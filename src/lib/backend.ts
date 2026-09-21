import type { Change, Workspace } from "../types";

/**
 * Where the workspace lives. In a plain browser it is local storage. When the
 * app is opened with `crm ui`, it is a folder on disk shared with the `crm`
 * command and MCP server, reached through the local API, and changes made by
 * agents stream in as they happen.
 */

declare global {
  interface Window {
    __OPEN_CRM__?: { backend?: "folder" };
  }
}

export const folderBacked = typeof window !== "undefined" && window.__OPEN_CRM__?.backend === "folder";

export interface FolderState {
  workspace: Workspace;
  rev: string;
  dir?: string;
  folder?: string;
  backupPath?: string;
}

export class BackendError extends Error {
  state?: FolderState;
  constructor(message: string, state?: FolderState) {
    super(message);
    this.name = "BackendError";
    this.state = state;
  }
}

async function call(path: string, init?: RequestInit): Promise<FolderState> {
  const response = await fetch(path, { ...init, headers: init?.body ? { "Content-Type": "application/json" } : undefined });
  const body = (await response.json().catch(() => null)) as (FolderState & { error?: { message: string } }) | null;
  if (!response.ok || !body) {
    throw new BackendError(body?.error?.message ?? "The workspace folder could not be reached.", body?.workspace ? body : undefined);
  }
  return body;
}

export const loadFolder = () => call("/api/workspace");

export const sendChange = (change: Change) => call("/api/changes", { method: "POST", body: JSON.stringify({ change }) });

export const sendDecision = (id: string, decision: "approve" | "reject") =>
  call("/api/proposals", { method: "POST", body: JSON.stringify({ id, decision }) });

export const replaceFolderWorkspace = (workspace: Workspace, baseRev: string) =>
  call("/api/workspace", { method: "PUT", body: JSON.stringify({ workspace, baseRev }) });

/** Call `onChange` whenever workspace.json changes on disk. Returns a stop function. */
export function watchFolder(onChange: (rev: string) => void, options: { onError?: (error: Error) => void; onReady?: () => void } = {}): () => void {
  const events = new EventSource("/api/events");
  events.onerror = () => options.onError?.(new BackendError("Workspace sync disconnected. Displayed records may be stale; reconnecting."));
  events.onmessage = (event) => {
    let message: { rev?: unknown; error?: { message?: string } };
    try {
      message = JSON.parse(event.data);
      if (!message || typeof message !== "object") throw new Error("Invalid sync event.");
      if (message.error) throw new Error(message.error.message || "Workspace sync is stale.");
      if (typeof message.rev !== "string" || !message.rev) throw new Error("Missing workspace revision in sync event.");
    } catch (error) {
      options.onError?.(new BackendError(`Workspace sync is stale or invalid: ${(error as Error).message}`));
      return;
    }
    options.onReady?.();
    onChange(message.rev as string);
  };
  return () => { events.onmessage = null; events.onerror = null; events.close(); };
}
