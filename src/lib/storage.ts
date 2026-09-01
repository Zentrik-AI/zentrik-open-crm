import { seedWorkspace } from "../data/seed";
import type { Workspace } from "../types";

const STORAGE_KEY = "zentrik-open-crm.workspace.v2";

export function hasStoredWorkspace() {
  return typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY) !== null;
}

/** Keep a new demo active and believable instead of letting fixed seed dates decay. */
export function createDemoWorkspace(): Workspace {
  const demo = structuredClone(seedWorkspace);
  const atDay = (offset: number, hour = 12) => {
    const value = new Date();
    value.setHours(hour, 0, 0, 0);
    value.setDate(value.getDate() + offset);
    return value.toISOString();
  };
  const taskDueOffsets = [1, -1, 2, 5, 3, -4, -6];
  const dealCloseOffsets = [14, 24, 10, 5, 18, 35, -42];
  const noteOffsets = [-1, -3, -2, -7, -4, -9, -6];

  demo.updatedAt = new Date().toISOString();
  demo.accounts = demo.accounts.map((account, index) => ({
    ...account,
    createdAt: atDay(-120 - index * 24),
    lastTouch: atDay(-1 - index),
    contacts: account.contacts.map((contact, contactIndex) => ({ ...contact, lastSeen: atDay(-1 - index - contactIndex) })),
  }));
  demo.deals = demo.deals.map((deal, index) => ({ ...deal, createdAt: atDay(-35 - index * 4), closeDate: atDay(dealCloseOffsets[index] ?? 30) }));
  demo.tasks = demo.tasks.map((task, index) => ({
    ...task,
    createdAt: atDay(-8 - index),
    due: atDay(taskDueOffsets[index] ?? 3, 17),
    completedAt: task.completedAt ? atDay(-2 - index) : undefined,
  }));
  demo.notes = demo.notes.map((note, index) => ({ ...note, createdAt: atDay(noteOffsets[index] ?? -10) }));
  demo.changelog = demo.changelog.map((entry, index) => ({ ...entry, date: atDay(-90 + index * 30) }));
  return demo;
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
