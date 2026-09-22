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

export type TaskStatus = "open" | "waiting" | "done" | "cancelled";

/** Who made a change. People work in the visual CRM; agents work through the
 *  `crm` command or the MCP server. */
export interface Actor {
  kind: "human" | "agent";
  name: string;
}

export interface Contact {
  id: string;
  name: string;
  role: string;
  influence: "economic" | "champion" | "technical" | "user";
  email?: string;
  lastSeen: string | null;
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
  health: number | null;
  fit: number | null;
  sourceConfidence: number | null;
  owner: string;
  tags: string[];
  contacts: Contact[];
  needs: string[];
  risks: string[];
  lastTouch: string | null;
  archivedAt?: string;
  archiveReason?: string;
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
  /** Why this task exists, in one sentence. */
  reason?: string;
  /** Ids of the notes that ground this task. Empty means it is a hunch. */
  evidence?: string[];
  /** Set when an agent created the record. */
  origin?: Actor;
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
  /** Date of the source event, distinct from the capture timestamp. */
  occurredAt?: string;
  /** Explicitly verified contact with the account, never inferred from capture. */
  interaction?: boolean;
  /** Set when an agent created the record. */
  origin?: Actor;
}

/* ---- Claims: what we know about an account, and how we know it ---------- */

/** The kinds of fact a team keeps about an account. */
export type ClaimKind = "need" | "risk" | "goal" | "objection" | "commitment" | "fact";

export type ClaimStatus = "active" | "resolved" | "superseded";

/** One thing we believe about an account, with the notes that say so. A claim
 *  with no evidence is a hunch and is shown as one. Claims are never edited in
 *  place: a change of mind resolves the old claim and records the new one. */
export interface Claim {
  id: string;
  accountId: string;
  kind: ClaimKind;
  text: string;
  /** Ids of the notes that say so. Empty means a hunch. */
  evidence: string[];
  /** The person this is about or who said it, when one applies. */
  contactId?: string;
  status: ClaimStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedReason?: string;
  /** The claim that replaced this one. */
  supersededBy?: string;
  /** Commitments: who owes it ("us" or "them") and by when. */
  owner?: "us" | "them";
  due?: string;
  /** Set when an agent recorded it. */
  origin?: Actor;
}

/* ---- Operations: the one write path shared by the app, the CLI, and MCP --- */

export type AccountPatch = Partial<
  Pick<Account, "name" | "domain" | "segment" | "stage" | "priority" | "owner" | "arr" | "health" | "fit" | "tags" | "needs" | "risks">
>;
export type TaskPatch = Partial<Pick<Task, "title" | "due" | "owner" | "priority" | "status" | "reason">>;

export type Op =
  | {
      type: "account.add";
      name: string;
      domain?: string;
      segment?: string;
      owner?: string;
      stage?: AccountStage;
      priority?: Priority;
      contact?: { name: string; role: string; influence?: Contact["influence"]; email?: string };
    }
  | { type: "account.update"; accountId: string; patch: AccountPatch }
  | { type: "account.archive"; accountId: string; archived: boolean; reason: string }
  | { type: "contact.add"; accountId: string; name: string; role: string; influence?: Contact["influence"]; email?: string }
  | { type: "deal.add"; accountId: string; name: string; stage?: DealStage; value?: number; owner?: string; closeDate?: string }
  | { type: "deal.move"; dealId: string; stage: DealStage }
  | {
      type: "task.add";
      title: string;
      accountId?: string;
      due?: string;
      owner?: string;
      priority?: Priority;
      reason?: string;
      evidence?: string[];
    }
  | { type: "task.set_status"; taskId: string; status: TaskStatus }
  | { type: "task.update"; taskId: string; patch: TaskPatch }
  | {
      type: "claim.add";
      accountId: string;
      kind: ClaimKind;
      text: string;
      evidence?: string[];
      contactId?: string;
      owner?: "us" | "them";
      due?: string;
    }
  | {
      type: "claim.resolve";
      claimId: string;
      reason: string;
      /** Record what is true now; the old claim is marked superseded by it. */
      replacement?: { text: string; evidence?: string[]; kind?: ClaimKind; owner?: "us" | "them"; due?: string };
    }
  | {
      type: "note.add";
      accountId: string;
      title: string;
      body: string;
      source: NoteSource;
      sourceRef?: string;
      sentiment?: Sentiment;
      contactId?: string;
      occurredAt?: string;
      interaction?: boolean;
    };

/** An operation plus everything needed to replay it exactly: when, by whom,
 *  and the id of the record it creates. Applying a change is deterministic. */
export interface Change {
  /** Stable source/action key for retries and repeated automation runs. */
  key?: string;
  /** Explicit proposal-only execution, even in a direct-mode workspace. */
  review?: boolean;
  /** Id for the record this change creates. Unused by updates. */
  recordId: string;
  /** Secondary id: the first contact on `account.add`, or the replacement on `claim.resolve`. */
  childId?: string;
  at: string;
  actor: Actor;
  op: Op;
}

/* ---- Agent loop: proposed changes and the record of what happened -------- */

/** How agent-made changes land. "review" holds each one for a person to
 *  approve; "direct" applies it immediately and records it in the activity log. */
export type AgentMode = "review" | "direct";

export type ProposalStatus = "pending" | "applied" | "rejected";

/** One change an agent asked for, waiting for (or resolved by) a person. */
export interface Proposal {
  /** Relevant fields as they stood when this proposal was prepared. */
  base?: Record<string, unknown>;
  id: string;
  createdAt: string;
  actor: Actor;
  /** The exact operation that runs on approval. */
  change: Change;
  summary: string;
  status: ProposalStatus;
  resolvedAt?: string;
  resolvedBy?: string;
  /** Id of the record the change created or touched, once applied. */
  targetId?: string;
}

export interface ActivityEntry {
  id: string;
  at: string;
  actor: Actor;
  summary: string;
  targetId?: string;
  accountId?: string;
}

export interface Workspace {
  /** Durable retry receipts; retained after a proposal leaves the visible history. */
  receipts?: Record<string, { op: Op; targetId: string; proposalId?: string; summary: string; rejected?: boolean }>;
  /** Missing in workspaces written before agent operations existed. */
  agentMode?: AgentMode;
  proposals?: Proposal[];
  activity?: ActivityEntry[];
  name: string;
  edition: "Self-Hosted" | "Cloud";
  updatedAt: string;
  accounts: Account[];
  deals: Deal[];
  tasks: Task[];
  notes: Note[];
  /** What we know about each account. Missing in workspaces written before
   *  claims existed; `needs` and `risks` on accounts are derived from these. */
  claims?: Claim[];
}
