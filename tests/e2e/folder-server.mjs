// Starts the app on a fresh demo workspace folder for the "folder" e2e project.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const port = process.argv[2] ?? "5178";
export const workspaceDir = path.join(root, "test-results", "folder-workspace");

fs.rmSync(workspaceDir, { recursive: true, force: true });
execFileSync(process.execPath, [path.join(root, "bin", "open-crm.js"), "init", workspaceDir, "--demo", "--name", "Folder workspace"], { stdio: "inherit" });

const vite = spawn(process.execPath, [path.join(root, "node_modules", "vite", "bin", "vite.js"), "--port", port, "--strictPort"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, OPEN_CRM_WORKSPACE: workspaceDir, OPEN_CRM_PORT: port },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => vite.kill(signal));
vite.on("exit", (code) => process.exit(code ?? 0));
