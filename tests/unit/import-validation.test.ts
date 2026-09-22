import assert from "node:assert/strict";
import { test } from "node:test";
import { seedWorkspace } from "../../src/data/seed.ts";
import { newChange, resolveProposal, submitChange } from "../../src/core/ops.ts";
import { parseWorkspace, validateWorkspace } from "../../src/core/validate.ts";
import type { Actor, Op, Proposal, Workspace } from "../../src/types.ts";

const actor: Actor = { kind: "agent", name: "import-test" };
const at = "2026-09-20T12:00:00.000Z";
const demo = () => structuredClone(seedWorkspace);
const proposal = (op: Op): Proposal => structuredClone({
  id: "prop_import", createdAt: at, actor, summary: "Review imported work",
  status: "pending", change: newChange(op, actor, at),
});

function set(workspace: Workspace, path: string, value: unknown) {
  const keys = path.split(".");
  let record = workspace as unknown as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) record = record[key] as Record<string, unknown>;
  record[keys[keys.length - 1]] = value;
}

function rejected(workspace: Workspace, path: string) {
  const result = parseWorkspace(JSON.stringify(workspace));
  assert.equal(result.workspace, undefined, `${path}: malformed import was accepted`);
  const label = path.replace(/\.(\d+)/g, "[$1]");
  assert.ok(result.errors.some(error => error.includes(label)), `${path}: ${result.errors.join("; ")}`);
}

test("legacy omissions, nullable scores, and dated notes survive import and re-export", () => {
  const workspace = demo();
  for (const path of ["edition", "updatedAt", "agentMode", "proposals", "activity", "ideas", "changelog", "receipts", "accounts.0.owner", "deals.0.owner", "deals.0.probability", "tasks.0.owner", "notes.0.sourceRef", "notes.0.occurredAt", "notes.0.interaction"]) set(workspace, path, undefined);
  workspace.accounts[0].health = null;
  workspace.accounts[0].fit = null;
  workspace.accounts[0].sourceConfidence = null;
  workspace.accounts[0].lastTouch = null;
  const parsed = parseWorkspace(JSON.stringify(workspace));
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.workspace!.agentMode, "review");
  assert.equal(parsed.workspace!.tasks[0].owner, "Unassigned");
  assert.equal(parsed.workspace!.accounts[0].owner, "Unassigned");
  assert.equal(parsed.workspace!.deals[0].probability, 55);
  assert.equal(parsed.workspace!.accounts[0].health, null);
  assert.equal(parsed.workspace!.notes[0].interaction, undefined);
  assert.deepEqual(parseWorkspace(JSON.stringify(parsed.workspace)).errors, []);
});

test("source events compare timestamps with capture time, including timezone offsets", () => {
  const workspace = demo();
  const note = workspace.notes[0];
  note.createdAt = "2099-01-01T10:00:00Z";
  note.occurredAt = "2099-01-01T11:00:00+02:00";
  note.interaction = true;
  assert.deepEqual(validateWorkspace(workspace), [], "wall clock time must not reject a valid imported timeline");
  note.occurredAt = "2099-01-01T09:30:00-02:00";
  rejected(workspace, "notes.0.occurredAt");
  note.occurredAt = note.createdAt;
  assert.deepEqual(validateWorkspace(workspace), [], "equal source and capture timestamps are valid");
});

test("notes reject malformed source metadata, invalid interactions, and foreign contacts", () => {
  for (const [key, value] of Object.entries({ occurredAt: "not a date", interaction: "false", sourceRef: {}, origin: { kind: "agent", name: [] }, contactId: "contact_lena" })) {
    const workspace = demo();
    set(workspace, `notes.0.${key}`, value);
    rejected(workspace, `notes.0.${key}`);
  }
  for (const source of ["call", "market"] as const) {
    const workspace = demo();
    Object.assign(workspace.notes[0], { source, interaction: true, occurredAt: source === "market" ? "2026-01-01" : undefined });
    rejected(workspace, "notes.0.interaction");
  }
  for (const source of ["call", "email", "meeting", "support"] as const) {
    const workspace = demo();
    Object.assign(workspace.notes[0], { source, interaction: true, occurredAt: "2026-01-01" });
    assert.deepEqual(validateWorkspace(workspace), []);
  }
});

test("optional UI strings and nested text lists reject objects, arrays, nulls, and numbers", () => {
  const paths = [
    "accounts.0.owner", "accounts.0.domain", "accounts.0.segment", "accounts.0.archiveReason",
    "accounts.0.contacts.0.role", "accounts.0.contacts.0.email", "deals.0.owner",
    "tasks.0.owner", "tasks.0.reason", "tasks.0.dealId", "tasks.0.contactId", "notes.0.sourceRef", "notes.0.dealId",
  ];
  for (const path of paths) for (const value of [{}, [], null, 42]) {
    const workspace = demo();
    set(workspace, path, value);
    rejected(workspace, path);
  }
  for (const path of ["accounts.0.tags", "accounts.0.needs", "accounts.0.risks", "changelog.0.tags"]) {
    const workspace = demo();
    set(workspace, path, ["valid", { toString: null }]);
    rejected(workspace, path);
  }
  const workspace = demo();
  set(workspace, "tasks.0.evidence", [{ toString: null }]);
  rejected(workspace, "tasks.0.evidence");
});

test("numeric fields reject non-finite values, including overflowing JSON numbers", () => {
  for (const path of ["accounts.0.arr", "accounts.0.health", "accounts.0.fit", "accounts.0.sourceConfidence", "deals.0.value", "deals.0.probability", "ideas.0.votes", "ideas.0.confidence"]) {
    for (const value of [NaN, Infinity, -Infinity, -1, "10", {}]) {
      const workspace = demo();
      set(workspace, path, value);
      assert.ok(validateWorkspace(workspace).length, `${path} accepted ${String(value)}`);
    }
  }
  const workspace = demo();
  workspace.deals[0].value = 123456789;
  const parsed = parseWorkspace(JSON.stringify(workspace).replace('"value":123456789', '"value":1e400'));
  assert.equal(parsed.workspace, undefined);
  assert.ok(parsed.errors.some(error => error.includes("deals[0].value")));
});

test("optional dates and metadata reject malformed values when present", () => {
  for (const path of ["updatedAt", "accounts.0.createdAt", "accounts.0.contacts.0.lastSeen", "deals.0.createdAt", "tasks.0.createdAt", "tasks.0.completedAt", "notes.0.createdAt", "notes.0.occurredAt"]) {
    for (const value of ["invalid", "2026-02-30", "2026-02-30T12:00:00Z", {}, 0, null]) {
      if (path.endsWith("lastSeen") && value === null) continue;
      const workspace = demo();
      set(workspace, path, value);
      rejected(workspace, path);
    }
  }
  const workspace = demo();
  set(workspace, "edition", {});
  rejected(workspace, "edition");
});

test("unknown contact interaction dates remain null and historical dates stay intact", () => {
  const workspace = demo();
  const historical = workspace.accounts[0].contacts[1].lastSeen;
  set(workspace, "accounts.0.contacts.0.lastSeen", null);
  const parsed = parseWorkspace(JSON.stringify(workspace));
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.workspace!.accounts[0].contacts[0].lastSeen, null);
  assert.equal(parsed.workspace!.accounts[0].contacts[1].lastSeen, historical);
  assert.deepEqual(parseWorkspace(JSON.stringify(parsed.workspace)).errors, []);
});

test("nested history entries and change envelopes are checked before UI use", () => {
  const fixture = () => {
    const workspace = demo();
    workspace.proposals = [proposal({ type: "task.add", title: "Review source" })];
    workspace.activity = [{ id: "act_import", at, actor: { ...actor }, summary: "Imported history" }];
    return workspace;
  };
  const cases: [string, unknown][] = [
    ["proposals.0", null], ["proposals.0.actor", null], ["proposals.0.actor.kind", "system"],
    ["proposals.0.summary", {}], ["proposals.0.status", "approved"], ["proposals.0.base", []],
    ["proposals.0.createdAt", false], ["proposals.0.resolvedAt", {}], ["proposals.0.resolvedBy", []],
    ["proposals.0.targetId", {}], ["proposals.0.change", []], ["proposals.0.change.op", null],
    ["proposals.0.change.recordId", {}], ["proposals.0.change.childId", []], ["proposals.0.change.at", 0],
    ["proposals.0.change.actor", null], ["proposals.0.change.actor.name", {}],
    ["proposals.0.change.key", "__proto__"], ["proposals.0.change.review", "false"],
    ["activity.0", null], ["activity.0.actor", []], ["activity.0.summary", {}], ["activity.0.at", "invalid"],
    ["activity.0.accountId", {}], ["activity.0.targetId", []], ["ideas.0", null],
    ["ideas.0.status", "unknown"], ["ideas.0.title", {}], ["ideas.0.problem", []], ["ideas.0.targetRelease", {}],
    ["changelog.0", false], ["changelog.0.title", {}], ["changelog.0.summary", []], ["changelog.0.date", "invalid"],
  ];
  for (const [path, value] of cases) {
    const workspace = fixture();
    set(workspace, path, value);
    rejected(workspace, path);
  }
});

test("all stored operation variants accept valid shapes and reject malformed payloads", () => {
  const cases: [Op, string, unknown][] = [
    [{ type: "account.add", name: "Example Company" }, "owner", {}],
    [{ type: "account.add", name: "Example Company" }, "contact", []],
    [{ type: "account.add", name: "Example Company", contact: { name: "Example Person", role: "Reviewer" } }, "contact.email", {}],
    [{ type: "account.update", accountId: "acct_future", patch: { health: null, fit: null } }, "patch", []],
    [{ type: "account.update", accountId: "acct_future", patch: { tags: ["review"] } }, "patch.tags", [{}]],
    [{ type: "account.update", accountId: "acct_future", patch: { owner: "Reviewer" } }, "patch.owner", {}],
    [{ type: "account.archive", accountId: "acct_future", archived: false, reason: "Restored" }, "archived", "false"],
    [{ type: "contact.add", accountId: "acct_future", name: "Example Person", role: "Reviewer" }, "role", {}],
    [{ type: "deal.add", accountId: "acct_future", name: "Example deal" }, "value", "10"],
    [{ type: "deal.move", dealId: "deal_old", stage: "won" }, "stage", {}],
    [{ type: "task.add", title: "Review source", evidence: ["note_pending"] }, "evidence", [{}]],
    [{ type: "task.set_status", taskId: "task_old", status: "waiting" }, "status", "unknown"],
    [{ type: "task.update", taskId: "task_old", patch: { owner: "Reviewer" } }, "patch", null],
    [{ type: "task.update", taskId: "task_old", patch: { owner: "Reviewer" } }, "patch.owner", {}],
    [{ type: "note.add", accountId: "acct_future", contactId: "contact_future", title: "Source", body: "Evidence", source: "call", occurredAt: at, interaction: true }, "interaction", "true"],
    [{ type: "note.add", accountId: "acct_future", title: "Source", body: "Evidence", source: "call" }, "sourceRef", {}],
  ];
  for (const [op, path, value] of cases) {
    const workspace = demo();
    workspace.proposals = [proposal(op)];
    assert.deepEqual(parseWorkspace(JSON.stringify(workspace)).errors, [], op.type);
    set(workspace, `proposals.0.change.op.${path}`, value);
    rejected(workspace, `proposals.0.change.op.${path}`);
  }
  for (const patch of [JSON.parse('{"__proto__":{"polluted":true}}'), { status: {} }, { unknown: "field" }]) {
    const workspace = demo();
    workspace.proposals = [proposal({ type: "account.update", accountId: "acct_future", patch })];
    rejected(workspace, "proposals.0.change.op.patch");
  }
  const workspace = demo();
  workspace.proposals = [proposal({ type: "task.add", title: "Review" })];
  set(workspace, "proposals.0.change.op.type", "constructor");
  rejected(workspace, "proposals.0.change.op.type");
});

test("proposal source dates are checked against the change capture timestamp", () => {
  const workspace = demo();
  workspace.proposals = [proposal({ type: "note.add", accountId: "acct_future", title: "Call", body: "Evidence", source: "call", occurredAt: "2026-09-21", interaction: true })];
  rejected(workspace, "proposals.0.change.op.occurredAt");
});

test("receipt structure and operations are validated without requiring retained history", () => {
  const fixture = () => ({ ...demo(), receipts: { "import:receipt": { op: { type: "task.add" as const, title: "Review source" }, targetId: "task_removed", proposalId: "prop_trimmed", summary: "Historical receipt" } } });
  assert.deepEqual(validateWorkspace(fixture()), []);
  for (const [path, value] of [
    ["receipts", []], ["receipts.import:receipt", null], ["receipts.import:receipt.op", []],
    ["receipts.import:receipt.targetId", {}], ["receipts.import:receipt.summary", {}],
    ["receipts.import:receipt.proposalId", []], ["receipts.import:receipt.rejected", "true"],
    ["receipts.import:receipt.op.title", {}],
  ] as [string, unknown][]) {
    const workspace = fixture();
    set(workspace, path, value);
    const parsed = parseWorkspace(JSON.stringify(workspace));
    assert.equal(parsed.workspace, undefined, path);
    assert.ok(parsed.errors.some(error => error.includes("receipts")), path);
  }
  const workspace = fixture();
  set(workspace, "receipts", JSON.parse('{"__proto__":{"op":{"type":"task.add","title":"Review"},"targetId":"task_old","summary":"Receipt"}}'));
  assert.ok(validateWorkspace(workspace).some(error => error.includes("safe stable key")));
});

test("dependent pending creation, legacy baselines, and resolved histories remain importable", () => {
  let workspace = demo();
  const account = newChange({ type: "account.add", name: "Example Import Company", contact: { name: "Example Person", role: "Reviewer" } }, actor, at);
  workspace = submitChange(workspace, { ...account, key: "import:account" }).workspace;
  const note = newChange({ type: "note.add", accountId: account.recordId, contactId: account.childId, source: "call", title: "Source", body: "Evidence", occurredAt: at, interaction: true }, actor, at);
  workspace = submitChange(workspace, note).workspace;
  workspace = submitChange(workspace, newChange({ type: "task.add", accountId: account.recordId, title: "Review evidence", evidence: [note.recordId] }, actor, at)).workspace;
  assert.deepEqual(parseWorkspace(JSON.stringify(workspace)).errors, []);
  for (const entry of [...workspace.proposals!].reverse()) workspace = resolveProposal(workspace, entry.id, "approve", "Reviewer", at).workspace;
  assert.deepEqual(parseWorkspace(JSON.stringify(workspace)).errors, []);
  workspace.proposals = [proposal({ type: "task.update", taskId: "task_no_longer_present", patch: { owner: "Reviewer" } })];
  assert.deepEqual(parseWorkspace(JSON.stringify(workspace)).errors, [], "old proposals without a baseline are still inspectable");
  assert.equal(workspace.proposals[0].base, undefined);
});
