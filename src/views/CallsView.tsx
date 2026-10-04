import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ArrowRight, Check, ChevronRight, ExternalLink, FileUp, KeyRound, Loader2, Mic, RefreshCw, ShieldCheck } from "lucide-react";
import type { Workspace } from "../types";
import type { CallRecord, CallsState } from "../core/calls";
import { callCategories } from "../core/calls";
import { folderBacked } from "../lib/backend";
import { Button } from "../components/ui/button";
import { Field, Input, Select } from "../components/ui/field";
import { useShareSafe } from "../components/ui/privacy";
import { cn } from "../lib/utils";
import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";
import type { Tone } from "../lib/meta";
import { localWorkspaceSetup, setupGuideUrl } from "../lib/setup";

async function request<T>(endpoint = "", body?: unknown): Promise<T> {
  const response = await fetch(`/api/calls${endpoint}`, body === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? "The local server could not complete this action.");
  return result;
}
const duration = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
const toggle = (values: string[], id: string) => values.includes(id) ? values.filter(v => v !== id) : [...values, id];
const statusMeta: Record<CallRecord["status"], { label: string; tone: Tone }> = {
  ready: { label: "Ready", tone: "neutral" },
  processing: { label: "Processing", tone: "agent" },
  review: { label: "To review", tone: "warning" },
  error: { label: "Failed", tone: "destructive" },
  saved: { label: "Saved", tone: "success" },
};
const dotTone: Record<Tone, string> = {
  neutral: "bg-border-strong", accent: "bg-accent", signal: "bg-signal", account: "bg-account", agent: "bg-agent",
  highlight: "bg-highlight", success: "bg-success", warning: "bg-warning", destructive: "bg-destructive",
};
const reviewHeading: Record<CallRecord["status"], string> = {
  saved: "Saved to account",
  error: "Processing failed",
  processing: "Processing with Jev",
  ready: "Ready to process",
  review: "Review before saving",
};
const checkbox = "mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[hsl(var(--accent))] disabled:cursor-not-allowed disabled:opacity-40";

export function CallsView({ workspace, active, onOpenAccount }: { workspace: Workspace; active: boolean; onOpenAccount: (id: string) => void }) {
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
  const [filter, setFilter] = useState("all");
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
  if (shareSafe) return (
    <section className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-muted-foreground"><ShieldCheck className="h-5 w-5" aria-hidden /></span>
      <h1 className="mt-4 text-h2 text-foreground">Calls are hidden</h1>
      <p className="mt-1 text-body-sm text-muted-foreground">Turn off share-safe view to work with transcripts and connections.</p>
    </section>
  );
  if (!folderBacked) return (
    <section className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-h1 text-foreground">Calls</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">Turn transcripts into sourced account updates.</p>
      </header>
      <Card className="flex flex-col items-center px-6 py-12 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-muted-foreground"><Mic className="h-5 w-5" aria-hidden /></span>
        <h2 className="mt-4 text-h2 text-foreground">Calls need a workspace folder</h2>
        <p className="mt-1 max-w-sm text-body-sm text-muted-foreground">Import from Granola or files, classify with Jev and keep the quotes that matter.</p>
        <pre className="mt-5 w-full max-w-sm overflow-x-auto rounded-lg border border-border bg-surface-sunken px-4 py-3 text-left font-mono text-label leading-6 text-muted-foreground">{localWorkspaceSetup}</pre>
        <a href={setupGuideUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-sm text-body-sm text-accent-fg hover:underline focus-visible:outline-none focus-visible:focus-ring">
          Setup guide <ArrowRight className="h-4 w-4" />
        </a>
        <p className="mt-4 max-w-sm text-label text-faint-foreground">Keys stay in local server memory. TypeSafe receives only the transcripts you process.</p>
      </Card>
    </section>
  );
  const current = detail?.id === openId ? detail : undefined;
  const running = state?.job && !state.job.finishedAt;
  const eligible = state?.calls.filter(c => c.status !== "saved" && c.status !== "processing") ?? [];
  const processed = state?.calls.filter(c => c.status === "review" || c.status === "saved") ?? [];
  const visibleCalls = state?.calls.filter(c => filter === "all" || ((c.status === "review" || c.status === "saved") && c.findingKinds?.includes(filter as "need" | "risk" | "goal" | "objection" | "commitment" | "fact"))) ?? [];
  const destination = workspace.accounts.find(a => a.id === (current?.savedAccountId || account));
  const selectedFindings = current?.findings.filter(f => quotes.includes(f.id)) ?? [];
  function chooseFilter(kind: string) {
    setFilter(kind);
    setSelected([]);
    setQuotes([]);
    const matches = state?.calls.filter(c => kind === "all" || ((c.status === "review" || c.status === "saved") && c.findingKinds?.some(k => k === kind))) ?? [];
    if (!matches.some(c => c.id === openId)) setOpenId(matches[0]?.id ?? "");
  }
  const labels: Record<string, string> = { need: "Customer needs", risk: "Risks", objection: "Objections", commitment: "Commitments", goal: "Goals", fact: "Account facts" };
  const reviewFindings = current?.findings.filter(f => filter === "all" || f.kind === filter) ?? [];
  const pill = (pressed: boolean) => cn(
    "h-8 rounded-full border px-3 text-body-sm font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:focus-ring",
    pressed ? "border-accent/40 bg-accent-bg text-accent-fg" : "border-border bg-surface-raised text-muted-foreground hover:border-border-strong hover:text-foreground",
  );
  const toolbarButton = "inline-flex h-9 cursor-pointer select-none items-center gap-1.5 rounded-lg border border-border bg-surface-raised px-3.5 text-body-sm font-medium text-foreground shadow-e1 transition-colors duration-fast hover:border-border-strong hover:bg-secondary focus-within:focus-ring [&_svg]:h-[15px] [&_svg]:w-[15px]";
  return <section className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-h1 text-foreground">Calls</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">Keep what a call should change, with the quote attached.</p>
      </div>
      <Button size="sm" onClick={() => showConnections(!connections)} aria-expanded={connections || (state && !state.connections.jev) || undefined}><KeyRound />Connections</Button>
    </header>

    {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive-bg px-4 py-3 text-body-sm text-destructive-fg"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span className="min-w-0 [overflow-wrap:anywhere]">{error}</span></div>}
    {notice && <p role="status" className="flex items-start gap-2 rounded-lg border border-border bg-surface-sunken px-4 py-3 text-body-sm text-foreground"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden /><span className="min-w-0 [overflow-wrap:anywhere]">{notice}</span></p>}

    {(connections || (state && !state.connections.jev)) && <Card aria-label="Provider connections" className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="text-h3 text-foreground">Connect for this session</h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-label text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className={cn("h-1.5 w-1.5 rounded-full", state?.connections.jev ? "bg-success" : "bg-border-strong")} aria-hidden /><span>Jev: {state?.connections.jev ? "connected" : "not connected"}</span></span>
          <span className="inline-flex items-center gap-1.5"><span className={cn("h-1.5 w-1.5 rounded-full", state?.connections.granola ? "bg-success" : "bg-border-strong")} aria-hidden /><span>Granola: {state?.connections.granola ? "connected" : "optional"}</span></span>
        </div>
      </div>
      <p className="mt-1 text-body-sm text-muted-foreground">Keys stay in local server memory, never in the browser, records or exports.</p>
      <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); showConnections(true); const submitted = key; setKey(""); void act(async () => { await request("/connect", { provider, key: submitted }); setNotice("Connection checked. Key loaded for this server session."); }); }}>
        <Field className="w-full sm:w-44" label="Provider"><Select value={provider} onChange={e => setProvider(e.target.value as "jev" | "granola")}><option value="jev">TypeSafe / Jev</option><option value="granola">Granola</option></Select></Field>
        <Field className="min-w-0 flex-1 basis-56" label="API key"><Input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} placeholder="Paste a key" /></Field>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={!key.trim() || busy}>Check and connect</Button>
          {state?.connections[provider] && <Button disabled={busy} onClick={() => void act(async () => { await request("/disconnect", { provider }); setNotice("Disconnected. No new requests will start; a request already sent may finish at the provider."); })}>Disconnect</Button>}
        </div>
      </form>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-label">
        <a className="inline-flex items-center gap-1 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:focus-ring" href="https://console.typesafe.ai" target="_blank" rel="noreferrer">Get a TypeSafe key<ExternalLink className="h-3 w-3" aria-hidden /></a>
        <a className="inline-flex items-center gap-1 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:focus-ring" href="https://docs.granola.ai/introduction" target="_blank" rel="noreferrer">Granola API setup and plan requirements<ExternalLink className="h-3 w-3" aria-hidden /></a>
      </div>
    </Card>}

    <details key={state?.calls.length ? "populated" : "empty"} open={!state?.calls.length || undefined} className="group border-b border-border pb-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-sm text-body-sm focus-visible:outline-none focus-visible:focus-ring [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-4 w-4 text-faint-foreground transition-transform duration-fast group-open:rotate-90" aria-hidden />
        <span className="font-medium text-foreground">Import calls</span>
        <span className="text-muted-foreground">Granola, files or 50 sample calls</span>
      </summary>
      <div className="mt-3 flex flex-wrap items-center gap-2 pl-6">
        <Button variant="secondary" disabled={!state?.connections.granola || busy} onClick={() => void act(async () => { const result = await request<{ notes: typeof remote; cursor?: string }>("/granola"); setRemote(result.notes); setCursor(result.cursor); setRemoteIds([]); showRemote(true); })}><RefreshCw />Browse Granola</Button>
        <label className={cn(toolbarButton, busy && "pointer-events-none opacity-40")}><FileUp aria-hidden />Import transcript files<input aria-label="Import transcript files" className="sr-only" type="file" accept=".txt,.md" multiple disabled={busy} onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ""; void act(async () => { if (files.length > 50) throw new Error("Choose up to 50 files at a time."); if (files.some(f => f.size > 800000)) throw new Error("Keep each transcript under 200,000 characters."); let added = 0; for (const f of files) { const result = await request<{ call: { id: string }; duplicate: boolean }>("/import", { title: f.name.slice(0,200), transcript: await f.text() }); if (!result.duplicate) added++; setOpenId(result.call.id); } setNotice(`${added} calls imported. ${files.length - added} duplicates skipped. Nothing has been sent to Jev.`); }); }} /></label>
        <Button variant="ghost" disabled={busy} onClick={() => void act(async () => { const result = await request<{ ids: string[] }>("/samples", { count: 50 }); setSelected(result.ids.filter(id => state?.calls.find(c => c.id === id)?.status !== "saved")); setOpenId(result.ids[0]); setNotice("50 short synthetic workshop calls loaded locally. Processing uses the real Jev API when you choose it; no model output is simulated."); })}>Try 50 sample calls</Button>
        <span className="text-label text-faint-foreground sm:ml-auto">Imports stay local until you process them.</span>
      </div>
      {remoteOpen && <Card className="mt-4 overflow-hidden" aria-label="Granola calls">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3"><h2 className="text-h3 text-foreground">Choose calls from Granola</h2><Button size="sm" variant="ghost" onClick={() => showRemote(false)}>Close</Button></div>
        <p className="px-5 pt-3 text-label text-faint-foreground">Selected transcripts download to this workspace. Import does not send them to Jev.</p>
        <div className="max-h-64 divide-y divide-border overflow-y-auto px-5">{remote.map(n => <label key={n.id} className="flex cursor-pointer items-start gap-3 py-2.5 text-body-sm"><input type="checkbox" className={checkbox} checked={remoteIds.includes(n.id)} onChange={() => setRemoteIds(toggle(remoteIds,n.id).slice(0,50))} /><span className="min-w-0 [overflow-wrap:anywhere]">{n.title}</span></label>)}</div>
        <div className="flex flex-wrap gap-2 border-t border-border bg-surface-sunken/50 px-5 py-3"><Button size="sm" variant="ghost" onClick={() => setRemoteIds(remote.slice(0,50).map(n => n.id))}>Select first <span className="tnum">{Math.min(50,remote.length)}</span></Button>{cursor && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void act(async () => { const result = await request<{ notes: typeof remote; cursor?: string }>(`/granola?cursor=${encodeURIComponent(cursor)}`); setRemote(v => [...v, ...result.notes.filter(n => !v.some(old => old.id === n.id))]); setCursor(result.cursor); })}>Load more</Button>}<Button size="sm" variant="primary" className="ml-auto" disabled={busy || !remoteIds.length} onClick={() => void act(async () => { const r = await request<{ imported: string[]; duplicates: number; failures: { error: string }[]; importMs: number }>("/import-granola", { ids: remoteIds }); setSelected(r.imported); setOpenId(r.imported[0] ?? ""); setNotice(`Imported ${r.imported.length} calls in ${duration(r.importMs)}; ${r.duplicates} duplicates, ${r.failures.length} failures.${r.failures.length ? ` ${r.failures[0].error}` : ""}`); showRemote(false); })}>{busy ? "Importing…" : `Import ${remoteIds.length} calls`}</Button></div>
      </Card>}
    </details>

    {state?.job && <section role="status" className={cn("rounded-xl px-4 py-3", running ? "border border-agent/30 bg-agent-bg" : "border border-border bg-surface-sunken/60")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className={cn("flex items-center gap-2 text-body-sm font-medium tnum", running ? "text-agent-fg" : state.job.failed ? "text-warning-fg" : "text-foreground")}>{running ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : state.job.failed ? <AlertCircle className="h-4 w-4" aria-hidden /> : <Check className="h-4 w-4 text-success" aria-hidden />}{state.job.done} / {state.job.ids.length} processed · {state.job.failed} failed</span>
        <span className="flex items-center gap-3"><span className="tnum text-label text-muted-foreground">{duration(state.job.elapsedMs)} · Jev processing only</span>{running && <Button size="sm" onClick={() => void act(async () => { await request("/cancel", {}); })}>Stop after active requests</Button>}</span>
      </div>
      {state.job.error && <p className="mt-2 text-body-sm text-destructive-fg">{state.job.error}</p>}
      {running && <div role="progressbar" aria-label="Batch progress" aria-valuemin={0} aria-valuemax={state.job.ids.length} aria-valuenow={state.job.done} className="mt-3 h-1 overflow-hidden rounded-full bg-agent/15"><div className="h-full rounded-full bg-agent transition-[width] duration-base ease-out" style={{ width: `${state.job.done / state.job.ids.length * 100}%` }} /></div>}
    </section>}

    {!!processed.length && <section aria-label="Call results" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-h3 text-foreground">What came out of the calls</h2><p className="tnum text-label text-muted-foreground">{processed.length} processed · {processed.filter(c => c.status === "saved").length} saved to CRM</p></div>
      <div className="flex flex-wrap gap-2" title="Calls with each type of evidence. A call can appear in more than one group."><button type="button" aria-pressed={filter === "all"} className={pill(filter === "all")} onClick={() => chooseFilter("all")}>All calls</button>{Object.entries(labels).map(([kind, label]) => {
        const count = processed.filter(c => c.findingKinds?.some(k => k === kind)).length;
        return <button type="button" key={kind} aria-pressed={filter === kind} className={pill(filter === kind)} onClick={() => chooseFilter(kind)}>{label}<span className="tnum opacity-60"> · {count}</span></button>;
      })}</div>
    </section>}

    {!state?.calls.length ? <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-16 text-center">
      <Mic className="h-5 w-5 text-faint-foreground" aria-hidden />
      <p className="text-body-sm text-muted-foreground">No calls yet. Import a transcript above to see what it should change.</p>
    </div> : <div className="grid gap-6 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.7fr)]">
      <aside className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-2"><h2 className="text-h3 text-foreground">Calls <span className="ml-1 tnum font-medium text-faint-foreground">{filter === "all" ? state?.calls.length ?? 0 : visibleCalls.length}</span></h2><div className="flex flex-wrap justify-end">{!!selected.length && <Button size="sm" variant="ghost" onClick={() => setSelected([])}>Clear selection</Button>}<Button size="sm" variant="ghost" onClick={() => setSelected(eligible.filter(c => visibleCalls.some(v => v.id === c.id)).slice(0,50).map(c => c.id))}>Select up to 50</Button></div></div>
        <Card className="max-h-[520px] divide-y divide-border overflow-y-auto">{visibleCalls.map(c => <div key={c.id} className={cn("flex items-start gap-3 px-3.5 py-3 transition-colors duration-fast", c.id === openId ? "bg-accent-bg/70 shadow-[inset_2px_0_0_hsl(var(--accent))]" : "hover:bg-secondary/50")}><input aria-label={`Select ${c.title}`} type="checkbox" className={checkbox} disabled={c.status === "saved" || c.status === "processing"} checked={selected.includes(c.id)} onChange={() => setSelected(toggle(selected,c.id).slice(0,50))} /><button className="min-w-0 flex-1 rounded-sm text-left focus-visible:outline-none focus-visible:focus-ring" onClick={() => setOpenId(c.id)}><span className="block text-body-sm font-medium text-foreground [overflow-wrap:anywhere]">{c.title}</span><span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-label text-muted-foreground"><span className={cn("h-1.5 w-1.5 rounded-full", dotTone[statusMeta[c.status].tone])} aria-hidden />{statusMeta[c.status].label}<span aria-hidden className="text-faint-foreground">·</span><span className="text-faint-foreground">{c.source === "granola" ? "Granola" : "File"}</span>{c.findingCount ? <><span aria-hidden className="text-faint-foreground">·</span><span className="tnum text-faint-foreground">{c.findingCount} proposed</span></> : null}</span></button></div>)}{!visibleCalls.length && <p className="p-5 text-body-sm text-muted-foreground">No calls in this group. Choose another result above.</p>}</Card>
        {!!selected.length && <div className="mt-4 space-y-3"><label className="flex cursor-pointer items-start gap-2.5 text-body-sm text-muted-foreground"><input className={checkbox} type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /><span>Send the selected transcript content to TypeSafe for Jev processing.</span></label><Button variant="agent" className="w-full" disabled={!selected.length || !consent || !state?.connections.jev || busy || !!running} onClick={() => void act(async () => { await request("/process", { ids: selected, consent }); setSelected([]); showConnections(false); })}>Process {selected.length} calls with Jev<ArrowRight /></Button></div>}
      </aside>
      <Card className="min-w-0 p-5 sm:p-6" aria-label="Call review">{!current ? <div className="flex flex-col items-center py-16 text-center"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-muted-foreground"><Mic className="h-5 w-5" aria-hidden /></span><h2 className="mt-4 text-h2 text-foreground">What should this call change?</h2><p className="mt-1 max-w-sm text-body-sm text-muted-foreground">Open a call to review its needs, risks and commitments.</p></div> : <>
        <Badge tone={statusMeta[current.status].tone} dot live={current.status === "processing"}>{reviewHeading[current.status]}</Badge>
        <h2 className="mt-3 text-h2 text-foreground [overflow-wrap:anywhere]">{current.title}</h2>
        <p className="mt-1 tnum text-label text-muted-foreground">{current.model ? `${current.model} · ${duration(current.processingMs ?? 0)}` : current.status === "error" ? "Nothing from this call has been saved to an account." : "Imported locally. Ready for processing."}</p>
        {current.error && <p className="mt-4 rounded-lg bg-destructive-bg px-3 py-2 text-body-sm text-destructive-fg">{current.error}</p>}
        {current.status === "saved" && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success/25 bg-success-bg px-4 py-3"><div className="min-w-0"><p className="text-body-sm font-medium text-success-fg"><span className="tnum">{current.savedSpanIds?.length ?? 0}</span> {current.savedSpanIds?.length === 1 ? "update" : "updates"} added to {destination?.name ?? "the account"}.</p><p className="text-label text-muted-foreground">One source note links the evidence to this call.</p></div><Button size="sm" variant="primary" onClick={() => onOpenAccount(current.savedAccountId!)}>Open updated account<ArrowRight /></Button></div>}
        {current.status === "review" && !!current.findings.length && <div className="mt-5 flex flex-wrap items-end gap-x-4 gap-y-2 border-t border-border pt-4"><Field className="min-w-0 flex-1 basis-56" label="Save to account"><Select value={account} onChange={e => setAccount(e.target.value)}><option value="">Choose an account</option>{workspace.accounts.filter(a => !a.archivedAt).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field><p className="pb-2 text-label text-muted-foreground"><span className="tnum">{reviewFindings.length}</span> {filter !== "all" ? labels[filter].toLowerCase() : "updates"} proposed. Keep what matters.</p></div>}
        <div className="mt-2 divide-y divide-border">{reviewFindings.map(f => <div key={f.id} className="flex gap-3 py-4"><input aria-label={`Keep ${f.kind}: ${f.text}`} type="checkbox" className={cn(checkbox, "mt-1")} checked={current.status === "saved" ? !!current.savedSpanIds?.includes(f.id) : quotes.includes(f.id)} disabled={current.status !== "review"} onChange={() => setQuotes(toggle(quotes,f.id))} /><div className="min-w-0 flex-1"><div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-label"><span className="font-medium text-agent-fg">{labels[f.kind]}</span>{f.certainty !== "explicit" ? <Badge tone="warning" className="h-5 px-1.5">{f.certainty}</Badge> : <span className="text-faint-foreground">{f.certainty}</span>}{current.status === "saved" && <span className={current.savedSpanIds?.includes(f.id) ? "text-success-fg" : "text-faint-foreground"}>{current.savedSpanIds?.includes(f.id) ? "Saved" : "Not saved"}</span>}</div><blockquote className="break-words text-body leading-relaxed text-foreground">{f.text}</blockquote><details className="group mt-2 text-body-sm"><summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-sm text-label text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:focus-ring [&::-webkit-details-marker]:hidden"><ChevronRight className="h-3.5 w-3.5 transition-transform duration-fast group-open:rotate-90" aria-hidden />Why this update?</summary><ol className="mt-3 space-y-3 border-l-2 border-agent/40 pl-4"><li><p className="font-medium text-foreground">1. What kind of account evidence is this?</p><p className="mt-0.5 text-muted-foreground">{callCategories[f.kind]} → {labels[f.kind]}</p></li><li><p className="font-medium text-foreground">2. Is it explicit, conditional or unclear?</p><p className="mt-0.5 text-muted-foreground">Jev classified this as {f.certainty}. {f.certainty === "conditional" ? "Keep the condition attached; this is not an unconditional promise." : f.certainty === "unclear" ? "Resolve the ambiguity before relying on this statement." : "A direct statement is still the speaker’s account, not independent verification."}</p></li><li><p className="font-medium text-foreground">3. Should the account remember it?</p><p className="mt-0.5 text-muted-foreground">You choose whether to keep it. The exact quote and its source are saved together.</p></li></ol><p className="mt-3 tnum text-label text-faint-foreground">Verbatim · characters {f.start}–{f.end} · Model confidence {Math.round(f.confidence * 100)}%</p></details></div></div>)}</div>
        {current.status === "review" && !current.findings.length && <p className="mt-5 text-body-sm text-muted-foreground">No passages were classified as useful account evidence. The complete transcript remains below.</p>}
        {current.status === "review" && !!current.findings.length && <div className="mt-2 space-y-3 rounded-lg border border-border bg-surface-sunken/60 p-4"><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-h3 text-foreground">{destination ? `Update ${destination.name}` : "Preview the CRM update"}</h3><p className="tnum text-label text-muted-foreground">{destination ? `${(workspace.claims ?? []).filter(c => c.accountId === destination.id).length} existing claims` : "Choose an account above"} · {quotes.length} selected {quotes.length === 1 ? "addition" : "additions"}</p></div>{!!selectedFindings.length && <ul className="space-y-1 text-body-sm text-foreground">{Object.entries(labels).filter(([kind]) => selectedFindings.some(f => f.kind === kind)).map(([kind,label]) => <li key={kind} className="tnum"><span className="text-success">+</span> {selectedFindings.filter(f => f.kind === kind).length} {selectedFindings.filter(f => f.kind === kind).length === 1 ? ({ need: "customer need", risk: "risk", objection: "objection", commitment: "commitment", goal: "goal", fact: "account fact" }[kind]) : label.toLowerCase()}</li>)}</ul>}<p className="text-label text-muted-foreground">Adds one source note and <span className="tnum">{quotes.length}</span> {quotes.length === 1 ? "claim" : "claims"}. Conditions stay attached; existing claims are not overwritten.</p><Button variant="primary" disabled={!account || !quotes.length || busy} onClick={() => void act(async () => { await request("/save", { id: current.id, accountId: account, spanIds: quotes }); setDetail(await request<CallRecord>(`/call?id=${encodeURIComponent(current.id)}`)); setQuotes([]); setNotice(""); })}><Check />Save {quotes.length} reviewed {quotes.length === 1 ? "quote" : "quotes"}</Button></div>}
        <details className="group mt-5 border-t border-border pt-4"><summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-sm text-body-sm font-medium text-foreground focus-visible:outline-none focus-visible:focus-ring [&::-webkit-details-marker]:hidden"><ChevronRight className="h-4 w-4 text-faint-foreground transition-transform duration-fast group-open:rotate-90" aria-hidden />Full transcript and source</summary><p className="my-3 break-all font-mono text-label text-faint-foreground">{current.sourceRef}</p><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-sunken p-4 font-sans text-body-sm leading-relaxed text-muted-foreground">{current.transcript}</pre></details>
      </>}</Card>
    </div>}
  </section>;
}
