import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { parseBundle, prepareImport, run } from "../../scripts/import-reviewed-feedback.mjs";
import { createPublicFeedbackBundle } from "../../src/lib/feedback.ts";

const env = {
  ZENTRIK_API_BASE: "https://feedback.example/api",
  ZENTRIK_WORKSPACE_ID: "00000000-0000-4000-8000-000000000001",
  ZENTRIK_PRODUCT_ID: "00000000-0000-4000-8000-000000000002",
  ZENTRIK_API_KEY: "SYNTHETIC_SECRET_MUST_NOT_APPEAR",
};
const bundle = {
  schema: "open-crm-feedback.v1", product: "Zentrik Open CRM", visibility: "public",
  feedback: { kind: "bug", title: "Synthetic example", body: "USER_TEXT_NOT_FOR_LOGS" },
};
const raw = JSON.stringify(bundle);
const prepared = prepareImport(raw, env);
const execution = ["--execute", "--reviewed-sha256", prepared.reviewHash];
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const context = { workspace: { id: env.ZENTRIK_WORKSPACE_ID }, credential: { scopes: ["signals:write", "products:read"] } };
const product = { id: env.ZENTRIK_PRODUCT_ID };
const receipt = { publicId: "SIGNAL-42", workspaceId: env.ZENTRIK_WORKSPACE_ID, jobId: "not-printed", secret: env.ZENTRIK_API_KEY };

async function invoke({ args = [], input = raw, environment = env, replies = [], fetcher, reader } = {}) {
  const calls = [];
  const out = [];
  const err = [];
  const code = await run(["--file", "untrusted-name.json", ...args], {
    env: environment, readFile: reader ?? (async () => input),
    stdout: (value) => out.push(value), stderr: (value) => err.push(value),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (fetcher) return fetcher(url, options);
      const response = replies.shift();
      assert.ok(response, "Unexpected HTTP request");
      return response;
    },
  });
  const output = out.join("\n");
  const errors = err.join("\n");
  assert.ok(!output.includes(env.ZENTRIK_API_KEY) && !errors.includes(env.ZENTRIK_API_KEY));
  assert.ok(!output.includes(bundle.feedback.body) && !errors.includes(bundle.feedback.body));
  return { code, output, errors, calls };
}

test("dry-run needs no key, makes zero HTTP requests, and omits authored text", async () => {
  const result = await invoke({ environment: { ...env, ZENTRIK_API_KEY: undefined } });
  assert.equal(result.code, 0);
  assert.deepEqual(result.calls, []);
  assert.equal(JSON.parse(result.output).reviewHash, prepared.reviewHash);
  assert.equal(JSON.parse(result.output).requestsSent, 0);
});

test("execute alone, stale review, changed destination, and missing key cannot send", async () => {
  for (const options of [
    { args: ["--execute"] },
    { args: ["--execute", "--reviewed-sha256", "0".repeat(64)] },
    { args: execution, input: JSON.stringify({ ...bundle, feedback: { ...bundle.feedback, body: "Changed" } }) },
    { args: execution, environment: { ...env, ZENTRIK_PRODUCT_ID: env.ZENTRIK_WORKSPACE_ID } },
    { args: execution, environment: { ...env, ZENTRIK_API_BASE: "https://other.example/api" } },
    { args: execution, environment: { ...env, ZENTRIK_API_KEY: undefined } },
  ]) {
    const result = await invoke(options);
    assert.equal(result.code, 1);
    assert.deepEqual(result.calls, []);
  }
});

test("strict bundle validation rejects private, malformed, extra, and oversized input", async () => {
  const invalid = [
    "{", "null", "[]", "{}", JSON.stringify({ ...bundle, visibility: "private" }),
    JSON.stringify({ ...bundle, schema: "open-crm-feedback.v2" }),
    JSON.stringify({ ...bundle, product: "Other product" }),
    JSON.stringify({ ...bundle, accounts: ["CRM_SENTINEL"] }),
    JSON.stringify({ ...bundle, feedback: { ...bundle.feedback, workspaceId: "CRM_SENTINEL" } }),
    ...[
      { kind: "support" }, { title: " " }, { body: null }, { title: ["text"] },
      { body: "a".repeat(100001) }, { title: "a".repeat(501) }, { body: "\u001b[31m" },
    ].map((patch) => JSON.stringify({ ...bundle, feedback: { ...bundle.feedback, ...patch } })),
    " ".repeat(256 * 1024 + 1),
  ];
  for (const input of invalid) {
    const result = await invoke({ input, args: execution });
    assert.equal(result.code, 1);
    assert.deepEqual(result.calls, []);
    assert.doesNotMatch(result.errors, /CRM_SENTINEL/);
  }
});

test("exporter and importer share normalized field and UTF-8 envelope limits", () => {
  for (const feedback of [
    { kind: "bug", title: " " + "t".repeat(500) + " ", body: " " + "b".repeat(100000) + " " },
    { kind: "idea", title: "Unicode example", body: "雪".repeat(80000) },
    { kind: "request", title: "Summary", body: "Line one\n\tLine two" },
  ]) {
    const exported = createPublicFeedbackBundle(feedback, true);
    assert.deepEqual(parseBundle(JSON.stringify(exported, null, 2) + "\n"), exported.feedback);
    assert.deepEqual(parseBundle(JSON.stringify({ ...bundle, feedback })), exported.feedback);
  }
  // Compact input fits, but the shared canonical pretty-printed bundle does not.
  const empty = { ...bundle, feedback: { kind: "bug", title: "Unicode", body: "" } };
  const room = 256 * 1024 - Buffer.byteLength(JSON.stringify(empty));
  const feedback = { ...empty.feedback, body: "雪".repeat(Math.floor(room / 3)) };
  const compact = JSON.stringify({ ...empty, feedback });
  assert.ok(Buffer.byteLength(compact) <= 256 * 1024);
  assert.throws(() => createPublicFeedbackBundle(feedback, true), /256 KiB/);
  assert.throws(() => parseBundle(compact), /shared public bundle validation/);
});

test("destination must be explicit HTTPS /api with valid UUIDs, never credential-bearing URLs", async () => {
  for (const patch of [
    { ZENTRIK_API_BASE: undefined }, { ZENTRIK_API_BASE: "http://feedback.example/api" },
    { ZENTRIK_API_BASE: "https://user:secret@feedback.example/api" },
    { ZENTRIK_API_BASE: "https://feedback.example/api?key=secret" },
    { ZENTRIK_API_BASE: "https://feedback.example/api#secret" },
    { ZENTRIK_API_BASE: "https://feedback.example/other" },
    { ZENTRIK_WORKSPACE_ID: undefined }, { ZENTRIK_PRODUCT_ID: "bad" },
  ]) {
    const result = await invoke({ environment: { ...env, ...patch } });
    assert.equal(result.code, 1);
    assert.deepEqual(result.calls, []);
  }
});

test("stable identity ignores JSON layout/key ordering, but separates changed feedback and product", () => {
  const reordered = JSON.stringify({ feedback: { body: bundle.feedback.body, title: bundle.feedback.title, kind: "bug" },
    visibility: "public", product: bundle.product, schema: bundle.schema }, null, 4);
  assert.deepEqual(prepareImport(reordered, env), prepared);
  assert.equal(prepareImport(raw, { ...env, ZENTRIK_API_BASE: env.ZENTRIK_API_BASE + "/" }).reviewHash, prepared.reviewHash);
  assert.notEqual(prepareImport(raw, { ...env, ZENTRIK_PRODUCT_ID: env.ZENTRIK_WORKSPACE_ID }).payload.externalId, prepared.payload.externalId);
  assert.notEqual(prepareImport(JSON.stringify({ ...bundle, feedback: { ...bundle.feedback, body: "Edited" } }), env).payload.externalId, prepared.payload.externalId);
  assert.deepEqual(Object.keys(prepared.payload), [
    "name", "text", "signalType", "productIds", "sourceKey", "externalId",
    "participantPolicy", "createMissingAccounts", "sourceExternalData",
  ]);
  assert.equal(prepared.payload.participantPolicy, "none");
  assert.equal(prepared.payload.createMissingAccounts, false);
  assert.deepEqual(parseBundle(raw), bundle.feedback);
});

test("verified execution makes two preflight reads and exactly one public API write", async () => {
  const result = await invoke({ args: execution, replies: [json(context), json(product), json(receipt, 201)] });
  assert.equal(result.code, 0);
  assert.deepEqual(result.calls.map(({ url }) => new URL(url).pathname), [
    "/api/external/v1/auth/context", "/api/external/v1/products/" + env.ZENTRIK_PRODUCT_ID, "/api/external/v1/signals",
  ]);
  const writes = result.calls.filter(({ options }) => options.method === "POST");
  assert.equal(writes.length, 1);
  assert.deepEqual(JSON.parse(writes[0].options.body), prepared.payload);
  assert.equal(writes[0].options.headers["Idempotency-Key"], prepared.idempotencyKey);
  for (const { options } of result.calls) {
    assert.equal(options.headers.Authorization, "Bearer " + env.ZENTRIK_API_KEY);
    assert.equal(options.redirect, "error");
    assert.ok(options.signal instanceof AbortSignal);
  }
  assert.equal(JSON.parse(result.output).signal, "SIGNAL-42");
  assert.doesNotMatch(result.output, /not-printed|jobId/);
});

test("workspace, scope, product, and malformed preflight failures prevent POST", async () => {
  for (const replies of [
    [json({ ...context, workspace: { id: env.ZENTRIK_PRODUCT_ID } })],
    [json({ ...context, credential: { scopes: ["signals:write"] } })],
    [json({ ...context, credential: { scopes: ["products:read"] } })],
    [json(null)], [json(context), json({ id: env.ZENTRIK_WORKSPACE_ID })],
    [json(context), json(product, 403)],
    [new Response("not JSON")],
  ]) {
    const result = await invoke({ args: execution, replies });
    assert.equal(result.code, 1);
    assert.ok(result.calls.every(({ options }) => options.method !== "POST"));
  }
});

test("API failures and redirects never echo server secrets or retry", async () => {
  for (const status of [301, 401, 403, 409, 429, 500]) {
    const result = await invoke({ args: execution, replies: [
      json(context), json(product), new Response(env.ZENTRIK_API_KEY + bundle.feedback.body, { status }),
    ] });
    assert.equal(result.code, 1);
    assert.equal(result.calls.length, 3);
    assert.match(result.errors, new RegExp("HTTP " + status));
  }
  const result = await invoke({ args: execution, fetcher: async () => { throw new Error(env.ZENTRIK_API_KEY); } });
  assert.equal(result.code, 1);
  assert.equal(result.calls.length, 1);
});

test("timeout covers fetch and stalled response bodies, aborts, and never retries", async () => {
  for (const fetcher of [
    async () => new Promise(() => {}),
    async () => new Response(new ReadableStream({ start() {} })),
  ]) {
    const result = await invoke({ args: [...execution, "--timeout-ms", "10"], fetcher });
    assert.equal(result.code, 1);
    assert.match(result.errors, /timed out/);
    assert.equal(result.calls.length, 1);
    assert.equal(result.calls[0].options.signal.aborted, true);
  }
});

test("malformed acceptance remains uncertain; rerun retains exact payload and dedupe key", async () => {
  for (const response of [json({}), json({ ...receipt, workspaceId: env.ZENTRIK_PRODUCT_ID }), new Response("x".repeat(256 * 1024 + 1))]) {
    const result = await invoke({ args: execution, replies: [json(context), json(product), response] });
    assert.equal(result.code, 1);
    assert.equal(result.calls.length, 3);
    assert.equal(result.calls[2].options.body, prepared.body);
    assert.equal(result.calls[2].options.headers["Idempotency-Key"], prepared.idempotencyKey);
  }
});

test("CLI reports sanitized argument/file errors and bounds file reads", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "feedback-intake-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, "bundle.json");
  const script = new URL("../../scripts/import-reviewed-feedback.mjs", import.meta.url);
  await writeFile(file, raw);
  const cli = (args) => spawnSync(process.execPath, [script.pathname, ...args], { encoding: "utf8", env: { ...process.env, ...env } });
  const good = cli(["--file", file]);
  assert.equal(good.status, 0, good.stderr);
  assert.equal(JSON.parse(good.stdout).mode, "dry-run");
  for (const args of [["--api-key", env.ZENTRIK_API_KEY], ["--file", join(directory, env.ZENTRIK_API_KEY)]]) {
    const result = cli(args);
    assert.equal(result.status, 1);
    assert.ok(!result.stderr.includes(env.ZENTRIK_API_KEY));
  }
  await writeFile(file, Buffer.alloc(256 * 1024 + 1));
  assert.equal(cli(["--file", file]).status, 1);
  await writeFile(file, Buffer.from([0xff, 0xfe]));
  assert.equal(cli(["--file", file]).status, 1);
});
