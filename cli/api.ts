import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { Change, Workspace } from "../src/types.ts";
import { OpError, resolveProposal, submitChange } from "../src/core/ops.ts";
import { validateWorkspace } from "../src/core/validate.ts";
import { StoreError, WORKSPACE_FILE, readWorkspace, updateWorkspace, writeWorkspace } from "./store.ts";

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
  let lastRev = "";

  const announce = () => {
    let rev: string;
    try {
      rev = readWorkspace(dir).rev;
    } catch {
      return;
    }
    if (rev === lastRev) return;
    lastRev = rev;
    for (const res of listeners) res.write(`data: ${JSON.stringify({ rev })}\n\n`);
  };

  // fs.watch fires more than once per write and differs by platform, so every
  // event funnels through a short debounce and a content-hash comparison.
  let timer: NodeJS.Timeout | undefined;
  const watcher = fs.watch(dir, (_event, name) => {
    if (name && name !== WORKSPACE_FILE) return;
    clearTimeout(timer);
    timer = setTimeout(announce, 80);
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (!url.pathname.startsWith("/api/")) return false;
    if (!trusted(req)) {
      send(res, 403, { error: { code: "forbidden", message: "This API only answers its own page on this computer." } });
      return true;
    }

    try {
      if (req.method === "GET" && url.pathname === "/api/workspace") {
        const loaded = readWorkspace(dir);
        lastRev = loaded.rev;
        send(res, 200, { ...loaded, dir, folder: path.basename(dir) });
      } else if (req.method === "GET" && url.pathname === "/api/events") {
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
        res.write(": connected\n\n");
        listeners.add(res);
        req.on("close", () => listeners.delete(res));
      } else if (req.method === "POST" && url.pathname === "/api/changes") {
        const { change } = (await readJson(req)) as { change: Change };
        // The page speaks for the person at the keyboard, whatever the body claims.
        const asPerson: Change = { ...change, actor: { kind: "human", name: change?.actor?.name || "you" } };
        const { loaded } = updateWorkspace(dir, ({ workspace }) => ({ workspace: submitChange(workspace, asPerson).workspace, result: null }));
        lastRev = loaded.rev;
        send(res, 200, loaded);
      } else if (req.method === "POST" && url.pathname === "/api/proposals") {
        const { id, decision, by } = (await readJson(req)) as { id: string; decision: "approve" | "reject"; by?: string };
        if (decision !== "approve" && decision !== "reject") throw new OpError("bad_request", "decision must be approve or reject.");
        const { loaded } = updateWorkspace(dir, ({ workspace }) => ({ workspace: resolveProposal(workspace, id, decision, by || "you").workspace, result: null }));
        lastRev = loaded.rev;
        send(res, 200, loaded);
      } else if (req.method === "PUT" && url.pathname === "/api/workspace") {
        const { workspace, baseRev } = (await readJson(req)) as { workspace: Workspace; baseRev?: string };
        const errors = validateWorkspace(workspace);
        if (errors.length) throw new OpError("invalid_workspace", errors.slice(0, 5).join(" "));
        const current = readWorkspace(dir);
        if (baseRev && baseRev !== current.rev) {
          send(res, 409, { ...current, error: { code: "conflict", message: "The workspace changed on disk. Loaded the latest records." } });
        } else {
          const loaded = writeWorkspace(dir, workspace);
          lastRev = loaded.rev;
          send(res, 200, loaded);
        }
      } else {
        send(res, 404, { error: { code: "not_found", message: "No such endpoint." } });
      }
    } catch (error) {
      if (error instanceof OpError || error instanceof StoreError) send(res, error.code === "not_found" ? 404 : 422, { error: { code: error.code, message: error.message } });
      else send(res, 500, { error: { code: "internal", message: (error as Error).message } });
    }
    return true;
  }

  return {
    handle,
    close() {
      watcher.close();
      clearTimeout(timer);
      for (const res of listeners) res.end();
    },
  };
}
