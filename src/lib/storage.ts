import { seedWorkspace } from "../data/seed";
import type { Workspace } from "../types";

const STORAGE_KEY = "zentrik-open-crm.workspace.v2";

export function touchWorkspace(workspace: Workspace): Workspace {
  return { ...workspace, updatedAt: new Date().toISOString() };
}

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
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  } catch {
    // Local storage can be unavailable in restricted browser contexts.
  }
}

export function resetWorkspace() {
  window.localStorage.removeItem(STORAGE_KEY);
  return touchWorkspace(seedWorkspace);
}
