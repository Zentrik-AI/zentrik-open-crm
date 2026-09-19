import assert from "node:assert/strict";
import { test } from "node:test";
import { buildBrief } from "../../src/core/brief.ts";
import { createDemoWorkspace } from "../../src/core/demo.ts";
import { GENERATED_NOTICE, buildViewFiles, workspaceLayout } from "../../src/core/markdown.ts";
import { OpError, newChange, pendingProposals, resolveProposal, submitChange } from "../../src/core/ops.ts";
import { normalizeWorkspace, parseWorkspace, validateWorkspace } from "../../src/core/validate.ts";
import type { Actor } from "../../src/types.ts";

const agent: Actor = { kind: "agent", name: "test-agent" };
const demo = () => normalizeWorkspace(createDemoWorkspace());

test("a person's change applies at once", () => {
  const workspace = demo();
  const result = submitChange(workspace, newChange({ type: "task.add", title: "Call Eli", accountId: "acct_northstar" }));
  assert.equal(result.outcome, "applied");
  assert.equal(result.workspace.tasks[0].title, "Call Eli");
  assert.equal(result.workspace.tasks[0].origin, undefined);
});

test("an agent's change waits for review and leaves the records untouched", () => {
  const workspace = demo();
  const result = submitChange(workspace, newChange({ type: "task.add", title: "Call Eli", accountId: "acct_northstar", evidence: ["note_northstar_call"] }, agent));
  assert.equal(result.outcome, "proposed");
  assert.equal(result.workspace.tasks.length, workspace.tasks.length);
  assert.equal(pendingProposals(result.workspace).length, 1);
});

test("approval replays the exact change and records who decided", () => {
  const change = newChange({ type: "note.add", accountId: "acct_harbor", title: "Sync failed", body: "Third time.", source: "support", sourceRef: "ticket 212" }, agent);
  const proposed = submitChange(demo(), change);
  assert.equal(proposed.outcome, "proposed");
  const { workspace, proposal } = resolveProposal(proposed.workspace, pendingProposals(proposed.workspace)[0].id, "approve", "Jorge");
  assert.equal(proposal.status, "applied");
  assert.equal(workspace.notes[0].id, change.recordId);
  assert.deepEqual(workspace.notes[0].origin, agent);
  assert.match(workspace.activity![0].summary, /approved by Jorge/);
  assert.throws(() => resolveProposal(workspace, proposal.id, "approve", "Jorge"), OpError);
});

test("rejection changes no record", () => {
  const proposed = submitChange(demo(), newChange({ type: "deal.move", dealId: "deal_northstar_pilot", stage: "won" }, agent));
  const { workspace } = resolveProposal(proposed.workspace, pendingProposals(proposed.workspace)[0].id, "reject", "Jorge");
  assert.equal(workspace.deals.find((d) => d.id === "deal_northstar_pilot")!.stage, "proposal");
  assert.equal(pendingProposals(workspace).length, 0);
});

test("direct mode applies an agent's change and logs it", () => {
  const result = submitChange({ ...demo(), agentMode: "direct" }, newChange({ type: "task.set_status", taskId: "task_northstar_security", status: "done" }, agent));
  assert.equal(result.outcome, "applied");
  assert.equal(result.workspace.activity![0].actor.name, "test-agent");
});

test("invalid changes are refused before anything is stored", () => {
  const workspace = demo();
  assert.throws(() => submitChange(workspace, newChange({ type: "task.add", title: "x", evidence: ["note_missing"] }, agent)), /existing notes/);
  assert.throws(() => submitChange(workspace, newChange({ type: "deal.move", dealId: "deal_northstar_pilot", stage: "signed" as never })), /must be one of/);
  assert.throws(() => submitChange(workspace, newChange({ type: "note.add", accountId: "acct_missing", title: "t", body: "b", source: "call" })), /No account/);
  assert.throws(() => submitChange(workspace, newChange({ type: "account.add", name: "northstar robotics" })), /already exists/);
});

test("a stale proposal fails loudly instead of corrupting records", () => {
  const proposed = submitChange(demo(), newChange({ type: "task.set_status", taskId: "task_northstar_security", status: "done" }, agent));
  const without = { ...proposed.workspace, tasks: proposed.workspace.tasks.filter((t) => t.id !== "task_northstar_security") };
  assert.throws(() => resolveProposal(without, pendingProposals(without)[0].id, "approve", "Jorge"), /No task/);
});

test("date-only due dates mean the end of that local day", () => {
  const result = submitChange(demo(), newChange({ type: "task.add", title: "Today", due: "2026-10-02" }));
  const due = new Date(result.workspace.tasks[0].due);
  assert.deepEqual([due.getFullYear(), due.getMonth(), due.getDate(), due.getHours()], [2026, 9, 2, 23]);
});

test("validation accepts the demo and names what is wrong with a broken file", () => {
  assert.deepEqual(validateWorkspace(demo()), []);
  const broken = demo();
  broken.notes[0].accountId = "acct_gone";
  broken.tasks[0].priority = "whenever" as never;
  const errors = validateWorkspace(broken);
  assert.ok(errors.some((e) => e.includes("notes[0].accountId")));
  assert.ok(errors.some((e) => e.includes("tasks[0].priority")));
  assert.deepEqual(parseWorkspace("{nope").errors, ["The file is not valid JSON."]);
  assert.ok(parseWorkspace(JSON.stringify({ accounts: [] })).errors.length > 0);
});

test("workspaces written before agent operations load with safe defaults", () => {
  const { agentMode: _mode, proposals: _proposals, activity: _activity, ...older } = demo();
  const loaded = parseWorkspace(JSON.stringify(older)).workspace!;
  assert.equal(loaded.agentMode, "review");
  assert.deepEqual(loaded.proposals, []);
});

test("Markdown views carry every record id so agents can cite and address them", () => {
  const workspace = demo();
  const files = buildViewFiles(workspace, workspaceLayout, true);
  assert.equal(files[0].path, "INDEX.md");
  const northstar = files.find((f) => f.path === "accounts/northstar-robotics.md")!;
  assert.ok(northstar.content.includes(GENERATED_NOTICE));
  for (const id of ["acct_northstar", "contact_eli", "deal_northstar_pilot", "task_northstar_security", "note_northstar_call"]) {
    assert.ok(northstar.content.includes(id), `missing ${id}`);
  }
});

test("the brief ranks what needs attention and says why", () => {
  const brief = buildBrief(demo());
  assert.ok(brief.attention.length > 0);
  assert.equal(brief.attention[0].rank, Math.min(...brief.attention.map((a) => a.rank)));
  assert.ok(brief.attention.some((a) => a.kind === "account_at_risk" && a.recordId === "acct_harbor"));
  assert.ok(brief.attention.every((a) => a.why.length > 0 && a.recordId));
});

test("an agent can build on its own pending work, and approval keeps the order honest", () => {
  const note = newChange({ type: "note.add", accountId: "acct_northstar", title: "Legal gate", body: "Diagram needed.", source: "call", sourceRef: "inbox/call.txt" }, agent);
  const first = submitChange(demo(), note);
  assert.equal(first.outcome, "proposed");
  const second = submitChange(first.workspace, newChange({ type: "task.add", title: "Send diagram", accountId: "acct_northstar", evidence: [note.recordId] }, agent));
  assert.equal(second.outcome, "proposed");

  const [taskProposal, noteProposal] = pendingProposals(second.workspace);
  assert.throws(() => resolveProposal(second.workspace, taskProposal.id, "approve", "Jorge"), /builds on another proposal/, "the task cannot land before its evidence");
  const afterNote = resolveProposal(second.workspace, noteProposal.id, "approve", "Jorge").workspace;
  const done = resolveProposal(afterNote, taskProposal.id, "approve", "Jorge").workspace;
  assert.deepEqual(done.tasks[0].evidence, [note.recordId]);
});
