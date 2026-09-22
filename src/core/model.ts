import type { AccountStage, ClaimKind, ClaimStatus, Contact, DealStage, NoteSource, Priority, Sentiment } from "../types.ts";

/**
 * The vocabulary of the CRM, free of any UI or Node dependency so the app, the
 * `crm` command, and the MCP server all validate against the same lists.
 */

export const accountStages: AccountStage[] = ["researching", "active", "expanding", "renewing", "at_risk"];

export const priorities: Priority[] = ["low", "medium", "high", "urgent"];

export const contactInfluences: Contact["influence"][] = ["economic", "champion", "technical", "user"];

export const dealStages: DealStage[] = ["lead", "qualified", "proposal", "negotiation", "won", "lost"];

export const noteSources: NoteSource[] = [
  "note",
  "call",
  "email",
  "meeting",
  "support",
  "review",
  "community",
  "github",
  "usage",
  "market",
];

export const sentiments: Sentiment[] = ["positive", "mixed", "negative", "neutral"];

export const stageProbability: Record<DealStage, number> = {
  lead: 20,
  qualified: 35,
  proposal: 55,
  negotiation: 75,
  won: 100,
  lost: 0,
};

export const isOpenDeal = (stage: DealStage) => stage !== "won" && stage !== "lost";

export const accountStageLabel: Record<AccountStage, string> = {
  researching: "Researching",
  active: "Active",
  expanding: "Expanding",
  renewing: "Renewing",
  at_risk: "At risk",
};

export const dealStageLabel: Record<DealStage, string> = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

export const noteSourceLabel: Record<NoteSource, string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
  support: "Support",
  community: "Community",
  review: "Review",
  github: "GitHub",
  usage: "Usage",
  market: "Market",
};

export const claimKinds: ClaimKind[] = ["need", "risk", "goal", "objection", "commitment", "fact"];

export const claimStatuses: ClaimStatus[] = ["active", "resolved", "superseded"];

export const claimKindLabel: Record<ClaimKind, { singular: string; plural: string }> = {
  need: { singular: "Need", plural: "Needs" },
  risk: { singular: "Risk", plural: "Risks" },
  goal: { singular: "Goal", plural: "Goals" },
  objection: { singular: "Objection", plural: "Objections" },
  commitment: { singular: "Commitment", plural: "Commitments" },
  fact: { singular: "Fact", plural: "Facts" },
};

/** Evidence older than this is worth re-checking before it is relied on. */
export const STALE_EVIDENCE_DAYS = 45;

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Reject calendar rollover and ambiguous locale-dependent date strings. */
export function isValidDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const day = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  return day.getUTCFullYear() === Number(match[1]) && day.getUTCMonth() + 1 === Number(match[2]) && day.getUTCDate() === Number(match[3]);
}

/** A short id derived from its parts, so the same input always names the same
 *  record. Used where a record is created by a rule rather than by a person. */
export function stableId(prefix: string, ...parts: string[]) {
  let hash = 2166136261;
  for (const char of parts.join("\u0000")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return `${prefix}_${hash.toString(36).padStart(7, "0").slice(0, 8)}`;
}

export function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function slugify(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "account";
}

/** Read a date the way a person means it. "2026-10-02" is the END of that
 *  local day, so "due today" is never born overdue; anything else must parse. */
export function parseDue(value: string): string | null {
  if (!isValidDate(value)) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (dateOnly) {
    const [, y, m, d] = dateOnly.map(Number);
    const date = new Date(y, m - 1, d, 23, 59, 59);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
