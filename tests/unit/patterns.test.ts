import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createDemoWorkspace } from "../../src/core/demo.ts";
import { normalizeWorkspace } from "../../src/core/validate.ts";
import { findPatterns, keyTerms, related, signalsBundle, signalsMarkdown } from "../../src/core/patterns.ts";
import { trace } from "../../src/core/memory.ts";
import { addSource, findSource, readSources } from "../../cli/sources.ts";

const demo = () => normalizeWorkspace(createDemoWorkspace());

test("key terms drop noise and plurals; relatedness needs real overlap", () => {
  assert.deepEqual([...keyTerms("Follow-ups that cite calls, notes, and open product gaps")].sort(), ["call", "cite", "follow", "gap", "note", "open", "product", "ups"]);
  assert.ok(related(keyTerms("Procurement asks for an exportable audit trail"), keyTerms("Procurement needs an exportable audit trail before the renewal signs")));
  assert.equal(related(keyTerms("Budget is confirmed for a multi-year renewal"), keyTerms("Avoid bloated CRM administration")), false);
});

test("patterns span accounts, name their shared terms, and carry the sources behind them", () => {
  const patterns = findPatterns(demo());
  assert.ok(patterns.length >= 3, `expected the demo to show patterns, got ${patterns.length}`);
  for (const p of patterns) {
    assert.ok(p.accounts.length >= 2);
    assert.ok(p.terms.length >= 2, `pattern ${p.label} has shared terms`);
    assert.ok(new Set(p.claims.map((c) => c.accountId)).size === p.accounts.length);
    assert.equal(p.id, findPatterns(demo()).find((x) => x.label === p.label)!.id, "ids are stable");
  }
  const environment = patterns.find((p) => p.terms.includes("environment"))!;
  assert.deepEqual(environment.accounts.map((a) => a.name).sort(), ["Meridian Health Co-op", "Northstar Robotics"]);
  assert.equal(environment.notes.length, 2);
  assert.equal(environment.kinds[0].kind, "objection");
});

test("archived accounts and same-account claims never form a pattern", () => {
  const workspace = demo();
  workspace.accounts = workspace.accounts.map((a) => (a.id === "acct_meridian" ? { ...a, archivedAt: "2026-09-01T00:00:00.000Z", archiveReason: "test" } : a));
  const patterns = findPatterns(workspace);
  assert.ok(patterns.every((p) => !p.accounts.some((a) => a.id === "acct_meridian")));
  const single = { ...demo(), accounts: demo().accounts.filter((a) => a.id === "acct_northstar") };
  single.claims = single.claims!.filter((c) => c.accountId === "acct_northstar");
  assert.equal(findPatterns(single).length, 0);
});

test("the signals bundle carries sources with what they supported, and share-safe keeps people as roles", () => {
  const workspace = demo();
  const pattern = findPatterns(workspace).find((p) => p.terms.includes("environment"))!;
  const bundle = signalsBundle(workspace, { pattern, product: "Test" });
  assert.equal(bundle.schema, "open-crm-signals.v1");
  assert.equal(bundle.sources.length, 2);
  const northstar = bundle.sources.find((s) => s.externalId === "note_northstar_call")!;
  assert.equal(northstar.signalType, "meeting_notes");
  assert.equal(northstar.sourceKey, "open-crm.demo-workspace");
  assert.equal(northstar.participants[0].name, "Eli Moreno");
  assert.ok(northstar.supports.some((c) => c.kind === "objection"));
  assert.ok(northstar.account.domain);
  assert.deepEqual(northstar.sourceLinks, [], "a written reference is not a link");
  assert.match(northstar.additionalContext, /Account: Northstar Robotics \(northstar-robotics\.invalid\)/);
  assert.match(northstar.additionalContext, /Source reference: Call summary/);
  assert.equal(northstar.providerType, "open-crm");
  const linked = { ...workspace, notes: workspace.notes.map((n) => (n.id === "note_northstar_call" ? { ...n, sourceRef: "https://calls.example/rec/42" } : n)) };
  assert.deepEqual(signalsBundle(linked, { pattern }).sources.find((s) => s.externalId === "note_northstar_call")!.sourceLinks, [{ url: "https://calls.example/rec/42", name: "Pilot call: local data control is the buying gate" }]);

  const safe = signalsBundle(workspace, { pattern, shareSafe: true });
  assert.equal(safe.sources[0].participants[0].name, safe.sources[0].participants[0].role);
  assert.equal(safe.sources[0].participants[0].email, undefined);
  assert.equal(safe.sources[0].account.domain, undefined);
  assert.doesNotMatch(safe.sources[0].additionalContext, /invalid/);
  assert.equal(safe.pattern?.label, pattern.label);

  const files = signalsMarkdown(bundle);
  assert.equal(files.length, 2);
  assert.ok(files[0].content.includes("## What this supported"));
  assert.ok(files.every((f) => f.path.endsWith(".md")));

  const account = signalsBundle(workspace, { accountId: "acct_harbor" });
  assert.ok(account.sources.every((s) => s.account.externalId === "acct_harbor"));
  assert.equal(account.pattern, undefined);
});

test("a contact can be the focus of a trace", () => {
  const eli = trace(demo(), "contact_eli")!;
  assert.equal(eli.focus.kind, "contact");
  assert.ok(eli.upstream.some((n) => n.id === "note_northstar_call"), "what they said");
  assert.ok(eli.downstream.some((n) => n.id === "claim_northstar_legal"), "what we know from it");
});

test("sources are kept by content hash, deduplicated, and findable by id, external id, or hash prefix", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "open-crm-sources-"));
  const file = path.join(dir, "call.txt");
  fs.writeFileSync(file, "Eli: legal wants a diagram.\n");
  const first = addSource(dir, file, { kind: "transcript", externalId: "cal-1", occurredAt: "2026-09-20", capturedBy: "test" });
  assert.equal(first.existed, false);
  assert.match(first.source.id, /^src_[0-9a-f]{10}$/);
  assert.ok(fs.existsSync(path.join(dir, first.source.path)));
  const again = addSource(dir, file, { kind: "transcript", capturedBy: "test" });
  assert.equal(again.existed, true);
  assert.equal(again.source.id, first.source.id);
  fs.writeFileSync(path.join(dir, "other.txt"), "Different content.\n");
  const byExternal = addSource(dir, path.join(dir, "other.txt"), { kind: "email", externalId: "cal-1", capturedBy: "test" });
  assert.equal(byExternal.existed, true, "the same external id is the same source");
  assert.equal(readSources(dir).length, 1);
  assert.equal(findSource(dir, `source:${first.source.id}`)?.id, first.source.id);
  assert.equal(findSource(dir, "cal-1")?.id, first.source.id);
  assert.equal(findSource(dir, first.source.sha256.slice(0, 8))?.id, first.source.id);
  assert.throws(() => addSource(dir, file, { kind: "banana", capturedBy: "test" }), /--kind must be one of/);
  assert.throws(() => addSource(dir, path.join(dir, "missing.txt"), { capturedBy: "test" }), /Cannot read/);
});
