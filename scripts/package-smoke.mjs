import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const scratch = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "open-crm-package-")));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const env = { ...process.env, OPEN_CRM_ACTOR: "package-smoke" };
delete env.OPEN_CRM_WORKSPACE;
delete env.NODE_PATH;
// npm run adds the checkout's dev tools to PATH. Do not lend them to the install.
env.PATH = (env.PATH ?? "").split(path.delimiter).filter(p => !p.replaceAll("\\", "/").includes("node_modules/.bin")).join(path.delimiter);

function run(command, args, cwd, options = {}) {
  const result = spawnSync(command, args, { cwd, env, encoding: "utf8", timeout: 180_000, maxBuffer: 8 * 1024 * 1024, ...options });
  assert.equal(result.status, 0, `${command} ${args.join(" ")}\n${result.error ?? result.stderr}\n${result.stdout}`);
  return result.stdout;
}

async function stop(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  const deadline = setTimeout(() => child.kill("SIGKILL"), 3_000);
  try { await exited; } finally { clearTimeout(deadline); }
}

let server;
try {
  console.log("Package smoke: pack with prepack build.");
  run(npm, ["pack", "--pack-destination", scratch], root);
  const archives = fs.readdirSync(scratch).filter(name => name.endsWith(".tgz"));
  assert.equal(archives.length, 1);
  const archive = path.join(scratch, archives[0]);
  const digest = createHash("sha256").update(fs.readFileSync(archive)).digest("hex");
  const install = path.join(scratch, "production install");
  fs.mkdirSync(install);
  fs.writeFileSync(path.join(install, "package.json"), '{"name":"open-crm-package-smoke","private":true}\n');
  console.log("Package smoke: install tarball with production dependencies and install scripts disabled.");
  run(npm, ["install", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false", archive], install);
  const pkg = path.join(install, "node_modules", manifest.name);
  const bin = path.join(pkg, manifest.bin["open-crm"]);
  for (const file of [manifest.bin["open-crm"], "dist/runtime/cli/main.js", "dist/index.html", "cli/main.ts", "src/core/ops.ts", "docs/agent-setup.md", "docs/agent-routines.md", "LICENSE", "NOTICE", "TRADEMARKS.md", "docs/licensing-and-ip.md"]) {
    assert.ok(fs.existsSync(path.join(pkg, file)), `tarball is missing ${file}`);
  }
  assert.ok(!fs.existsSync(path.join(pkg, "vite.config.ts")), "build configuration must remain checkout-only");
  const tree = JSON.parse(run(npm, ["ls", "--all", "--omit=dev", "--json"], install));
  function checkDependencies(node) {
    for (const [name, dependency] of Object.entries(node.dependencies ?? {})) {
      assert.ok(!["vite", "typescript", "@playwright/test"].includes(name), `unexpected dev dependency: ${name}`);
      checkDependencies(dependency);
    }
  }
  checkDependencies(tree);
  const shim = path.join(install, "node_modules/.bin/open-crm");
  const help = process.platform === "win32" ? run(process.execPath, [bin, "help"], install) : run(shim, ["help"], install);
  assert.match(help, /setup/);

  console.log("Package smoke: cold-start setup, dated proposals, repeat runs and refresh preservation.");
  const onboarding = run(process.execPath, ["--test", "--test-concurrency=1", path.join(root, "tests/unit/agent-onboarding.test.ts")], install,
    { env: { ...env, OPEN_CRM_TEST_BIN: bin } });
  process.stdout.write(onboarding);
  const workspace = path.join(scratch, "ui workspace");
  run(process.execPath, [bin, "init", workspace, "--demo"], install);
  const cli = (...args) => run(process.execPath, [bin, "--workspace", workspace, ...args], install);
  const records = fs.readFileSync(path.join(workspace, "workspace.json"), "utf8");
  const mcp = run(process.execPath, [bin, "--workspace", workspace, "mcp"], install, { input: [
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", clientInfo: { name: "package-smoke" }, capabilities: {} } },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "crm_status", arguments: {} } },
  ].map(message => JSON.stringify(message)).join("\n") + "\n" });
  const replies = mcp.trim().split("\n").map(line => JSON.parse(line));
  assert.equal(replies.length, 3);
  for (const reply of replies) assert.ok(reply.result && !reply.error && !reply.result.isError, JSON.stringify(reply));
  assert.equal(replies.find(reply => reply.id === 1).result.serverInfo.name, "open-crm");
  assert.ok(replies.find(reply => reply.id === 2).result.tools.some(tool => tool.name === "crm_add_note"));

  // Defeat archive timestamp coincidences: shipped CLI sources can be newer than dist.
  const index = path.join(pkg, "dist/index.html");
  const htmlBefore = fs.readFileSync(index, "utf8");
  const newer = new Date(fs.statSync(index).mtimeMs + 60_000);
  fs.utimesSync(path.join(pkg, "src/types.ts"), newer, newer);
  console.log("Package smoke: serve bundled HTML/assets and workspace API without a rebuild.");
  server = spawn(process.execPath, [bin, "--workspace", workspace, "ui", "--no-open", "--port", "0"], { cwd: install, env, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  server.stderr.on("data", chunk => { stderr += chunk; });
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`UI startup timed out\n${stdout}\n${stderr}`)), 15_000);
    server.once("error", error => { clearTimeout(timer); reject(error); });
    server.once("exit", code => { clearTimeout(timer); reject(new Error(`UI exited (${code})\n${stdout}\n${stderr}`)); });
    server.stdout.on("data", chunk => {
      stdout += chunk;
      const match = stdout.match(/http:\/\/127\.0\.0\.1:([1-9]\d*)(?=\s)/);
      if (match) { clearTimeout(timer); resolve(match[0]); }
    });
  });
  const get = async pathname => {
    const response = await fetch(new URL(pathname, url), { signal: AbortSignal.timeout(5_000) });
    assert.equal(response.status, 200, pathname);
    return response;
  };
  const html = await (await get("/")).text();
  assert.ok(html.includes('window.__OPEN_CRM__={backend:"folder"}'));
  const assets = [...html.matchAll(/(?:src|href)="([^\"]+\.(?:js|css))"/g)].map(match => match[1]);
  assert.ok(assets.some(asset => asset.endsWith(".js")) && assets.some(asset => asset.endsWith(".css")));
  for (const asset of assets) {
    const response = await get(asset);
    assert.match(response.headers.get("content-type") ?? "", asset.endsWith(".js") ? /javascript/ : /text\/css/);
    assert.ok((await response.text()).length > 0);
  }
  const api = await (await get("/api/workspace")).json();
  assert.deepEqual(api.workspace, JSON.parse(records));
  assert.equal(JSON.parse(cli("check", "--json")).ok, true);
  assert.equal(fs.readFileSync(index, "utf8"), htmlBefore);
  assert.doesNotMatch(stderr, /[Bb]uilding|[Rr]ebuilding/);
  await stop(server);
  server = undefined;

  // An incomplete installed package needs reinstall guidance, not a dev-tool build.
  fs.renameSync(index, `${index}.smoke-backup`);
  const missing = spawnSync(process.execPath, [bin, "--workspace", workspace, "ui", "--no-open"], { cwd: install, env, encoding: "utf8", timeout: 10_000 });
  assert.equal(missing.status, 2, missing.stderr);
  assert.match(missing.stderr, /bundle is missing.*Reinstall Open CRM/);
  assert.doesNotMatch(missing.stderr, /[Bb]uilding|[Rr]ebuilding/);
  assert.equal(fs.readFileSync(path.join(workspace, "workspace.json"), "utf8"), records);
  console.log(`Package smoke passed: ${archives[0]} sha256=${digest}`);
} finally {
  try { if (server) await stop(server); }
  finally { fs.rmSync(scratch, { recursive: true, force: true }); }
}
