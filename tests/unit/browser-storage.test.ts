import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { normalizeWorkspace, parseWorkspace } from "../../src/core/validate.ts";
import {
  createDemoWorkspace, getStorageIssue, getStoredWorkspaceText, hasStoredWorkspace,
  loadWorkspace, recoverWorkspace, resetWorkspace, saveWorkspace,
} from "../../src/lib/storage.ts";
import type { Workspace } from "../../src/types.ts";

const KEY = "zentrik-open-crm.workspace.v2";
const BACKUP = `${KEY}.recovery.`;
const replacement = () => ({ ...createDemoWorkspace(), name: "Synthetic recovery workspace" });
// JSON omits optional undefined fields present in the in-memory demo fixtures.
const persisted = (workspace: Workspace) => JSON.parse(JSON.stringify(normalizeWorkspace(workspace)));

/** Hooks model storage exceptions and another tab writing between storage calls.
 * Seed/inspect the map directly so assertions do not trigger fault hooks. */
class FakeStorage implements Storage {
  data = new Map<string, string>();
  writes: { key: string; value: string }[] = [];
  beforeRead?: (key: string) => void;
  beforeWrite?: (key: string, value: string) => void;
  afterWrite?: (key: string, value: string) => void;
  get length() { return this.data.size; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  getItem(key: string) { this.beforeRead?.(key); return this.data.get(key) ?? null; }
  setItem(key: string, value: string) {
    this.beforeWrite?.(key, value);
    this.data.set(key, value);
    this.writes.push({ key, value });
    this.afterWrite?.(key, value);
  }
  removeItem(key: string) { this.data.delete(key); }
  clear() { this.data.clear(); }
}

function fixture(t: TestContext, raw: string | null = null) {
  const local = new FakeStorage();
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: local } });
  // Reset module state with an empty, readable store before applying each fault.
  loadWorkspace();
  if (raw !== null) local.data.set(KEY, raw);
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
    else Reflect.deleteProperty(globalThis, "window");
  });
  return local;
}

function assertError(error: string | null) {
  assert.equal(typeof error, "string");
  assert.ok(error);
  assert.equal(getStorageIssue(), error);
}

function assertUnavailable(workspace: Workspace) {
  for (const key of ["accounts", "deals", "tasks", "notes"] as const) assert.deepEqual(workspace[key], []);
  assert.match(workspace.name, /unavailable/i);
}

test("an empty store loads demo records without writing; a successful save clears errors", (t) => {
  const local = fixture(t);
  assert.equal(hasStoredWorkspace(), false);
  const workspace = loadWorkspace();
  assert.ok(workspace.accounts.length > 0);
  assert.equal(getStorageIssue(), null);
  assert.deepEqual(local.writes, []);
  assertError(saveWorkspace({ ...workspace, name: "" }));
  assert.equal(saveWorkspace(workspace), null);
  assert.equal(getStorageIssue(), null);
  assert.equal(hasStoredWorkspace(), true);
  assert.deepEqual(loadWorkspace(), persisted(workspace));
});

for (const raw of ["", "{malformed\r\n", "null", "[]", '{"accounts":[]}', '{"name":"Synthetic","accounts":[],"deals":[],"tasks":[null],"notes":[]}']) {
  test(`invalid stored input ${JSON.stringify(raw)} is never overwritten by the fallback`, (t) => {
    const local = fixture(t, raw);
    assert.equal(hasStoredWorkspace(), false);
    assertError(getStorageIssue());
    const fallback = loadWorkspace();
    assertUnavailable(fallback);
    assertError(saveWorkspace(fallback));
    assertError(saveWorkspace(createDemoWorkspace()));
    assert.equal(getStoredWorkspaceText(), raw);
    assert.equal(local.data.get(KEY), raw);
    assert.deepEqual(local.writes, []);
  });
}

test("automatic saves detect newly malformed storage after a successful load", (t) => {
  const local = fixture(t, JSON.stringify(createDemoWorkspace()));
  const loaded = loadWorkspace();
  local.data.set(KEY, "{another tab's incomplete edit");
  assertError(saveWorkspace(loaded));
  assert.equal(local.data.get(KEY), "{another tab's incomplete edit");
  assert.deepEqual(local.writes, []);
});

for (const failure of ["QuotaExceededError", "SecurityError"]) {
  test(`${failure} on save preserves records and reports unsaved work until retry succeeds`, (t) => {
    const raw = JSON.stringify(createDemoWorkspace());
    const local = fixture(t, raw);
    loadWorkspace();
    local.beforeWrite = () => { throw new DOMException("Synthetic storage failure", failure); };
    const next = replacement();
    assertError(saveWorkspace(next));
    assert.equal(local.data.get(KEY), raw);
    assert.deepEqual(local.writes, []);
    local.beforeWrite = undefined;
    assert.equal(saveWorkspace(next), null);
    assert.equal(getStorageIssue(), null);
    assert.equal(local.data.get(KEY), JSON.stringify(next));
  });
}

for (const deniedAt of ["property", "read"]) {
  test(`denied storage ${deniedAt} blocks load, export, reset and recovery even with a download receipt`, (t) => {
    const raw = "{original inaccessible text";
    const local = fixture(t, raw);
    const deny = () => { throw new DOMException("Synthetic denial", "SecurityError"); };
    if (deniedAt === "property") Object.defineProperty(window, "localStorage", { configurable: true, get: deny });
    else local.beforeRead = deny;
    assert.equal(hasStoredWorkspace(), false);
    assertUnavailable(loadWorkspace());
    assertError(getStorageIssue());
    assert.throws(getStoredWorkspaceText, /Cannot read browser storage/);
    assertError(saveWorkspace(replacement()));
    assertError(recoverWorkspace(replacement(), { downloadedOriginal: raw }).error);
    assert.throws(resetWorkspace, /Recovery did not complete/);
    assert.equal(local.data.get(KEY), raw);
    assert.deepEqual(local.writes, []);
    if (deniedAt === "property") Object.defineProperty(window, "localStorage", { configurable: true, value: local });
    else local.beforeRead = undefined;
    // Regaining access alone must not auto-save the placeholder.
    assertError(saveWorkspace(replacement()));
    assert.equal(recoverWorkspace(replacement()).error, null);
    assert.equal(getStorageIssue(), null);
    assert.equal(saveWorkspace(replacement()), null);
  });
}

test("missing window reports unavailable storage without throwing on automatic save", (t) => {
  fixture(t);
  Reflect.deleteProperty(globalThis, "window");
  assertUnavailable(loadWorkspace());
  assertError(saveWorkspace(replacement()));
  assert.throws(getStoredWorkspaceText, /Cannot read browser storage/);
  assertError(recoverWorkspace(replacement()).error);
});

for (const raw of ["\uFEFF {broken: '雪 🧪'}\r\n\t\u0000", ` \r\n${JSON.stringify(createDemoWorkspace())}\t\n`, ""]) {
  test(`recovery preserves exact original text (${raw.length} code units) and existing backups`, (t) => {
    const local = fixture(t, raw);
    local.data.set(`${BACKUP}1`, "older backup\r\n");
    loadWorkspace();
    const next = replacement();
    const result = recoverWorkspace(next);
    assert.deepEqual(result, { error: null, backupKey: `${BACKUP}2` });
    assert.equal(local.data.get(`${BACKUP}1`), "older backup\r\n");
    assert.equal(local.data.get(result.backupKey!), raw);
    assert.deepEqual(local.writes.map(({ key }) => key), [`${BACKUP}2`, KEY]);
    assert.deepEqual(parseWorkspace(local.data.get(KEY)!).workspace, persisted(next));
    assert.equal(getStorageIssue(), null);
    assert.equal(saveWorkspace(next), null);
  });
}

test("recovery of an empty store needs no backup", (t) => {
  const local = fixture(t);
  const next = replacement();
  assert.deepEqual(recoverWorkspace(next), { error: null, backupKey: null });
  assert.deepEqual(local.writes.map(({ key }) => key), [KEY]);
});

test("an invalid recovery payload cannot write a backup or replace the original", (t) => {
  const raw = "{original";
  const local = fixture(t, raw);
  for (const invalid of [null, {}, { ...replacement(), name: "" }]) {
    const result = recoverWorkspace(invalid as Workspace);
    assertError(result.error);
    assert.equal(result.backupKey, null);
  }
  assert.equal(local.data.get(KEY), raw);
  assert.deepEqual(local.writes, []);
});

test("failed backup writes never bypass protection; only an exact explicit download receipt permits recovery", (t) => {
  const raw = "{original\r\n\t";
  const local = fixture(t, raw);
  loadWorkspace();
  local.beforeWrite = (key) => {
    if (key.startsWith(BACKUP)) throw new DOMException("Synthetic full storage", "QuotaExceededError");
  };
  assertError(recoverWorkspace(replacement()).error);
  assert.throws(resetWorkspace, /Recovery did not complete/);
  assertError(saveWorkspace(replacement()));
  for (const downloadedOriginal of ["", raw.trim(), `${raw}changed`]) {
    assertError(recoverWorkspace(replacement(), { downloadedOriginal }).error);
  }
  assert.equal(local.data.get(KEY), raw);
  assert.deepEqual(local.writes, []);
  assert.deepEqual(recoverWorkspace(replacement(), { downloadedOriginal: raw }), { error: null, backupKey: null });
  assert.deepEqual(local.writes.map(({ key }) => key), [KEY]);
  assert.equal(getStorageIssue(), null);
});

for (const failure of ["mismatch", "read-error"]) {
  test(`backup verification ${failure} prevents replacement`, (t) => {
    const raw = "{original";
    const local = fixture(t, raw);
    local.afterWrite = (key) => {
      if (!key.startsWith(BACKUP)) return;
      if (failure === "mismatch") local.data.set(key, "different backup text");
      else local.beforeRead = (readKey) => { if (readKey === key) throw new Error("Synthetic read denial"); };
    };
    assertError(recoverWorkspace(replacement()).error);
    assert.equal(local.data.get(KEY), raw);
    assert.ok(local.writes.every(({ key }) => key !== KEY));
  });
}

test("failed replacement retains original and verified backup; retry never replaces that backup", (t) => {
  const raw = "{original";
  const local = fixture(t, raw);
  loadWorkspace();
  local.beforeWrite = (key) => { if (key === KEY) throw new DOMException("Synthetic full storage", "QuotaExceededError"); };
  const failed = recoverWorkspace(replacement());
  assertError(failed.error);
  assert.equal(failed.backupKey, `${BACKUP}1`);
  assert.equal(local.data.get(failed.backupKey!), raw);
  assert.equal(local.data.get(KEY), raw);
  local.beforeWrite = undefined;
  assertError(saveWorkspace(replacement()));
  const retried = recoverWorkspace(replacement());
  assert.deepEqual(retried, { error: null, backupKey: `${BACKUP}2` });
  assert.equal(local.data.get(`${BACKUP}1`), raw);
  assert.equal(local.data.get(`${BACKUP}2`), raw);
  assert.equal(getStorageIssue(), null);
});

for (const concurrent of [null, "{another tab", JSON.stringify(replacement())]) {
  test(`recovery detects an interleaved ${concurrent === null ? "deletion" : "write"} after backup`, (t) => {
    const raw = "{original";
    const local = fixture(t, raw);
    local.afterWrite = (key) => {
      if (!key.startsWith(BACKUP)) return;
      if (concurrent === null) local.data.delete(KEY);
      else local.data.set(KEY, concurrent);
    };
    const result = recoverWorkspace(replacement());
    assertError(result.error);
    assert.match(result.error!, /changed during recovery/);
    assert.equal(local.data.get(KEY) ?? null, concurrent);
    assert.equal(local.data.get(result.backupKey!), raw);
    assert.ok(local.writes.every(({ key }) => key !== KEY));
  });
}

for (const downloaded of [false, true]) {
  test(`recovery detects an interleaved write before its final read (${downloaded ? "download receipt" : "empty store"})`, (t) => {
    const raw = downloaded ? "{downloaded original" : null;
    const local = fixture(t, raw);
    let reads = 0;
    local.beforeRead = (key) => {
      if (key === KEY && ++reads === 2) local.data.set(KEY, "{newer original");
    };
    const result = recoverWorkspace(replacement(), downloaded ? { downloadedOriginal: raw! } : {});
    assertError(result.error);
    assert.match(result.error!, /changed during recovery/);
    assert.equal(local.data.get(KEY), "{newer original");
    assert.deepEqual(local.writes, []);
  });
}

test("successful explicit reset backs up the original and clears the blocked state", (t) => {
  const raw = "{original";
  const local = fixture(t, raw);
  loadWorkspace();
  const reset = resetWorkspace();
  assert.equal(local.data.get(`${BACKUP}1`), raw);
  assert.deepEqual(parseWorkspace(local.data.get(KEY)!).workspace, persisted(reset));
  assert.equal(getStorageIssue(), null);
  assert.equal(saveWorkspace(reset), null);
});
