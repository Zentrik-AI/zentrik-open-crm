import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const readJson = file => JSON.parse(fs.readFileSync(file, "utf8"));
const licenseMarkers = {
  MIT: /Permission is hereby granted/i,
  ISC: /Permission to use, copy, modify, and(?:\/or)? distribute/i,
  "OFL-1.1": /SIL OPEN FONT LICENSE Version 1\.1/i,
};

// Use the locked production graph, including transitive dependencies. Do not
// silently omit an unavailable package, optional dependency, or license file.
export function renderNotices(directory = root) {
  const manifest = readJson(path.join(directory, "package.json"));
  const lock = readJson(path.join(directory, "package-lock.json"));
  if (!lock.packages?.[""]) throw new Error("A package-lock with a packages map is required.");
  for (const field of ["dependencies", "optionalDependencies"]) {
    const declared = manifest[field] ?? {};
    const locked = lock.packages[""][field] ?? {};
    if (Object.keys(declared).length !== Object.keys(locked).length ||
        Object.entries(declared).some(([name, version]) => locked[name] !== version)) {
      throw new Error(`package-lock.json does not match package.json ${field}.`);
    }
  }
  const packages = Object.entries(lock.packages).filter(([location, entry]) => location && !entry.dev)
    .sort(([a], [b]) => compare(a, b));
  if (!packages.length) throw new Error("No locked production dependencies found.");
  for (const [location, entry] of [["", lock.packages[""]], ...packages]) {
    for (const name of Object.keys({ ...entry.dependencies, ...entry.optionalDependencies })) {
      let parent = location;
      let found = false;
      while (true) {
        const candidate = lock.packages[path.posix.join(parent, "node_modules", name)];
        if (candidate && !candidate.dev) { found = true; break; }
        if (!parent) break;
        const next = path.posix.dirname(parent);
        parent = next === "." ? "" : next;
      }
      if (!found) throw new Error(`Missing production dependency in lock: ${location || "package.json"} -> ${name}`);
    }
  }
  const sections = packages.map(([location, entry]) => {
    if (!location.startsWith("node_modules/") || location.split("/").includes("..") || entry.link) {
      throw new Error(`Unsupported dependency location: ${location}`);
    }
    const dir = path.join(directory, location);
    const installed = readJson(path.join(dir, "package.json"));
    const name = location.split("node_modules/").at(-1);
    if (installed.name !== name || installed.version !== entry.version || installed.license !== entry.license) {
      throw new Error(`Installed metadata does not match lock: ${location}`);
    }
    const marker = licenseMarkers[entry.license];
    if (!marker) throw new Error(`License needs explicit review: ${location}`);
    const files = fs.readdirSync(dir).filter(file => /^(licen[sc]e|copying|ofl|notice)(?:[.-].*)?$/i.test(file)).sort(compare);
    const texts = files.map(file => {
      const text = fs.readFileSync(path.join(dir, file), "utf8").replace(/\r\n?/g, "\n").trim();
      if (!text || text.includes("\0")) throw new Error(`Empty or invalid notice: ${location}/${file}`);
      return { file, text };
    });
    if (!texts.some(({ file, text }) => !/^notice/i.test(file) && marker.test(text) && /copyright/i.test(text))) {
      throw new Error(`Missing or incomplete license text: ${location}`);
    }
    if (name.startsWith("@fontsource")) {
      if (entry.license !== "OFL-1.1" || !fs.readdirSync(path.join(dir, "files")).some(file => /\.woff2?$/.test(file))) {
        throw new Error(`Font files or OFL license missing: ${location}`);
      }
    }
    return [`${name}@${entry.version}`, `License: ${entry.license}`, `Package: ${location}`,
      ...texts.flatMap(({ file, text }) => ["", `--- ${file} ---`, text])].join("\n");
  });
  return ["Zentrik Open CRM — Third-party notices", "",
    "Generated from package-lock.json and installed production dependency license files.",
    "Includes transitive runtime dependencies and bundled font licenses.",
    "Third-party components retain their respective licenses and copyright notices.",
    "This inventory does not certify build-tool licensing or legal release approval.",
    "", sections.join("\n\n" + "=".repeat(72) + "\n\n"), ""].join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.some(arg => !["--check", "--dist"].includes(arg))) throw new Error("Usage: node scripts/third-party-notices.mjs [--check] [--dist]");
    const text = renderNotices();
    const targets = [path.join(root, "THIRD_PARTY_NOTICES.txt")];
    if (args.includes("--dist")) {
      if (!fs.statSync(path.join(root, "dist")).isDirectory()) throw new Error("Build dist before generating bundle notices.");
      targets.push(path.join(root, "dist/THIRD_PARTY_NOTICES.txt"));
    }
    for (const target of targets) {
      if (args.includes("--check")) {
        if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== text) throw new Error(`Missing or stale notices: ${path.relative(root, target)}`);
      } else fs.writeFileSync(target, text);
    }
    console.log(`Third-party notices ${args.includes("--check") ? "verified" : "generated"}: ${targets.length} file(s).`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
