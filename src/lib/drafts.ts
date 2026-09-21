import type { AccountStage, Contact, DealStage, NoteSource, Priority } from "../types";

export const accountStages: AccountStage[] = [
  "researching",
  "active",
  "expanding",
  "renewing",
  "at_risk",
];

export const priorities: Priority[] = ["low", "medium", "high", "urgent"];

export const contactInfluences: Contact["influence"][] = [
  "economic",
  "champion",
  "technical",
  "user",
];

export const dealStages: DealStage[] = [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
];

export const emptyAccountDraft = {
  name: "",
  domain: "",
  segment: "",
  owner: "",
  stage: "researching" as AccountStage,
  priority: "medium" as Priority,
  contactName: "",
  contactRole: "",
};
export type AccountDraft = typeof emptyAccountDraft;

export const emptyContactDraft = {
  name: "",
  role: "",
  email: "",
  influence: "champion" as Contact["influence"],
};
export type ContactDraft = typeof emptyContactDraft;

export type NoteDraft = {
  occurredAt?: string;
  interaction?: boolean;
  accountId: string;
  contactId: string;
  source: NoteSource;
  title: string;
  body: string;
  sourceRef: string;
};

export type TaskDraft = {
  title: string;
  accountId: string;
  due: string;
  owner: string;
  priority: Priority;
};

export type DealDraft = {
  accountId: string;
  name: string;
  value: string;
  stage: DealStage;
  closeDate: string;
  owner: string;
};
