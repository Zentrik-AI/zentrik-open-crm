export type AccountStage =
  | "researching"
  | "active"
  | "expanding"
  | "renewing"
  | "at_risk";

export type Priority = "low" | "medium" | "high" | "urgent";

/** Where a note came from — the source-grounded touchpoint kinds. */
export type NoteSource =
  | "call"
  | "email"
  | "meeting"
  | "note"
  | "support"
  | "community"
  | "review"
  | "github"
  | "usage"
  | "market";

export type Sentiment = "positive" | "mixed" | "negative" | "neutral";

/** The deal pipeline. won/lost are terminal. */
export type DealStage =
  | "lead"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

export type TaskStatus = "open" | "done";

export interface Contact {
  id: string;
  name: string;
  role: string;
  influence: "economic" | "champion" | "technical" | "user";
  email?: string;
  lastSeen: string;
}

export interface Account {
  id: string;
  name: string;
  domain: string;
  segment: string;
  stage: AccountStage;
  priority: Priority;
  /** Current recurring revenue (distinct from open pipeline in `deals`). */
  arr: number;
  health: number;
  fit: number;
  sourceConfidence: number;
  owner: string;
  tags: string[];
  contacts: Contact[];
  needs: string[];
  risks: string[];
  lastTouch: string;
  createdAt: string;
}

export interface Deal {
  id: string;
  accountId: string;
  name: string;
  stage: DealStage;
  value: number;
  owner: string;
  closeDate: string;
  probability: number;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  accountId?: string;
  dealId?: string;
  contactId?: string;
  due: string;
  owner: string;
  priority: Priority;
  status: TaskStatus;
  createdAt: string;
  completedAt?: string;
}

export interface Note {
  id: string;
  accountId: string;
  contactId?: string;
  dealId?: string;
  source: NoteSource;
  title: string;
  body: string;
  sentiment: Sentiment;
  createdAt: string;
  sourceRef?: string;
}

/* ---- Improve Open CRM (product-feedback layer — not the user's CRM data) -- */

export type IdeaStatus = "candidate" | "shaping" | "queued" | "released";

export interface Idea {
  id: string;
  title: string;
  problem: string;
  status: IdeaStatus;
  votes: number;
  targetRelease: string;
  confidence: number;
}

export interface ChangelogEntry {
  id: string;
  date: string;
  title: string;
  summary: string;
  tags: string[];
}

export interface Workspace {
  name: string;
  edition: "Self-Hosted" | "Cloud";
  updatedAt: string;
  accounts: Account[];
  deals: Deal[];
  tasks: Task[];
  notes: Note[];
  /** Product-feedback layer, surfaced only under "Improve Open CRM". */
  ideas: Idea[];
  changelog: ChangelogEntry[];
}
