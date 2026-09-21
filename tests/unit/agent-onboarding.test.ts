import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

// The package smoke runs this same public CLI contract against the installed tarball.
const bin = process.env.OPEN_CRM_TEST_BIN ?? path.resolve(import.meta.dirname, "../../bin/open-crm.js");
const env: NodeJS.ProcessEnv = { ...process.env, OPEN_CRM_ACTOR: "onboarding-test" };
delete env.OPEN_CRM_WORKSPACE;

function run(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, { cwd, env, encoding: "utf8", timeout: 15_000 });
  assert.equal(result.status, 0, `${command} ${args.join(" ")}\n${result.error ?? result.stderr}\n${result.stdout}`);
  return result.stdout;
}

function workspace(t: TestContext, demo = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "open-crm-onboarding-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dir = path.join(root, "workspace with spaces");
  run(process.execPath, [bin, "init", dir, ...(demo ? ["--demo"] : []), "--json"], root);
  const read = (file: string) => fs.readFileSync(path.join(dir, file), "utf8");
  const crm = (...args: string[]) => process.platform === "win32"
    ? run(process.execPath, [bin, "--workspace", dir, ...args], dir)
    : run(path.join(dir, "crm"), args, dir);
  const json = (...args: string[]) => JSON.parse(crm(...args, "--json"));
  const refresh = () => JSON.parse(run(process.execPath, [bin, "init", dir, "--refresh", "--json"], root));
  return { dir, read, crm, json, refresh };
}

test("a cold workspace exposes the agent kit and setup stays read-only with no scheduler", (t) => {
  const { dir, read, json } = workspace(t);
  for (const file of ["AGENTS.md", "CLAUDE.md", "docs/agent-setup.md", "docs/agent-routines.md",
    ".agents/skills/open-crm-operator/SKILL.md", ".claude/skills/open-crm-operator/SKILL.md"]) {
    assert.ok(read(file).length, `missing instructions: ${file}`);
  }
  assert.equal(read(".agents/skills/open-crm-operator/SKILL.md"), read(".claude/skills/open-crm-operator/SKILL.md"));
  const records = read("workspace.json"), receipt = read("automations/routines.json");
  const setup = json("setup");
  assert.equal(fs.realpathSync(setup.workspace), fs.realpathSync(dir));
  assert.ok(read(setup.instructions).length);
  assert.equal(setup.liveScheduleVerified, false);
  assert.equal(setup.configuration.deliveryMode, "manual");
  assert.equal(setup.configuration.status, "unconfigured");
  assert.deepEqual(setup.configuration.owners, []);
  assert.equal(setup.configuration.timezone, null);
  assert.equal(setup.configuration.routines.length, 2);
  for (const routine of setup.configuration.routines) {
    assert.equal(routine.enabled, false);
    for (const field of ["scheduler", "nativeId", "cadence", "verifiedAt", "nextRunAt"]) assert.equal(routine[field], null);
    assert.ok(read(routine.instructions).length);
  }
  assert.deepEqual(json("setup"), setup);
  assert.equal(json("check").ok, true);
  assert.equal(json("status").agentMode, "review");
  assert.deepEqual(json("proposals", "--all"), []);
  assert.deepEqual(json("tasks", "--all"), []);
  assert.equal(read("workspace.json"), records);
  assert.equal(read("automations/routines.json"), receipt);
});

for (const mode of ["review", "direct"]) {
  test(`manual onboarding in ${mode} mode holds a dated note and grounded task, then retries without duplicates`, (t) => {
    const { dir, read, json, refresh } = workspace(t, true);
    // Synthetic fixture decisions only; the routine itself never changes mode or approves work.
    if (mode === "direct") json("mode", "direct", "--approved-by", "Fixture Operator");
    const before = json("show", "northstar");
    const sourceRef = "inbox/synthetic-review.md";
    fs.writeFileSync(path.join(dir, sourceRef), "Synthetic source, 2020-01-10: Fixture Operator will review the sample by 2020-01-20.\n");
    const configuration = JSON.parse(read("automations/routines.json"));
    Object.assign(configuration, { workspacePath: dir, host: "fixture-host", owners: ["Fixture Operator"], timezone: "Etc/UTC", outputDestination: "this manual test" });
    fs.writeFileSync(path.join(dir, "automations/routines.json"), JSON.stringify(configuration, null, 2) + "\n");
    assert.equal(json("check").ok, true);
    json("status"); json("proposals", "--all"); json("tasks", "--all");
    const noteArgs = ["note", "add", "--account", before.account.id, "--title", "Synthetic dated source",
      "--body", "Fixture Operator will review the sample by 2020-01-20.", "--source", "note", "--ref", sourceRef,
      "--occurred-at", "2020-01-10", "--key", `fixture:${before.account.id}:source:note`, "--review"];
    const note = json(...noteArgs);
    const taskArgs = ["task", "add", "--account", before.account.id, "--title", "Review the synthetic sample",
      "--owner", "Fixture Operator", "--due", "2020-01-20", "--evidence", note.recordId,
      "--reason", "The dated synthetic source requests a sample review.",
      "--key", `fixture:${before.account.id}:source:review-task`, "--review"];
    const task = json(...taskArgs);
    assert.equal(note.outcome, "proposed");
    assert.equal(task.outcome, "proposed");
    const proposals = json("proposals", "--all");
    assert.equal(proposals.length, 2);
    const noteOp = proposals.find((p: { id: string }) => p.id === note.id).change.op;
    assert.equal(noteOp.occurredAt, "2020-01-10");
    assert.equal(noteOp.sourceRef, sourceRef);
    assert.equal(noteOp.interaction, false);
    const taskOp = proposals.find((p: { id: string }) => p.id === task.id).change.op;
    assert.deepEqual(taskOp.evidence, [note.recordId]);
    assert.equal(taskOp.due, "2020-01-20");
    const after = json("show", before.account.id);
    assert.deepEqual(after.notes, before.notes);
    assert.deepEqual(after.tasks, before.tasks);
    assert.equal(after.account.lastTouch, before.account.lastTouch);
    const records = read("workspace.json");
    assert.deepEqual(json(...noteArgs), note);
    assert.deepEqual(json(...taskArgs), task);
    assert.deepEqual(json("proposals", "--all"), proposals);
    assert.equal(read("workspace.json"), records);
    // Refresh must retain both pending work and durable retry receipts.
    refresh();
    assert.equal(read("workspace.json"), records);
    assert.deepEqual(json(...noteArgs), note);
    assert.deepEqual(json(...taskArgs), task);
    assert.equal(read("workspace.json"), records);
    assert.equal(json("check").ok, true);
  });
}

test("refresh preserves operator edits and saved schedule receipts while supplying missing files and reviewable updates", (t) => {
  const { dir, read, json, refresh } = workspace(t);
  const edited = ["AGENTS.md", "CLAUDE.md", "docs/agent-setup.md", "docs/agent-routines.md",
    "playbooks/daily-review.md", ".agents/skills/open-crm-operator/SKILL.md", ".claude/skills/open-crm-operator/SKILL.md"];
  const original = new Map(edited.map(file => [file, read(file)]));
  for (const file of edited) fs.appendFileSync(path.join(dir, file), "\nOperator edit: preserve this local instruction.\n");
  const manifest = JSON.parse(read("automations/routines.json"));
  Object.assign(manifest, { host: "fixture-host", owners: ["Fixture Operator"], timezone: "Etc/UTC" });
  // An inert fixture receipt exercises preservation; no native job exists or is created.
  Object.assign(manifest.routines[0], { nativeId: "synthetic-disabled-receipt", scheduler: "fixture-only", verifiedAt: "2020-01-10T00:00:00.000Z" });
  fs.writeFileSync(path.join(dir, "automations/routines.json"), JSON.stringify(manifest, null, 2) + "\n");
  fs.writeFileSync(path.join(dir, ".mcp.json"), '{"mcpServers":{},"operatorNote":"keep"}\n');
  const preserved = new Map([...edited, "automations/routines.json", ".mcp.json", "workspace.json"].map(file => [file, read(file)]));
  fs.rmSync(path.join(dir, "playbooks/prepare-call.md"));
  fs.writeFileSync(path.join(dir, "crm"), "outdated wrapper\n");
  for (let pass = 0; pass < 2; pass++) {
    assert.equal(refresh().refreshed, true);
    for (const [file, text] of preserved) assert.equal(read(file), text, `${file} changed on refresh`);
    for (const [file, text] of original) assert.equal(read(`.open-crm/kit-updates/${file}`), text);
    assert.ok(read("playbooks/prepare-call.md").length);
    assert.ok(!fs.existsSync(path.join(dir, ".open-crm/kit-updates/automations/routines.json")));
    assert.equal(json("setup").liveScheduleVerified, false);
    assert.deepEqual(json("setup").configuration, manifest);
    assert.equal(json("check").ok, true);
  }
});
