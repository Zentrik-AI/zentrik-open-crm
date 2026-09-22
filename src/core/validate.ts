import type { Workspace } from "../types.ts";
import { accountStages, contactInfluences, dealStages, isValidDate as isDate, noteSources, priorities, sentiments, stageProbability } from "./model.ts";

/**
 * Structural and referential checks for a workspace. Used before importing a
 * backup, by `crm check`, and by the local server before it trusts a file a
 * person or an agent may have edited by hand.
 */

type Rec = Record<string, unknown>;
const isRec = (value: unknown): value is Rec => typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string" && value.length > 0;

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
  const text = (value: unknown, where: string) => check(typeof value === "string", `${where} must be text.`);
  const optionalText = (raw: Rec, keys: string[], where: string) => {
    for (const key of keys) if (raw[key] !== undefined) text(raw[key], `${where}.${key}`);
  };
  const optionalDates = (raw: Rec, keys: string[], where: string) => {
    for (const key of keys) if (raw[key] !== undefined) check(isDate(raw[key]), `${where}.${key} must be a date.`);
  };
  const textList = (value: unknown, where: string) =>
    check(Array.isArray(value) && value.every(item => typeof item === "string"), `${where} must be a list of text values.`);
  const number = (value: unknown, where: string, max = Infinity) =>
    check(typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max, `${where} must be a finite non-negative number${max === Infinity ? "" : ` no greater than ${max}`}.`);
  const actor = (value: unknown, where: string) => {
    if (!isRec(value)) return errors.push(`${where} must be an actor object.`);
    within(value.kind, ["human", "agent"], `${where}.kind`);
    check(isText(value.name), `${where}.name is missing.`);
  };
  const sourceEvent = (raw: Rec, capturedAt: unknown, where: string) => {
    optionalText(raw, ["sourceRef"], where);
    optionalDates(raw, ["occurredAt"], where);
    if (raw.interaction !== undefined) check(typeof raw.interaction === "boolean", `${where}.interaction must be a boolean.`);
    if (isDate(raw.occurredAt) && isDate(capturedAt)) {
      check(new Date(raw.occurredAt).getTime() <= new Date(capturedAt).getTime(), `${where}.occurredAt must not be after capture.`);
    }
    if (raw.interaction === true) {
      check(isDate(raw.occurredAt) && ["call", "email", "meeting", "support"].includes(raw.source as string), `${where}.interaction needs an actual date and a call, email, meeting, or support source.`);
    }
  };
  const stableKey = (value: unknown, where: string) => check(
    typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9:._/-]{0,239}$/.test(value) && !["__proto__", "constructor", "prototype"].includes(value),
    `${where} must be a safe stable key of 1–240 characters.`,
  );

  // Stored operations can be stale or depend on other pending proposals. Check
  // their shape here; approval still checks them against the current records.
  const operation = (value: unknown, where: string, at?: unknown) => {
    if (!isRec(value)) return errors.push(`${where} must be an operation object.`);
    const required = (...keys: string[]) => {
      for (const key of keys) check(isText(value[key]), `${where}.${key} is missing or is not text.`);
    };
    const optionalEnum = (key: string, allowed: readonly string[]) => {
      if (value[key] !== undefined) within(value[key], allowed, `${where}.${key}`);
    };
    const contact = (raw: unknown, path: string) => {
      if (!isRec(raw)) return errors.push(`${path} must be a contact object.`);
      for (const key of ["name", "role"]) check(isText(raw[key]), `${path}.${key} is missing or is not text.`);
      optionalText(raw, ["email"], path);
      if (raw.influence !== undefined) within(raw.influence, contactInfluences, `${path}.influence`);
    };
    switch (value.type) {
      case "account.add":
        required("name");
        optionalText(value, ["domain", "segment", "owner"], where);
        optionalEnum("stage", accountStages);
        optionalEnum("priority", priorities);
        if (value.contact !== undefined) contact(value.contact, `${where}.contact`);
        break;
      case "account.update":
      case "task.update": {
        const account = value.type === "account.update";
        required(account ? "accountId" : "taskId");
        if (!isRec(value.patch)) { errors.push(`${where}.patch must be an object.`); break; }
        const patch = value.patch;
        const path = `${where}.patch`;
        const strings = account ? ["name", "domain", "segment", "owner"] : ["title", "owner", "reason"];
        const allowed = account ? [...strings, "stage", "priority", "arr", "health", "fit", "tags", "needs", "risks"] : [...strings, "due", "priority", "status"];
        for (const key of Object.keys(patch)) check(allowed.includes(key), `${path}.${key} is not a supported field.`);
        optionalText(patch, strings, path);
        if (patch.priority !== undefined) within(patch.priority, priorities, `${path}.priority`);
        if (account) {
          if (patch.stage !== undefined) within(patch.stage, accountStages, `${path}.stage`);
          if (patch.arr !== undefined) number(patch.arr, `${path}.arr`);
          for (const key of ["health", "fit"]) if (patch[key] !== undefined && patch[key] !== null) number(patch[key], `${path}.${key}`, 100);
          for (const key of ["tags", "needs", "risks"]) if (patch[key] !== undefined) textList(patch[key], `${path}.${key}`);
        } else {
          optionalDates(patch, ["due"], path);
          if (patch.status !== undefined) within(patch.status, ["open", "waiting", "done", "cancelled"], `${path}.status`);
        }
        break;
      }
      case "account.archive":
        required("accountId", "reason");
        check(typeof value.archived === "boolean", `${where}.archived must be a boolean.`);
        break;
      case "contact.add":
        required("accountId");
        contact(value, where);
        break;
      case "deal.add":
        required("accountId", "name");
        optionalText(value, ["owner"], where);
        optionalDates(value, ["closeDate"], where);
        optionalEnum("stage", dealStages);
        if (value.value !== undefined) number(value.value, `${where}.value`);
        break;
      case "deal.move":
        required("dealId");
        within(value.stage, dealStages, `${where}.stage`);
        break;
      case "task.add":
        required("title");
        optionalText(value, ["accountId", "owner", "reason"], where);
        optionalDates(value, ["due"], where);
        optionalEnum("priority", priorities);
        if (value.evidence !== undefined) textList(value.evidence, `${where}.evidence`);
        break;
      case "task.set_status":
        required("taskId");
        within(value.status, ["open", "waiting", "done", "cancelled"], `${where}.status`);
        break;
      case "note.add":
        required("accountId", "title", "body");
        within(value.source, noteSources, `${where}.source`);
        optionalEnum("sentiment", sentiments);
        optionalText(value, ["contactId"], where);
        sourceEvent(value, at, where);
        break;
      default:
        errors.push(`${where}.type is not a supported operation.`);
    }
  };

  if (data.edition !== undefined) within(data.edition, ["Self-Hosted", "Cloud"], "workspace.edition");
  optionalDates(data, ["updatedAt"], "workspace");

  const accountIds = new Set<string>();
  const accountNames = new Set<string>();
  const contactAccounts = new Map<string, unknown>();
  (data.accounts as unknown[]).forEach((raw, i) => {
    const where = `accounts[${i}]`;
    if (!isRec(raw)) return errors.push(`${where} is not an object.`);
    claim(raw.id, where);
    if (isText(raw.id)) accountIds.add(raw.id);
    check(isText(raw.name), `${where}.name is missing.`);
    if (isText(raw.name)) {
      const name = raw.name.trim().toLowerCase().replace(/\s+/g, " ");
      check(!accountNames.has(name), `${where}.name duplicates another account.`);
      accountNames.add(name);
    }
    within(raw.stage, accountStages, `${where}.stage`);
    within(raw.priority, priorities, `${where}.priority`);
    check(typeof raw.arr === "number" && Number.isFinite(raw.arr) && raw.arr >= 0, `${where}.arr must be a non-negative number.`);
    for (const key of ["health", "fit", "sourceConfidence"]) check(raw[key] === null || (typeof raw[key] === "number" && Number.isFinite(raw[key]) && raw[key] >= 0 && raw[key] <= 100), `${where}.${key} must be unknown (null) or 0–100.`);
    optionalText(raw, ["domain", "segment", "owner", "archiveReason"], where);
    optionalDates(raw, ["createdAt"], where);
    for (const key of ["tags", "needs", "risks"]) textList(raw[key], `${where}.${key}`);
    check(Array.isArray(raw.contacts), `${where}.contacts must be a list.`);
    check(raw.lastTouch === null || isDate(raw.lastTouch), `${where}.lastTouch must be a date or unknown (null).`);
    if (raw.archivedAt !== undefined) check(isDate(raw.archivedAt) && isText(raw.archiveReason), `${where} needs an archive date and reason.`);
    if (Array.isArray(raw.contacts)) {
      raw.contacts.forEach((contact, j) => {
        const at = `${where}.contacts[${j}]`;
        if (!isRec(contact)) return errors.push(`${at} is not an object.`);
        claim(contact.id, at);
        if (isText(contact.id)) contactAccounts.set(contact.id, raw.id);
        check(isText(contact.name), `${at}.name is missing.`);
        within(contact.influence, contactInfluences, `${at}.influence`);
        optionalText(contact, ["role", "email"], at);
        check(contact.lastSeen === null || isDate(contact.lastSeen), `${at}.lastSeen must be a date or unknown (null).`);
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
    if (raw.contactId !== undefined) check(isText(raw.contactId) && contactAccounts.has(raw.contactId) && contactAccounts.get(raw.contactId) === raw.accountId, `${where}.contactId must belong to its account.`);
    optionalText(raw, ["dealId"], where);
    sourceEvent(raw, raw.createdAt, where);
    if (raw.origin !== undefined) actor(raw.origin, `${where}.origin`);
  });

  (data.deals as unknown[]).forEach((raw, i) => {
    const where = `deals[${i}]`;
    if (!isRec(raw)) return errors.push(`${where} is not an object.`);
    claim(raw.id, where);
    check(isText(raw.name), `${where}.name is missing.`);
    within(raw.stage, dealStages, `${where}.stage`);
    number(raw.value, `${where}.value`);
    if (raw.probability !== undefined) number(raw.probability, `${where}.probability`, 100);
    optionalText(raw, ["owner"], where);
    optionalDates(raw, ["createdAt"], where);
    check(isDate(raw.closeDate), `${where}.closeDate must be a date.`);
    check(isText(raw.accountId) && accountIds.has(raw.accountId), `${where}.accountId points to no account.`);
  });

  (data.tasks as unknown[]).forEach((raw, i) => {
    const where = `tasks[${i}]`;
    if (!isRec(raw)) return errors.push(`${where} is not an object.`);
    claim(raw.id, where);
    check(isText(raw.title), `${where}.title is missing.`);
    within(raw.priority, priorities, `${where}.priority`);
    within(raw.status, ["open", "waiting", "done", "cancelled"], `${where}.status`);
    if (raw.status === "waiting" || raw.status === "cancelled") check(isText(raw.reason), `${where} needs a waiting or cancellation reason.`);
    check(isDate(raw.due), `${where}.due must be a date.`);
    optionalText(raw, ["owner", "reason", "dealId", "contactId"], where);
    optionalDates(raw, ["createdAt", "completedAt"], where);
    if (raw.origin !== undefined) actor(raw.origin, `${where}.origin`);
    if (raw.accountId !== undefined) check(isText(raw.accountId) && accountIds.has(raw.accountId), `${where}.accountId points to no account.`);
    if (raw.evidence !== undefined) {
      check(Array.isArray(raw.evidence), `${where}.evidence must be a list of note ids.`);
      if (Array.isArray(raw.evidence)) {
        for (const noteId of raw.evidence) check(isText(noteId) && noteIds.has(noteId), `${where}.evidence must cite existing note ids.`);
      }
    }
  });

  if (data.agentMode !== undefined) within(data.agentMode, ["review", "direct"], "workspace.agentMode");
  for (const key of ["proposals", "activity", "ideas", "changelog"]) {
    if (data[key] !== undefined) check(Array.isArray(data[key]), `workspace.${key} must be a list.`);
  }
  const entries = (key: string, visit: (raw: Rec, where: string) => void) => {
    if (!Array.isArray(data[key])) return;
    data[key].forEach((raw, i) => {
      const where = `${key}[${i}]`;
      if (!isRec(raw)) { errors.push(`${where} is not an object.`); return; }
      claim(raw.id, where);
      visit(raw, where);
    });
  };
  entries("proposals", (raw, where) => {
    check(isDate(raw.createdAt), `${where}.createdAt must be a date.`);
    actor(raw.actor, `${where}.actor`);
    text(raw.summary, `${where}.summary`);
    within(raw.status, ["pending", "applied", "rejected"], `${where}.status`);
    optionalDates(raw, ["resolvedAt"], where);
    optionalText(raw, ["resolvedBy", "targetId"], where);
    if (raw.base !== undefined) check(isRec(raw.base), `${where}.base must be an object.`);
    const change = raw.change;
    const path = `${where}.change`;
    if (!isRec(change)) { errors.push(`${path} must be an object.`); return; }
    check(isText(change.recordId), `${path}.recordId is missing or is not text.`);
    check(isDate(change.at), `${path}.at must be a date.`);
    actor(change.actor, `${path}.actor`);
    optionalText(change, ["childId"], path);
    if (change.key !== undefined) stableKey(change.key, `${path}.key`);
    if (change.review !== undefined) check(typeof change.review === "boolean", `${path}.review must be a boolean.`);
    operation(change.op, `${path}.op`, change.at);
  });
  entries("activity", (raw, where) => {
    check(isDate(raw.at), `${where}.at must be a date.`);
    actor(raw.actor, `${where}.actor`);
    text(raw.summary, `${where}.summary`);
    optionalText(raw, ["targetId", "accountId"], where);
  });
  entries("ideas", (raw, where) => {
    for (const key of ["title", "problem", "targetRelease"]) text(raw[key], `${where}.${key}`);
    within(raw.status, ["candidate", "shaping", "queued", "released"], `${where}.status`);
    number(raw.votes, `${where}.votes`);
    number(raw.confidence, `${where}.confidence`, 100);
  });
  entries("changelog", (raw, where) => {
    check(isDate(raw.date), `${where}.date must be a date.`);
    for (const key of ["title", "summary"]) text(raw[key], `${where}.${key}`);
    textList(raw.tags, `${where}.tags`);
  });
  if (data.receipts !== undefined) {
    if (!isRec(data.receipts)) errors.push("workspace.receipts must be an object.");
    else for (const [key, raw] of Object.entries(data.receipts)) {
      const where = `receipts[${JSON.stringify(key)}]`;
      stableKey(key, where);
      if (!isRec(raw)) { errors.push(`${where} must be an object.`); continue; }
      check(isText(raw.targetId), `${where}.targetId is missing or is not text.`);
      text(raw.summary, `${where}.summary`);
      optionalText(raw, ["proposalId"], where);
      if (raw.rejected !== undefined) check(typeof raw.rejected === "boolean", `${where}.rejected must be a boolean.`);
      operation(raw.op, `${where}.op`);
    }
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
    // Older hand-written records can omit these fields. Supply defaults for
    // consumers that trim owners or calculate weighted pipeline values.
    accounts: workspace.accounts.map(account => ({
      ...account,
      owner: account.owner ?? "Unassigned",
    })),
    deals: workspace.deals.map(deal => ({ ...deal, owner: deal.owner ?? "Unassigned", probability: deal.probability ?? stageProbability[deal.stage] })),
    tasks: workspace.tasks.map(task => ({ ...task, owner: task.owner ?? "Unassigned" })),
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
