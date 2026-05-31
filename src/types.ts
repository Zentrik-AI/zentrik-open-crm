export type AccountStage =
  | "researching"
  | "active"
  | "expanding"
  | "renewing"
  | "at_risk";

export type Priority = "low" | "medium" | "high" | "urgent";

export type SignalSource =
  | "call"
  | "email"
  | "support"
  | "community"
  | "feedback"
  | "review"
  | "github"
  | "usage"
  | "market";

export type Sentiment = "positive" | "mixed" | "negative" | "neutral";

export type IdeaStatus = "candidate" | "shaping" | "queued" | "released";

export interface Contact {
  id: string;
  name: string;
  role: string;
  influence: "economic" | "champion" | "technical" | "user";
  lastSeen: string;
}

export interface NextAction {
  id: string;
  label: string;
  due: string;
  owner: string;
  status: "open" | "done";
}

export interface Account {
  id: string;
  name: string;
  domain: string;
  segment: string;
  stage: AccountStage;
  priority: Priority;
  arr: number;
  health: number;
  fit: number;
  sourceConfidence: number;
  owner: string;
  tags: string[];
  contacts: Contact[];
  needs: string[];
  risks: string[];
  nextAction: NextAction;
  lastTouch: string;
}

export interface Signal {
  id: string;
  accountId: string;
  source: SignalSource;
  title: string;
  body: string;
  sentiment: Sentiment;
  impact: Priority;
  receivedAt: string;
  sourceRef: string;
  linkedIdeaId?: string;
}

export interface Idea {
  id: string;
  title: string;
  problem: string;
  status: IdeaStatus;
  votes: number;
  linkedSignalIds: string[];
  targetRelease: string;
  confidence: number;
}

export interface CodexTask {
  id: string;
  title: string;
  status: "ready" | "running" | "needs_review";
  accountId?: string;
  ideaId?: string;
  prompt: string;
  guardrail: string;
}

export interface EvolutionLogEntry {
  id: string;
  date: string;
  title: string;
  summary: string;
  evidence: string[];
}

export interface Workspace {
  name: string;
  edition: "Self-Hosted" | "Cloud";
  updatedAt: string;
  accounts: Account[];
  signals: Signal[];
  ideas: Idea[];
  codexTasks: CodexTask[];
  evolutionLog: EvolutionLogEntry[];
}
