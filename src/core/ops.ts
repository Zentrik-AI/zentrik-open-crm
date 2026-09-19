import type { Account, ActivityEntry, Actor, Change, Contact, Deal, Note, Op, Proposal, Task, Workspace } from "../types.ts";
import {
  DAY_MS,
  accountStages,
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
  "contact.add": "contact",
  "deal.add": "deal",
  "deal.move": "deal",
  "task.add": "task",
  "task.set_status": "task",
  "note.add": "note",
};

export const humanActor: Actor = { kind: "human", name: "you" };

export function newChange(op: Op, actor: Actor = humanActor, at: string = new Date().toISOString()): Change {
  return {
    recordId: makeId(idPrefix[op.type]),
    childId: op.type === "account.add" && op.contact ? makeId("contact") : undefined,
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

/** Apply one change. Throws `OpError` and leaves the workspace untouched when
 *  the change is not valid against the current records. */
export function applyChange(workspace: Workspace, change: Change): Applied {
  const { op, at, actor, recordId } = change;
  const origin = actor.kind === "agent" ? actor : undefined;
  const touched = (next: Workspace): Workspace => ({ ...next, updatedAt: at });

  switch (op.type) {
    case "account.add": {
      const name = need(op.name, "name");
      if (workspace.accounts.some((a) => a.name.toLowerCase() === name.toLowerCase())) {
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
              lastSeen: at,
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
        health: 70,
        fit: 70,
        sourceConfidence: 35,
        owner: op.owner?.trim() || "Unassigned",
        tags: ["new account"],
        contacts,
        needs: ["Needs discovery"],
        risks: ["No recent note captured yet"],
        lastTouch: at,
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
      const next: Account = { ...account };
      if (patch.name !== undefined) next.name = need(patch.name, "name");
      if (patch.domain !== undefined) next.domain = need(patch.domain, "domain");
      if (patch.segment !== undefined) next.segment = need(patch.segment, "segment");
      if (patch.owner !== undefined) next.owner = need(patch.owner, "owner");
      if (patch.stage !== undefined) next.stage = oneOf(patch.stage, accountStages, "stage", account.stage);
      if (patch.priority !== undefined) next.priority = oneOf(patch.priority, priorities, "priority", account.priority);
      if (patch.arr !== undefined) {
        if (!Number.isFinite(patch.arr) || patch.arr < 0) throw new OpError("invalid_value", "arr must be a positive number.");
        next.arr = patch.arr;
      }
      if (patch.health !== undefined) next.health = score(patch.health, "health");
      if (patch.fit !== undefined) next.fit = score(patch.fit, "fit");
      if (patch.tags !== undefined) next.tags = stringList(patch.tags, "tags");
      if (patch.needs !== undefined) next.needs = stringList(patch.needs, "needs");
      if (patch.risks !== undefined) next.risks = stringList(patch.risks, "risks");
      const fields = Object.keys(patch);
      if (fields.length === 0) throw new OpError("missing_field", "Nothing to update.");
      return {
        workspace: touched({ ...workspace, accounts: workspace.accounts.map((a) => (a.id === account.id ? next : a)) }),
        summary: `Updated ${account.name} · ${fields.join(", ")}`,
        targetId: account.id,
        accountId: account.id,
      };
    }

    case "contact.add": {
      const account = findAccount(workspace, op.accountId);
      const contact: Contact = {
        id: recordId,
        name: need(op.name, "name"),
        role: need(op.role, "role"),
        influence: oneOf(op.influence, contactInfluences, "influence", "champion"),
        email: op.email?.trim() || undefined,
        lastSeen: at,
      };
      return {
        workspace: touched({
          ...workspace,
          accounts: workspace.accounts.map((a) => (a.id === account.id ? { ...a, contacts: [...a.contacts, contact], lastTouch: at } : a)),
        }),
        summary: `Added contact ${contact.name} to ${account.name}`,
        targetId: recordId,
        accountId: account.id,
      };
    }

    case "deal.add": {
      const account = findAccount(workspace, op.accountId);
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

    case "task.set_status": {
      const task = workspace.tasks.find((t) => t.id === op.taskId);
      if (!task) throw new OpError("not_found", `No task with id ${op.taskId}.`);
      const status = oneOf(op.status, ["open", "done"] as const, "status", task.status);
      return {
        workspace: touched({
          ...workspace,
          tasks: workspace.tasks.map((t) => (t.id === task.id ? { ...t, status, completedAt: status === "done" ? at : undefined } : t)),
        }),
        summary: status === "done" ? `Completed "${task.title}"` : `Reopened "${task.title}"`,
        targetId: task.id,
        accountId: task.accountId,
      };
    }

    case "note.add": {
      const account = findAccount(workspace, op.accountId);
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
        origin,
      };
      return {
        workspace: touched({
          ...workspace,
          notes: [note, ...workspace.notes],
          accounts: workspace.accounts.map((a) => (a.id === account.id ? { ...a, lastTouch: at } : a)),
        }),
        summary: `Captured note "${note.title}" on ${account.name}`,
        targetId: recordId,
        accountId: account.id,
      };
    }
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
      projected = applyChange(projected, proposal.change).workspace;
    } catch {
      /* stale; approval will say why */
    }
  }
  return projected;
}


/**
 * Submit a change on behalf of its actor. A person's change applies at once.
 * An agent's change is checked against the current records, then either held
 * for review (the default) or applied and logged when the workspace is in
 * direct mode.
 */
export function submitChange(workspace: Workspace, change: Change): Submitted {
  if (change.actor.kind === "human") return { outcome: "applied", ...applyChange(workspace, change) };

  if ((workspace.agentMode ?? "review") === "direct") {
    const applied = applyChange(workspace, change);
    const logged = logActivity(applied.workspace, {
      id: makeId("act"),
      at: change.at,
      actor: change.actor,
      summary: applied.summary,
      targetId: applied.targetId,
      accountId: applied.accountId,
    });
    return { outcome: "applied", ...applied, workspace: logged };
  }

  const applied = applyChange(projectPending(workspace), change);
  const proposal: Proposal = {
    id: makeId("prop"),
    createdAt: change.at,
    actor: change.actor,
    change,
    summary: applied.summary,
    status: "pending",
  };
  return {
    outcome: "proposed",
    workspace: { ...workspace, updatedAt: change.at, proposals: [proposal, ...(workspace.proposals ?? [])] },
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
