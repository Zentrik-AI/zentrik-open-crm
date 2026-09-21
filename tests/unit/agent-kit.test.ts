import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { agentKitFiles } from "../../cli/agent-kit.ts";
import { agentsMd, claudeMd, playbooks } from "../../cli/templates.ts";
import { createDemoWorkspace } from "../../src/core/demo.ts";

test("agent kit is deterministic, portable and resolves its skill references", () => {
  const files = agentKitFiles();
  assert.deepEqual(files, agentKitFiles());
  assert.equal(Object.keys(files).length, 5);
  for (const [file, content] of Object.entries(files)) {
    assert.ok(!path.isAbsolute(file) && !file.split("/").includes(".."));
    assert.ok(content.endsWith("\n"));
  }
  const codex = ".agents/skills/open-crm-operator/SKILL.md";
  const claude = ".claude/skills/open-crm-operator/SKILL.md";
  assert.equal(files[codex], files[claude]);
  assert.match(files[codex], /^---\nname: open-crm-operator\ndescription: .+\n---\n/);
  for (const file of [codex, claude]) {
    for (const match of files[file].matchAll(/\]\(([^)]+)\)/g)) {
      assert.ok(files[path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1]))], `broken skill reference: ${match[1]}`);
    }
  }
});

test("automation receipt starts disabled without inferred scope or live identifiers", () => {
  const files = agentKitFiles();
  const manifest = JSON.parse(files["automations/routines.json"]);
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.status, "unconfigured");
  assert.equal(manifest.deliveryMode, "manual");
  assert.deepEqual(manifest.owners, []);
  for (const field of ["workspacePath", "host", "timezone", "outputDestination", "confirmedAt"]) assert.equal(manifest[field], null);
  assert.deepEqual(manifest.routines.map((r: { id: string }) => r.id), ["daily-review", "weekly-review"]);
  for (const routine of manifest.routines) {
    assert.equal(routine.enabled, false);
    for (const field of ["cadence", "scheduler", "nativeId", "verifiedAt", "nextRunAt"]) assert.equal(routine[field], null);
    assert.equal(routine.reviewRequired, true);
    assert.equal(routine.stableKeysRequired, true);
    assert.ok(files[routine.instructions]);
    assert.equal(typeof routine.promptTemplate, "string");
    assert.ok(routine.promptTemplate.includes(`Run the ${routine.id} routine`));
    assert.deepEqual(
      [...routine.promptTemplate.matchAll(/\{\{(\w+)\}\}/g)].map((m: RegExpMatchArray) => m[1]).sort(),
      ["workspacePath", "host", "owners", "timezone", "outputDestination"].sort(),
    );
    for (const required of ["--key <stable-key> --review", "canonical records and pending proposals", "not a disposable Git worktree", "never approve proposals or send external messages"]) {
      assert.ok(routine.promptTemplate.includes(required), required);
    }
  }
});

test("first-run entrypoints route to the same guarded routine contract", () => {
  const files = agentKitFiles();
  const entry = agentsMd(createDemoWorkspace());
  assert.equal(claudeMd.trim(), "@AGENTS.md");
  for (const doc of ["docs/agent-setup.md", "docs/agent-routines.md"]) {
    assert.ok(files[doc]);
    assert.ok(entry.includes(doc));
  }
  assert.ok(playbooks["daily-review.md"].includes("docs/agent-routines.md"));
  assert.match(entry, /--key <stable-key> --review/);
  assert.doesNotMatch(entry, /nothing you do can corrupt/);
  const run = files["docs/agent-routines.md"];
  // Contract checks intentionally inspect packaged instructions, not runtime safety.
  for (const text of ["./crm proposals --all --json", "./crm tasks --all --json", "--key <stable-key> --review", "--occurred-at", "--interaction", "same key and payload", "no additional notes", "never send external messages"]) assert.ok(run.includes(text), text);
  const setup = files["docs/agent-setup.md"];
  for (const text of ["IANA timezone", "List existing native schedules", "Read the native schedule back", "returned ID", "use manual mode", "Do not infer support from a product name"]) assert.ok(setup.includes(text), text);
  assert.ok(setup.includes("https://code.claude.com/docs/en/desktop-scheduled-tasks"));
  assert.ok(setup.includes("Cloud /schedule runs use a"));
  assert.ok(setup.includes("exact shared local CRM folder"));
  assert.ok(setup.includes("Unresolved placeholders block enabling"));
  assert.ok(!setup.includes("https://code.claude.com/docs/en/scheduled-tasks"));
});
