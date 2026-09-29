import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ArrowRight, Check, FileUp, KeyRound, Loader2, Mic, RefreshCw, ShieldCheck } from "lucide-react";
import type { Workspace } from "../types";
import type { CallRecord, CallsState } from "../core/calls";
import { folderBacked } from "../lib/backend";
import { Button } from "../components/ui/button";
import { Field, Input, Select } from "../components/ui/field";
import { useShareSafe } from "../components/ui/privacy";
import { cn } from "../lib/utils";

async function request<T>(endpoint = "", body?: unknown): Promise<T> {
  const response = await fetch(`/api/calls${endpoint}`, body === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? "The local server could not complete this action.");
  return result;
}
const duration = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
const toggle = (values: string[], id: string) => values.includes(id) ? values.filter(v => v !== id) : [...values, id];

export function CallsView({ workspace, active }: { workspace: Workspace; active: boolean }) {
  const shareSafe = useShareSafe();
  const [state, setState] = useState<CallsState>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState("");
  const [detail, setDetail] = useState<CallRecord>();
  const [quotes, setQuotes] = useState<string[]>([]);
  const [account, setAccount] = useState("");
  const [consent, setConsent] = useState(false);
  const [connections, showConnections] = useState(false);
  const [provider, setProvider] = useState<"jev" | "granola">("jev");
  const [key, setKey] = useState("");
  const [remote, setRemote] = useState<{ id: string; title: string; createdAt?: string }[]>([]);
  const [remoteIds, setRemoteIds] = useState<string[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [remoteOpen, showRemote] = useState(false);
  const refresh = useCallback(async () => setState(await request<CallsState>()), []);
  useEffect(() => {
    if (!active || !folderBacked || shareSafe) return;
    let alive = true;
    const load = () => request<CallsState>().then(v => { if (alive) setState(v); }).catch(e => { if (alive) setError(e.message); });
    void load(); const timer = setInterval(load, 1500);
    return () => { alive = false; clearInterval(timer); };
  }, [active, shareSafe]);
  const openStatus = state?.calls.find(c => c.id === openId)?.status;
  useEffect(() => {
    if (!active || shareSafe || !openId) { setDetail(undefined); return; }
    let alive = true;
    void request<CallRecord>(`/call?id=${encodeURIComponent(openId)}`).then(call => { if (alive) setDetail(call); }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [active, shareSafe, openId, openStatus]);
  useEffect(() => { setQuotes([]); setAccount(""); }, [openId]);
  useEffect(() => { if (shareSafe) { setState(undefined); setRemote([]); setKey(""); } }, [shareSafe]);
  async function act(work: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await work(); await refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  if (shareSafe) return <div className="py-16 text-center"><ShieldCheck className="mx-auto mb-4 h-8 w-8 text-muted-foreground" /><h1 className="font-display text-h1">Calls are hidden</h1><p className="mt-2 text-muted-foreground">Turn off share-safe view to work with transcripts and connections.</p></div>;
  if (!folderBacked) return <section className="mx-auto max-w-xl py-12"><p className="text-label uppercase text-accent-fg">Calls</p><h1 className="mt-3 font-display text-h1">Bring your conversations into your CRM.</h1><p className="mt-4 text-body text-muted-foreground">Import from Granola or transcript files, classify passages with Jev, and review the quotes you want to keep. Calls use a workspace folder on your computer.</p><pre className="my-6 overflow-x-auto rounded-lg bg-secondary p-4 text-body-sm">npm run crm -- init ~/my-crm{`\n`}cd ~/my-crm{`\n`}./crm ui</pre><p className="text-body-sm text-muted-foreground">The folder app keeps connection keys in server memory. TypeSafe receives selected transcript content when you process calls.</p></section>;
  const current = detail?.id === openId ? detail : undefined;
  const running = state?.job && !state.job.finishedAt;
  const eligible = state?.calls.filter(c => c.status !== "saved" && c.status !== "processing") ?? [];
  return <section className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-label uppercase tracking-widest text-accent-fg">Conversation → evidence → account</p><h1 className="mt-2 font-display text-display">Calls</h1><p className="mt-2 text-body text-muted-foreground">Keep what matters, with the words that support it.</p></div><Button onClick={() => showConnections(!connections)}><KeyRound />Connections</Button></header>
    {error && <div role="alert" className="rounded-lg border border-destructive bg-destructive-bg p-4 text-body-sm">{error}</div>}
    {notice && <p role="status" className="rounded-lg border border-border bg-secondary p-4 text-body-sm">{notice}</p>}
    {(connections || (state && !state.connections.jev)) && <section aria-label="Provider connections" className="rounded-xl border border-border bg-surface-raised p-5">
      <div className="flex flex-wrap justify-between gap-3"><h2 className="font-display text-h2">Connect for this session</h2><span className="text-body-sm text-muted-foreground">Jev: {state?.connections.jev ? "connected" : "not connected"} · Granola: {state?.connections.granola ? "connected" : "optional"}</span></div>
      <p className="mt-2 max-w-3xl text-body-sm text-muted-foreground">Keys stay in the local server's memory until you disconnect or stop it. They are not saved in the browser, CRM records, or exports. Granola supplies transcripts; TypeSafe processes the content you select.</p>
      <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); showConnections(true); const submitted = key; setKey(""); void act(async () => { await request("/connect", { provider, key: submitted }); setNotice("Connection checked. Key loaded for this server session."); }); }}>
        <Field label="Provider"><Select value={provider} onChange={e => setProvider(e.target.value as "jev" | "granola")}><option value="jev">TypeSafe / Jev</option><option value="granola">Granola</option></Select></Field>
        <Field className="min-w-48 flex-1" label="API key"><Input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} placeholder="Enter key on your computer" /></Field>
        <Button type="submit" variant="primary" disabled={!key.trim() || busy}>Check and connect</Button>
        {state?.connections[provider] && <Button disabled={busy} onClick={() => void act(async () => { await request("/disconnect", { provider }); setNotice("Disconnected. No new requests will start; a request already sent may finish at the provider."); })}>Disconnect</Button>}
      </form>
      <div className="mt-3 flex flex-wrap gap-4 text-body-sm"><a className="text-accent-fg underline" href="https://console.typesafe.ai" target="_blank" rel="noreferrer">Get a TypeSafe key</a><a className="text-accent-fg underline" href="https://docs.granola.ai/introduction" target="_blank" rel="noreferrer">Granola API setup and plan requirements</a></div>
    </section>}
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary" disabled={!state?.connections.granola || busy} onClick={() => void act(async () => { const result = await request<{ notes: typeof remote; cursor?: string }>("/granola"); setRemote(result.notes); setCursor(result.cursor); setRemoteIds([]); showRemote(true); })}><RefreshCw />Browse Granola</Button>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border-strong px-3 py-2 text-body-sm focus-within:focus-ring"><FileUp className="h-4 w-4" />Import transcript files<input aria-label="Import transcript files" className="sr-only" type="file" accept=".txt,.md" multiple disabled={busy} onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ""; void act(async () => { if (files.length > 50) throw new Error("Choose up to 50 files at a time."); if (files.some(f => f.size > 800000)) throw new Error("Keep each transcript under 200,000 characters."); let added = 0; for (const f of files) { const result = await request<{ call: { id: string }; duplicate: boolean }>("/import", { title: f.name.slice(0,200), transcript: await f.text() }); if (!result.duplicate) added++; setOpenId(result.call.id); } setNotice(`${added} calls imported. ${files.length - added} duplicates skipped. Nothing has been sent to Jev.`); }); }} /></label>
      <Button disabled={busy} onClick={() => void act(async () => { const result = await request<{ ids: string[] }>("/samples", { count: 50 }); setSelected(result.ids.filter(id => state?.calls.find(c => c.id === id)?.status !== "saved")); setOpenId(result.ids[0]); setNotice("50 short synthetic workshop calls loaded locally. Processing uses the real Jev API when you choose it; no model output is simulated."); })}>Try 50 sample calls</Button>
      <p className="text-body-sm text-muted-foreground">Read-only import. Choose what to process next.</p>
    </div>
    {remoteOpen && <section className="rounded-xl border border-border p-5" aria-label="Granola calls"><div className="flex justify-between gap-3"><h2 className="font-display text-h2">Choose calls from Granola</h2><Button size="sm" onClick={() => showRemote(false)}>Close</Button></div><p className="my-3 text-body-sm text-muted-foreground">Selected transcripts will be downloaded to this workspace. Import does not send them to Jev.</p><div className="max-h-64 overflow-y-auto divide-y divide-border">{remote.map(n => <label key={n.id} className="flex items-start gap-3 py-3 text-body-sm"><input type="checkbox" checked={remoteIds.includes(n.id)} onChange={() => setRemoteIds(toggle(remoteIds,n.id).slice(0,50))} /><span>{n.title}</span></label>)}</div><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" onClick={() => setRemoteIds(remote.slice(0,50).map(n => n.id))}>Select first {Math.min(50,remote.length)}</Button>{cursor && <Button size="sm" disabled={busy} onClick={() => void act(async () => { const result = await request<{ notes: typeof remote; cursor?: string }>(`/granola?cursor=${encodeURIComponent(cursor)}`); setRemote(v => [...v, ...result.notes.filter(n => !v.some(old => old.id === n.id))]); setCursor(result.cursor); })}>Load more</Button>}<Button variant="primary" disabled={busy || !remoteIds.length} onClick={() => void act(async () => { const r = await request<{ imported: string[]; duplicates: number; failures: { error: string }[]; importMs: number }>("/import-granola", { ids: remoteIds }); setSelected(r.imported); setOpenId(r.imported[0] ?? ""); setNotice(`Imported ${r.imported.length} calls in ${duration(r.importMs)}; ${r.duplicates} duplicates, ${r.failures.length} failures.${r.failures.length ? ` ${r.failures[0].error}` : ""}`); showRemote(false); })}>{busy ? "Importing…" : `Import ${remoteIds.length} calls`}</Button></div></section>}
    {state?.job && <section role="status" className="rounded-xl border border-agent bg-agent-bg p-4"><div className="flex flex-wrap items-center justify-between gap-3"><span className="flex items-center gap-2 text-agent-fg">{running ? <Loader2 className="h-4 w-4 animate-spin" /> : state.job.failed ? <AlertCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}{state.job.done} / {state.job.ids.length} processed · {state.job.failed} failed</span><span className="font-mono text-body-sm">{duration(state.job.elapsedMs)} · Jev processing only</span>{running && <Button size="sm" onClick={() => void act(async () => { await request("/cancel", {}); })}>Stop after active requests</Button>}</div>{state.job.error && <p className="mt-2 text-body-sm text-destructive-fg">{state.job.error}</p>}<div role="progressbar" aria-label="Batch progress" aria-valuemin={0} aria-valuemax={state.job.ids.length} aria-valuenow={state.job.done} className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-agent transition-[width]" style={{ width: `${state.job.done / state.job.ids.length * 100}%` }} /></div></section>}
    <div className="grid gap-6 lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.7fr)]">
      <aside className="min-w-0"><div className="mb-3 flex items-center justify-between"><h2 className="font-display text-h2">Imported calls <span className="text-muted-foreground">{state?.calls.length ?? 0}</span></h2><div className="flex flex-wrap justify-end"><Button size="sm" variant="ghost" onClick={() => setSelected(eligible.slice(0,50).map(c => c.id))}>Select up to 50</Button>{!!selected.length && <Button size="sm" variant="ghost" onClick={() => setSelected([])}>Clear selection</Button>}</div></div>
        <div className="max-h-[520px] overflow-y-auto rounded-xl border border-border">{!state?.calls.length && <div className="p-8 text-center"><Mic className="mx-auto mb-3 h-7 w-7 text-muted-foreground" /><p className="text-body-sm text-muted-foreground">Import a call to see its evidence here.</p></div>}{state?.calls.map(c => <div key={c.id} className={cn("flex items-start gap-3 border-b border-border p-3 last:border-0", c.id === openId && "bg-accent-bg")}><input aria-label={`Select ${c.title}`} type="checkbox" className="mt-1" disabled={c.status === "saved" || c.status === "processing"} checked={selected.includes(c.id)} onChange={() => setSelected(toggle(selected,c.id).slice(0,50))} /><button className="min-w-0 flex-1 text-left" onClick={() => setOpenId(c.id)}><span className="block break-words text-body-sm font-medium">{c.title}</span><span className="mt-1 block text-label text-muted-foreground">{c.source === "granola" ? "Granola" : "File"} · {c.status} {c.findingCount ? `· ${c.findingCount} passages` : ""}</span></button></div>)}</div>
        <label className="my-4 flex items-start gap-2 text-body-sm text-muted-foreground"><input className="mt-1" type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /><span>Send the selected transcript content to TypeSafe for Jev processing.</span></label><Button variant="agent" className="w-full" disabled={!selected.length || !consent || !state?.connections.jev || busy || !!running} onClick={() => void act(async () => { await request("/process", { ids: selected, consent }); setSelected([]); showConnections(false); })}>Process {selected.length} calls with Jev<ArrowRight /></Button>
      </aside>
      <section className="min-w-0 rounded-xl border border-border bg-surface-raised p-5" aria-label="Call review">{!current ? <div className="py-16 text-center"><h2 className="font-display text-h2">A source for every quote.</h2><p className="mx-auto mt-3 max-w-sm text-body text-muted-foreground">Open a call, inspect the passages, then choose what belongs in an account.</p></div> : <>
        <p className="text-label uppercase text-muted-foreground">{current.status === "saved" ? "Saved to account" : current.status === "error" ? "Processing failed" : current.status === "processing" ? "Processing with Jev" : current.status === "ready" ? "Ready to process" : "Review before saving"}</p><h2 className="mt-2 break-words font-display text-h1">{current.title}</h2>
        <p className="mt-2 text-body-sm text-muted-foreground">{current.model ? `${current.model} · ${duration(current.processingMs ?? 0)}` : current.status === "error" ? "Nothing from this call has been saved to an account." : "Imported locally. Ready for processing."}</p>
        {current.error && <p className="my-4 text-body-sm text-destructive-fg">{current.error}</p>}
        {!!current.findings.length && <div aria-label="Evidence map" className="my-5 flex flex-wrap items-center gap-2 text-label"><span className="rounded-md bg-secondary px-3 py-2">Call</span><ArrowRight className="h-3 w-3" />{[...new Set(current.findings.map(f => f.kind))].map(kind => <span key={kind} className="rounded-md border border-border px-3 py-2">{kind} · {current.findings.filter(f => f.kind === kind).length}</span>)}<ArrowRight className="h-3 w-3" /><span>Human review</span></div>}
        <div className="space-y-3">{current.findings.map(f => <label key={f.id} className="flex gap-3 rounded-lg border border-border p-4"><input type="checkbox" className="mt-1" checked={current.status === "saved" ? !!current.savedSpanIds?.includes(f.id) : quotes.includes(f.id)} disabled={current.status !== "review"} onChange={() => setQuotes(toggle(quotes,f.id))} /><div className="min-w-0"><div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-label"><span className="font-medium text-agent-fg">{f.kind}</span>{current.status === "saved" && <span className="text-muted-foreground">{current.savedSpanIds?.includes(f.id) ? "Saved" : "Not saved"}</span>}<span className={f.certainty !== "explicit" ? "text-warning-fg" : "text-muted-foreground"}>{f.certainty}</span><span className="text-muted-foreground">Model confidence {Math.round(f.confidence * 100)}%</span></div><blockquote className="break-words text-body leading-relaxed">{f.text}</blockquote><span className="mt-2 block text-label text-faint-foreground">Verbatim · characters {f.start}–{f.end}</span></div></label>)}</div>
        {current.status === "review" && !current.findings.length && <p className="my-5 text-body text-muted-foreground">No passages were classified as useful account evidence. The complete transcript remains below.</p>}
        {current.status === "review" && !!current.findings.length && <div className="mt-5 space-y-3 border-t border-border pt-5"><Field label="Save to account"><Select value={account} onChange={e => setAccount(e.target.value)}><option value="">Choose an account</option>{workspace.accounts.filter(a => !a.archivedAt).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field><p className="text-body-sm text-muted-foreground">This creates one source note and {quotes.length} {quotes.length === 1 ? "claim" : "claims"} from your selected quotes. Conditions stay attached. Existing claims are not overwritten.</p><Button variant="primary" disabled={!account || !quotes.length || busy} onClick={() => void act(async () => { await request("/save", { id: current.id, accountId: account, spanIds: quotes }); setQuotes([]); setNotice("Reviewed quotes saved as a source note and account claims."); })}><Check />Save {quotes.length} reviewed {quotes.length === 1 ? "quote" : "quotes"}</Button></div>}
        <details className="mt-6 border-t border-border pt-4"><summary className="cursor-pointer text-body-sm font-medium">Full transcript and source</summary><p className="my-3 break-all font-mono text-label text-muted-foreground">{current.sourceRef}</p><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-body-sm leading-relaxed">{current.transcript}</pre></details>
      </>}</section>
    </div>
  </section>;
}
