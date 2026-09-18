import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Workspace } from "../src/types.ts";
import { GENERATED_NOTICE, buildViewFiles, workspaceLayout } from "../src/core/markdown.ts";
import { normalizeWorkspace, parseWorkspace } from "../src/core/validate.ts";

/**
 * A workspace folder on disk. `workspace.json` is the source of truth; the
 * Markdown under `accounts/` and `INDEX.md` are views regenerated on every
 * write. The app's local server, the `crm` command, and the MCP server all
 * read and write through this module, one short lock at a time.
 */

export const WORKSPACE_FILE = "workspace.json";
const STATE_DIR = ".open-crm";
const LOCK_FILE = "lock";
const LOCK_WAIT_MS = 3000;
const LOCK_STALE_MS = 10_000;

export class StoreError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "StoreError";
    this.code = code;
  }
}

/** Walk up from `start` to the nearest folder holding a workspace.json. */
export function findWorkspaceDir(start: string): string | null {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, WORKSPACE_FILE))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function resolveWorkspaceDir(explicit?: string): string {
  const candidate = explicit ?? process.env.OPEN_CRM_WORKSPACE;
  if (candidate) {
    const dir = path.resolve(candidate);
    if (!fs.existsSync(path.join(dir, WORKSPACE_FILE))) {
      throw new StoreError("no_workspace", `No ${WORKSPACE_FILE} in ${dir}. Create one with: crm init ${candidate}`);
    }
    return dir;
  }
  const found = findWorkspaceDir(process.cwd());
  if (!found) throw new StoreError("no_workspace", `No workspace here. Create one with "crm init <folder>", or pass --workspace <folder>.`);
  return found;
}

const revOf = (text: string) => createHash("sha1").update(text).digest("hex").slice(0, 12);

export interface Loaded {
  workspace: Workspace;
  /** Content hash of workspace.json. Changes whenever anyone changes the file. */
  rev: string;
}

export function readWorkspace(dir: string): Loaded {
  const file = path.join(dir, WORKSPACE_FILE);
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    throw new StoreError("no_workspace", `Cannot read ${file}.`);
  }
  const { workspace, errors } = parseWorkspace(text);
  if (!workspace) {
    throw new StoreError("invalid_workspace", `${file} is not a valid workspace:\n${errors.slice(0, 12).map((e) => `  - ${e}`).join("\n")}`);
  }
  return { workspace, rev: revOf(text) };
}

function writeAtomic(file: string, content: string) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

function sleep(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function withLock<T>(dir: string, fn: () => T): T {
  const stateDir = path.join(dir, STATE_DIR);
  fs.mkdirSync(stateDir, { recursive: true });
  const lock = path.join(stateDir, LOCK_FILE);
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      fs.closeSync(fs.openSync(lock, "wx"));
      break;
    } catch {
      try {
        if (Date.now() - fs.statSync(lock).mtimeMs > LOCK_STALE_MS) fs.rmSync(lock, { force: true });
      } catch {
        /* the holder released it between our two calls */
      }
      if (Date.now() > deadline) throw new StoreError("locked", "Another process is writing this workspace. Try again in a moment.");
      sleep(25);
    }
  }
  try {
    return fn();
  } finally {
    fs.rmSync(lock, { force: true });
  }
}

function serialize(workspace: Workspace) {
  return `${JSON.stringify(workspace, null, 2)}\n`;
}

/** Rewrite the Markdown views and remove generated account files whose
 *  account is gone. Files a person wrote by hand are never touched. */
export function writeViews(dir: string, workspace: Workspace) {
  const files = buildViewFiles(workspace, workspaceLayout, true);
  const accountDir = path.join(dir, workspaceLayout.accountDir);
  fs.mkdirSync(accountDir, { recursive: true });
  const keep = new Set(files.map((file) => path.join(dir, file.path)));
  for (const name of fs.readdirSync(accountDir)) {
    const full = path.join(accountDir, name);
    if (!name.endsWith(".md") || keep.has(full)) continue;
    if (fs.readFileSync(full, "utf8").includes(GENERATED_NOTICE)) fs.rmSync(full);
  }
  for (const file of files) {
    const full = path.join(dir, file.path);
    let current: string | null = null;
    try {
      current = fs.readFileSync(full, "utf8");
    } catch {
      /* new file */
    }
    if (current !== file.content) writeAtomic(full, file.content);
  }
}

/** Names of generated views that no longer match workspace.json. */
export function staleViews(dir: string, workspace: Workspace): string[] {
  return buildViewFiles(workspace, workspaceLayout, true)
    .filter((file) => {
      try {
        return fs.readFileSync(path.join(dir, file.path), "utf8") !== file.content;
      } catch {
        return true;
      }
    })
    .map((file) => file.path);
}

export function writeWorkspace(dir: string, workspace: Workspace): Loaded {
  const normalized = normalizeWorkspace(workspace);
  const text = serialize(normalized);
  writeAtomic(path.join(dir, WORKSPACE_FILE), text);
  writeViews(dir, normalized);
  return { workspace: normalized, rev: revOf(text) };
}

/** Read, change, and write under one lock. `fn` returns the next workspace
 *  plus whatever the caller wants back. Throwing leaves the file untouched. */
export function updateWorkspace<T>(dir: string, fn: (current: Loaded) => { workspace: Workspace; result: T }): { loaded: Loaded; result: T } {
  return withLock(dir, () => {
    const { workspace, result } = fn(readWorkspace(dir));
    return { loaded: writeWorkspace(dir, workspace), result };
  });
}
