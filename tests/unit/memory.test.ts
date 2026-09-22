import assert from "node:assert/strict";
import { test } from "node:test";
import { createDemoWorkspace } from "../../src/core/demo.ts";
import { seedWorkspace } from "../../src/data/seed.ts";
import { accountMemory, briefMarkdown, lintWorkspace, trace } from "../../src/core/memory.ts";
import { applyChange, newChange, pendingProposals, resolveProposal, submitChange } from "../../src/core/ops.ts";
import { normalizeWorkspace, parseWorkspace, validateWorkspace } from "../../src/core/validate.ts";
import { buildViewFiles, workspaceLayout } from "../../src/core/markdown.ts";
import type { Actor, Op, Workspace } from "../../src/types.ts";

const agent: Actor = { kind: "agent", name: "test-agent" };
const at = "2026-09-22T12:00:00.000Z";
const now = new Date(at);
const demo = () => normalizeWorkspace(createDemoWorkspace());
const change = (op: Op, actor: Actor = { kind: "human", name: "you" }) => newChange(op, actor, at);

test("legacy needs and risks become claims once, and the lists are derived from claims afterwards", () => {
  const legacy = structuredClone(seedWorkspace) as Workspace;
  delete legacy.claims;
  const loaded = normalizeWorkspace(legacy);
  const northstar = loaded.claims!.filter((c) => c.accountId === "acct_northstar" && c.status === "active");
  assert.deepEqual(northstar.filter((c) => c.kind === "need").map((c) => c.text), legacy.accounts[0].needs);
  assert.ok(northstar.every((c) => c.evidence.length === 0), "migrated claims are hunches");
  assert.deepEqual(normalizeWorkspace(loaded).claims!.length, loaded.claims!.length, "running again adds nothing");
  assert.deepEqual(validateWorkspace(loaded), []);
});

test("recording a claim with evidence grounds it; the legacy list follows", () => {
  const workspace = demo();
  const before = workspace.accounts[0].needs.length;
  const next = applyChange(workspace, change({ type: "claim.add", accountId: "acct_northstar", kind: "need", text: "A data-flow diagram before the pilot review", evidence: ["note_northstar_call"], contactId: "contact_eli" })).workspace;
  assert.equal(next.accounts[0].needs.length, before + 1);
  assert.equal(next.accounts[0].needs.at(-1), "A data-flow diagram before the pilot review");
  const memory = accountMemory(next, "acct_northstar", now);
  const g = memory.claims.find((x) => x.claim.text.startsWith("A data-flow"))!;
  assert.equal(g.grounded, true);
  assert.equal(g.contact?.name, "Eli Moreno");
  assert.deepEqual(validateWorkspace(next), []);
});

test("a claim's evidence must be a note on the same account, and duplicates are refused", () => {
  const workspace = demo();
  assert.throws(() => applyChange(workspace, change({ type: "claim.add", accountId: "acct_northstar", kind: "risk", text: "x", evidence: ["note_harbor_support"] })), /another account/);
  assert.throws(() => applyChange(workspace, change({ type: "claim.add", accountId: "acct_northstar", kind: "risk", text: "x", evidence: ["note_missing"] })), /existing notes/);
  assert.throws(() => applyChange(workspace, change({ type: "claim.add", accountId: "acct_northstar", kind: "risk", text: "sensitive manufacturing customers require local data handling" })), /already recorded/);
  assert.throws(() => applyChange(workspace, change({ type: "claim.add", accountId: "acct_northstar", kind: "need", text: "x", owner: "us" })), /Only a commitment/);
});

test("resolving with a replacement keeps the history readable", () => {
  const workspace = demo();
  const old = workspace.claims!.find((c) => c.id === "claim_northstar_legal")!;
  const next = applyChange(workspace, change({ type: "claim.resolve", claimId: old.id, reason: "Legal cleared it after the security explainer", replacement: { text: "Legal accepts the pilot with local data handling", evidence: ["note_northstar_call"] } })).workspace;
  const resolved = next.claims!.find((c) => c.id === old.id)!;
  assert.equal(resolved.status, "superseded");
  assert.ok(resolved.supersededBy);
  const replacement = next.claims!.find((c) => c.id === resolved.supersededBy)!;
  assert.equal(replacement.kind, "objection");
  assert.equal(replacement.status, "active");
  assert.equal(replacement.contactId, old.contactId, "the person carries over");
  assert.throws(() => applyChange(next, change({ type: "claim.resolve", claimId: old.id, reason: "again" })), /already superseded/);
  const memory = accountMemory(next, "acct_northstar", now);
  assert.equal(memory.history[0].claim.id, old.id);
  assert.deepEqual(validateWorkspace(next), []);
});

test("updating needs through the legacy list resolves the claims it drops and adds hunches for the new ones", () => {
  const workspace = demo();
  const next = applyChange(workspace, change({ type: "account.update", accountId: "acct_northstar", patch: { needs: ["Follow-ups that cite calls, notes, and open product gaps", "A brand-new need"] } })).workspace;
  const claims = next.claims!.filter((c) => c.accountId === "acct_northstar" && c.kind === "need");
  assert.equal(claims.find((c) => c.text === "Account memory across a long founder-led sales cycle")!.status, "resolved");
  assert.equal(claims.find((c) => c.text === "A brand-new need")!.evidence.length, 0);
  assert.deepEqual(next.accounts[0].needs, ["Follow-ups that cite calls, notes, and open product gaps", "A brand-new need"]);
});

test("agent claims wait for review like any other change, and can be cited by a task in the same session", () => {
  const claim = newChange({ type: "claim.add", accountId: "acct_harbor", kind: "objection", text: "Drafts must be reviewed before sending", evidence: ["note_harbor_support"] }, agent, at);
  const first = submitChange(demo(), claim);
  assert.equal(first.outcome, "proposed");
  assert.equal(first.workspace.claims!.some((c) => c.id === claim.recordId), false);
  const approved = resolveProposal(first.workspace, pendingProposals(first.workspace)[0].id, "approve", "Rowan").workspace;
  assert.deepEqual(approved.claims!.find((c) => c.id === claim.recordId)!.origin, agent);
});

test("memory ranks what to ask: overdue commitments, then hunches, then missing roles", () => {
  const memory = accountMemory(demo(), "acct_northstar", now);
  assert.equal(memory.questions[0].rank, 1);
  assert.match(memory.questions[0].text, /^Did we send the local-first security explainer/);
  assert.ok(memory.questions.some((q) => q.text === "Who approves the budget and signs?"));
  assert.equal(memory.gaps.map((g) => g.influence).sort().join(","), "economic,user");
  assert.ok(memory.counts.grounded > 0);
  const harbor = accountMemory(demo(), "acct_harbor", now);
  assert.ok(harbor.questions.filter((q) => q.rank === 2).length >= 3, "hunches become confirmation questions");
});

test("the brief names a record on every line it can", () => {
  const markdown = briefMarkdown(accountMemory(demo(), "acct_meridian", now), now);
  assert.match(markdown, /^# Meridian Health Co-op · brief for 2026-09-22/);
  for (const section of ["## Since last contact", "## Where things stand", "## Commitments", "## Who decides", "## Open work"]) assert.ok(markdown.includes(section), section);
  assert.ok(markdown.includes("`claim_meridian_clear`"));
  assert.ok(markdown.includes("`note_meridian_meeting`"));
  assert.ok(markdown.includes("**Theirs**"));
});

test("a trace runs from source to action and back", () => {
  const workspace = demo();
  const fromTask = trace(workspace, "task_northstar_security", now)!;
  assert.equal(fromTask.focus.kind, "task");
  assert.ok(fromTask.upstream.some((n) => n.id === "note_northstar_call"));
  assert.ok(fromTask.upstream.some((n) => n.kind === "claim"), "claims resting on the same note show up");
  assert.ok(fromTask.downstream.some((n) => n.id === "deal_northstar_pilot"));

  const fromClaim = trace(workspace, "claim_northstar_local", now)!;
  assert.ok(fromClaim.upstream.some((n) => n.id === "note_northstar_call"));
  assert.ok(fromClaim.upstream.some((n) => n.id === "contact_eli"));
  assert.ok(fromClaim.downstream.some((n) => n.id === "task_northstar_security"));

  const fromNote = trace(workspace, "note_northstar_call", now)!;
  assert.equal(fromNote.upstream[0].kind, "source");
  assert.ok(fromNote.downstream.length >= 4);

  const hunch = trace(workspace, "claim_harbor_inbox", now)!;
  assert.equal(hunch.focus.tone, "hunch");
  assert.equal(hunch.upstream.length, 0);
  assert.equal(trace(workspace, "nothing", now), null);
});

test("lint finds hunches, missing roles and overdue commitments, and is quiet when the memory is sound", () => {
  const findings = lintWorkspace(demo(), now);
  const codes = new Set(findings.map((f) => f.code));
  for (const code of ["hunch", "overdue_commitment", "no_economic_buyer", "no_champion"]) assert.ok(codes.has(code as never), code);
  assert.ok(findings.every((f) => f.message && f.accountName));
  assert.equal(findings[0].severity, "warn", "warnings sort first");
  const only = lintWorkspace(demo(), now, "acct_meridian");
  assert.ok(only.every((f) => f.accountId === "acct_meridian"));
});

test("Markdown views list what we know with evidence ids, and hunches say so", () => {
  const northstar = buildViewFiles(demo(), workspaceLayout, true).find((f) => f.path === "accounts/northstar-robotics.md")!.content;
  assert.ok(northstar.includes("## What we know"));
  assert.ok(northstar.includes("**Commitment** (ours,"));
  assert.ok(northstar.includes("`claim_northstar_legal`"));
  const harbor = buildViewFiles(demo(), workspaceLayout, true).find((f) => f.path === "accounts/harbor-reed-advisory.md")!.content;
  assert.ok(harbor.includes("hunch, no source"));
});

test("a claims list survives a round trip through the parser", () => {
  const text = JSON.stringify(demo());
  const { workspace, errors } = parseWorkspace(text);
  assert.deepEqual(errors, []);
  assert.equal(workspace!.claims!.length, demo().claims!.length);
  const broken = demo();
  broken.claims![0].evidence = ["note_missing"];
  assert.ok(validateWorkspace(broken).some((e) => e.includes("claims[0].evidence")));
});
