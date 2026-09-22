import type { Account, Claim, ClaimKind, Note, Workspace } from "../types.ts";
import { claimKindLabel, noteSourceLabel, stableId } from "./model.ts";
import { noteDate } from "./memory.ts";

/**
 * Patterns across accounts. When several accounts say the same kind of thing,
 * that is no longer account work; it is evidence about the product. Open CRM
 * notices the recurrence and hands the *sources* on. It does not draw the
 * product conclusion; that is what Zentrik is for.
 */

const STOP = new Set(
  "a an the and or of to in on for with without from by as at is are be been was were it its this that these those we our us they their them you your not no any all more less into over under before after than then so if when which who what how can could should would will just also only very much every each such via per".split(" "),
);

/** Words that carry meaning in a claim: lowercase, no punctuation, no stopwords, plurals trimmed. */
export function keyTerms(text: string): Set<string> {
  const terms = new Set<string>();
  for (const raw of text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/[\s-]+/)) {
    if (raw.length < 3 || STOP.has(raw)) continue;
    terms.add(raw.length > 3 && raw.endsWith("s") && !raw.endsWith("ss") ? raw.slice(0, -1) : raw);
  }
  return terms;
}

const overlap = (a: Set<string>, b: Set<string>) => {
  let shared = 0;
  for (const term of a) if (b.has(term)) shared += 1;
  return { shared, jaccard: shared / (a.size + b.size - shared || 1) };
};

/** Two claims are about the same thing when they share enough of their meaning. */
export function related(a: Set<string>, b: Set<string>): boolean {
  const { shared, jaccard } = overlap(a, b);
  return shared >= 3 || (shared >= 2 && jaccard >= 0.4);
}

export const patternKinds: ClaimKind[] = ["need", "objection", "goal", "risk", "fact"];

export interface Pattern {
  id: string;
  /** The shortest claim in the group, as the group's name. */
  label: string;
  /** How often each kind appears; the first entry is the dominant one. */
  kinds: Array<{ kind: ClaimKind; count: number }>;
  accounts: Array<{ id: string; name: string }>;
  claims: Claim[];
  /** Every note the group's claims cite, newest first. */
  notes: Note[];
  /** Terms the group's claims have in common, for a reader to check the grouping. */
  terms: string[];
  /** Newest evidence date across the group. */
  latest: string | null;
  hunches: number;
}

export function findPatterns(workspace: Workspace, minAccounts = 2): Pattern[] {
  const active = (workspace.claims ?? []).filter((c) => c.status === "active" && patternKinds.includes(c.kind) && !workspace.accounts.find((a) => a.id === c.accountId)?.archivedAt);
  const terms = new Map(active.map((c) => [c.id, keyTerms(c.text)]));
  const parent = new Map(active.map((c) => [c.id, c.id]));
  const find = (id: string): string => (parent.get(id) === id ? id : (parent.set(id, find(parent.get(id)!)), parent.get(id)!));
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      if (active[i].accountId === active[j].accountId) continue;
      if (related(terms.get(active[i].id)!, terms.get(active[j].id)!)) parent.set(find(active[i].id), find(active[j].id));
    }
  }
  const groups = new Map<string, Claim[]>();
  for (const claim of active) groups.set(find(claim.id), [...(groups.get(find(claim.id)) ?? []), claim]);

  const nameOf = new Map(workspace.accounts.map((a) => [a.id, a.name]));
  const patterns: Pattern[] = [];
  for (const claims of groups.values()) {
    const accountIds = [...new Set(claims.map((c) => c.accountId))];
    if (accountIds.length < minAccounts) continue;
    const kindCounts = new Map<ClaimKind, number>();
    for (const c of claims) kindCounts.set(c.kind, (kindCounts.get(c.kind) ?? 0) + 1);
    const noteIds = [...new Set(claims.flatMap((c) => c.evidence))];
    const notes = noteIds.map((id) => workspace.notes.find((n) => n.id === id)).filter((n): n is Note => Boolean(n)).sort((a, b) => noteDate(b).localeCompare(noteDate(a)));
    let common: string[] | null = null;
    for (const c of claims) {
      const own = terms.get(c.id)!;
      common = common === null ? [...own] : common.filter((t) => own.has(t));
    }
    const sortedIds = claims.map((c) => c.id).sort();
    patterns.push({
      id: stableId("pattern", ...sortedIds),
      label: [...claims].sort((a, b) => a.text.length - b.text.length)[0].text,
      kinds: [...kindCounts.entries()].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count),
      accounts: accountIds.map((id) => ({ id, name: nameOf.get(id) ?? id })),
      claims: [...claims].sort((a, b) => a.accountId.localeCompare(b.accountId)),
      notes,
      terms: [...(common ?? [])].sort(),
      latest: notes[0] ? noteDate(notes[0]) : null,
      hunches: claims.filter((c) => c.evidence.length === 0).length,
    });
  }
  return patterns.sort((a, b) => b.accounts.length - a.accounts.length || b.notes.length - a.notes.length || a.label.localeCompare(b.label));
}

export function describePattern(p: Pattern): string {
  const kind = p.kinds[0];
  const noun = claimKindLabel[kind.kind].singular.toLowerCase();
  return `${p.accounts.length} accounts share ${/^[aeiou]/.test(noun) ? "an" : "a"} ${noun}: ${p.label}`;
}

/* ---- Signals bundle: the sources behind a pattern, ready for Zentrik ------ */

/** How a note's source reads as a Zentrik signal type. */
export const signalTypeOf: Record<Note["source"], string> = {
  call: "meeting_notes",
  meeting: "meeting_notes",
  email: "feedback_record",
  note: "reconstructed_notes",
  support: "support_ticket",
  community: "feedback_record",
  review: "review",
  github: "feedback_record",
  usage: "feedback_record",
  market: "discovery_report",
};

export interface SignalSource {
  /** Stable identity for retries: the note id inside this workspace's namespace. */
  sourceKey: string;
  externalId: string;
  signalType: string;
  name: string;
  text: string;
  occurredAt?: string;
  /** The system it came from, for the receiving side's provenance. */
  providerType: "open-crm";
  /** Only real links; a written reference goes into additionalContext instead. */
  sourceLinks: Array<{ url: string; name: string }>;
  /** Account and source reference in words, since the receiving side has its own account ids. */
  additionalContext: string;
  account: { externalId: string; name: string; domain?: string };
  participants: Array<{ name: string; role: string; email?: string; affiliation: "external" }>;
  /** The claims this note grounds, so the reviewer sees why it was sent. */
  supports: Array<{ kind: ClaimKind; text: string }>;
}

export interface SignalsBundle {
  schema: "open-crm-signals.v1";
  product: string;
  generatedAt: string;
  workspace: string;
  shareSafe: boolean;
  pattern?: { id: string; label: string; accounts: string[] };
  sources: SignalSource[];
}

/**
 * The evidence behind a pattern or an account, as sources a product tool can
 * ingest. It carries the notes, not our conclusions: the receiving side draws
 * its own. Share-safe keeps people as roles and drops emails and domains.
 */
export function signalsBundle(
  workspace: Workspace,
  options: { pattern?: Pattern; accountId?: string; shareSafe?: boolean; product?: string; now?: Date } = {},
): SignalsBundle {
  const shareSafe = options.shareSafe === true;
  const notes = options.pattern
    ? options.pattern.notes
    : workspace.notes.filter((n) => !options.accountId || n.accountId === options.accountId).sort((a, b) => noteDate(b).localeCompare(noteDate(a)));
  const slug = workspace.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workspace";
  const sources: SignalSource[] = notes.map((note) => {
    const account = workspace.accounts.find((a) => a.id === note.accountId) as Account;
    const contact = account.contacts.find((c) => c.id === note.contactId);
    const ref = note.sourceRef && note.sourceRef !== "Manual entry" ? note.sourceRef : undefined;
    const isUrl = ref !== undefined && /^https?:\/\/\S+$/i.test(ref);
    return {
      sourceKey: `open-crm.${slug}`,
      externalId: note.id,
      signalType: signalTypeOf[note.source],
      name: note.title,
      text: note.body,
      occurredAt: note.occurredAt,
      providerType: "open-crm",
      sourceLinks: isUrl ? [{ url: ref, name: note.title }] : [],
      additionalContext: [`Account: ${account.name}${shareSafe || !account.domain ? "" : ` (${account.domain})`}`, ref && !isUrl ? `Source reference: ${ref}` : undefined, `Recorded in ${options.product ?? "Open CRM"} as a ${noteSourceLabel[note.source].toLowerCase()} note.`].filter(Boolean).join(" "),
      account: { externalId: account.id, name: account.name, domain: shareSafe ? undefined : account.domain },
      participants: contact ? [{ name: shareSafe ? contact.role : contact.name, role: contact.role, email: shareSafe ? undefined : contact.email, affiliation: "external" }] : [],
      supports: (workspace.claims ?? []).filter((c) => c.status === "active" && c.evidence.includes(note.id)).map((c) => ({ kind: c.kind, text: c.text })),
    };
  });
  return {
    schema: "open-crm-signals.v1",
    product: options.product ?? "Open CRM",
    generatedAt: (options.now ?? new Date()).toISOString(),
    workspace: workspace.name,
    shareSafe,
    pattern: options.pattern ? { id: options.pattern.id, label: options.pattern.label, accounts: options.pattern.accounts.map((a) => a.name) } : undefined,
    sources,
  };
}

/** One Markdown file per source, for tools that import files rather than JSON. */
export function signalsMarkdown(bundle: SignalsBundle): Array<{ path: string; content: string }> {
  const q = (v: string) => JSON.stringify(v);
  return bundle.sources.map((s) => ({
    path: `${s.externalId}.md`,
    content: [
      "---",
      `title: ${q(s.name)}`,
      `account: ${q(s.account.name)}`,
      `type: ${s.signalType}`,
      `occurredAt: ${s.occurredAt ? q(s.occurredAt) : "null"}`,
      `source: ${s.sourceLinks[0] ? q(s.sourceLinks[0].url) : "null"}`,
      `context: ${q(s.additionalContext)}`,
      `participants: [${s.participants.map((p) => q(`${p.name} (${p.role})`)).join(", ")}]`,
      "---",
      "",
      `# ${s.name}`,
      "",
      s.text,
      "",
      ...(s.supports.length ? ["## What this supported", ...s.supports.map((c) => `- ${claimKindLabel[c.kind].singular}: ${c.text}`), ""] : []),
    ].join("\n"),
  }));
}
