import {
  Activity,
  CalendarClock,
  Github,
  LifeBuoy,
  Mail,
  MessageSquare,
  NotebookPen,
  Phone,
  Star,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import type {
  AccountStage,
  ClaimKind,
  Contact,
  DealStage,
  NoteSource,
  Priority,
  Sentiment,
} from "../types";

/** Every tone resolves to a semantic ramp (bg + fg + solid). Color encodes KIND. */
export type Tone =
  | "neutral"
  | "accent"
  | "signal"
  | "account"
  | "agent"
  | "highlight"
  | "success"
  | "warning"
  | "destructive";

/* ---- Accounts: stage ---------------------------------------------------- */

export const stageMeta: Record<
  AccountStage,
  { label: string; tone: Tone; railIndex: number | null }
> = {
  researching: { label: "Researching", tone: "signal", railIndex: 0 },
  active: { label: "Active", tone: "account", railIndex: 1 },
  expanding: { label: "Expanding", tone: "success", railIndex: 2 },
  renewing: { label: "Renewing", tone: "highlight", railIndex: 3 },
  at_risk: { label: "At risk", tone: "destructive", railIndex: null },
};

export const stageRail: AccountStage[] = ["researching", "active", "expanding", "renewing"];

/* ---- Deals: pipeline stage --------------------------------------------- */

export const dealStageMeta: Record<DealStage, { label: string; tone: Tone }> = {
  lead: { label: "Lead", tone: "neutral" },
  qualified: { label: "Qualified", tone: "signal" },
  proposal: { label: "Proposal", tone: "account" },
  negotiation: { label: "Negotiation", tone: "warning" },
  won: { label: "Won", tone: "success" },
  lost: { label: "Lost", tone: "destructive" },
};

/** Columns shown on the pipeline board, left → right. `lost` is tracked off-board. */
export const pipelineColumns: DealStage[] = ["lead", "qualified", "proposal", "negotiation", "won"];

/** Open pipeline = everything not yet terminal. */
export const isOpenDeal = (stage: DealStage) => stage !== "won" && stage !== "lost";

/* ---- Priority + task ---------------------------------------------------- */

export const levelOf: Record<Priority, number> = { low: 1, medium: 2, high: 3, urgent: 4 };

export const priorityMeta: Record<Priority, { label: string; tone: Tone }> = {
  low: { label: "Low", tone: "neutral" },
  medium: { label: "Medium", tone: "signal" },
  high: { label: "High", tone: "warning" },
  urgent: { label: "Urgent", tone: "destructive" },
};

/* ---- Notes: source + sentiment ----------------------------------------- */

/** Sources share ONE tone (they're all notes); the GLYPH differentiates. */
export const sourceMeta: Record<NoteSource, { label: string; icon: LucideIcon }> = {
  call: { label: "Call", icon: Phone },
  email: { label: "Email", icon: Mail },
  meeting: { label: "Meeting", icon: CalendarClock },
  note: { label: "Note", icon: NotebookPen },
  support: { label: "Support", icon: LifeBuoy },
  community: { label: "Community", icon: Users },
  review: { label: "Review", icon: Star },
  github: { label: "GitHub", icon: Github },
  usage: { label: "Usage", icon: Activity },
  market: { label: "Market", icon: TrendingUp },
};

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

export const sentimentMeta: Record<Sentiment, { label: string; tone: Tone; glyph: string }> = {
  positive: { label: "Positive", tone: "success", glyph: "▲" },
  mixed: { label: "Mixed", tone: "warning", glyph: "◆" },
  negative: { label: "Negative", tone: "destructive", glyph: "▼" },
  neutral: { label: "Neutral", tone: "neutral", glyph: "–" },
};

/* ---- Claims: what we know, by kind ------------------------------------- */

export const claimKindMeta: Record<ClaimKind, { label: string; plural: string; tone: Tone; sensitive: boolean }> = {
  need: { label: "Need", plural: "Needs", tone: "success", sensitive: false },
  goal: { label: "Goal", plural: "Goals", tone: "accent", sensitive: false },
  objection: { label: "Objection", plural: "Objections", tone: "warning", sensitive: true },
  risk: { label: "Risk", plural: "Risks", tone: "destructive", sensitive: true },
  commitment: { label: "Commitment", plural: "Commitments", tone: "account", sensitive: true },
  fact: { label: "Fact", plural: "Facts", tone: "neutral", sensitive: false },
};

/** Display order: what they want first, then what stands in the way. */
export const claimKindOrder: ClaimKind[] = ["need", "goal", "objection", "risk", "commitment", "fact"];

/* ---- Contacts: influence (rings never use agent-violet — that's AI only) - */

export const influenceMeta: Record<Contact["influence"], { label: string; tone: Tone }> = {
  economic: { label: "Economic", tone: "success" },
  champion: { label: "Champion", tone: "highlight" },
  technical: { label: "Technical", tone: "signal" },
  user: { label: "User", tone: "neutral" },
};

/* ---- Thresholds --------------------------------------------------------- */

/** Health/score bands: >=70 healthy, 40-69 watch, <40 at-risk. */
export function thresholdTone(value: number): Tone {
  if (value >= 70) return "success";
  if (value >= 40) return "warning";
  return "destructive";
}
