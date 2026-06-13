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
