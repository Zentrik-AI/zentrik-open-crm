import type { Workspace } from "../types.ts";
import { accountStages, contactInfluences, dealStages, noteSources, priorities, sentiments } from "./model.ts";

/**
 * Structural and referential checks for a workspace. Used before importing a
 * backup, by `crm check`, and by the local server before it trusts a file a
 * person or an agent may have edited by hand.
 */

type Rec = Record<string, unknown>;
const isRec = (value: unknown): value is Rec => typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const isDate = (value: unknown) => typeof value === "string" && !Number.isNaN(new Date(value).getTime());

export function validateWorkspace(data: unknown): string[] {
  const errors: string[] = [];
  if (!isRec(data)) return ["The file is not a workspace object."];

  if (!isText(data.name)) errors.push("workspace.name is missing.");
  for (const key of ["accounts", "deals", "tasks", "notes"] as const) {
    if (!Array.isArray(data[key])) errors.push(`workspace.${key} must be a list.`);
  }
  if (errors.length) return errors;

  const ids = new Set<string>();
  const claim = (id: unknown, where: string) => {
    if (!isText(id)) return errors.push(`${where} has no id.`);
    if (ids.has(id)) errors.push(`${where} reuses id ${id}.`);
    ids.add(id);
  };
  const check = (ok: boolean, message: string) => {
    if (!ok) errors.push(message);
  };
  const within = (value: unknown, allowed: readonly string[], where: string) =>
    check(typeof value === "string" && allowed.includes(value), `${where} must be one of: ${allowed.join(", ")}.`);

  const accountIds = new Set<string>();
  const contactIds = new Set<string>();
  (data.accounts as unknown[]).forEach((raw, i) => {
    const where = `accounts[${i}]`;
    if (!isRec(raw)) return errors.push(`${where} is not an object.`);
    claim(raw.id, where);
    if (isText(raw.id)) accountIds.add(raw.id);
    check(isText(raw.name), `${where}.name is missing.`);
    within(raw.stage, accountStages, `${where}.stage`);
    within(raw.priority, priorities, `${where}.priority`);
    for (const key of ["arr", "health", "fit", "sourceConfidence"]) check(typeof raw[key] === "number", `${where}.${key} must be a number.`);
    for (const key of ["tags", "needs", "risks", "contacts"]) check(Array.isArray(raw[key]), `${where}.${key} must be a list.`);
    check(isDate(raw.lastTouch), `${where}.lastTouch must be a date.`);
    if (Array.isArray(raw.contacts)) {
      raw.contacts.forEach((contact, j) => {
        const at = `${where}.contacts[${j}]`;
        if (!isRec(contact)) return errors.push(`${at} is not an object.`);
        claim(contact.id, at);
        if (isText(contact.id)) contactIds.add(contact.id);
        check(isText(contact.name), `${at}.name is missing.`);
        within(contact.influence, contactInfluences, `${at}.influence`);
      });
    }
  });

  const noteIds = new Set<string>();
  (data.notes as unknown[]).forEach((raw, i) => {
    const where = `notes[${i}]`;
    if (!isRec(raw)) return errors.push(`${where} is not an object.`);
    claim(raw.id, where);
    if (isText(raw.id)) noteIds.add(raw.id);
    check(isText(raw.title), `${where}.title is missing.`);
    check(typeof raw.body === "string", `${where}.body is missing.`);
    within(raw.source, noteSources, `${where}.source`);
    within(raw.sentiment, sentiments, `${where}.sentiment`);
    check(isDate(raw.createdAt), `${where}.createdAt must be a date.`);
    check(isText(raw.accountId) && accountIds.has(raw.accountId), `${where}.accountId points to no account.`);
    if (raw.contactId !== undefined) check(isText(raw.contactId) && contactIds.has(raw.contactId), `${where}.contactId points to no contact.`);
  });

  (data.deals as unknown[]).forEach((raw, i) => {
    const where = `deals[${i}]`;
    if (!isRec(raw)) return errors.push(`${where} is not an object.`);
    claim(raw.id, where);
    check(isText(raw.name), `${where}.name is missing.`);
    within(raw.stage, dealStages, `${where}.stage`);
    check(typeof raw.value === "number", `${where}.value must be a number.`);
    check(isDate(raw.closeDate), `${where}.closeDate must be a date.`);
    check(isText(raw.accountId) && accountIds.has(raw.accountId), `${where}.accountId points to no account.`);
  });

  (data.tasks as unknown[]).forEach((raw, i) => {
    const where = `tasks[${i}]`;
    if (!isRec(raw)) return errors.push(`${where} is not an object.`);
    claim(raw.id, where);
    check(isText(raw.title), `${where}.title is missing.`);
    within(raw.priority, priorities, `${where}.priority`);
    within(raw.status, ["open", "done"], `${where}.status`);
    check(isDate(raw.due), `${where}.due must be a date.`);
    if (raw.accountId !== undefined) check(isText(raw.accountId) && accountIds.has(raw.accountId), `${where}.accountId points to no account.`);
    if (raw.evidence !== undefined) {
      check(Array.isArray(raw.evidence), `${where}.evidence must be a list of note ids.`);
      if (Array.isArray(raw.evidence)) {
        for (const noteId of raw.evidence) check(isText(noteId) && noteIds.has(noteId), `${where}.evidence cites ${String(noteId)}, which is not a note.`);
      }
    }
  });

  if (data.agentMode !== undefined) within(data.agentMode, ["review", "direct"], "workspace.agentMode");
  for (const key of ["proposals", "activity", "ideas", "changelog"]) {
    if (data[key] !== undefined) check(Array.isArray(data[key]), `workspace.${key} must be a list.`);
  }

  return errors;
}

/** Fill the fields that older workspaces and hand-written files leave out. */
export function normalizeWorkspace(workspace: Workspace): Workspace {
  return {
    ...workspace,
    edition: workspace.edition ?? "Self-Hosted",
    updatedAt: workspace.updatedAt ?? new Date().toISOString(),
    agentMode: workspace.agentMode ?? "review",
    proposals: workspace.proposals ?? [],
    activity: workspace.activity ?? [],
    ideas: workspace.ideas ?? [],
    changelog: workspace.changelog ?? [],
  };
}

export function parseWorkspace(text: string): { workspace?: Workspace; errors: string[] } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { errors: ["The file is not valid JSON."] };
  }
  const errors = validateWorkspace(data);
  if (errors.length) return { errors };
  return { workspace: normalizeWorkspace(data as Workspace), errors: [] };
}
