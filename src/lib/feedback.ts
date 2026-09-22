/** Lightweight product-feedback helpers for the "Improve Open CRM" surface.
 *  This is about evolving the open-source product — not the user's CRM data. */

export type FeedbackKind = "request" | "bug" | "confusing" | "idea";

export const feedbackKinds: Array<{ id: FeedbackKind; label: string }> = [
  { id: "request", label: "Feature request" },
  { id: "bug", label: "Bug or regression" },
  { id: "confusing", label: "Confusing workflow" },
  { id: "idea", label: "Idea / suggestion" },
];

export type FeedbackDraft = {
  kind: FeedbackKind;
  title: string;
  body: string;
};

export const REPO_URL = "https://github.com/Zentrik-AI/zentrik-open-crm";
export const GITHUB_ISSUES_URL =
  "https://github.com/Zentrik-AI/zentrik-open-crm/issues/new/choose";
export const DISCUSSIONS_URL =
  "https://github.com/Zentrik-AI/zentrik-open-crm/discussions";

export const FEEDBACK_STORAGE_KEY = "zentrik-open-crm.feedback-draft.v1";

/** Explicit allowlist: never serialize a workspace or spread caller properties. */
export function normalizeFeedbackDraft(value: unknown): FeedbackDraft {
  if (!value || typeof value !== "object") throw new Error("Invalid feedback draft.");
  const input = value as Record<string, unknown>;
  if (!feedbackKinds.some((kind) => kind.id === input.kind) ||
      typeof input.title !== "string" || typeof input.body !== "string") {
    throw new Error("Invalid feedback draft.");
  }
  return { kind: input.kind as FeedbackKind, title: input.title, body: input.body };
}

export function readFeedbackDraft(storage: Pick<Storage, "getItem">): FeedbackDraft | null {
  const raw = storage.getItem(FEEDBACK_STORAGE_KEY);
  return raw === null ? null : normalizeFeedbackDraft(JSON.parse(raw));
}

export function saveFeedbackDraft(storage: Pick<Storage, "setItem">, draft: FeedbackDraft) {
  storage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(normalizeFeedbackDraft(draft)));
}

export function deleteFeedbackDraft(storage: Pick<Storage, "removeItem">) {
  storage.removeItem(FEEDBACK_STORAGE_KEY);
}

/** Review is a user assertion, not automatic redaction or a hosted API contract. */
export function createPublicFeedbackBundle(draft: FeedbackDraft, reviewed: boolean) {
  if (reviewed !== true) throw new Error("Review the feedback for public sharing first.");
  const feedback = normalizeFeedbackDraft(draft);
  feedback.title = feedback.title.trim();
  feedback.body = feedback.body.trim();
  if (!feedback.title || !feedback.body) throw new Error("Add a title and description first.");
  if (feedback.title.length > 500 || feedback.body.length > 100000) {
    throw new Error("Use at most 500 characters for the title and 100,000 for the description.");
  }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(feedback.title + feedback.body)) {
    throw new Error("Remove unsupported control characters before sharing.");
  }
  const bundle = {
    schema: "open-crm-feedback.v1" as const,
    product: "Zentrik Open CRM" as const,
    visibility: "public" as const,
    feedback,
  };
  // Reserve space for the readable, two-space JSON download and its newline.
  if (new TextEncoder().encode(JSON.stringify(bundle, null, 2) + "\n").byteLength > 256 * 1024) {
    throw new Error("Shorten the feedback to fit the 256 KiB handoff limit.");
  }
  return bundle;
}

export function createGitHubIssueDraft(draft: FeedbackDraft) {
  const kind = feedbackKinds.find((k) => k.id === draft.kind)?.label ?? "Feedback";
  return {
    title: `${kind}: ${draft.title}`,
    body: [
      "## Type",
      kind,
      "",
      "## What's the friction or idea?",
      draft.body,
      "",
      "## Notes",
      "- [ ] This does not include private account records, customer names, or exports.",
    ].join("\n"),
  };
}
