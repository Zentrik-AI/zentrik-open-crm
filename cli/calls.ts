import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { applyChange, newChange, OpError } from "../src/core/ops.ts";
import type { CallJob, CallRecord, CallsState } from "../src/core/calls.ts";
import { updateWorkspace } from "./store.ts";
import { addSource } from "./sources.ts";
import { classifyCall, getGranola, listGranola, providerJson, type Fetcher } from "./call-providers.ts";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const pause = (ms: number) => new Promise(r => setTimeout(r, ms));
export function createCallService(dir: string, fetcher: Fetcher = fetch, options: { recover?: boolean } = {}) {
  const root = path.join(dir, ".open-crm", "calls");
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  let keys: Record<"jev" | "granola", string> = { jev: process.env.TYPESAFE_API_KEY ?? "", granola: process.env.GRANOLA_API_KEY ?? "" };
  let job: CallJob | undefined;
  let cancelled = false;
  let importing = false;
  const lockFile = path.join(root, "processing.lock");
  function liveLock(): boolean {
    if (!fs.existsSync(lockFile)) return false;
    try {
      const owner = JSON.parse(fs.readFileSync(lockFile, "utf8"));
      if (!Number.isInteger(owner.pid) || owner.pid <= 0) return true;
      try { process.kill(owner.pid, 0); return true; }
      catch (e) { return (e as NodeJS.ErrnoException).code !== "ESRCH"; }
    } catch { return true; }
  }
  function acquire(id: string) {
    if (fs.existsSync(lockFile) && !liveLock()) fs.rmSync(lockFile);
    try { fs.writeFileSync(lockFile, JSON.stringify({ pid: process.pid, id }), { flag: "wx", mode: 0o600 }); }
    catch { throw new OpError("busy", "Another process is working on calls in this workspace. Let it finish first."); }
  }
  function release(id: string) {
    try { if (JSON.parse(fs.readFileSync(lockFile,"utf8")).id === id) fs.rmSync(lockFile); } catch { /* preserve a lock we cannot identify */ }
  }
  function file(id: string) {
    if (!/^call_[a-f0-9]{24}$/.test(id)) throw new OpError("invalid_value", "Invalid call id.");
    return path.join(root, `${id}.json`);
  }
  function save(call: CallRecord) {
    const target = file(call.id), tmp = `${target}.${randomUUID()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(call), { mode: 0o600, flag: "wx" });
    fs.renameSync(tmp, target);
  }
  function get(id: string): CallRecord {
    const target = file(id);
    if (!fs.existsSync(target)) throw new OpError("not_found", "Call not found.");
    return JSON.parse(fs.readFileSync(target, "utf8"));
  }
  function records(): CallRecord[] {
    return fs.readdirSync(root).filter(n => /^call_[a-f0-9]{24}\.json$/.test(n)).map(n => get(n.slice(0, -5))).sort((a,b) => b.importedAt.localeCompare(a.importedAt));
  }
  // A process restart cannot resume an in-flight provider request honestly.
  for (const call of options.recover && !liveLock() ? records() : []) if (call.status === "processing") save({ ...call, status: "error", error: "The local server stopped during processing. Retry this call." });
  function requireKey(provider: "jev" | "granola") {
    if (!keys[provider]) throw new OpError("missing_key", `Connect ${provider === "jev" ? "TypeSafe / Jev" : "Granola"} first.`);
    return keys[provider];
  }
  function ingest(input: { title: string; transcript: string; source: "file" | "granola"; externalId?: string; occurredAt?: string }) {
    if (typeof input.title !== "string" || !input.title.trim() || input.title.length > 200 || typeof input.transcript !== "string" || !input.transcript.trim() || input.transcript.length > 200000) throw new OpError("invalid_value", "A call needs a title (up to 200 characters) and a transcript (up to 200,000 characters).");
    const id = `call_${hash(input.transcript).slice(0,24)}`;
    if (fs.existsSync(file(id))) return { call: get(id), duplicate: true };
    if (records().length >= 200) throw new OpError("too_large", "This workspace has 200 imported calls. Use a separate workspace for another batch.");
    const temporary = path.join(root, `${id}.txt`);
    fs.writeFileSync(temporary, input.transcript, { mode: 0o600 });
    let source;
    try { source = addSource(dir, temporary, { kind: "transcript", capturedBy: "Calls import", externalId: input.externalId ? `${input.externalId}:${hash(input.transcript).slice(0,16)}` : undefined, occurredAt: input.occurredAt }).source; }
    finally { fs.rmSync(temporary, { force: true }); }
    fs.chmodSync(path.join(dir, source.path), 0o600);
    const call: CallRecord = { ...input, title: input.title.trim(), id, sourceRef: `source:${source.id}`, importedAt: new Date().toISOString(), status: "ready", findings: [] };
    save(call);
    return { call, duplicate: false };
  }
  return {
    get, ingest,
    state(): CallsState { return { calls: records(), job: job && { ...job, elapsedMs: job.finishedAt ? job.elapsedMs : Date.now() - Date.parse(job.startedAt) }, connections: { jev: !!keys.jev, granola: !!keys.granola } }; },
    async connect(provider: "jev" | "granola", key: string) {
      if (!["jev", "granola"].includes(provider) || typeof key !== "string" || !key.trim() || key.length > 2048 || /[\r\n]/.test(key)) throw new OpError("invalid_value", "Enter a valid provider key.");
      const clean = key.trim();
      if (provider === "jev") await providerJson("https://api.typesafe.ai/v1/models", clean, {}, fetcher);
      else await listGranola(clean, undefined, fetcher);
      keys[provider] = clean;
      return { connected: true };
    },
    disconnect(provider: "jev" | "granola") {
      if (!["jev", "granola"].includes(provider)) throw new OpError("invalid_value", "Unknown provider.");
      keys[provider] = "";
      if (provider === "jev") cancelled = true;
      return { connected: false };
    },
    listGranola(cursor?: string) { return listGranola(requireKey("granola"), cursor, fetcher); },
    async importGranola(ids: string[]) {
      if (!Array.isArray(ids) || !ids.length || ids.length > 50 || ids.some(id => typeof id !== "string" || !/^not_[a-zA-Z0-9_-]+$/.test(id))) throw new OpError("invalid_value", "Select between 1 and 50 Granola calls.");
      if (importing) throw new OpError("busy", "An import is already running.");
      const key = requireKey("granola");
      importing = true;
      const started = Date.now();
      const imported: string[] = [], failures: { id: string; error: string }[] = [];
      let duplicates = 0;
      try {
        for (const id of [...new Set(ids)]) {
          if (!keys.granola) { failures.push({ id, error: "Granola disconnected. Import stopped." }); break; }
          try {
            const data = await getGranola(key, id, fetcher, () => !keys.granola);
            const result = ingest({ ...data, source: "granola", externalId: id });
            imported.push(result.call.id); if (result.duplicate) duplicates++;
          } catch (e) { failures.push({ id, error: e instanceof OpError ? e.message : "This call could not be imported." }); }
          await pause(250);
        }
      } finally { importing = false; }
      return { imported, duplicates, failures, importMs: Date.now() - started };
    },
    start(ids: string[], consent: boolean) {
      if (consent !== true) throw new OpError("consent_required", "Confirm sending the selected transcript content to TypeSafe.");
      if (job && !job.finishedAt) throw new OpError("busy", "A batch is already running.");
      if (!Array.isArray(ids) || !ids.length || ids.length > 50) throw new OpError("invalid_value", "Select between 1 and 50 calls.");
      const selected = [...new Set(ids)].map(get);
      if (selected.some(c => c.status === "saved")) throw new OpError("invalid_value", "Saved calls cannot be processed again.");
      requireKey("jev");
      cancelled = false;
      const current: CallJob = { id: randomUUID(), ids: selected.map(c => c.id), done: 0, failed: 0, startedAt: new Date().toISOString(), elapsedMs: 0 };
      acquire(current.id);
      job = current;
      try { for (const call of selected) save({ ...call, status: "processing", findings: [], error: undefined }); }
      catch (e) { release(current.id); job = undefined; throw e; }
      let next = 0;
      const worker = async () => {
        while (next < selected.length) {
          const call = selected[next++], start = Date.now();
          try {
            if (cancelled) throw new OpError("cancelled", "Processing cancelled. Retry when ready.");
            const result = await classifyCall(call.transcript, requireKey("jev"), fetcher, () => cancelled || !keys.jev);
            if (cancelled) throw new OpError("cancelled", "Processing cancelled. No CRM records were changed.");
            save({ ...call, ...result, status: "review", error: undefined, processingMs: Date.now() - start });
          } catch (e) {
            current.failed++;
            save({ ...call, findings: [], status: "error", error: e instanceof OpError ? e.message : "Processing failed. Retry this call.", processingMs: Date.now() - start });
          }
          current.done++;
        }
      };
      void Promise.all(Array.from({ length: Math.min(4, selected.length) }, worker)).catch(() => {
        current.failed = Math.max(current.failed, current.ids.length - current.done);
        current.error = "The local result could not be saved. Check disk access before retrying.";
      }).finally(() => {
        current.finishedAt = new Date().toISOString(); current.elapsedMs = Date.now() - Date.parse(current.startedAt);
        try { fs.writeFileSync(path.join(root, `batch-${current.id}.json`), JSON.stringify({ ...current, inputCharacters: selected.reduce((n,c)=>n+c.transcript.length,0), models: [...new Set(selected.map(c=>get(c.id).model).filter(Boolean))], includesImport: false, includesReview: false }), { mode: 0o600 }); }
        catch { current.error = "Batch receipt could not be saved. Check disk access before retrying."; }
        finally { release(current.id); }
      }).catch(() => { /* A failed receipt write must not create an unhandled rejection. Per-call state remains available. */ });
      return current;
    },
    cancel() { cancelled = true; return { cancelling: true }; },
    commit(id: string, accountId: string, spanIds: string[], reviewer = "you") {
      const call = get(id);
      if (typeof accountId !== "string" || !accountId || !Array.isArray(spanIds) || !spanIds.length || spanIds.some(s => typeof s !== "string")) throw new OpError("invalid_value", "Choose an account and at least one quote.");
      if (call.status !== "review" && call.status !== "saved") throw new OpError("invalid_value", "Process and review this call first.");
      const chosen = [...new Set(spanIds)].map(span => {
        const finding = call.findings.find(f => f.id === span);
        if (!finding || call.transcript.slice(finding.start, finding.end) !== finding.text) throw new OpError("invalid_value", "A selected quote does not match its transcript.");
        return finding;
      });
      const noteId = `note_${id}`;
      const result = updateWorkspace(dir, ({ workspace }) => {
        const previous = workspace.notes.find(n => n.id === noteId);
        if (previous) {
          if (previous.accountId !== accountId) throw new OpError("invalid_value", "This call was already saved to a different account.");
          return { workspace, result: { noteId, duplicate: true, savedSpanIds: (workspace.claims ?? []).filter(c => c.evidence.includes(noteId) && c.id.startsWith(`claim_${id}_`)).map(c => c.id.slice(`claim_${id}_`.length)) } };
        }
        if (!workspace.accounts.some(a => a.id === accountId && !a.archivedAt)) throw new OpError("not_found", "Choose an active account.");
        const actor = { kind: "agent" as const, name: `Jev · reviewed by ${reviewer}` };
        const change = newChange({ type: "note.add", accountId, title: call.title, body: chosen.map(f => `[${f.kind}; ${f.certainty}; model confidence ${Math.round(f.confidence * 100)}%]\n${f.text}`).join("\n\n"), source: "call", sourceRef: call.sourceRef, occurredAt: call.occurredAt }, actor);
        change.recordId = noteId;
        let nextWorkspace = applyChange(workspace, change).workspace;
        for (const finding of chosen) {
          const claim = newChange({ type: "claim.add", accountId, kind: finding.kind, text: `${finding.certainty === "explicit" ? "" : `[${finding.certainty}] `}${finding.text}`, evidence: [noteId] }, actor);
          claim.recordId = `claim_${id}_${finding.id}`;
          nextWorkspace = applyChange(nextWorkspace, claim).workspace;
        }
        return { workspace: nextWorkspace, result: { noteId, duplicate: false, savedSpanIds: chosen.map(f => f.id) } };
      });
      save({ ...call, status: "saved", savedNoteId: noteId, savedAccountId: accountId, savedSpanIds: result.result.savedSpanIds });
      return result.result;
    },
    close() { cancelled = true; keys = { jev: "", granola: "" }; },
  };
}
export type CallService = ReturnType<typeof createCallService>;
