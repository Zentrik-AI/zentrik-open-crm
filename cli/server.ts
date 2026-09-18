import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApi } from "./api.ts";
import { StoreError } from "./store.ts";

/** `crm ui`: serve the built app and the workspace API on loopback. */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");

/** Tells the app, before it renders, that its records live in a folder. */
export const FOLDER_MARKER = `<script>window.__OPEN_CRM__={backend:"folder"}</script>`;

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function newestMtime(dir: string): number {
  let newest = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    newest = Math.max(newest, entry.isDirectory() ? newestMtime(full) : fs.statSync(full).mtimeMs);
  }
  return newest;
}

/** A clone has sources but no bundle; an installed package has the bundle
 *  but no sources. Build only when there are sources newer than the bundle. */
function ensureBuilt() {
  const index = path.join(DIST, "index.html");
  const src = path.join(ROOT, "src");
  const built = fs.existsSync(index);
  if (built && (!fs.existsSync(src) || newestMtime(src) <= fs.statSync(index).mtimeMs)) return;
  if (!fs.existsSync(src)) throw new StoreError("no_bundle", "The app bundle is missing. Reinstall Open CRM.");
  process.stderr.write(built ? "The app changed since the last build. Rebuilding…\n" : "Building the app (first run)…\n");
  try {
    execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build", "--silent"], { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
  } catch {
    throw new StoreError("build_failed", `Could not build the app. Run "npm install" then "npm run build" in ${ROOT}.`);
  }
}

function openBrowser(url: string) {
  const [command, args] =
    process.platform === "darwin" ? ["open", [url]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
  try {
    spawn(command as string, args as string[], { stdio: "ignore", detached: true }).on("error", () => {}).unref();
  } catch {
    /* the URL is printed either way */
  }
}

export async function serveUi(dir: string, options: { port?: number; open?: boolean } = {}) {
  ensureBuilt();
  const api = createApi(dir);

  const server = http.createServer(async (req, res) => {
    if (await api.handle(req, res)) return;
    const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
    let file = path.join(DIST, pathname);
    if (!file.startsWith(DIST + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, "index.html");
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream" });
    if (file.endsWith("index.html")) return res.end(fs.readFileSync(file, "utf8").replace("<head>", `<head>${FOLDER_MARKER}`));
    fs.createReadStream(file).pipe(res);
  });

  const wanted = options.port ?? 5178;
  const port = await new Promise<number>((resolve, reject) => {
    let attempt = wanted;
    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE" && !options.port && attempt < wanted + 20) server.listen(++attempt, "127.0.0.1");
      else reject(new StoreError("port_in_use", `Port ${attempt} is not available. Pass --port <number>.`));
    });
    server.on("listening", () => resolve(attempt));
    server.listen(attempt, "127.0.0.1");
  });

  const url = `http://127.0.0.1:${port}`;
  process.stdout.write(`Open CRM is serving ${dir}\n  ${url}\n\nChanges made by agents with ./crm appear here as they happen. Press Ctrl+C to stop.\n`);
  if (options.open !== false) openBrowser(url);

  const stop = () => {
    api.close();
    server.close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
