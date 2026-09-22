import type { Account, ActivityEntry, Actor, Change, Claim, Contact, Deal, Note, Op, Proposal, Task, Workspace } from "../types.ts";
import { deriveAccountLists } from "./claims.ts";
import {
  DAY_MS,
  isValidDate,
  accountStages,
  claimKinds,
  stableId,
  contactInfluences,
  dealStages,
  makeId,
  noteSources,
  parseDue,
  priorities,
  sentiments,
  slugify,
  stageProbability,
} from "./model.ts";

/**
 * The one write path. The visual CRM, the `crm` command, and the MCP server
 * all describe a change as an `Op`, wrap it in a `Change`, and apply it here.
 * Applying is pure and deterministic, so a change an agent proposes today is
 * exactly the change a person approves tomorrow.
 */

export class OpError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "OpError";
    this.code = code;
  }
}

const ACTIVITY_LIMIT = 200;
const RESOLVED_PROPOSAL_LIMIT = 100;

const idPrefix: Record<Op["type"], string> = {
  "account.add": "acct",
  "account.update": "acct",
  "account.archive": "acct",
  "contact.add": "contact",
  "deal.add": "deal",
  "deal.move": "deal",
  "task.add": "task",
  "task.set_status": "task",
  "task.update": "task",
  "note.add": "note",
  "claim.add": "claim",
  "claim.resolve": "claim",
};

export const humanActor: Actor = { kind: "human", name: "you" };

export function newChange(op: Op, actor: Actor = humanActor, at: string = new Date().toISOString()): Change {
  return {
    recordId: makeId(idPrefix[op.type]),
    childId: op.type === "account.add" && op.contact ? makeId("contact") : op.type === "claim.resolve" && op.replacement ? makeId("claim") : undefined,
    at,
    actor,
    op,
  };
}

export interface Applied {
  workspace: Workspace;
  summary: string;
  targetId: string;
  accountId?: string;
}

function need(value: string | undefined, field: string): string {
  if (value !== undefined && typeof value !== "string") throw new OpError("invalid_value", `${field} must be text.`);
  const trimmed = (value ?? "").trim();
  if (!trimmed) throw new OpError("missing_field", `${field} is required.`);
  return trimmed;
}

function oneOf<T extends string>(value: T | undefined, allowed: readonly T[], field: string, fallback: T): T {
  if (value === undefined) return fallback;
  if (!allowed.includes(value)) throw new OpError("invalid_value", `${field} must be one of: ${allowed.join(", ")}.`);
  return value;
}

function findAccount(workspace: Workspace, accountId: string): Account {
  const account = workspace.accounts.find((a) => a.id === accountId);
  if (!account) throw new OpError("not_found", `No account with id ${accountId}.`);
  return account;
}

function dueOrDefault(value: string | undefined, at: string, days: number, field: string): string {
  if (!value) return new Date(new Date(at).getTime() + days * DAY_MS).toISOString();
  const parsed = parseDue(value);
  if (!parsed) throw new OpError("invalid_value", `${field} must be a date such as 2026-10-02.`);
  return parsed;
}

function score(value: number, field: string) {
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new OpError("invalid_value", `${field} must be between 0 and 100.`);
  return Math.round(value);
}

function stringList(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new OpError("invalid_value", `${field} must be a list of text values.`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

const identity = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
/** Object property order is not part of a retry's meaning. */
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
export function proposalBase(workspace: Workspace, op: Op): Record<string, unknown> | undefined {
  let record: object | undefined;
  let fields: string[] = [];
  if (op.type === "account.update") { record = workspace.accounts.find(a => a.id === op.accountId); fields = Object.keys(op.patch); }
  if (op.type === "account.archive") { record = workspace.accounts.find(a => a.id === op.accountId); fields = ["archivedAt", "archiveReason"]; }
  if (op.type === "task.update") { record = workspace.tasks.find(t => t.id === op.taskId); fields = Object.keys(op.patch); }
  if (op.type === "task.set_status") { record = workspace.tasks.find(t => t.id === op.taskId); fields = ["status"]; }
  if (op.type === "deal.move") { record = workspace.deals.find(d => d.id === op.dealId); fields = ["stage"]; }
  if (op.type === "claim.resolve") { record = workspace.claims?.find(c => c.id === op.claimId); fields = ["status"]; }
  return fields.length ? Object.fromEntries(fields.map(k => [k, record ? (record as Record<string, unknown>)[k] ?? null : null])) : undefined;
}

export function proposalConflict(workspace: Workspace, proposal: Proposal): string | undefined {
  const current = proposalBase(workspace, proposal.change.op);
  if (current && !proposal.base) return "This older proposal has no conflict baseline. Reject it and prepare it again from current records.";
  if (current && canonical(current) !== canonical(proposal.base)) return "The fields in this proposal changed since it was prepared. Reject it and prepare it again from current records.";
}

/** Apply one change. Throws `OpError` and leaves the workspace untouched when
 *  the change is not valid against the current records. */
export function applyChange(workspace: Workspace, change: Change): Applied {
  const { op, at, actor, recordId } = change;
  const origin = actor.kind === "agent" ? actor : undefined;
  const touched = (next: Workspace): Workspace => deriveAccountLists({ ...next, updatedAt: at });

  const claimText = (value: string | undefined) => {
    const text = need(value, "text");
    if (text.length > 400) throw new OpError("invalid_value", "Keep a claim to one idea, under 400 characters.");
    return text;
  };
  const claimEvidence = (account: Account, raw: unknown) => {
    const evidence = raw === undefined ? [] : stringList(raw, "evidence");
    for (const noteId of evidence) {
      const note = workspace.notes.find((n) => n.id === noteId);
      if (!note) throw new OpError("not_found", `Evidence must cite existing notes. No note with id ${noteId}.`);
      if (note.accountId !== account.id) throw new OpError("invalid_value", `Note ${noteId} belongs to another account.`);
    }
    return [...new Set(evidence)];
  };
  const claimOwner = (value: unknown, kind: string) => {
    if (value === undefined) return undefined;
    if (value !== "us" && value !== "them") throw new OpError("invalid_value", "A commitment's owner is \"us\" or \"them\".");
    if (kind !== "commitment") throw new OpError("invalid_value", "Only a commitment has an owner.");
    return value;
  };

  switch (op.type) {
    case "account.add": {
      const name = need(op.name, "name");
      if (workspace.accounts.some((a) => identity(a.name) === identity(name))) {
        throw new OpError("duplicate", `An account named "${name}" already exists.`);
      }
      const contacts: Contact[] = op.contact
        ? [
            {
              id: change.childId ?? makeId("contact"),
              name: need(op.contact.name, "contact name"),
              role: need(op.contact.role, "contact role"),
              influence: oneOf(op.contact.influence, contactInfluences, "influence", "champion"),
              email: op.contact.email?.trim() || undefined,
              lastSeen: null,
            },
          ]
        : [];
      const account: Account = {
        id: recordId,
        name,
        domain: op.domain?.trim() || `${slugify(name)}.example`,
        segment: op.segment?.trim() || "New relationship",
        stage: oneOf(op.stage, accountStages, "stage", "researching"),
        priority: oneOf(op.priority, priorities, "priority", "medium"),
        arr: 0,
        health: null,
        fit: null,
        sourceConfidence: null,
        owner: op.owner?.trim() || "Unassigned",
        tags: ["new account"],
        contacts,
        needs: ["Needs discovery"],
        risks: ["No recent note captured yet"],
        lastTouch: null,
        createdAt: at,
      };
      return {
        workspace: touched({ ...workspace, accounts: [account, ...workspace.accounts] }),
        summary: `Added account ${name}`,
        targetId: recordId,
        accountId: recordId,
      };
    }

    case "account.update": {
      const account = findAccount(workspace, op.accountId);
      const patch = op.patch ?? {};
      if (Object.keys(patch).some(k => !["name", "domain", "segment", "stage", "priority", "owner", "arr", "health", "fit", "tags", "needs", "risks"].includes(k))) throw new OpError("invalid_value", "Unsupported account field.");
      const next: Account = { ...account };
      if (patch.name !== undefined) next.name = need(patch.name, "name");
      if (workspace.accounts.some(a => a.id !== account.id && identity(a.name) === identity(next.name))) {
        throw new OpError("duplicate", "An account with that name already exists. Use its existing record.");
      }
      if (patch.domain !== undefined) next.domain = need(patch.domain, "domain");
      if (patch.segment !== undefined) next.segment = need(patch.segment, "segment");
      if (patch.owner !== undefined) next.owner = need(patch.owner, "owner");
      if (patch.stage !== undefined) next.stage = oneOf(patch.stage, accountStages, "stage", account.stage);
      if (patch.priority !== undefined) next.priority = oneOf(patch.priority, priorities, "priority", account.priority);
      if (patch.arr !== undefined) {
        if (!Number.isFinite(patch.arr) || patch.arr < 0) throw new OpError("invalid_value", "arr must be a positive number.");
        next.arr = patch.arr;
      }
      if (patch.health !== undefined) next.health = patch.health === null ? null : score(patch.health, "health");
      if (patch.fit !== undefined) next.fit = patch.fit === null ? null : score(patch.fit, "fit");
      if (patch.tags !== undefined) next.tags = stringList(patch.tags, "tags");
      if (patch.needs !== undefined) next.needs = stringList(patch.needs, "needs");
      if (patch.risks !== undefined) next.risks = stringList(patch.risks, "risks");
      const fields = Object.keys(patch);
      if (fields.length === 0) throw new OpError("missing_field", "Nothing to update.");
      // The lists are a legacy way in. Keep the claims that back them honest:
      // a text that is new becomes a hunch, a text that is gone is resolved.
      let claims = workspace.claims ?? [];
      const reconcile = (kind: "need" | "risk", texts: string[]) => {
        const active = claims.filter((c) => c.accountId === account.id && c.kind === kind && c.status === "active");
        for (const claim of active) {
          if (!texts.includes(claim.text)) claims = claims.map((c) => (c.id === claim.id ? { ...c, status: "resolved" as const, resolvedAt: at, resolvedReason: `Removed from the account's ${kind}s` } : c));
        }
        for (const text of texts) {
          if (!active.some((c) => c.text === text)) claims = [...claims, { id: stableId("claim", account.id, kind, text, at), accountId: account.id, kind, text, evidence: [], status: "active", createdAt: at, origin }];
        }
      };
      if (patch.needs !== undefined) reconcile("need", next.needs);
      if (patch.risks !== undefined) reconcile("risk", next.risks);
      return {
        workspace: touched({ ...workspace, claims: workspace.claims ? claims : undefined, accounts: workspace.accounts.map((a) => (a.id === account.id ? next : a)) }),
        summary: `Updated ${account.name} · ${fields.join(", ")}`,
        targetId: account.id,
        accountId: account.id,
      };
    }

    case "account.archive": {
      const account = findAccount(workspace, op.accountId);
      if (typeof op.archived !== "boolean") throw new OpError("invalid_value", "archived must be a boolean.");
      const reason = need(op.reason, "Archive / restore reason");
      const next = { ...account, archivedAt: op.archived ? at : undefined, archiveReason: reason };
      return { workspace: touched({ ...workspace, accounts: workspace.accounts.map(a => a.id === account.id ? next : a) }),
        summary: `${op.archived ? "Archived" : "Restored"} ${account.name}`, targetId: account.id, accountId: account.id };
    }

    case "contact.add": {
      const account = findAccount(workspace, op.accountId);
      const contact: Contact = {
        id: recordId,
        name: need(op.name, "name"),
        role: need(op.role, "role"),
        influence: oneOf(op.influence, contactInfluences, "influence", "champion"),
        email: op.email?.trim() || undefined,
        lastSeen: null,
      };
      return {
        workspace: touched({
          ...workspace,
          accounts: workspace.accounts.map((a) => (a.id === account.id ? { ...a, contacts: [...a.contacts, contact] } : a)),
        }),
        summary: `Added contact ${contact.name} to ${account.name}`,
        targetId: recordId,
        accountId: account.id,
      };
    }

    case "deal.add": {
      const account = findAccount(workspace, op.accountId);
      if (account.archivedAt) throw new OpError("invalid_value", "Restore the account before adding a new deal.");
      const stage = oneOf(op.stage, dealStages, "stage", "lead");
      const value = op.value ?? 0;
      if (!Number.isFinite(value) || value < 0) throw new OpError("invalid_value", "value must be a positive number.");
      const deal: Deal = {
        id: recordId,
        accountId: account.id,
        name: need(op.name, "name"),
        stage,
        value,
        owner: op.owner?.trim() || account.owner || "Unassigned",
        closeDate: dueOrDefault(op.closeDate, at, 30, "closeDate"),
        probability: stageProbability[stage],
        createdAt: at,
      };
      return {
        workspace: touched({ ...workspace, deals: [deal, ...workspace.deals] }),
        summary: `Added deal ${deal.name} for ${account.name}`,
        targetId: recordId,
        accountId: account.id,
      };
    }

    case "deal.move": {
      const deal = workspace.deals.find((d) => d.id === op.dealId);
      if (!deal) throw new OpError("not_found", `No deal with id ${op.dealId}.`);
      const stage = oneOf(op.stage, dealStages, "stage", deal.stage);
      return {
        workspace: touched({
          ...workspace,
          deals: workspace.deals.map((d) => (d.id === deal.id ? { ...d, stage, probability: stageProbability[stage] } : d)),
        }),
        summary: `Moved ${deal.name} to ${stage}`,
        targetId: deal.id,
        accountId: deal.accountId,
      };
    }

    case "task.add": {
      const account = op.accountId ? findAccount(workspace, op.accountId) : undefined;
      if (account?.archivedAt) throw new OpError("archived", "Restore this account before adding new work.");
      if (workspace.tasks.some(t => t.accountId === account?.id && ["open", "waiting"].includes(t.status) && identity(t.title) === identity(op.title))) {
        throw new OpError("duplicate", "That action already exists. Update its task instead.");
      }
      const evidence = op.evidence ? stringList(op.evidence, "evidence") : [];
      for (const noteId of evidence) {
        if (!workspace.notes.some((n) => n.id === noteId)) throw new OpError("not_found", `Evidence must cite existing notes. No note with id ${noteId}.`);
      }
      const task: Task = {
        id: recordId,
        title: need(op.title, "title"),
        accountId: account?.id,
        due: dueOrDefault(op.due, at, 3, "due"),
        owner: op.owner?.trim() || account?.owner || "Unassigned",
        priority: oneOf(op.priority, priorities, "priority", "medium"),
        status: "open",
        createdAt: at,
        reason: op.reason?.trim() || undefined,
        evidence: evidence.length ? evidence : undefined,
        origin,
      };
      return {
        workspace: touched({ ...workspace, tasks: [task, ...workspace.tasks] }),
        summary: `Added task "${task.title}"${account ? ` for ${account.name}` : ""}`,
        targetId: recordId,
        accountId: account?.id,
      };
    }

    case "task.update":
    case "task.set_status": {
      const task = workspace.tasks.find((t) => t.id === op.taskId);
      if (!task) throw new OpError("not_found", `No task with id ${op.taskId}.`);
      const patch = op.type === "task.update" ? op.patch : { status: op.status };
      if (!patch || !Object.keys(patch).length) throw new OpError("missing_field", "Nothing to update.");
      if (Object.keys(patch).some(k => !["title", "due", "owner", "priority", "status", "reason"].includes(k))) throw new OpError("invalid_value", "Unsupported task field.");
      const status = oneOf(patch.status, ["open", "waiting", "done", "cancelled"] as const, "status", task.status);
      const next = { ...task, ...patch, status, completedAt: status === "done" ? task.completedAt ?? at : undefined };
      if (patch.title !== undefined) next.title = need(patch.title, "title");
      if (patch.owner !== undefined) next.owner = need(patch.owner, "owner");
      if (patch.priority !== undefined) next.priority = oneOf(patch.priority, priorities, "priority", task.priority);
      if (patch.due !== undefined) next.due = dueOrDefault(patch.due, at, 3, "due");
      if (status === "waiting" || status === "cancelled") next.reason = need(next.reason, "A waiting or cancellation reason");
      if (patch.reason !== undefined && status !== "waiting" && status !== "cancelled") {
        if (typeof patch.reason !== "string") throw new OpError("invalid_value", "reason must be text.");
        next.reason = patch.reason.trim() || undefined;
      }
      if ((status === "open" || status === "waiting") && workspace.tasks.some(t => t.id !== task.id && t.accountId === next.accountId && (t.status === "open" || t.status === "waiting") && identity(t.title) === identity(next.title))) throw new OpError("duplicate", "An active task with this title already exists on this account.");
      return {
        workspace: touched({
          ...workspace,
          tasks: workspace.tasks.map((t) => (t.id === task.id ? next : t)),
        }),
        summary: `Updated "${next.title}" · ${status}`,
        targetId: task.id,
        accountId: task.accountId,
      };
    }

    case "claim.add": {
      const account = findAccount(workspace, op.accountId);
      if (account.archivedAt) throw new OpError("archived", "Restore this account before recording what you know about it.");
      const kind = oneOf(op.kind, claimKinds, "kind", "fact");
      const text = claimText(op.text);
      if ((workspace.claims ?? []).some((c) => c.accountId === account.id && c.kind === kind && c.status === "active" && identity(c.text) === identity(text))) {
        throw new OpError("duplicate", `That ${kind} is already recorded. Cite more evidence on it, or resolve it first.`);
      }
      if (op.contactId && !account.contacts.some((c) => c.id === op.contactId)) throw new OpError("not_found", `No contact with id ${op.contactId} on ${account.name}.`);
      const claim: Claim = {
        id: recordId,
        accountId: account.id,
        kind,
        text,
        evidence: claimEvidence(account, op.evidence),
        contactId: op.contactId || undefined,
        status: "active",
        createdAt: at,
        owner: claimOwner(op.owner, kind),
        due: op.due ? dueOrDefault(op.due, at, 0, "due") : undefined,
        origin,
      };
      return {
        workspace: touched({ ...workspace, claims: [...(workspace.claims ?? []), claim] }),
        summary: `Recorded ${kind}: "${text}" on ${account.name}`,
        targetId: recordId,
        accountId: account.id,
      };
    }

    case "claim.resolve": {
      const claim = (workspace.claims ?? []).find((c) => c.id === op.claimId);
      if (!claim) throw new OpError("not_found", `No claim with id ${op.claimId}.`);
      if (claim.status !== "active") throw new OpError("already_resolved", `That claim was already ${claim.status}.`);
      const account = findAccount(workspace, claim.accountId);
      const reason = need(op.reason, "reason");
      let claims = workspace.claims ?? [];
      let replacement: Claim | undefined;
      if (op.replacement) {
        const kind = oneOf(op.replacement.kind, claimKinds, "kind", claim.kind);
        replacement = {
          id: change.childId ?? makeId("claim"),
          accountId: account.id,
          kind,
          text: claimText(op.replacement.text),
          evidence: claimEvidence(account, op.replacement.evidence),
          contactId: claim.contactId,
          status: "active",
          createdAt: at,
          owner: claimOwner(op.replacement.owner, kind),
          due: op.replacement.due ? dueOrDefault(op.replacement.due, at, 0, "due") : undefined,
          origin,
        };
        claims = [...claims, replacement];
      }
      claims = claims.map((c) => (c.id === claim.id ? { ...c, status: replacement ? "superseded" as const : "resolved" as const, resolvedAt: at, resolvedReason: reason, supersededBy: replacement?.id } : c));
      return {
        workspace: touched({ ...workspace, claims }),
        summary: replacement ? `Updated ${claim.kind} on ${account.name}: "${claim.text}" → "${replacement.text}"` : `Resolved ${claim.kind} "${claim.text}" on ${account.name}`,
        targetId: replacement?.id ?? claim.id,
        accountId: account.id,
      };
    }

    case "note.add": {
      const account = findAccount(workspace, op.accountId);
      if (op.interaction !== undefined && typeof op.interaction !== "boolean") throw new OpError("invalid_value", "interaction must be a boolean.");
      if (op.occurredAt !== undefined && !isValidDate(op.occurredAt)) throw new OpError("invalid_value", "Source date must be a valid ISO date.");
      const occurredAt = op.occurredAt ? new Date(op.occurredAt).toISOString() : undefined;
      if (occurredAt && Date.parse(occurredAt) > Date.parse(at)) throw new OpError("invalid_value", "A source event cannot be in the future.");
      if (op.interaction && (!occurredAt || !["call", "email", "meeting", "support"].includes(op.source))) {
        throw new OpError("invalid_value", "A verified interaction needs its actual date and a call, email, meeting, or support source.");
      }
      if (op.sourceRef && workspace.notes.some(n => n.accountId === account.id && n.sourceRef === op.sourceRef && n.body === op.body)) {
        throw new OpError("duplicate", "This source note already exists.");
      }
      if (op.contactId && !account.contacts.some((c) => c.id === op.contactId)) {
        throw new OpError("not_found", `No contact with id ${op.contactId} on ${account.name}.`);
      }
      const note: Note = {
        id: recordId,
        accountId: account.id,
        contactId: op.contactId || undefined,
        source: oneOf(op.source, noteSources, "source", "note"),
        title: need(op.title, "title"),
        body: need(op.body, "body"),
        sentiment: oneOf(op.sentiment, sentiments, "sentiment", "neutral"),
        createdAt: at,
        sourceRef: op.sourceRef?.trim() || "Manual entry",
        occurredAt,
        interaction: op.interaction === true,
        origin,
      };
      return {
        workspace: touched({
          ...workspace,
          notes: [note, ...workspace.notes],
          accounts: workspace.accounts.map(a => a.id !== account.id || !op.interaction || !occurredAt ? a : {
            ...a,
            lastTouch: !a.lastTouch || Date.parse(occurredAt) > Date.parse(a.lastTouch) ? occurredAt : a.lastTouch,
            contacts: a.contacts.map(c => c.id === op.contactId && (!c.lastSeen || Date.parse(occurredAt) > Date.parse(c.lastSeen)) ? { ...c, lastSeen: occurredAt } : c),
          }),
        }),
        summary: `Captured note "${note.title}" on ${account.name}`,
        targetId: recordId,
        accountId: account.id,
      };
    }
    default:
      throw new OpError("invalid_value", "Unknown record operation.");
  }
}

function logActivity(workspace: Workspace, entry: ActivityEntry): Workspace {
  return { ...workspace, activity: [entry, ...(workspace.activity ?? [])].slice(0, ACTIVITY_LIMIT) };
}

function trimProposals(proposals: Proposal[]): Proposal[] {
  const pending = proposals.filter((p) => p.status === "pending");
  const resolved = proposals.filter((p) => p.status !== "pending").slice(0, RESOLVED_PROPOSAL_LIMIT);
  return [...pending, ...resolved];
}

export type Submitted =
  | ({ outcome: "applied" } & Applied)
  | { outcome: "proposed"; workspace: Workspace; summary: string; proposalId: string; targetId: string; accountId?: string };

/** The records as they would be if every pending proposal were approved, oldest
 *  first. An agent's next change is checked against this, so it can build on
 *  its own proposed work: cite a note it just captured, or add a contact to an
 *  account it just proposed. Proposals that no longer apply are skipped. */
export function projectPending(workspace: Workspace): Workspace {
  let projected = workspace;
  for (const proposal of [...pendingProposals(workspace)].reverse()) {
    try {
      if (proposalConflict(projected, proposal)) continue;
      projected = applyChange(projected, proposal.change).workspace;
    } catch {
      /* stale; approval will say why */
    }
  }
  return projected;
}

/** A changed baseline can also be a dependency that is not approved yet. */
export function proposalApprovalIssue(workspace: Workspace, proposal: Proposal): { code: string; message: string } | undefined {
  const conflict = proposalConflict(workspace, proposal);
  if (!conflict) return;
  const others = { ...workspace, proposals: (workspace.proposals ?? []).filter(p => p.id !== proposal.id) };
  if (!proposalConflict(projectPending(others), proposal)) return { code: "depends_on_pending", message: "This builds on another proposal that is still waiting. Approve that one first, or approve all." };
  return { code: "stale_proposal", message: conflict };
}


/**
 * Submit a change on behalf of its actor. A person's change applies at once.
 * An agent's change is checked against the current records, then either held
 * for review (the default) or applied and logged when the workspace is in
 * direct mode.
 */
export function submitChange(workspace: Workspace, change: Change): Submitted {
  if (!change || !change.op || !change.actor || !["human", "agent"].includes(change.actor.kind) || typeof change.actor.name !== "string" || !change.actor.name.trim() || typeof change.recordId !== "string" || !change.recordId || !isValidDate(change.at)) throw new OpError("invalid_value", "Invalid change envelope.");
  if (change.review !== undefined && typeof change.review !== "boolean") throw new OpError("invalid_value", "review must be a boolean.");
  if (change.key !== undefined && (typeof change.key !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9:._/-]{0,239}$/.test(change.key) || ["__proto__", "constructor", "prototype"].includes(change.key))) throw new OpError("invalid_value", "Use a stable key of 1–240 letters, digits, colon, dot, slash, underscore or hyphen.");
  const prior = change.key && Object.prototype.hasOwnProperty.call(workspace.receipts ?? {}, change.key) ? workspace.receipts?.[change.key] : undefined;
  if (prior) {
    if (canonical(prior.op) !== canonical(change.op)) throw new OpError("key_conflict", "This key already identifies different work. Inspect the existing record before choosing a new key.");
    if (prior.rejected) throw new OpError("rejected", "This keyed proposal was rejected. Do not recreate it without a new human decision.");
    const pending = workspace.proposals?.find(p => p.id === prior.proposalId && p.status === "pending");
    return pending ? { outcome: "proposed", workspace, summary: prior.summary, proposalId: pending.id, targetId: prior.targetId }
      : { outcome: "applied", workspace, summary: prior.summary, targetId: prior.targetId };
  }
  const receipt = (next: Workspace, targetId: string, summary: string, proposalId?: string): Workspace => change.key
    ? { ...next, receipts: { ...next.receipts, [change.key]: { op: change.op, targetId, summary, proposalId } } } : next;
  if (change.actor.kind === "human") {
    const applied = applyChange(workspace, change);
    return { outcome: "applied", ...applied, workspace: receipt(applied.workspace, applied.targetId, applied.summary) };
  }

  if (!change.review && (workspace.agentMode ?? "review") === "direct") {
    const applied = applyChange(workspace, change);
    const logged = logActivity(applied.workspace, {
      id: makeId("act"),
      at: change.at,
      actor: change.actor,
      summary: applied.summary,
      targetId: applied.targetId,
      accountId: applied.accountId,
    });
    return { outcome: "applied", ...applied, workspace: receipt(logged, applied.targetId, applied.summary) };
  }

  const applied = applyChange(projectPending(workspace), change);
  const proposal: Proposal = {
    id: makeId("prop"),
    createdAt: change.at,
    actor: change.actor,
    change,
    summary: applied.summary,
    status: "pending",
    base: proposalBase(projectPending(workspace), change.op),
  };
  return {
    outcome: "proposed",
    workspace: receipt({ ...workspace, updatedAt: change.at, proposals: [proposal, ...(workspace.proposals ?? [])] }, applied.targetId, applied.summary, proposal.id),
    summary: applied.summary,
    proposalId: proposal.id,
    targetId: applied.targetId,
    accountId: applied.accountId,
  };
}

/** Approve or reject a pending proposal. Approval replays the stored change
 *  against the records as they are now, so a stale proposal fails loudly. */
export function resolveProposal(
  workspace: Workspace,
  proposalId: string,
  decision: "approve" | "reject",
  resolvedBy: string,
  at: string = new Date().toISOString(),
): { workspace: Workspace; proposal: Proposal } {
  const proposal = (workspace.proposals ?? []).find((p) => p.id === proposalId);
  if (!proposal) throw new OpError("not_found", `No proposal with id ${proposalId}.`);
  if (proposal.status !== "pending") throw new OpError("already_resolved", `Proposal ${proposalId} is already ${proposal.status}.`);

  let next = workspace;
  let resolved: Proposal;
  if (decision === "approve") {
    const issue = proposalApprovalIssue(workspace, proposal);
    if (issue) throw new OpError(issue.code, issue.message);
    let applied: Applied;
    try {
      applied = applyChange(workspace, proposal.change);
    } catch (error) {
      const others = { ...workspace, proposals: (workspace.proposals ?? []).filter((p) => p.id !== proposalId) };
      try {
        applyChange(projectPending(others), proposal.change);
      } catch {
        throw error;
      }
      throw new OpError("depends_on_pending", "This builds on another proposal that is still waiting. Approve that one first, or approve all.");
    }
    next = applied.workspace;
    resolved = { ...proposal, status: "applied", resolvedAt: at, resolvedBy, targetId: applied.targetId };
  } else {
    resolved = { ...proposal, status: "rejected", resolvedAt: at, resolvedBy };
    if (proposal.change.key && next.receipts?.[proposal.change.key]) next = { ...next, receipts: { ...next.receipts, [proposal.change.key]: { ...next.receipts[proposal.change.key], rejected: true } } };
  }

  next = logActivity(next, {
    id: makeId("act"),
    at,
    actor: proposal.actor,
    summary: `${proposal.summary} · ${decision === "approve" ? "approved" : "rejected"} by ${resolvedBy}`,
    targetId: resolved.targetId,
    accountId: "accountId" in proposal.change.op ? proposal.change.op.accountId : undefined,
  });
  const proposals = trimProposals((next.proposals ?? []).map((p) => (p.id === proposalId ? resolved : p)));
  return { workspace: { ...next, updatedAt: at, proposals }, proposal: resolved };
}

export const pendingProposals = (workspace: Workspace) => (workspace.proposals ?? []).filter((p) => p.status === "pending");
