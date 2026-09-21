import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Workspace } from "../src/types.ts";
import { GENERATED_NOTICE, buildViewFiles, workspaceLayout } from "../src/core/markdown.ts";
import { normalizeWorkspace, parseWorkspace, validateWorkspace } from "../src/core/validate.ts";

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

function writeAtomic(file: string, content: string, beforeRename?: () => void) {
  const tmp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    const fd = fs.openSync(tmp, "wx", 0o600);
    try {
      fs.writeFileSync(fd, content);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    beforeRename?.();
    fs.renameSync(tmp, file);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

function sleep(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM and unknown errors are not proof that the owner has exited.
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

function releaseLock(lock: string, owner: string) {
  // Never recursively remove a lock: a successor may already own this path.
  try { fs.unlinkSync(path.join(lock, owner)); } catch { /* already released */ }
  try { fs.rmdirSync(lock); } catch { /* absent or a non-empty successor */ }
}

/** A local-process lock, not a network/shared-drive lease. Publish a complete
 * owner directory atomically, then reclaim only its exact dead-owner marker.
 * An old mtime never grants permission to steal a live process's lock. */
export function withWorkspaceLock<T>(dir: string, fn: () => T): T {
  const stateDir = path.join(dir, STATE_DIR);
  fs.mkdirSync(stateDir, { recursive: true });
  const lock = path.join(stateDir, LOCK_FILE);
  const owner = `${process.pid}-${randomUUID()}.json`;
  const candidate = fs.mkdtempSync(path.join(stateDir, "lock-candidate-"));
  fs.writeFileSync(path.join(candidate, owner), JSON.stringify({ pid: process.pid, token: owner }), { mode: 0o600 });
  const deadline = Date.now() + LOCK_WAIT_MS;
  try {
    for (;;) {
      try {
        fs.renameSync(candidate, lock);
        break;
      } catch (error) {
        if (!["EEXIST", "ENOTEMPTY", "ENOTDIR", "EISDIR", "EPERM"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error;
        try {
          const names = fs.readdirSync(lock);
          if (names.length === 1 && /^\d+-[a-f0-9-]+\.json$/.test(names[0])) {
            const marker = JSON.parse(fs.readFileSync(path.join(lock, names[0]), "utf8"));
            if (Number.isSafeInteger(marker.pid) && marker.pid > 0 && marker.token === names[0] && !processExists(marker.pid)) {
              releaseLock(lock, names[0]);
              continue;
            }
          } else if (names.length === 0) {
            // A holder may have exited between unlinking its marker and rmdir.
            try { fs.rmdirSync(lock); } catch { /* another contender acquired it */ }
          }
        } catch { /* released, legacy, or unreadable; never guess ownership */ }
        if (Date.now() > deadline) throw new StoreError("locked", "Workspace lock is held or has unknown ownership. Retry after the writer exits. For a legacy or damaged lock, stop all CRM writers before removing .open-crm/lock.");
        sleep(25);
      }
    }
    try { return fn(); } finally { releaseLock(lock, owner); }
  } finally {
    releaseLock(candidate, owner);
  }
}

function serialize(workspace: Workspace) {
  return `${JSON.stringify(workspace, null, 2)}\n`;
}

function readGeneratedView(file: string): string | null {
  const collision = (reason: string) => new StoreError("view_collision", `Cannot generate ${file}: ${reason}. Move the existing path to a safe location, then retry. Its contents have not been replaced.`);
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw collision("the existing path cannot be inspected");
  }
  if (!stat.isFile()) throw collision("the existing path is not a regular generated file");
  let content: string;
  try { content = fs.readFileSync(file, "utf8"); }
  catch { throw collision("the generated notice cannot be verified; check read permissions"); }
  // Keep accepting the original notice used by earlier workspace versions.
  if (!content.includes(GENERATED_NOTICE)) throw collision("the existing file has no Open CRM generated notice");
  return content;
}

/** Inspect every target before any canonical write, view write or orphan removal. */
function checkedViewFiles(dir: string, workspace: Workspace) {
  const files = buildViewFiles(workspace, workspaceLayout, true);
  for (const file of files) readGeneratedView(path.join(dir, file.path));
  return files;
}

/** Rewrite marked Markdown views and remove marked account files whose account
 * is gone. Refuse unmarked target files and leave unmarked orphans untouched. */
export function writeViews(dir: string, workspace: Workspace) {
  const files = checkedViewFiles(dir, workspace);
  const accountDir = path.join(dir, workspaceLayout.accountDir);
  fs.mkdirSync(accountDir, { recursive: true });
  const keep = new Set(files.map((file) => path.join(dir, file.path)));
  for (const entry of fs.readdirSync(accountDir, { withFileTypes: true })) {
    const full = path.join(accountDir, entry.name);
    if (!entry.isFile() || !entry.name.endsWith(".md") || keep.has(full)) continue;
    if (fs.readFileSync(full, "utf8").includes(GENERATED_NOTICE)) fs.rmSync(full);
  }
  for (const file of files) {
    const full = path.join(dir, file.path);
    const current = readGeneratedView(full);
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
  return commitWorkspace(dir, workspace);
}

function commitWorkspace(dir: string, workspace: Workspace, beforeCommit?: () => void): Loaded {
  const errors = validateWorkspace(workspace);
  if (errors.length) throw new StoreError("invalid_workspace", errors.slice(0, 5).join(" "));
  const normalized = normalizeWorkspace(workspace);
  const text = serialize(normalized);
  checkedViewFiles(dir, normalized);
  writeAtomic(path.join(dir, WORKSPACE_FILE), text, beforeCommit);
  writeViews(dir, normalized);
  return { workspace: normalized, rev: revOf(text) };
}

/** Read, change, and write under one lock. `fn` returns the next workspace
 *  plus whatever the caller wants back. Throwing leaves the file untouched. */
export function updateWorkspace<T>(dir: string, fn: (current: Loaded) => { workspace: Workspace; result: T }): { loaded: Loaded; result: T } {
  return withWorkspaceLock(dir, () => {
    const { workspace, result } = fn(readWorkspace(dir));
    return { loaded: writeWorkspace(dir, workspace), result };
  });
}

export class RevisionConflict extends StoreError {
  current: Loaded;
  constructor(current: Loaded) {
    super("conflict", "The workspace changed on disk. Review the latest records before replacing them.");
    this.current = current;
  }
}

/** Whole-workspace import/reset only. Ordinary operations use updateWorkspace.
 * Missing or initially stale revisions fail before backup or mutation. A later
 * conflict can leave a backup but does not commit the replacement. The immutable
 * backup contains the exact previous file, including fields normalization would change. */
export function replaceWorkspace(dir: string, workspace: Workspace, baseRev: string): Loaded & { backupPath: string } {
  if (typeof baseRev !== "string" || !baseRev.trim()) throw new StoreError("base_rev_required", "A baseRev from the last workspace read is required.");
  const errors = validateWorkspace(workspace);
  if (errors.length) throw new StoreError("invalid_workspace", errors.slice(0, 5).join(" "));
  return withWorkspaceLock(dir, () => {
    const current = readWorkspace(dir);
    if (current.rev !== baseRev) throw new RevisionConflict(current);
    const previous = fs.readFileSync(path.join(dir, WORKSPACE_FILE), "utf8");
    // Detect an editor write between the two reads too. Editors do not take our lock.
    if (revOf(previous) !== baseRev) throw new RevisionConflict(readWorkspace(dir));
    const backupDir = path.join(dir, STATE_DIR, "backups");
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    const backupPath = path.join(backupDir, `${baseRev}.json`);
    if (fs.existsSync(backupPath)) {
      if (fs.readFileSync(backupPath, "utf8") !== previous) throw new StoreError("backup_conflict", "The existing revision backup differs. Replacement was stopped.");
    } else {
      writeAtomic(backupPath, previous);
    }
    const loaded = commitWorkspace(dir, workspace, () => {
      // Recheck after backup creation and staging, immediately before rename.
      // This is not an OS atomic compare-and-swap: an arbitrary editor can still
      // write between this read and rename without taking the workspace lock.
      const latest = readWorkspace(dir);
      if (latest.rev !== baseRev) throw new RevisionConflict(latest);
    });
    return { ...loaded, backupPath };
  });
}

/** Restore one explicit backup, never guess 'latest'. This also backs up the
 * current valid workspace and requires its current revision. */
export function restoreWorkspace(dir: string, backupRev: string, baseRev: string): Loaded & { backupPath: string } {
  if (typeof baseRev !== "string" || !baseRev.trim()) throw new StoreError("base_rev_required", "A baseRev from the last workspace read is required.");
  if (!/^[a-f0-9]{12}$/.test(backupRev)) throw new StoreError("bad_request", "Invalid backup revision.");
  let text: string;
  try { text = fs.readFileSync(path.join(dir, STATE_DIR, "backups", `${backupRev}.json`), "utf8"); }
  catch { throw new StoreError("invalid_backup", "Cannot read the requested revision backup."); }
  if (revOf(text) !== backupRev) throw new StoreError("invalid_backup", "Backup content does not match its revision.");
  const { workspace, errors } = parseWorkspace(text);
  if (!workspace) throw new StoreError("invalid_backup", errors.join(" "));
  return replaceWorkspace(dir, workspace, baseRev);
}

/** crm check --fix must reload under the write lock, not publish stale views. */
export function repairViews(dir: string): Loaded {
  return withWorkspaceLock(dir, () => {
    const loaded = readWorkspace(dir);
    writeViews(dir, loaded.workspace);
    return loaded;
  });
}
