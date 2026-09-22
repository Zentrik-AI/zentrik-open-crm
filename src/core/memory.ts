import type { Account, Claim, ClaimKind, Contact, Deal, Note, Task, Workspace } from "../types.ts";
import { DAY_MS, STALE_EVIDENCE_DAYS, claimKindLabel, claimKinds, isOpenDeal, noteSourceLabel } from "./model.ts";

/**
 * Account memory: what we know, how we know it, who decides, and what to ask
 * next. Everything here is computed from the records, so the same answers
 * appear in the app, in `crm brief`, and in an agent's context.
 */

export const committeeLanes: Array<{ influence: Contact["influence"]; label: string; ask: string }> = [
  { influence: "economic", label: "Signs off", ask: "Who approves the budget and signs?" },
  { influence: "champion", label: "Pushes for it", ask: "Who inside wants this to happen?" },
  { influence: "technical", label: "Evaluates", ask: "Who checks that it will work for them?" },
  { influence: "user", label: "Lives with it", ask: "Who will use it day to day?" },
];

/** The date a note is evidence for: when it happened, or when it was captured. */
export const noteDate = (note: Note) => note.occurredAt ?? note.createdAt;

const daysBetween = (from: string, to: number) => Math.max(0, Math.floor((to - Date.parse(from)) / DAY_MS));

export interface GroundedClaim {
  claim: Claim;
  notes: Note[];
  contact?: Contact;
  /** Newest evidence date, or null for a hunch. */
  latest: string | null;
  ageDays: number | null;
  grounded: boolean;
  stale: boolean;
  /** A commitment whose due date has passed. */
  overdue: boolean;
}

export interface CommitteeMember {
  contact: Contact;
  daysSince: number | null;
  /** Notes that record this person saying or doing something. */
  mentions: number;
  claims: number;
}

export interface CommitteeLane {
  influence: Contact["influence"];
  label: string;
  ask: string;
  members: CommitteeMember[];
}

export interface Question {
  text: string;
  why: string;
  recordId?: string;
  rank: number;
}

export interface AccountMemory {
  account: Account;
  /** Active claims, newest evidence first, hunches last. */
  claims: GroundedClaim[];
  byKind: Record<ClaimKind, GroundedClaim[]>;
  /** Resolved and superseded claims, newest first. */
  history: GroundedClaim[];
  committee: CommitteeLane[];
  gaps: CommitteeLane[];
  /** What was recorded after the last verified interaction. */
  since: { from: string | null; notes: Note[]; claims: GroundedClaim[]; tasksDone: Task[] };
  commitments: { ours: GroundedClaim[]; theirs: GroundedClaim[] };
  questions: Question[];
  openTasks: Task[];
  openDeals: Deal[];
  counts: { grounded: number; hunches: number; stale: number };
}

export function groundClaim(workspace: Workspace, claim: Claim, now: number): GroundedClaim {
  const notes = claim.evidence.map((id) => workspace.notes.find((n) => n.id === id)).filter((n): n is Note => Boolean(n));
  const dates = notes.map(noteDate).sort();
  const latest = dates.at(-1) ?? null;
  const ageDays = latest ? daysBetween(latest, now) : null;
  const account = workspace.accounts.find((a) => a.id === claim.accountId);
  return {
    claim,
    notes,
    contact: claim.contactId ? account?.contacts.find((c) => c.id === claim.contactId) : undefined,
    latest,
    ageDays,
    grounded: notes.length > 0,
    stale: ageDays !== null && ageDays > STALE_EVIDENCE_DAYS,
    overdue: claim.status === "active" && claim.kind === "commitment" && Boolean(claim.due) && Date.parse(claim.due!) < now,
  };
}

const byEvidence = (a: GroundedClaim, b: GroundedClaim) => {
  if (a.grounded !== b.grounded) return a.grounded ? -1 : 1;
  return (b.latest ?? "").localeCompare(a.latest ?? "") || a.claim.createdAt.localeCompare(b.claim.createdAt);
};

const decisionStages = new Set<Account["stage"]>(["active", "expanding", "renewing", "at_risk"]);

export function accountMemory(workspace: Workspace, accountId: string, now: Date = new Date()): AccountMemory {
  const t = now.getTime();
  const account = workspace.accounts.find((a) => a.id === accountId);
  if (!account) throw new Error(`No account with id ${accountId}.`);
  const all = (workspace.claims ?? []).filter((c) => c.accountId === accountId).map((c) => groundClaim(workspace, c, t));
  const claims = all.filter((g) => g.claim.status === "active").sort(byEvidence);
  const history = all.filter((g) => g.claim.status !== "active").sort((a, b) => (b.claim.resolvedAt ?? "").localeCompare(a.claim.resolvedAt ?? ""));
  const byKind = Object.fromEntries(claimKinds.map((kind) => [kind, claims.filter((g) => g.claim.kind === kind)])) as Record<ClaimKind, GroundedClaim[]>;
  const notes = workspace.notes.filter((n) => n.accountId === accountId);

  const committee: CommitteeLane[] = committeeLanes.map((lane) => ({
    ...lane,
    members: account.contacts
      .filter((c) => c.influence === lane.influence)
      .map((contact) => ({
        contact,
        daysSince: contact.lastSeen ? daysBetween(contact.lastSeen, t) : null,
        mentions: notes.filter((n) => n.contactId === contact.id).length,
        claims: claims.filter((g) => g.claim.contactId === contact.id).length,
      }))
      .sort((a, b) => (a.daysSince ?? Infinity) - (b.daysSince ?? Infinity)),
  }));
  const gaps = committee.filter((lane) => lane.members.length === 0);

  const from = account.lastTouch;
  const after = (date: string) => !from || Date.parse(date) > Date.parse(from);
  const since = {
    from,
    notes: notes.filter((n) => after(noteDate(n))).sort((a, b) => noteDate(b).localeCompare(noteDate(a))),
    claims: claims.filter((g) => after(g.claim.createdAt)),
    tasksDone: workspace.tasks.filter((task) => task.accountId === accountId && task.status === "done" && task.completedAt && after(task.completedAt)),
  };

  const commitments = {
    ours: byKind.commitment.filter((g) => g.claim.owner !== "them").sort((a, b) => (a.claim.due ?? "").localeCompare(b.claim.due ?? "")),
    theirs: byKind.commitment.filter((g) => g.claim.owner === "them").sort((a, b) => (a.claim.due ?? "").localeCompare(b.claim.due ?? "")),
  };
  const openTasks = workspace.tasks.filter((task) => task.accountId === accountId && (task.status === "open" || task.status === "waiting")).sort((a, b) => a.due.localeCompare(b.due));
  const openDeals = workspace.deals.filter((deal) => deal.accountId === accountId && isOpenDeal(deal.stage));

  const questions: Question[] = [];
  for (const g of byKind.commitment.filter((g) => g.overdue)) {
    questions.push({ rank: 1, text: g.claim.owner === "them" ? `Did they ${lower(g.claim.text)}?` : `Did we ${lower(g.claim.text)}?`, why: `committed for ${g.claim.due!.slice(0, 10)}`, recordId: g.claim.id });
  }
  for (const g of claims.filter((g) => !g.grounded && g.claim.kind !== "commitment")) {
    questions.push({ rank: 2, text: `Confirm: ${g.claim.text}`, why: "recorded without a source", recordId: g.claim.id });
  }
  const deciding = decisionStages.has(account.stage) || openDeals.length > 0;
  for (const lane of gaps) {
    if (lane.influence === "economic" && deciding) questions.push({ rank: 3, text: lane.ask, why: "no one recorded as signing off" });
    if (lane.influence === "champion") questions.push({ rank: 4, text: lane.ask, why: "no champion recorded" });
  }
  for (const g of claims.filter((g) => g.stale && g.claim.kind !== "commitment")) {
    questions.push({ rank: 5, text: `Still true? ${g.claim.text}`, why: `last evidence ${g.ageDays} days ago`, recordId: g.claim.id });
  }
  if (!from && notes.length > 0) questions.push({ rank: 6, text: "When did we last actually talk?", why: "no verified interaction recorded" });
  questions.sort((a, b) => a.rank - b.rank);

  return {
    account,
    claims,
    byKind,
    history,
    committee,
    gaps,
    since,
    commitments,
    questions: questions.slice(0, 6),
    openTasks,
    openDeals,
    counts: { grounded: claims.filter((g) => g.grounded).length, hunches: claims.filter((g) => !g.grounded).length, stale: claims.filter((g) => g.stale).length },
  };
}

const lower = (text: string) => (text ? text[0].toLowerCase() + text.slice(1) : text);
const day = (iso: string | null | undefined) => iso?.slice(0, 10) ?? "unknown";
const tick = (id: string) => `\`${id}\``;

function claimLine(g: GroundedClaim): string {
  const who = g.contact ? ` · ${g.contact.name}` : "";
  const evidence = g.grounded ? g.notes.map((n) => tick(n.id)).join(", ") + (g.stale ? ` · ${g.ageDays} days old` : ` · ${day(g.latest)}`) : "hunch, no source";
  const due = g.claim.kind === "commitment" && g.claim.due ? ` · by ${day(g.claim.due)}${g.overdue ? " · OVERDUE" : ""}` : "";
  return `- ${g.claim.text}${who}${due} — ${evidence} ${tick(g.claim.id)}`;
}

/** The brief a person reads before a conversation, and an agent reads before
 *  recommending anything. Every line names the record behind it. */
export function briefMarkdown(memory: AccountMemory, now: Date = new Date()): string {
  const { account } = memory;
  const lines: string[] = [
    `# ${account.name} · brief for ${now.toISOString().slice(0, 10)}`,
    `*${account.segment} · ${account.stage} · owner ${account.owner} · last verified contact ${memory.since.from ? day(memory.since.from) : "unknown"}* ${tick(account.id)}`,
    "",
  ];

  lines.push(`## Since last contact`);
  if (memory.since.notes.length === 0 && memory.since.tasksDone.length === 0) lines.push(memory.since.from ? "- Nothing new recorded." : "- No verified interaction yet; everything below is what has been recorded so far.");
  for (const n of memory.since.notes) lines.push(`- ${day(noteDate(n))} ${noteSourceLabel[n.source]}: ${n.title} ${tick(n.id)}`);
  for (const task of memory.since.tasksDone) lines.push(`- ${day(task.completedAt)} done: ${task.title} ${tick(task.id)}`);
  lines.push("");

  lines.push("## Where things stand");
  const standing = (["need", "goal", "objection", "risk", "fact"] as ClaimKind[]).flatMap((kind) => memory.byKind[kind].map((g) => `${claimLine(g).replace(/^- /, `- **${claimKindLabel[kind].singular}** `)}`));
  lines.push(...(standing.length ? standing : ["- Nothing recorded yet. Capture a source note first."]), "");

  if (memory.byKind.commitment.length) {
    lines.push("## Commitments");
    for (const g of memory.commitments.ours) lines.push(claimLine(g).replace(/^- /, "- **Ours** "));
    for (const g of memory.commitments.theirs) lines.push(claimLine(g).replace(/^- /, "- **Theirs** "));
    lines.push("");
  }

  lines.push("## Who decides");
  for (const lane of memory.committee) {
    const members = lane.members.map((m) => `${m.contact.name} (${m.contact.role}${m.daysSince === null ? ", never seen" : `, seen ${m.daysSince}d ago`}) ${tick(m.contact.id)}`);
    lines.push(`- ${lane.label}: ${members.length ? members.join("; ") : `no one recorded → ${lane.ask}`}`);
  }
  lines.push("");

  if (memory.questions.length) {
    lines.push("## Ask");
    memory.questions.forEach((q, i) => lines.push(`${i + 1}. ${q.text} *(${q.why})*`));
    lines.push("");
  }

  if (memory.openTasks.length || memory.openDeals.length) {
    lines.push("## Open work");
    for (const deal of memory.openDeals) lines.push(`- Deal: ${deal.name} · ${deal.stage} · $${deal.value.toLocaleString("en-US")} · close ${day(deal.closeDate)} ${tick(deal.id)}`);
    for (const task of memory.openTasks) lines.push(`- [ ] ${task.title} · ${task.status} · ${task.status === "waiting" ? "review" : "due"} ${day(task.due)} · ${task.owner} ${tick(task.id)}`);
    lines.push("");
  }
  return lines.join("\n");
}

/* ---- Trace: why a record exists, and what rests on it ------------------- */

export type TraceKind = "source" | "note" | "claim" | "task" | "deal" | "contact";

export interface TraceNode {
  id: string;
  kind: TraceKind;
  title: string;
  detail?: string;
  date?: string;
  /** How the node reads: grounded evidence, a hunch, finished work, or open work. */
  tone: "grounded" | "hunch" | "done" | "open" | "neutral";
}

export interface Trace {
  accountId: string;
  focus: TraceNode;
  /** Where the focus came from. */
  upstream: TraceNode[];
  /** What rests on the focus. */
  downstream: TraceNode[];
}

function noteNode(note: Note, contact?: Contact): TraceNode {
  return { id: note.id, kind: "note", title: note.title, detail: `${noteSourceLabel[note.source]}${contact ? ` · ${contact.name}` : ""} · ${note.sourceRef || "no reference"}`, date: noteDate(note), tone: note.sourceRef && note.sourceRef !== "Manual entry" ? "grounded" : "hunch" };
}
function claimNode(g: GroundedClaim): TraceNode {
  return { id: g.claim.id, kind: "claim", title: g.claim.text, detail: `${claimKindLabel[g.claim.kind].singular}${g.claim.status !== "active" ? ` · ${g.claim.status}` : ""}`, date: g.latest ?? g.claim.createdAt, tone: g.claim.status !== "active" ? "done" : g.grounded ? "grounded" : "hunch" };
}
function taskNode(task: Task): TraceNode {
  return { id: task.id, kind: "task", title: task.title, detail: `${task.status}${task.owner ? ` · ${task.owner}` : ""}`, date: task.completedAt ?? task.due, tone: task.status === "done" ? "done" : task.status === "cancelled" ? "neutral" : "open" };
}

export function trace(workspace: Workspace, id: string, now: Date = new Date()): Trace | null {
  const t = now.getTime();
  const contactsOf = (accountId: string) => workspace.accounts.find((a) => a.id === accountId)?.contacts ?? [];
  const contactNode = (contact: Contact): TraceNode => ({ id: contact.id, kind: "contact", title: contact.name, detail: contact.role, tone: "neutral" });
  const notesFor = (ids: string[]) => ids.map((nid) => workspace.notes.find((n) => n.id === nid)).filter((n): n is Note => Boolean(n));
  const citing = (noteIds: string[], accountId: string) => ({
    claims: (workspace.claims ?? []).filter((c) => c.accountId === accountId && c.evidence.some((e) => noteIds.includes(e))),
    tasks: workspace.tasks.filter((task) => task.accountId === accountId && task.evidence?.some((e) => noteIds.includes(e))),
  });

  const task = workspace.tasks.find((x) => x.id === id);
  if (task?.accountId) {
    const notes = notesFor(task.evidence ?? []);
    const contacts = contactsOf(task.accountId);
    const related = citing(notes.map((n) => n.id), task.accountId).claims.filter((c) => c.status === "active").map((c) => claimNode(groundClaim(workspace, c, t)));
    const deal = workspace.deals.find((d) => d.id === task.dealId);
    return {
      accountId: task.accountId,
      focus: { ...taskNode(task), tone: notes.length ? (task.status === "done" ? "done" : "grounded") : "hunch", detail: task.reason ?? taskNode(task).detail },
      upstream: [...notes.map((n) => noteNode(n, contacts.find((c) => c.id === n.contactId))), ...related],
      downstream: deal ? [{ id: deal.id, kind: "deal", title: deal.name, detail: deal.stage, date: deal.closeDate, tone: deal.stage === "won" ? "done" : "open" }] : [],
    };
  }

  const claim = workspace.claims?.find((x) => x.id === id);
  if (claim) {
    const g = groundClaim(workspace, claim, t);
    const contacts = contactsOf(claim.accountId);
    const { tasks } = citing(claim.evidence, claim.accountId);
    const replacement = claim.supersededBy ? workspace.claims?.find((c) => c.id === claim.supersededBy) : undefined;
    return {
      accountId: claim.accountId,
      focus: claimNode(g),
      upstream: [...g.notes.map((n) => noteNode(n, contacts.find((c) => c.id === n.contactId))), ...(g.contact ? [contactNode(g.contact)] : [])],
      downstream: [...tasks.map(taskNode), ...(replacement ? [claimNode(groundClaim(workspace, replacement, t))] : [])],
    };
  }

  const note = workspace.notes.find((x) => x.id === id);
  if (note) {
    const contacts = contactsOf(note.accountId);
    const { claims, tasks } = citing([note.id], note.accountId);
    const contact = contacts.find((c) => c.id === note.contactId);
    return {
      accountId: note.accountId,
      focus: noteNode(note),
      upstream: [{ id: `source-${note.id}`, kind: "source", title: note.sourceRef || "No source reference", detail: `${noteSourceLabel[note.source]} · ${note.interaction ? "verified interaction" : "not verified contact"}`, date: noteDate(note), tone: note.sourceRef && note.sourceRef !== "Manual entry" ? "grounded" : "hunch" }, ...(contact ? [contactNode(contact)] : [])],
      downstream: [...claims.map((c) => claimNode(groundClaim(workspace, c, t))), ...tasks.map(taskNode)],
    };
  }
  return null;
}

/* ---- Lint: where the memory is thin ------------------------------------- */

export type LintCode = "hunch" | "stale_evidence" | "overdue_commitment" | "no_economic_buyer" | "no_champion" | "contact_never_seen" | "note_without_reference" | "agent_task_without_evidence" | "no_verified_interaction";

export interface LintFinding {
  code: LintCode;
  severity: "warn" | "info";
  message: string;
  accountId?: string;
  accountName?: string;
  recordId?: string;
}

export function lintWorkspace(workspace: Workspace, now: Date = new Date(), accountId?: string): LintFinding[] {
  const t = now.getTime();
  const findings: LintFinding[] = [];
  const accounts = workspace.accounts.filter((a) => !a.archivedAt && (!accountId || a.id === accountId));
  for (const account of accounts) {
    const memory = accountMemory(workspace, account.id, now);
    const base = { accountId: account.id, accountName: account.name };
    for (const g of memory.claims) {
      if (g.overdue) findings.push({ code: "overdue_commitment", severity: "warn", message: `Commitment past due: "${g.claim.text}" (${g.claim.owner === "them" ? "theirs" : "ours"}, ${day(g.claim.due)}).`, ...base, recordId: g.claim.id });
      else if (!g.grounded) findings.push({ code: "hunch", severity: "warn", message: `${claimKindLabel[g.claim.kind].singular} recorded without a source: "${g.claim.text}".`, ...base, recordId: g.claim.id });
      else if (g.stale) findings.push({ code: "stale_evidence", severity: "info", message: `${claimKindLabel[g.claim.kind].singular} rests on evidence ${g.ageDays} days old: "${g.claim.text}".`, ...base, recordId: g.claim.id });
    }
    const deciding = decisionStages.has(account.stage) || memory.openDeals.length > 0;
    for (const lane of memory.gaps) {
      if (lane.influence === "economic" && deciding) findings.push({ code: "no_economic_buyer", severity: "warn", message: `No one recorded as signing off. ${lane.ask}`, ...base });
      if (lane.influence === "champion") findings.push({ code: "no_champion", severity: "info", message: `No champion recorded. ${lane.ask}`, ...base });
    }
    for (const lane of memory.committee) for (const m of lane.members) {
      if (m.daysSince === null && m.mentions === 0) findings.push({ code: "contact_never_seen", severity: "info", message: `${m.contact.name} (${m.contact.role}) has no recorded interaction or note.`, ...base, recordId: m.contact.id });
    }
    if (!account.lastTouch && deciding) findings.push({ code: "no_verified_interaction", severity: "warn", message: `${account.name} is ${account.stage} with no verified interaction date.`, ...base });
    for (const note of workspace.notes.filter((n) => n.accountId === account.id)) {
      if (!note.sourceRef || note.sourceRef === "Manual entry") findings.push({ code: "note_without_reference", severity: "info", message: `Note "${note.title}" has no source reference to follow back.`, ...base, recordId: note.id });
    }
    for (const task of memory.openTasks) {
      if (task.origin && !task.evidence?.length) findings.push({ code: "agent_task_without_evidence", severity: "warn", message: `${task.origin.name} added "${task.title}" without evidence.`, ...base, recordId: task.id });
    }
  }
  const weight = { warn: 0, info: 1 };
  return findings.sort((a, b) => weight[a.severity] - weight[b.severity] || (a.accountName ?? "").localeCompare(b.accountName ?? ""));
}
