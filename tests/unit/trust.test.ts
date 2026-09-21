import assert from "node:assert/strict";
import { test } from "node:test";
import { createDemoWorkspace } from "../../src/core/demo.ts";
import { applyChange, newChange, pendingProposals, resolveProposal, submitChange } from "../../src/core/ops.ts";
import { buildBrief } from "../../src/core/brief.ts";
import { validateWorkspace } from "../../src/core/validate.ts";
import { parseDue, isValidDate } from "../../src/core/model.ts";
import type { Actor, Op } from "../../src/types.ts";

const actor: Actor = { kind: "agent", name: "test-agent" };
const at = "2026-09-20T12:00:00.000Z";
const demo = createDemoWorkspace;
const change = (op: Op) => newChange(op, actor, at);

test("source and due dates reject calendar rollover and ambiguous input", () => {
  for (const value of ["2026-02-30", "2026-13-01", "09/20/2026", "2026-09-20T12:00:00"]) {
    assert.equal(isValidDate(value), false);
    assert.equal(parseDue(value), null);
  }
  assert.ok(isValidDate("2024-02-29"));
  assert.ok(isValidDate("2026-09-20T12:00:00-07:00"));
});

test("malformed booleans cannot archive or establish contact by truthiness", () => {
  assert.throws(() => applyChange(demo(), change({type:"account.archive", accountId:"acct_northstar", archived:"false" as never, reason:"Invalid request"})), /boolean/);
  assert.throws(() => applyChange(demo(), change({type:"note.add", accountId:"acct_northstar", source:"call", title:"Source", body:"Evidence", occurredAt:"2020-01-01", interaction:"false" as never})), /boolean/);
});

test("source dates compare instants across timezone offsets", () => {
  const op: Op = {type:"note.add", accountId:"acct_northstar", source:"call", title:"Offset source", body:"Evidence", occurredAt:"2026-09-20T09:00:00Z"};
  assert.throws(() => applyChange(demo(), newChange(op, actor, "2026-09-20T10:00:00+02:00")), /future/);
  const valid = {...op, occurredAt:"2026-09-20T11:00:00Z"};
  assert.ok(applyChange(demo(), newChange(valid, actor, "2026-09-20T10:00:00-02:00")).workspace.notes.length);
});

test("new unknowns stay unknown, distinct from a sourced zero", () => {
  const result = applyChange(demo(), change({ type: "account.add", name: "Example Company" })).workspace;
  assert.equal(result.accounts[0].health, null);
  assert.equal(result.accounts[0].fit, null);
  assert.equal(result.accounts[0].sourceConfidence, null);
  assert.equal(result.accounts[0].lastTouch, null);
  assert.deepEqual(validateWorkspace(result), []);
  const known = applyChange(result, change({ type: "account.update", accountId: result.accounts[0].id, patch: { health: 0 } })).workspace;
  assert.equal(known.accounts[0].health, 0);
});

test("research and contact creation never refresh relationship touch; dated interactions do", () => {
  let workspace = demo();
  const accountId = workspace.accounts[0].id;
  workspace.accounts[0].lastTouch = "2026-01-01T12:00:00.000Z";
  workspace = applyChange(workspace, change({ type: "note.add", accountId, source: "market", title: "Research", body: "Public source", occurredAt: "2026-01-15" })).workspace;
  assert.equal(workspace.accounts[0].lastTouch, "2026-01-01T12:00:00.000Z");
  workspace = applyChange(workspace, change({ type: "contact.add", accountId, name: "Casey Example", role: "Research contact" })).workspace;
  assert.equal(workspace.accounts[0].lastTouch, "2026-01-01T12:00:00.000Z");
  const contact = workspace.accounts[0].contacts.at(-1)!;
  assert.equal(contact.lastSeen, null);
  workspace = applyChange(workspace, change({ type: "note.add", accountId, contactId: contact.id, source: "call", title: "Conversation", body: "Actual call", occurredAt: "2026-02-01", interaction: true })).workspace;
  assert.equal(workspace.accounts[0].lastTouch, "2026-02-01T00:00:00.000Z");
  assert.equal(workspace.accounts[0].contacts.at(-1)!.lastSeen, "2026-02-01T00:00:00.000Z");
  assert.equal(workspace.notes[0].createdAt, at);
  assert.throws(() => applyChange(workspace, change({ type: "note.add", accountId, source: "market", title: "x", body: "y", occurredAt: "2026-09-01", interaction: true })), /verified interaction/);
  assert.throws(() => applyChange(workspace, change({ type: "note.add", accountId, source: "call", title: "x", body: "y", interaction: true })), /actual date/);
});

test("an old proposal cannot overwrite a newer human edit, but unrelated edits are allowed", () => {
  const source = demo();
  const accountId = source.accounts[0].id;
  const pending = submitChange(source, change({ type: "account.update", accountId, patch: { owner: "Sam" } }));
  const id = pendingProposals(pending.workspace)[0].id;
  const updated = applyChange(pending.workspace, newChange({ type: "account.update", accountId, patch: { owner: "Casey" } })).workspace;
  assert.throws(() => resolveProposal(updated, id, "approve", "Alex"), /changed since/);
  assert.equal(updated.accounts[0].owner, "Casey");
  const unrelated = applyChange(pending.workspace, newChange({ type: "account.update", accountId, patch: { segment: "New segment" } })).workspace;
  assert.equal(resolveProposal(unrelated, id, "approve", "Alex").workspace.accounts[0].owner, "Sam");
});

test("account names are unique on add, rename and import validation", () => {
  const source = demo();
  assert.throws(() => applyChange(source, change({ type: "account.update", accountId: source.accounts[0].id, patch: { name: source.accounts[1].name.toUpperCase() } })), /already exists/);
  source.accounts[0].name = source.accounts[1].name;
  assert.ok(validateWorkspace(source).some(e => e.includes("duplicates another")));
});

test("waiting work is review-only; archived work stays inspectable but leaves due queues", () => {
  const source = demo();
  const task = source.tasks[0];
  const waiting = applyChange(source, change({ type: "task.update", taskId: task.id, patch: { status: "waiting", due: "2026-01-10", reason: "Only when the buyer replies" } })).workspace;
  const brief = buildBrief(waiting, new Date(at));
  assert.equal(brief.attention.find(i => i.recordId === task.id)?.kind, "waiting_review");
  const archived = applyChange(waiting, change({ type: "account.archive", accountId: task.accountId!, archived: true, reason: "No active work" })).workspace;
  assert.ok(!buildBrief(archived, new Date(at)).attention.some(i => i.accountId === task.accountId));
  assert.equal(archived.tasks.length, source.tasks.length);
  assert.throws(() => applyChange(archived, change({ type: "task.add", accountId: task.accountId, title: "New work" })), /Restore/);
  assert.throws(() => applyChange(archived, change({ type: "deal.add", accountId: task.accountId!, name: "Hidden deal" })), /Restore/);
  const restored = applyChange(archived, change({ type: "account.archive", accountId: task.accountId!, archived: false, reason: "Buyer replied" })).workspace;
  assert.ok(buildBrief(restored, new Date(at)).attention.some(i => i.accountId === task.accountId));
});

test("retries preserve one proposal and one record, including after review-history trimming", () => {
  const op: Op = { type: "task.add", title: "Send example diagram", accountId: "acct_northstar", evidence: ["note_northstar_call"] };
  const request = () => ({ ...change(op), key: "daily:note_northstar_call:diagram", review: true });
  const first = submitChange({ ...demo(), agentMode: "direct" }, request());
  assert.equal(first.outcome, "proposed");
  const retry = submitChange(first.workspace, request());
  assert.equal(retry.targetId, first.targetId);
  assert.equal(retry.workspace.proposals!.length, 1);
  const accepted = resolveProposal(retry.workspace, pendingProposals(retry.workspace)[0].id, "approve", "Alex").workspace;
  const again = submitChange({ ...accepted, proposals: [] }, request());
  assert.equal(again.workspace.tasks.length, accepted.tasks.length);
  assert.throws(() => submitChange(accepted, { ...request(), op: { ...op, title: "Different work" } }), /different work/);
  const rejected = resolveProposal(first.workspace, pendingProposals(first.workspace)[0].id, "reject", "Alex").workspace;
  assert.throws(() => submitChange(rejected, request()), /rejected/);
});

test("pending duplicate work is not added under a new title key", () => {
  const op: Op = { type: "task.add", title: "One action", accountId: "acct_northstar" };
  const first = submitChange(demo(), change(op));
  assert.throws(() => submitChange(first.workspace, change(op)), /already exists/);
});

test("task edits preserve evidence and cancellation is not completion", () => {
  const source = demo();
  const task = source.tasks[0];
  task.evidence = [source.notes[0].id];
  const edited = applyChange(source, change({ type: "task.update", taskId: task.id, patch: { title: "Revised action", owner: "Sam", status: "cancelled", reason: "No longer required" } })).workspace.tasks[0];
  assert.deepEqual(edited.evidence, task.evidence);
  assert.equal(edited.completedAt, undefined);
  assert.equal(edited.status, "cancelled");
});

test("retry identity ignores property ordering and covers human clients", () => {
  const first = submitChange(demo(), { ...newChange({ type: "task.add", title: "Unique retry action", accountId: "acct_northstar" }), key: "human:retry" });
  const retried = submitChange(first.workspace, { ...newChange({ accountId: "acct_northstar", title: "Unique retry action", type: "task.add" }), key: "human:retry" });
  assert.equal(retried.workspace.tasks.length, first.workspace.tasks.length);
});

test("dependent updates can be approved after the account creation they need", () => {
  const added = submitChange(demo(), change({ type: "account.add", name: "Dependent Example" }));
  const edited = submitChange(added.workspace, change({ type: "account.update", accountId: added.targetId, patch: { owner: "Sam" } }));
  const [update, create] = pendingProposals(edited.workspace);
  assert.throws(() => resolveProposal(edited.workspace, update.id, "approve", "Alex"), /another proposal/);
  const created = resolveProposal(edited.workspace, create.id, "approve", "Alex").workspace;
  assert.equal(resolveProposal(created, update.id, "approve", "Alex").workspace.accounts[0].owner, "Sam");
});
