import { seedWorkspace } from "../data/seed";
import type { Workspace } from "../types";

const STORAGE_KEY = "zentrik-open-crm.workspace.v1";

export function loadWorkspace(): Workspace {
  if (typeof window === "undefined") {
    return seedWorkspace;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return seedWorkspace;
  }

  try {
    return JSON.parse(stored) as Workspace;
  } catch {
    return seedWorkspace;
  }
}

export function saveWorkspace(workspace: Workspace) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...workspace, updatedAt: new Date().toISOString() }),
  );
}

export function resetWorkspace() {
  window.localStorage.removeItem(STORAGE_KEY);
  return seedWorkspace;
}
