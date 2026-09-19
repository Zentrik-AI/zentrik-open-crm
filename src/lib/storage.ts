import { seedWorkspace } from "../data/seed";
import { createDemoWorkspace } from "../core/demo.ts";
import type { Workspace } from "../types";

export { createDemoWorkspace };

const STORAGE_KEY = "zentrik-open-crm.workspace.v2";

export function hasStoredWorkspace() {
  return typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY) !== null;
}

export function touchWorkspace(workspace: Workspace): Workspace {
  return { ...workspace, updatedAt: new Date().toISOString() };
}

export function loadWorkspace(): Workspace {
  if (typeof window === "undefined") {
    return seedWorkspace;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return createDemoWorkspace();
  }

  try {
    return JSON.parse(stored) as Workspace;
  } catch {
    return createDemoWorkspace();
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
  return createDemoWorkspace();
}
