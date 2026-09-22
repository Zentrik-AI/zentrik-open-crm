import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { Change, Workspace } from "../src/types.ts";
import { OpError, resolveProposal, submitChange } from "../src/core/ops.ts";
import { RevisionConflict, StoreError, WORKSPACE_FILE, readWorkspace, replaceWorkspace, updateWorkspace } from "./store.ts";

/**
 * The HTTP API the visual CRM uses when it runs on a workspace folder. The
 * same handler is mounted by `crm ui` and by the Vite dev server. It listens
 * on loopback only, and refuses requests that did not come from its own page.
 */

const MAX_BODY = 20 * 1024 * 1024;

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new OpError("too_large", "Request body is too large.");
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new OpError("bad_request", "Request body is not valid JSON.");
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new OpError("bad_request", "Expected a JSON object.");
  return value as Record<string, unknown>;
}

/** A page on another origin must not be able to read or write a local CRM.
 *  Loopback hosts only (defeats DNS rebinding), same-origin writes only, and
 *  JSON bodies only (so a cross-site form post cannot reach a handler). */
function trusted(req: IncomingMessage): boolean {
  const host = (req.headers.host ?? "").replace(/:\d+$/, "");
  if (!["127.0.0.1", "localhost", "[::1]"].includes(host)) return false;
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) return false;
    } catch {
      return false;
    }
  }
  if (req.method !== "GET" && !(req.headers["content-type"] ?? "").startsWith("application/json")) return false;
  return true;
}

export function createApi(dir: string) {
  const listeners = new Set<ServerResponse>();
  // Per-client state: a GET or another client's write must not consume events.
  const states = new Map<ServerResponse, string>();
  let watchError: Error | undefined;

  const announce = () => {
    let event: { rev: string } | { error: { message: string } };
    try {
      if (watchError) throw watchError;
      event = { rev: readWorkspace(dir).rev };
    } catch (error) {
      event = { error: { message: `Workspace sync is stale: ${(error as Error).message}` } };
    }
    const message = JSON.stringify(event);
    for (const res of listeners) {
      if (states.get(res) === message) continue;
      states.set(res, message);
      res.write(`data: ${message}\n\n`);
    }
  };

  // fs.watch fires more than once per write and differs by platform, so every
  // event funnels through a short debounce and a content-hash comparison.
  let timer: NodeJS.Timeout | undefined;
  const watcher = fs.watch(dir, (_event, name) => {
    if (name && name !== WORKSPACE_FILE) return;
    clearTimeout(timer);
    timer = setTimeout(announce, 80);
  });
  watcher.on("error", (error) => { watchError = error; announce(); });
  const heartbeat = setInterval(() => {
    for (const res of listeners) res.write(": keep-alive\n\n");
  }, 15000);
  heartbeat.unref();

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    let url: URL;
    try { url = new URL(req.url ?? "/", "http://localhost"); }
    catch { send(res, 400, { error: { code: "bad_request", message: "Invalid request URL." } }); return true; }
    if (!url.pathname.startsWith("/api/")) return false;
    if (!trusted(req)) {
      send(res, 403, { error: { code: "forbidden", message: "This API only answers its own page on this computer." } });
      return true;
    }

    try {
      if (req.method === "GET" && url.pathname === "/api/workspace") {
        const loaded = readWorkspace(dir);
        send(res, 200, { ...loaded, dir, folder: path.basename(dir) });
      } else if (req.method === "GET" && url.pathname === "/api/events") {
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
        res.write(": connected\n\n");
        listeners.add(res);
        announce(); // Includes the current revision on every connection/reconnection.
        res.on("close", () => { listeners.delete(res); states.delete(res); });
      } else if (req.method === "POST" && url.pathname === "/api/changes") {
        const change = object(object(await readJson(req)).change);
        const op = object(change.op);
        if (typeof op.type !== "string" || typeof change.recordId !== "string" || !change.recordId.trim()
          || typeof change.at !== "string" || Number.isNaN(Date.parse(change.at))) throw new OpError("bad_request", "A change needs an operation, recordId, and valid date.");
        const actor = change.actor === undefined ? {} : object(change.actor);
        if (actor.name !== undefined && typeof actor.name !== "string") throw new OpError("bad_request", "Actor name must be text.");
        // The page speaks for the person at the keyboard, whatever the body claims.
        const asPerson = { ...change, actor: { kind: "human", name: actor.name || "you" } } as Change;
        const { loaded } = updateWorkspace(dir, ({ workspace }) => ({ workspace: submitChange(workspace, asPerson).workspace, result: null }));
        announce();
        send(res, 200, loaded);
      } else if (req.method === "POST" && url.pathname === "/api/proposals") {
        const { id, decision, by } = object(await readJson(req));
        if (typeof id !== "string" || !id.trim() || (by !== undefined && typeof by !== "string")) throw new OpError("bad_request", "A proposal id and optional text reviewer are required.");
        if (decision !== "approve" && decision !== "reject") throw new OpError("bad_request", "decision must be approve or reject.");
        const { loaded } = updateWorkspace(dir, ({ workspace }) => ({ workspace: resolveProposal(workspace, id, decision, typeof by === "string" && by ? by : "you").workspace, result: null }));
        announce();
        send(res, 200, loaded);
      } else if (req.method === "PUT" && url.pathname === "/api/workspace") {
        const { workspace, baseRev } = object(await readJson(req));
        const loaded = replaceWorkspace(dir, workspace as Workspace, baseRev as string);
        announce();
        send(res, 200, loaded);
      } else {
        send(res, 404, { error: { code: "not_found", message: "No such endpoint." } });
      }
    } catch (error) {
      if (error instanceof RevisionConflict) send(res, 409, { ...error.current, error: { code: error.code, message: error.message } });
      else if (error instanceof OpError || error instanceof StoreError) send(res, error.code === "not_found" ? 404 : error.code === "too_large" ? 413 : error.code === "bad_request" ? 400 : error.code === "locked" ? 423 : 422, { error: { code: error.code, message: error.message } });
      else if (error instanceof TypeError || error instanceof RangeError) send(res, 400, { error: { code: "bad_request", message: "The request contains invalid field types or values." } });
      else send(res, 500, { error: { code: "internal", message: (error as Error).message } });
    }
    return true;
  }

  return {
    handle,
    close() {
      watcher.close();
      clearTimeout(timer);
      clearInterval(heartbeat);
      for (const res of listeners) res.end();
      listeners.clear();
      states.clear();
    },
  };
}
