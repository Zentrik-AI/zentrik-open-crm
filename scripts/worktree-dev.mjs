#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = process.env.ZENTRIK_WORKTREE_MANIFEST || path.join(repoRoot, ".zentrik-worktree.json");
const profilePath = path.join(repoRoot, ".zentrik", "worktree.json");
const statePath = path.join(repoRoot, "tmp", "worktree-runtime.json");

function readJson(candidate) {
  try {
    return JSON.parse(fs.readFileSync(candidate, "utf8"));
  } catch {
    return null;
  }
}

const manifest = readJson(manifestPath);
const profile = readJson(profilePath);
if (!manifest || !profile) {
  console.error("Worktree manifest or repository profile is missing. Run the shared worktree prepare command.");
  process.exit(2);
}

function gitValue(...args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

function expectedComposeProject(repository, branch, identity) {
  const slug = String(branch).replace(/[^a-zA-Z0-9_-]+/g, "_");
  return `${repository}_${slug}_${identity.slice(0, 8)}`
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "")
    .slice(0, 63)
    .replace(/[_-]+$/g, "");
}

function validateManifestIdentity() {
  const commonDir = path.resolve(gitValue("rev-parse", "--path-format=absolute", "--git-common-dir"));
  const branch = gitValue("rev-parse", "--abbrev-ref", "HEAD");
  const identity = createHash("sha256").update(`${commonDir}\0${repoRoot}`).digest("hex").slice(0, 16);
  const expectedProject = expectedComposeProject(profile.id, branch, identity);
  if (
    manifest.primary ||
    manifest.identity !== identity ||
    manifest.repository !== profile.id ||
    path.resolve(manifest.repoRoot || "") !== repoRoot ||
    manifest.branch !== branch ||
    manifest.composeProject !== expectedProject
  ) {
    throw new Error("Worktree manifest identity is stale or invalid. Run the shared worktree prepare command.");
  }
}

function atomicWrite(candidate, value) {
  fs.mkdirSync(path.dirname(candidate), { recursive: true });
  const temporary = `${candidate}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, candidate);
}

function selectedProfile() {
  const index = process.argv.indexOf("--profile");
  return (index >= 0 ? process.argv[index + 1] : process.env.ZENTRIK_WORKTREE_PROFILE) || profile.runtime.defaultProfile;
}

function portListening(port) {
  return new Promise((resolve) => {
    const socket = net.connect(Number(port), "127.0.0.1");
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(600, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function portAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen({ port: Number(port), host: "127.0.0.1" });
  });
}

function httpReady(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 400);
    });
    request.once("error", () => resolve(false));
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForUrl(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await httpReady(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Open CRM sandbox did not become ready at ${url}.`);
}

function processCommand(pid) {
  try {
    return execFileSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function processAlive(pid) {
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch {
    return false;
  }
}

function ownedProcess(state) {
  const command = processCommand(state.pid);
  return command.includes(repoRoot) && command.includes("vite");
}

function stopProcess(state) {
  if (!state?.pid || !processAlive(state.pid)) return;
  if (!ownedProcess(state)) {
    throw new Error(`Refusing to stop PID ${state.pid}; it is not the recorded Open CRM Vite process.`);
  }
  try {
    process.kill(-Number(state.pid), "SIGTERM");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

async function up() {
  const requested = selectedProfile();
  if (!profile.runtime.profiles[requested]) {
    throw new Error(`Unknown runtime profile ${requested}. Choose: ${Object.keys(profile.runtime.profiles).join(", ")}`);
  }
  if (readJson(statePath)) throw new Error("This worktree already records a runtime. Run info or down first.");
  const port = manifest.ports.frontend;
  if (!port || !(await portAvailable(port))) throw new Error(`Assigned frontend port ${port} is occupied.`);
  const viteEntry = path.join(repoRoot, "node_modules", "vite", "bin", "vite.js");
  if (!fs.existsSync(viteEntry)) throw new Error("Vite is not installed. Run npm ci in the sandbox worktree.");
  const child = spawn(process.execPath, [viteEntry, "--host", "127.0.0.1", "--port", String(port)], {
    cwd: repoRoot,
    detached: true,
    stdio: "ignore",
    env: { ...process.env, BROWSER: "none", ZENTRIK_OPEN_CRM_ENVIRONMENT: "sandbox" },
  });
  child.unref();
  const state = {
    version: 1,
    identity: manifest.identity,
    worktree: repoRoot,
    branch: manifest.branch,
    profile: requested,
    pid: child.pid,
    startedAt: new Date().toISOString(),
    url: `http://127.0.0.1:${port}`,
  };
  atomicWrite(statePath, state);
  try {
    await waitForUrl(`${state.url}/`);
  } catch (error) {
    try {
      stopProcess(state);
    } finally {
      fs.rmSync(statePath, { force: true });
    }
    throw error;
  }
  console.log(`Started Open CRM ${requested} sandbox for ${manifest.branch} at ${state.url}.`);
}

async function info() {
  const state = readJson(statePath);
  if (!state) {
    console.log(`Runtime stopped. Available profiles: ${Object.keys(profile.runtime.profiles).join(", ")}`);
    return;
  }
  console.log(`open-crm runtime [${state.profile}] - branch ${state.branch}`);
  console.log(`  url       ${state.url} (${processAlive(state.pid) && await httpReady(`${state.url}/`) ? "up" : "DOWN"})`);
  console.log(`  pid       ${state.pid}`);
  console.log("  stop      zentrik-agent-workflows/bin/zentrik-worktree --repo . down");
}

function down() {
  const state = readJson(statePath);
  if (!state) {
    console.log("No runtime is recorded for this worktree.");
    return;
  }
  stopProcess(state);
  fs.rmSync(statePath, { force: true });
  console.log(`Stopped Open CRM ${state.profile} sandbox for ${state.branch}.`);
}

const command = process.argv[2];
try {
  validateManifestIdentity();
  if (command === "up") await up();
  else if (command === "info") await info();
  else if (command === "down" || command === "clean") down();
  else throw new Error("Usage: worktree-dev.mjs <up|info|down|clean> [--profile sandbox]");
} catch (error) {
  console.error(`Open CRM worktree runtime: ${error.message}`);
  process.exitCode = 2;
}
