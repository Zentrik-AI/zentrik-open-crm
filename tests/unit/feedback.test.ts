import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FEEDBACK_STORAGE_KEY, createPublicFeedbackBundle, createGitHubIssueDraft,
  readFeedbackDraft, saveFeedbackDraft, deleteFeedbackDraft,
} from "../../src/lib/feedback.ts";

const draft = { kind: "bug" as const, title: " Example bug ", body: " Fictional reproduction. " };

test("public bundle allowlists only user-authored feedback and fixed format labels", () => {
  const hostile = {
    ...draft,
    accounts: [{ name: "CRM_SENTINEL" }], notes: ["NOTE_SENTINEL"],
    workspaceId: "WORKSPACE_SENTINEL", credentials: "SECRET_SENTINEL",
    ideas: [{ title: "IDEA_SENTINEL" }], visibility: "private",
    toJSON: () => ({ leaked: "SERIALIZER_SENTINEL" }),
  };
  const bundle = createPublicFeedbackBundle(hostile, true);
  assert.deepEqual(JSON.parse(JSON.stringify(bundle)), {
    schema: "open-crm-feedback.v1", product: "Zentrik Open CRM", visibility: "public",
    feedback: { kind: "bug", title: "Example bug", body: "Fictional reproduction." },
  });
  assert.doesNotMatch(JSON.stringify(bundle), /SENTINEL/);
  assert.equal(draft.title, " Example bug ");
});

test("public export requires affirmative review and complete valid feedback", () => {
  assert.throws(() => createPublicFeedbackBundle(draft, false), /Review/);
  assert.throws(() => createPublicFeedbackBundle(draft, "yes" as unknown as boolean), /Review/);
  for (const invalid of [
    { ...draft, title: " " }, { ...draft, body: "" },
    { ...draft, kind: "support" }, { ...draft, title: { name: "private" } }, null,
  ]) {
    assert.throws(() => createPublicFeedbackBundle(invalid as typeof draft, true));
  }
});

test("typed sensitive text is not falsely redacted or claimed safe automatically", () => {
  const typed = { ...draft, body: "User typed PRIVATE_SENTINEL" };
  assert.throws(() => createPublicFeedbackBundle(typed, false));
  assert.equal(createPublicFeedbackBundle(typed, true).feedback.body, typed.body);
});

test("draft storage reads and writes only the feedback key, never CRM storage", () => {
  const data = new Map<string, string>([["zentrik-open-crm.workspace.v2", "PRIVATE_CRM_SENTINEL"]]);
  const touched: string[] = [];
  const storage = {
    getItem(key: string) { touched.push(key); return data.get(key) ?? null; },
    setItem(key: string, value: string) { touched.push(key); data.set(key, value); },
  };
  assert.equal(readFeedbackDraft(storage), null);
  saveFeedbackDraft(storage, { ...draft, accounts: ["EXTRA_SENTINEL"] } as typeof draft);
  assert.deepEqual(readFeedbackDraft(storage), draft);
  assert.ok(touched.every((key) => key === FEEDBACK_STORAGE_KEY));
  assert.doesNotMatch(data.get(FEEDBACK_STORAGE_KEY)!, /SENTINEL|reviewed|visibility/);
  assert.equal(data.get("zentrik-open-crm.workspace.v2"), "PRIVATE_CRM_SENTINEL");
});

test("malformed drafts and denied storage report errors without a fallback write", () => {
  for (const raw of ["{", "null", "[]", "{}", '{"kind":"bug","title":42,"body":"text"}']) {
    assert.throws(() => readFeedbackDraft({ getItem: () => raw }));
  }
  assert.throws(() => readFeedbackDraft({ getItem() { throw new Error("Denied"); } }), /Denied/);
  assert.throws(() => saveFeedbackDraft({ setItem() { throw new Error("Full"); } }, draft), /Full/);
});

test("GitHub text is derived only from the authored fields", () => {
  const issue = createGitHubIssueDraft({ ...draft, notes: ["PRIVATE_SENTINEL"] } as typeof draft);
  assert.match(issue.title, /Bug or regression/);
  assert.ok(issue.body.includes(draft.body));
  assert.doesNotMatch(JSON.stringify(issue), /PRIVATE_SENTINEL/);
});

test("public export enforces intake limits including UTF-8 and control characters", () => {
  for (const invalid of [
    { ...draft, title: "a".repeat(501) },
    { ...draft, body: "a".repeat(100001) },
    { ...draft, body: "界".repeat(100000) },
    { ...draft, body: "bad\u0000text" },
  ]) assert.throws(() => createPublicFeedbackBundle(invalid, true));
  assert.equal(createPublicFeedbackBundle({ ...draft, title: "a".repeat(500) }, true).feedback.title.length, 500);
});

test("deleting feedback removes only its own storage key and surfaces failures", () => {
  const touched: string[] = [];
  deleteFeedbackDraft({ removeItem: (key) => touched.push(key) });
  assert.deepEqual(touched, [FEEDBACK_STORAGE_KEY]);
  assert.throws(() => deleteFeedbackDraft({ removeItem() { throw new Error("Denied"); } }), /Denied/);
});
