import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";
import { pathToFileURL } from "node:url";
import { createApi } from "../../cli/api.ts";
import { readWorkspace, repairViews, replaceWorkspace, restoreWorkspace, RevisionConflict, staleViews, StoreError, updateWorkspace, withWorkspaceLock, writeViews, writeWorkspace } from "../../cli/store.ts";
import { createDemoWorkspace } from "../../src/core/demo.ts";
import { GENERATED_NOTICE } from "../../src/core/markdown.ts";
import { newChange } from "../../src/core/ops.ts";
import { watchFolder } from "../../src/lib/backend.ts";

const storeURL = pathToFileURL(path.resolve(import.meta.dirname, "../../cli/store.ts")).href;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check: () => boolean) {
  const deadline = Date.now() + 5000;
  while (!check()) { assert.ok(Date.now() < deadline, "condition timed out"); await delay(20); }
}
function fixture(t: TestContext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "open-crm-store-safety-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  writeWorkspace(dir, createDemoWorkspace());
  return dir;
}
const codeIs = (code: string) => (error: unknown) => error instanceof StoreError && error.code === code;
function worker(script: string) {
  const child = spawn(process.execPath, ["--input-type=module", "-e", `import * as s from ${JSON.stringify(storeURL)}; ${script}`]);
  let output = "", errors = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { errors += chunk; });
  const done = once(child, "close").then(([code]) => { assert.equal(code, 0, errors); return output.trim(); });
  return { child, done, output: () => output };
}

function viewBytes(dir: string) {
  const names = ["INDEX.md", ...fs.readdirSync(path.join(dir, "accounts")).map((name) => `accounts/${name}`)];
  return Object.fromEntries(names.filter((name) => fs.lstatSync(path.join(dir, name)).isFile())
    .map((name) => [name, fs.readFileSync(path.join(dir, name))]));
}

for (const target of ["INDEX.md", "accounts/northstar-robotics.md"]) {
  for (const operation of ["replace", "write", "update", "views", "repair"] as const) {
    test(`${operation} refuses an unmarked ${target} before canonical or view changes`, (t) => {
      const dir = fixture(t), original = readWorkspace(dir);
      const file = path.join(dir, target);
      // Include non-UTF8 bytes: a refused collision must preserve the actual file.
      fs.writeFileSync(file, Buffer.concat([Buffer.from("Synthetic handwritten notes\r\n"), Buffer.from([0xff, 0x00])]));
      fs.appendFileSync(path.join(dir, target === "INDEX.md" ? "accounts/harbor-cloud.md" : "INDEX.md"), "\nStale generated view\n");
      fs.writeFileSync(path.join(dir, "accounts/stale-generated.md"), `${GENERATED_NOTICE}\nSynthetic orphan\n`);
      const canonical = fs.readFileSync(path.join(dir, "workspace.json"));
      const views = viewBytes(dir);
      const next = { ...original.workspace, name: "Synthetic requested change" };
      const run = () => {
        if (operation === "replace") return replaceWorkspace(dir, next, original.rev);
        if (operation === "write") return writeWorkspace(dir, next);
        if (operation === "update") return updateWorkspace(dir, () => ({ workspace: next, result: null }));
        if (operation === "views") return writeViews(dir, next);
        return repairViews(dir);
      };
      assert.throws(run, (error) => {
        assert.ok(error instanceof StoreError);
        assert.equal(error.code, "view_collision");
        assert.ok(error.message.includes(file));
        assert.match(error.message, /Move .*safe location.*retry/);
        return true;
      });
      assert.deepEqual(fs.readFileSync(path.join(dir, "workspace.json")), canonical);
      assert.deepEqual(viewBytes(dir), views, "collision must precede other view writes and orphan cleanup");
    });
  }
}

test("initial workspace creation refuses an existing unmarked index", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "open-crm-store-safety-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const original = "# Synthetic personal index\r\n";
  fs.writeFileSync(path.join(dir, "INDEX.md"), original);
  assert.throws(() => writeWorkspace(dir, createDemoWorkspace()), codeIs("view_collision"));
  assert.equal(fs.existsSync(path.join(dir, "workspace.json")), false);
  assert.equal(fs.readFileSync(path.join(dir, "INDEX.md"), "utf8"), original);
});

for (const kind of ["directory", "dangling symlink"] as const) {
  test(`a ${kind} at a view target is not treated as an absent generated file`, (t) => {
    const dir = fixture(t), original = readWorkspace(dir);
    const index = path.join(dir, "INDEX.md");
    fs.unlinkSync(index);
    if (kind === "directory") fs.mkdirSync(index);
    else fs.symlinkSync("synthetic-missing-target", index);
    assert.throws(() => replaceWorkspace(dir, { ...original.workspace, name: "Synthetic edit" }, original.rev), codeIs("view_collision"));
    assert.equal(readWorkspace(dir).rev, original.rev);
    assert.equal(kind === "directory" ? fs.lstatSync(index).isDirectory() : fs.lstatSync(index).isSymbolicLink(), true);
  });
}

test("unreadable view targets fail closed before canonical writes", (t) => {
  const dir = fixture(t), original = readWorkspace(dir);
  const index = path.join(dir, "INDEX.md"), read = fs.readFileSync;
  const views = viewBytes(dir);
  const mocked = t.mock.method(fs, "readFileSync", (...args: Parameters<typeof read>) => {
    if (args[0] === index) throw Object.assign(new Error("Synthetic permission denial"), { code: "EACCES" });
    return read(...args);
  });
  assert.throws(() => writeWorkspace(dir, { ...original.workspace, name: "Synthetic edit" }), codeIs("view_collision"));
  mocked.mock.restore();
  assert.equal(readWorkspace(dir).rev, original.rev);
  assert.deepEqual(viewBytes(dir), views);
});

test("legacy notices permit regeneration; only marked stale orphan files are removed", (t) => {
  const dir = fixture(t), original = readWorkspace(dir);
  // Literal from the original released workspace format, independent of the current generator.
  const legacyNotice = "<!-- Generated by Open CRM from workspace.json. Do not edit: changes here are overwritten. Use the crm command to change records. -->";
  for (const target of ["INDEX.md", "accounts/northstar-robotics.md", "accounts/stale-generated.md"]) {
    fs.writeFileSync(path.join(dir, target), `${legacyNotice}\r\nSynthetic old view\r\n`);
  }
  const handwritten = "# Synthetic personal research\r\nDo not remove.\r\n";
  const manual = path.join(dir, "accounts/personal-notes.md");
  fs.writeFileSync(manual, handwritten);
  const orphanDirectory = path.join(dir, "accounts/personal-directory.md");
  fs.mkdirSync(orphanDirectory);
  fs.writeFileSync(path.join(orphanDirectory, "notes.txt"), handwritten);
  const orphanLink = path.join(dir, "accounts/personal-link.md");
  fs.symlinkSync("northstar-robotics.md", orphanLink);
  const result = replaceWorkspace(dir, { ...original.workspace, name: "Synthetic regenerated" }, original.rev);
  assert.equal(staleViews(dir, result.workspace).length, 0);
  assert.equal(fs.existsSync(path.join(dir, "accounts/stale-generated.md")), false);
  assert.equal(fs.readFileSync(manual, "utf8"), handwritten);
  assert.equal(fs.readFileSync(path.join(orphanDirectory, "notes.txt"), "utf8"), handwritten);
  assert.equal(fs.readlinkSync(orphanLink), "northstar-robotics.md");
});

for (const moment of ["backup publication", "replacement staging"] as const) {
  test(`replacement rechecks the revision after ${moment} and preserves an interleaved editor write`, (t) => {
    const dir = fixture(t), original = readWorkspace(dir);
    const file = path.join(dir, "workspace.json");
    const before = fs.readFileSync(file);
    const views = viewBytes(dir);
    const edited = `${JSON.stringify({ ...original.workspace, name: "Synthetic external editor change" })}\r\n`;
    const backupPath = path.join(dir, ".open-crm/backups", `${original.rev}.json`);
    const rename = fs.renameSync, write = fs.writeFileSync;
    let injected = false;
    if (moment === "backup publication") {
      t.mock.method(fs, "renameSync", (...args: Parameters<typeof rename>) => {
        const result = rename(...args);
        if (args[1] === backupPath) { injected = true; write(file, edited); }
        return result;
      });
    } else {
      t.mock.method(fs, "writeFileSync", (...args: Parameters<typeof write>) => {
        const result = write(...args);
        if (typeof args[0] === "number" && typeof args[1] === "string" && args[1].includes('"name": "Synthetic replacement"')) {
          injected = true;
          write(file, edited);
        }
        return result;
      });
    }
    assert.throws(() => replaceWorkspace(dir, { ...original.workspace, name: "Synthetic replacement" }, original.rev), (error) => {
      assert.ok(error instanceof RevisionConflict);
      assert.equal(error.current.workspace.name, "Synthetic external editor change");
      assert.equal(error.current.rev, readWorkspace(dir).rev);
      return true;
    });
    assert.equal(injected, true);
    assert.equal(fs.readFileSync(file, "utf8"), edited);
    assert.deepEqual(fs.readFileSync(backupPath), before);
    assert.deepEqual(viewBytes(dir), views);
    assert.equal(fs.readdirSync(dir).some((name) => name.endsWith(".tmp")), false);
    assert.equal(fs.existsSync(path.join(dir, ".open-crm/lock")), false);
  });
}

test("replacement requires the observed revision; conflicts return current without backup or mutation", (t) => {
  const dir = fixture(t), original = readWorkspace(dir);
  for (const rev of [undefined, null, "", " ", 12]) {
    assert.throws(() => replaceWorkspace(dir, original.workspace, rev as string), codeIs("base_rev_required"));
  }
  assert.throws(() => replaceWorkspace(dir, original.workspace, "old"), (error) => error instanceof RevisionConflict && error.current.rev === original.rev);
  assert.equal(readWorkspace(dir).rev, original.rev);
  assert.equal(fs.existsSync(path.join(dir, ".open-crm/backups")), false);
  assert.throws(() => replaceWorkspace(dir, null as never, original.rev), codeIs("invalid_workspace"));
});

test("replacement keeps exact immutable backup bytes; explicit restore also backs up the current state", (t) => {
  const dir = fixture(t);
  const originalBytes = JSON.stringify(readWorkspace(dir).workspace); // Non-canonical whitespace is still preserved.
  fs.writeFileSync(path.join(dir, "workspace.json"), originalBytes);
  const original = readWorkspace(dir);
  const replaced = replaceWorkspace(dir, { ...original.workspace, name: "Synthetic changed workspace" }, original.rev);
  assert.equal(fs.readFileSync(replaced.backupPath, "utf8"), originalBytes);
  assert.equal(staleViews(dir, replaced.workspace).length, 0);
  assert.throws(() => restoreWorkspace(dir, original.rev, original.rev), RevisionConflict);
  const restored = restoreWorkspace(dir, original.rev, replaced.rev);
  assert.deepEqual(restored.workspace, original.workspace);
  assert.equal(JSON.parse(fs.readFileSync(restored.backupPath, "utf8")).name, replaced.workspace.name);
  assert.equal(fs.readFileSync(replaced.backupPath, "utf8"), originalBytes);
});

test("missing, tampered, and path-traversal backups cannot change current records", (t) => {
  const dir = fixture(t), original = readWorkspace(dir);
  assert.throws(() => restoreWorkspace(dir, "../workspace", original.rev), codeIs("bad_request"));
  assert.throws(() => restoreWorkspace(dir, "000000000000", original.rev), codeIs("invalid_backup"));
  const changed = replaceWorkspace(dir, { ...original.workspace, name: "Synthetic revised" }, original.rev);
  fs.writeFileSync(changed.backupPath, "{}");
  assert.throws(() => restoreWorkspace(dir, original.rev, changed.rev), codeIs("invalid_backup"));
  assert.equal(readWorkspace(dir).rev, changed.rev);
  const invalidRev = createHash("sha1").update("{}").digest("hex").slice(0, 12);
  fs.writeFileSync(path.join(dir, ".open-crm/backups", `${invalidRev}.json`), "{}");
  assert.throws(() => restoreWorkspace(dir, invalidRev, changed.rev), codeIs("invalid_backup"));
  // A pre-existing backup for the current revision must never be overwritten.
  fs.writeFileSync(path.join(dir, ".open-crm/backups", `${changed.rev}.json`), "tampered");
  assert.throws(() => replaceWorkspace(dir, original.workspace, changed.rev), codeIs("backup_conflict"));
  assert.equal(readWorkspace(dir).rev, changed.rev);
});

test("concurrent replacements with one base revision have exactly one winner", async (t) => {
  const dir = fixture(t), original = readWorkspace(dir);
  const results = await Promise.all(Array.from({ length: 4 }, (_, i) => worker(`
    const dir = ${JSON.stringify(dir)};
    try { s.replaceWorkspace(dir, {...s.readWorkspace(dir).workspace, name: 'Synthetic worker ${i}'}, ${JSON.stringify(original.rev)}); console.log('won'); }
    catch(e) { if(e.code !== 'conflict') throw e; console.log('conflict'); }
  `).done));
  assert.equal(results.filter((r) => r === "won").length, 1);
  assert.equal(results.filter((r) => r === "conflict").length, 3);
  assert.equal(fs.readdirSync(path.join(dir, ".open-crm/backups")).length, 1);
  assert.equal(staleViews(dir, readWorkspace(dir).workspace).length, 0);
});

test("old live-owner locks are not stolen and thrown operations release their own lock", (t) => {
  const dir = fixture(t), lock = path.join(dir, ".open-crm/lock");
  fs.mkdirSync(lock, { recursive: true });
  const token = `${process.pid}-aaaa.json`;
  fs.writeFileSync(path.join(lock, token), JSON.stringify({ pid: process.pid, token }));
  fs.utimesSync(lock, new Date(0), new Date(0));
  assert.throws(() => withWorkspaceLock(dir, () => assert.fail("stole live lock")), codeIs("locked"));
  assert.ok(fs.existsSync(path.join(lock, token)));
  fs.unlinkSync(path.join(lock, token)); fs.rmdirSync(lock);
  assert.throws(() => withWorkspaceLock(dir, () => { throw new Error("deliberate"); }), /deliberate/);
  assert.equal(withWorkspaceLock(dir, () => "released"), "released");
});

test("replacement and ordinary record updates use the same lock without losing a record update", async (t) => {
  const dir = fixture(t), original = readWorkspace(dir);
  const replace = worker(`try { s.replaceWorkspace(${JSON.stringify(dir)}, {...s.readWorkspace(${JSON.stringify(dir)}).workspace, name:'Synthetic replacement'}, ${JSON.stringify(original.rev)}); console.log('won'); } catch(e) { if(e.code!=='conflict') throw e; console.log('conflict'); }`);
  const update = worker(`s.updateWorkspace(${JSON.stringify(dir)}, ({workspace}) => ({workspace:{...workspace,name:workspace.name+' | retained update'},result:null}));`);
  const [outcome] = await Promise.all([replace.done, update.done]);
  assert.equal(readWorkspace(dir).workspace.name, `${outcome === "won" ? "Synthetic replacement" : original.workspace.name} | retained update`);
});

test("a proven exited owner is reclaimed, but unknown legacy ownership is not", async (t) => {
  const dir = fixture(t), lock = path.join(dir, ".open-crm/lock");
  const exited = worker("console.log(process.pid)");
  const pid = Number(await exited.done), token = `${pid}-aaaa.json`;
  fs.mkdirSync(lock, { recursive: true });
  fs.writeFileSync(path.join(lock, token), JSON.stringify({ pid, token }));
  assert.equal(withWorkspaceLock(dir, () => 42), 42);
  fs.writeFileSync(lock, JSON.stringify({ pid: process.pid }));
  assert.throws(() => withWorkspaceLock(dir, () => 0), codeIs("locked"));
  assert.ok(fs.statSync(lock).isFile());
});

test("repair waits for the writer and regenerates from the new revision", async (t) => {
  const dir = fixture(t);
  const active = worker(`s.withWorkspaceLock(${JSON.stringify(dir)}, () => {
    console.log('locked'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,300);
    s.writeWorkspace(${JSON.stringify(dir)}, {...s.readWorkspace(${JSON.stringify(dir)}).workspace, name:'Synthetic latest'});
  });`);
  await until(() => active.output().includes("locked"));
  const repaired = repairViews(dir);
  await active.done;
  assert.equal(repaired.workspace.name, "Synthetic latest");
  assert.equal(staleViews(dir, repaired.workspace).length, 0);
  assert.match(fs.readFileSync(path.join(dir, "INDEX.md"), "utf8"), /Synthetic latest/);
});

async function server(t: TestContext) {
  const dir = fixture(t), api = createApi(dir);
  const httpServer = http.createServer((req, res) => { void api.handle(req, res); });
  httpServer.listen(0, "127.0.0.1");
  await once(httpServer, "listening");
  const address = httpServer.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  t.after(() => { api.close(); httpServer.closeAllConnections(); httpServer.close(); });
  const request = (endpoint: string, method: string, body: unknown) => fetch(base + endpoint, { method, headers: { "content-type": "application/json", origin: base }, body: JSON.stringify(body) });
  return { dir, base, request };
}

test("HTTP replacement rejects missing/stale revisions and malformed requests without mutation", async (t) => {
  const { dir, base, request } = await server(t), original = readWorkspace(dir);
  assert.equal((await request("/api/workspace", "PUT", { workspace: original.workspace })).status, 422);
  const conflict = await request("/api/workspace", "PUT", { workspace: original.workspace, baseRev: "stale" });
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).rev, original.rev);
  for (const endpoint of ["/api/workspace", "/api/changes", "/api/proposals"]) {
    for (const body of [null, [], "bad", { change: null }, { change: { op: null } }]) {
      const response = await request(endpoint, endpoint === "/api/workspace" ? "PUT" : "POST", body);
      assert.ok(response.status >= 400 && response.status < 500, `${endpoint}: ${response.status}`);
    }
  }
  assert.equal((await fetch(base + "/api/changes", { method: "POST", headers: { "content-type": "application/json" }, body: "{" })).status, 400);
  const badField = newChange({ type: "task.add", title: 42 as never });
  assert.ok([400, 422].includes((await request("/api/changes", "POST", { change: badField })).status));
  const badDate = newChange({ type: "note.add", accountId: original.workspace.accounts[0].id, source: "note", title: "Synthetic", body: "Synthetic", occurredAt: "invalid-date" });
  assert.ok([400, 422].includes((await request("/api/changes", "POST", { change: badDate })).status));
  assert.equal((await fetch(base + "/api/workspace", { headers: { origin: "https://evil.invalid" } })).status, 403);
  assert.equal(readWorkspace(dir).rev, original.rev);
  const changed = await request("/api/workspace", "PUT", { workspace: { ...original.workspace, name: "Synthetic API edit" }, baseRev: original.rev });
  assert.equal(changed.status, 200);
  assert.ok(fs.existsSync((await changed.json()).backupPath));
});

test("each stream gets initial/reconnect revision, all writes, stale failure, and recovery", async (t) => {
  const { dir, base, request } = await server(t);
  async function stream() {
    const events: { rev?: string; error?: unknown }[] = [];
    const req = http.get(base + "/api/events");
    t.after(() => req.destroy());
    const [res] = await once(req, "response") as [http.IncomingMessage];
    let buffer = "";
    res.on("data", (chunk) => {
      buffer += chunk;
      for (let at = buffer.indexOf("\n\n"); at >= 0; at = buffer.indexOf("\n\n")) {
        const line = buffer.slice(0, at); buffer = buffer.slice(at + 2);
        if (line.startsWith("data: ")) events.push(JSON.parse(line.slice(6)));
      }
    });
    await until(() => events.length > 0);
    return { req, events };
  }
  const a = await stream(), b = await stream();
  assert.equal(a.events[0].rev, readWorkspace(dir).rev);
  assert.equal(b.events[0].rev, a.events[0].rev);
  const changed = await request("/api/changes", "POST", { change: newChange({ type: "task.add", title: "Synthetic sync task" }) });
  assert.equal(changed.status, 200);
  const { rev } = await changed.json();
  await fetch(base + "/api/workspace"); // Must not consume the other clients' revision.
  await until(() => a.events.some((e) => e.rev === rev) && b.events.some((e) => e.rev === rev));
  a.req.destroy();
  const c = await stream(); assert.equal(c.events[0].rev, rev);
  const replaced = await request("/api/workspace", "PUT", { workspace: { ...readWorkspace(dir).workspace, name: "Synthetic replaced" }, baseRev: rev });
  assert.equal(replaced.status, 200);
  const replacedRev = (await replaced.json()).rev;
  await until(() => b.events.some((e) => e.rev === replacedRev) && c.events.some((e) => e.rev === replacedRev));
  // External/CLI atomic rename followed immediately by GET must still broadcast.
  const external = writeWorkspace(dir, { ...readWorkspace(dir).workspace, name: "Synthetic external edit" });
  await fetch(base + "/api/workspace");
  await until(() => b.events.some((e) => e.rev === external.rev) && c.events.some((e) => e.rev === external.rev));
  const bytes = fs.readFileSync(path.join(dir, "workspace.json"), "utf8");
  fs.writeFileSync(path.join(dir, "workspace.json"), "{broken");
  await until(() => Boolean(b.events.at(-1)?.error) && Boolean(c.events.at(-1)?.error));
  fs.writeFileSync(path.join(dir, "workspace.json"), bytes);
  await until(() => b.events.at(-1)?.rev === external.rev && c.events.at(-1)?.rev === external.rev);
});

test("browser watch reports stale/disconnected/malformed events and readies only on a revision", (t) => {
  const original = globalThis.EventSource;
  class FakeEvents {
    static instance: FakeEvents;
    onmessage: ((event: { data: string }) => void) | null = null;
    onerror: (() => void) | null = null;
    closed = false;
    constructor() { FakeEvents.instance = this; }
    close() { this.closed = true; }
  }
  globalThis.EventSource = FakeEvents as unknown as typeof EventSource;
  t.after(() => { globalThis.EventSource = original; });
  const revisions: string[] = [], errors: Error[] = [];
  let ready = 0;
  const stop = watchFolder((rev) => revisions.push(rev), { onError: (error) => errors.push(error), onReady: () => { ready++; } });
  const events = FakeEvents.instance;
  for (const data of ["{bad", "null", "{}", '{"error":{"message":"cannot read"}}']) events.onmessage?.({ data });
  events.onerror?.();
  assert.equal(errors.length, 5); assert.equal(ready, 0);
  events.onmessage?.({ data: '{"rev":"abc123"}' });
  events.onerror?.();
  events.onmessage?.({ data: '{"rev":"abc123"}' }); // Reconnect to same revision still clears stale state.
  assert.deepEqual(revisions, ["abc123", "abc123"]); assert.equal(ready, 2);
  stop(); assert.equal(events.closed, true); assert.equal(events.onmessage, null); assert.equal(events.onerror, null);
});
