import { createDemoWorkspace } from "../core/demo.ts";
import { normalizeWorkspace, parseWorkspace, validateWorkspace } from "../core/validate.ts";
import type { Workspace } from "../types";

export { createDemoWorkspace };

const STORAGE_KEY = "zentrik-open-crm.workspace.v2";
let issue: string | null = null;
let blocked: string | null = null;

export const getStorageIssue = (): string | null => issue;

function storage(): Storage {
  if (typeof window === "undefined") throw new Error("Browser storage is unavailable.");
  return window.localStorage;
}

function fail(message: string, protect = false): string {
  issue = message;
  if (protect) blocked = message;
  return message;
}

function unavailable(): Workspace {
  // A renderable placeholder, never sample records presented as recovered data.
  return normalizeWorkspace({ name: "Workspace unavailable — recovery required", accounts: [], deals: [], tasks: [], notes: [] } as unknown as Workspace);
}

/** Raw bytes for a recovery download, not parsed or normalized. Access errors
 * are thrown so callers cannot label an empty download as a successful backup. */
export function getStoredWorkspaceText(): string | null {
  try { return storage().getItem(STORAGE_KEY); }
  catch { throw new Error(fail("Cannot read browser storage. Saved records have not been replaced.", true)); }
}

export function hasStoredWorkspace() {
  try {
    const raw = getStoredWorkspaceText();
    if (raw === null) return false;
    if (parseWorkspace(raw).workspace) return true;
    fail("Stored workspace is invalid. The original is preserved; use explicit import or reset recovery.", true);
  } catch { /* getStoredWorkspaceText records the error */ }
  return false;
}

export function touchWorkspace(workspace: Workspace): Workspace {
  return { ...workspace, updatedAt: new Date().toISOString() };
}

export function loadWorkspace(): Workspace {
  issue = null;
  blocked = null;
  try {
    const stored = getStoredWorkspaceText();
    if (stored === null) return createDemoWorkspace();
    const parsed = parseWorkspace(stored);
    if (parsed.workspace) return parsed.workspace;
    fail("Stored workspace is invalid. The original is preserved; use explicit import or reset recovery.", true);
  } catch {
    // The storage-access error remains visible, and automatic saves stay blocked.
  }
  return unavailable();
}

/** Automatic saves never recover/replace unreadable data. A returned error
 * means the UI must keep an unsaved warning; success is exactly null. */
export function saveWorkspace(workspace: Workspace): string | null {
  if (blocked) return fail(blocked);
  try {
    const local = storage();
    const raw = local.getItem(STORAGE_KEY);
    if (raw !== null && !parseWorkspace(raw).workspace) return fail("Stored workspace became invalid. Automatic saving is blocked to preserve the original.", true);
    const errors = validateWorkspace(workspace);
    if (errors.length) return fail(`Workspace was not saved: ${errors[0]}`);
    local.setItem(STORAGE_KEY, JSON.stringify(workspace));
    issue = null;
    return null;
  } catch {
    return fail("Workspace changes were not saved. Browser storage is unavailable or full. Export your in-memory work before leaving.");
  }
}

/** Explicit import/reset only. Preserve exact prior bytes under a new backup
 * key before replacement. If backup storage is full, callers may first download
 * getStoredWorkspaceText(), then pass those exact bytes as downloadedOriginal.
 * This option is a human-confirmed download receipt, never an automatic bypass.
 * A read failure always prevents replacement, even with a download receipt. */
export function recoverWorkspace(workspace: Workspace, options: { downloadedOriginal?: string } = {}): { error: string | null; backupKey: string | null } {
  let backupKey: string | null = null;
  try {
    const errors = validateWorkspace(workspace);
    if (errors.length) return { error: fail(`Recovery workspace is invalid: ${errors[0]}`), backupKey };
    const local = storage();
    const raw = local.getItem(STORAGE_KEY);
    const serialized = JSON.stringify(normalizeWorkspace(workspace));
    if (raw !== null) {
      if (options.downloadedOriginal !== undefined) {
        if (options.downloadedOriginal !== raw) return { error: fail("Stored data changed since the recovery download. Download the current original before retrying."), backupKey };
      } else {
        // Never replace a previous recovery backup, including after a failed save.
        let index = 1;
        while (local.getItem(`${STORAGE_KEY}.recovery.${index}`) !== null) index++;
        const key = `${STORAGE_KEY}.recovery.${index}`;
        local.setItem(key, raw);
        if (local.getItem(key) !== raw) throw new Error("Backup verification failed.");
        backupKey = key;
      }
    }
    // Also reject a detectable interleaved write before replacing the original.
    if (local.getItem(STORAGE_KEY) !== raw) return { error: fail("Stored data changed during recovery. Reload and review before retrying."), backupKey };
    local.setItem(STORAGE_KEY, serialized);
    blocked = null;
    issue = null;
    return { error: null, backupKey };
  } catch {
    return { error: fail("Recovery did not complete. Keep the original; allow browser storage or download its exact text before retrying."), backupKey };
  }
}

/** Throws on failure: callers must not display the demo as a successful reset. */
export function resetWorkspace(): Workspace {
  const workspace = createDemoWorkspace();
  const { error } = recoverWorkspace(workspace);
  if (error) throw new Error(error);
  return workspace;
}
