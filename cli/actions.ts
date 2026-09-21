import type { Account, Actor, Op, Proposal, Workspace } from "../src/types.ts";
import { buildBrief, type Brief } from "../src/core/brief.ts";
import { accountMarkdown, accountRecords, uniqueSlugs } from "../src/core/markdown.ts";
import { OpError, newChange, pendingProposals, projectPending, resolveProposal, submitChange } from "../src/core/ops.ts";
import { validateWorkspace } from "../src/core/validate.ts";
import { readWorkspace, staleViews, updateWorkspace, repairViews } from "./store.ts";

/**
 * What the `crm` command and the MCP server can do, as plain functions over a
 * workspace folder. Each returns data; the callers decide how to show it.
 */

/** Find an account by id, file slug, exact name, or an unambiguous part of the name. */
export function resolveAccount(workspace: Workspace, ref: string): Account {
  const needle = ref.trim().toLowerCase();
  if (!needle) throw new OpError("missing_field", "An account is required.");
  const slugs = uniqueSlugs(workspace.accounts);
  const exact = workspace.accounts.find((a) => a.id === ref || slugs.get(a.id) === needle || a.name.toLowerCase() === needle);
  if (exact) return exact;
  const partial = workspace.accounts.filter((a) => a.name.toLowerCase().includes(needle) || (slugs.get(a.id) ?? "").includes(needle));
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) {
    throw new OpError("ambiguous", `"${ref}" matches ${partial.length} accounts: ${partial.map((a) => `${a.name} (${a.id})`).join(", ")}. Use the id.`);
  }
  throw new OpError("not_found", `No account matches "${ref}". List them with: crm accounts`);
}

export function status(dir: string): Brief & { agentMode: string } {
  const { workspace } = readWorkspace(dir);
  return { ...buildBrief(workspace), agentMode: workspace.agentMode ?? "review" };
}

export function listAccounts(dir: string) {
  const { workspace } = readWorkspace(dir);
  const slugs = uniqueSlugs(workspace.accounts);
  return workspace.accounts.map((a) => ({
    id: a.id,
    slug: slugs.get(a.id) ?? "",
    name: a.name,
    stage: a.stage,
    priority: a.priority,
    owner: a.owner,
    health: a.health,
    lastTouch: a.lastTouch,
    openTasks: workspace.tasks.filter((t) => t.accountId === a.id && t.status === "open").length,
    notes: workspace.notes.filter((n) => n.accountId === a.id).length,
  }));
}

export function showAccount(dir: string, ref: string) {
  const { workspace } = readWorkspace(dir);
  const account = resolveAccount(workspace, ref);
  const records = accountRecords(workspace, account);
  const waiting = pendingProposals(workspace).filter((p) => "accountId" in p.change.op && p.change.op.accountId === account.id);
  const pending = waiting.length
    ? ["", "## Waiting for review", ...waiting.map((p) => `- ${p.summary} · by ${p.actor.name} \`${p.id}\` → \`${p.change.recordId}\``), ""].join("\n")
    : "";
  return { account, ...records, pending: waiting, markdown: accountMarkdown(account, records.deals, records.tasks, records.notes) + pending };
}

export interface SearchHit {
  kind: "account" | "contact" | "deal" | "task" | "note";
  id: string;
  title: string;
  accountId?: string;
  accountName?: string;
  snippet?: string;
}

export function search(dir: string, query: string): SearchHit[] {
  const { workspace } = readWorkspace(dir);
  const needle = query.trim().toLowerCase();
  if (!needle) throw new OpError("missing_field", "A search query is required.");
  const has = (...parts: (string | undefined)[]) => parts.some((part) => part?.toLowerCase().includes(needle));
  const nameOf = new Map(workspace.accounts.map((a) => [a.id, a.name]));
  const hits: SearchHit[] = [];
  for (const a of workspace.accounts) {
    if (has(a.name, a.domain, a.segment, ...a.tags, ...a.needs, ...a.risks)) hits.push({ kind: "account", id: a.id, title: a.name, accountId: a.id, accountName: a.name });
    for (const c of a.contacts) {
      if (has(c.name, c.role, c.email)) hits.push({ kind: "contact", id: c.id, title: `${c.name} — ${c.role}`, accountId: a.id, accountName: a.name });
    }
  }
  for (const d of workspace.deals) {
    if (has(d.name)) hits.push({ kind: "deal", id: d.id, title: `${d.name} (${d.stage})`, accountId: d.accountId, accountName: nameOf.get(d.accountId) });
  }
  for (const t of workspace.tasks) {
    if (has(t.title, t.reason)) hits.push({ kind: "task", id: t.id, title: `${t.title} (${t.status})`, accountId: t.accountId, accountName: t.accountId ? nameOf.get(t.accountId) : undefined });
  }
  for (const n of workspace.notes) {
    if (!has(n.title, n.body, n.sourceRef)) continue;
    const at = n.body.toLowerCase().indexOf(needle);
    const snippet = at >= 0 ? n.body.slice(Math.max(0, at - 60), at + needle.length + 60).replace(/\s+/g, " ").trim() : undefined;
    hits.push({ kind: "note", id: n.id, title: n.title, accountId: n.accountId, accountName: nameOf.get(n.accountId), snippet });
  }
  return hits;
}

export function listTasks(dir: string, options: { all?: boolean; account?: string } = {}) {
  const { workspace } = readWorkspace(dir);
  const accountId = options.account ? resolveAccount(workspace, options.account).id : undefined;
  const nameOf = new Map(workspace.accounts.map((a) => [a.id, a.name]));
  return workspace.tasks
    .filter((t) => (options.all || t.status === "open") && (!accountId || t.accountId === accountId))
    .sort((a, b) => a.due.localeCompare(b.due))
    .map((t) => ({ ...t, accountName: t.accountId ? nameOf.get(t.accountId) : undefined }));
}

export interface ChangeResult {
  outcome: "applied" | "proposed";
  summary: string;
  /** The new or touched record when applied; the proposal when held for review. */
  id: string;
  /** The record this change creates or touches. For a proposal, the id the
   *  record will have once approved; later proposals may already cite it. */
  recordId: string;
  next: string;
}

/** Submit one operation. `account` fields may be any account reference. */
export function change(dir: string, actor: Actor, build: (workspace: Workspace) => Op, options: { key?: string; review?: boolean } = {}): ChangeResult {
  return updateWorkspace(dir, ({ workspace }) => {
    // Resolve references against pending work too, so an agent can add a note
    // to an account it proposed a moment ago.
    const submitted = submitChange(workspace, { ...newChange(build(projectPending(workspace)), actor), ...options });
    const result: ChangeResult =
      submitted.outcome === "applied"
        ? { outcome: "applied", summary: submitted.summary, id: submitted.targetId, recordId: submitted.targetId, next: "Applied and saved." }
        : {
            outcome: "proposed",
            summary: submitted.summary,
            id: submitted.proposalId,
            recordId: submitted.targetId,
            next: `Held for review as ${submitted.proposalId}. You can already cite ${submitted.targetId} in later changes. A person approves in the app under Review.`,
          };
    return { workspace: submitted.workspace, result };
  }).result;
}

export function listProposals(dir: string, all = false): Proposal[] {
  const { workspace } = readWorkspace(dir);
  return all ? workspace.proposals ?? [] : pendingProposals(workspace);
}

export function decide(dir: string, proposalRef: string, decision: "approve" | "reject", by: string): Proposal[] {
  return updateWorkspace(dir, ({ workspace }) => {
    const ids = proposalRef === "all" ? pendingProposals(workspace).map((p) => p.id) : [proposalRef];
    if (ids.length === 0) throw new OpError("not_found", "There are no pending proposals.");
    let next = workspace;
    const resolved: Proposal[] = [];
    // Oldest first, so a proposal that builds on an earlier one still applies.
    for (const id of [...ids].reverse()) {
      const step = resolveProposal(next, id, decision, by);
      next = step.workspace;
      resolved.push(step.proposal);
    }
    return { workspace: next, result: resolved };
  }).result;
}

export function setAgentMode(dir: string, mode: "review" | "direct") {
  return updateWorkspace(dir, ({ workspace }) => ({ workspace: { ...workspace, agentMode: mode, updatedAt: new Date().toISOString() }, result: mode })).result;
}

export function activity(dir: string, limit = 20) {
  return (readWorkspace(dir).workspace.activity ?? []).slice(0, limit);
}

/** Validate the records and confirm the Markdown views match them. With
 *  `fix`, stale views are regenerated first. */
export function check(dir: string, fix = false) {
  const { workspace } = fix ? repairViews(dir) : readWorkspace(dir);
  const errors = validateWorkspace(workspace);
  const stale = staleViews(dir, workspace);
  const warnings: string[] = [];
  for (const task of workspace.tasks) {
    if (task.status === "open" && task.origin && !task.evidence?.length) warnings.push(`Task ${task.id} was added by ${task.origin.name} without evidence.`);
  }
  return { ok: errors.length === 0 && stale.length === 0, errors, staleViews: stale, warnings };
}
