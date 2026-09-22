#!/usr/bin/env node
// Maintainer-only adapter for the public REST API; shared pure bundle validation.
import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { createPublicFeedbackBundle } from "../src/lib/feedback.ts";

const MAX_BYTES = 256 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha256 = (text) => createHash("sha256").update(text).digest("hex");
class IntakeError extends Error {}
const fail = (message) => { throw new IntakeError(message); };

function exactKeys(value, keys) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

export function parseBundle(raw) {
  if (typeof raw !== "string" || Buffer.byteLength(raw) > MAX_BYTES) fail("Bundle exceeds the 256 KiB limit.");
  let value;
  try { value = JSON.parse(raw); } catch { fail("Bundle must be valid JSON."); }
  if (!exactKeys(value, ["schema", "product", "visibility", "feedback"])
    || value.schema !== "open-crm-feedback.v1" || value.product !== "Zentrik Open CRM"
    || value.visibility !== "public"
    || !exactKeys(value.feedback, ["kind", "title", "body"])) {
    fail("Expected an exact public open-crm-feedback.v1 bundle; extra fields are rejected.");
  }
  try {
    // This validates the public format, not maintainer approval to transmit it.
    // Execution still requires the exact destination-bound dry-run review hash.
    return createPublicFeedbackBundle(value.feedback, true).feedback;
  } catch {
    fail("Feedback failed the shared public bundle validation. Review its fields, text limits, and control characters.");
  }
}

function config(env, execute) {
  let base;
  try { base = new URL(env.ZENTRIK_API_BASE); } catch { fail("Set ZENTRIK_API_BASE to an HTTPS API URL ending in /api."); }
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash
    || !/^\/api\/?$/.test(base.pathname)) {
    fail("ZENTRIK_API_BASE must use HTTPS and /api, without credentials, query, or fragment.");
  }
  if (!UUID.test(env.ZENTRIK_WORKSPACE_ID ?? "") || !UUID.test(env.ZENTRIK_PRODUCT_ID ?? "")) {
    fail("Set ZENTRIK_WORKSPACE_ID and ZENTRIK_PRODUCT_ID to the reviewed destination UUIDs.");
  }
  if (execute && (typeof env.ZENTRIK_API_KEY !== "string" || !env.ZENTRIK_API_KEY.trim()
    || /\s/.test(env.ZENTRIK_API_KEY))) {
    fail("Set ZENTRIK_API_KEY to a valid maintainer credential in the environment.");
  }
  return {
    base: base.href.replace(/\/$/, ""),
    workspaceId: env.ZENTRIK_WORKSPACE_ID.toLowerCase(),
    productId: env.ZENTRIK_PRODUCT_ID.toLowerCase(),
  };
}

export function prepareImport(raw, env = process.env) {
  const feedback = parseBundle(raw);
  const destination = config(env, false);
  const externalId = sha256(JSON.stringify({ version: 1, productId: destination.productId, feedback }));
  const payload = {
    name: feedback.title,
    text: feedback.body,
    signalType: "feedback_record",
    productIds: [destination.productId],
    sourceKey: "open-crm.reviewed-feedback.v1",
    externalId,
    participantPolicy: "none",
    createMissingAccounts: false,
    sourceExternalData: { bundleSchema: "open-crm-feedback.v1", feedbackKind: feedback.kind },
  };
  const body = JSON.stringify(payload);
  return {
    destination, payload, body,
    idempotencyKey: "open-crm-feedback-v1-" + sha256(body),
    reviewHash: sha256(JSON.stringify({ destination, payload })),
  };
}

async function readBundle(file) {
  let handle;
  try {
    handle = await open(file, "r");
    if (!(await handle.stat()).isFile()) fail("Bundle must be a regular file.");
    const buffer = Buffer.alloc(MAX_BYTES + 1);
    let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await handle.read(buffer, size, buffer.length - size, null);
      if (!bytesRead) break;
      size += bytesRead;
    }
    if (size > MAX_BYTES) fail("Bundle exceeds the 256 KiB limit.");
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, size));
  } catch (error) {
    if (error instanceof IntakeError) throw error;
    fail("Could not read a UTF-8 feedback bundle.");
  } finally {
    await handle?.close();
  }
}

async function responseJson(response) {
  if (!response.body) fail("API returned an invalid receipt.");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) fail("API response exceeded the size limit.");
      chunks.push(value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { fail("API returned invalid JSON."); }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

async function request(url, options, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new IntakeError("API request timed out. Delivery may be unknown; retry only the same reviewed request."));
    }, timeoutMs);
  });
  try {
    return await Promise.race([timeout, (async () => {
      const response = await fetchImpl(url, { ...options, redirect: "error", signal: controller.signal });
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        // Never print response text, headers, URLs, or thrown network errors.
        fail("API rejected the request (HTTP " + Number(response.status) + "). No automatic retry was attempted.");
      }
      return responseJson(response);
    })()]);
  } catch (error) {
    if (error instanceof IntakeError) throw error;
    fail("API request failed. Delivery may be unknown; retry only the same reviewed request.");
  } finally {
    clearTimeout(timer);
  }
}

/** Inject fetch for offline tests; never discover credentials or read .env files. */
export async function run(argv, {
  env = process.env, fetchImpl = globalThis.fetch, readFile = readBundle,
  stdout = (text) => process.stdout.write(text + "\n"),
  stderr = (text) => process.stderr.write(text + "\n"),
} = {}) {
  try {
    let args;
    try {
      args = parseArgs({ args: argv, strict: true, allowPositionals: false, options: {
        file: { type: "string" }, execute: { type: "boolean" },
        "reviewed-sha256": { type: "string" }, "timeout-ms": { type: "string" },
        help: { type: "boolean" },
      } }).values;
    } catch { fail("Invalid arguments. Use --help; credentials belong only in environment variables."); }
    if (args.help) {
      stdout("Usage: node scripts/import-reviewed-feedback.mjs --file BUNDLE [--execute --reviewed-sha256 HASH] [--timeout-ms 15000]\nDry-run is the default and makes no HTTP requests. Required environment: ZENTRIK_API_BASE, ZENTRIK_WORKSPACE_ID, ZENTRIK_PRODUCT_ID. Execute also requires ZENTRIK_API_KEY.");
      return 0;
    }
    if (!args.file) fail("Provide --file with a reviewed feedback bundle.");
    const timeoutMs = args["timeout-ms"] === undefined ? 15000 : Number(args["timeout-ms"]);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) fail("Request timeout must be 1–60000 milliseconds.");
    const prepared = prepareImport(await readFile(args.file), env);
    const { destination, payload, reviewHash, body, idempotencyKey } = prepared;
    if (!args.execute) {
      stdout(JSON.stringify({
        mode: "dry-run", requestsSent: 0, destination, reviewHash,
        sourceKey: payload.sourceKey, externalId: payload.externalId,
        feedbackKind: payload.sourceExternalData.feedbackKind,
        titleCharacters: payload.name.length, bodyCharacters: payload.text.length,
        note: "Review the source file and destination. No feedback text or credential is printed.",
      }, null, 2));
      return 0;
    }
    if (args["reviewed-sha256"] !== reviewHash) fail("Execute requires --reviewed-sha256 matching the current dry-run hash.");
    config(env, true);
    const headers = { Authorization: "Bearer " + env.ZENTRIK_API_KEY, Accept: "application/json" };
    const context = await request(destination.base + "/external/v1/auth/context", { headers }, fetchImpl, timeoutMs);
    if (context?.workspace?.id !== destination.workspaceId) fail("Credential workspace does not match the reviewed destination.");
    const scopes = context?.credential?.scopes;
    if (!Array.isArray(scopes) || !["signals:write", "products:read"].every((scope) => scopes.includes(scope))) {
      fail("Credential requires signals:write and products:read scopes.");
    }
    const product = await request(destination.base + "/external/v1/products/" + destination.productId, { headers }, fetchImpl, timeoutMs);
    if (product?.id !== destination.productId) fail("Product preflight did not confirm the reviewed destination.");
    const receipt = await request(destination.base + "/external/v1/signals", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body,
    }, fetchImpl, timeoutMs);
    if (receipt?.workspaceId !== destination.workspaceId
      || typeof receipt?.publicId !== "string" || !/^SIGNAL-[0-9]{1,20}$/.test(receipt.publicId)
      || receipt.publicId.includes(env.ZENTRIK_API_KEY)) {
      fail("API acceptance receipt could not be verified. Delivery may have occurred; retry only the same reviewed request.");
    }
    stdout(JSON.stringify({
      mode: "execute", accepted: true, signal: receipt.publicId, externalId: payload.externalId,
      note: "Intake accepted. Processing, idea creation, and release outcomes are not verified.",
    }, null, 2));
    return 0;
  } catch (error) {
    stderr(error instanceof IntakeError ? error.message : "Feedback import failed. No raw error details were printed.");
    return 1;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = await run(process.argv.slice(2));
}
