import { useEffect, useState } from "react";
import { ArrowRight, Check, CheckCheck, HelpCircle, Loader2, ScanLine, ShieldCheck } from "lucide-react";
import type { Workspace } from "../types";
import type { CallsState } from "../core/calls";
import type { InvestigationDecision, InvestigationRun } from "../core/investigation";
import { Button } from "../components/ui/button";
import { Input, Textarea } from "../components/ui/field";
import { useShareSafe } from "../components/ui/privacy";
import { folderBacked } from "../lib/backend";
import { cn } from "../lib/utils";

async function request<T>(endpoint:string,body?:unknown):Promise<T>{
  const r=await fetch(`/api/calls${endpoint}`,body===undefined?undefined:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const value=await r.json();if(!r.ok)throw new Error(value.error?.message ?? "The operation failed.");return value;
}
const actionable=(d:InvestigationDecision)=>!!d.op;
export function InvestigationView({active,workspace,onOpenAccount}:{active:boolean;workspace:Workspace;onOpenAccount:(id:string)=>void}){
  const shareSafe=useShareSafe();
  const [run,setRun]=useState<InvestigationRun|null>(null);
  const [calls,setCalls]=useState<CallsState>();
  const [text,setText]=useState("");
  const [mode,setMode]=useState<"notes"|"calls">("notes");
  const [ids,setIds]=useState<string[]>([]);
  const [consent,setConsent]=useState(false);
  const [key,setKey]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [accountId,setAccountId]=useState("");
  const [showContext,setShowContext]=useState(false);
  const [filter,setFilter]=useState<"all"|"changes"|"questions">("all");
  useEffect(()=>{
    if(!active||shareSafe||!folderBacked)return;
    let live=true;
    async function load(){try{const [next,source]=await Promise.all([request<InvestigationRun|null>("/investigation"),request<CallsState>("")]);if(live){setRun(next);setCalls(source);}}catch(e){if(live)setError((e as Error).message);}}
    void load();const timer=setInterval(load,700);return()=>{live=false;clearInterval(timer);};
  },[active,shareSafe]);
  useEffect(()=>{if(shareSafe){setRun(null);setCalls(undefined);setText("");setKey("");}},[shareSafe]);
  async function act(work:()=>Promise<void>){setBusy(true);setError("");try{await work();setRun(await request<InvestigationRun|null>("/investigation"));setCalls(await request<CallsState>(""));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  if(shareSafe)return <div className="py-16 text-center"><ShieldCheck className="mx-auto mb-3 h-8 w-8"/><h1 className="font-display text-h1">Account investigation is hidden</h1><p className="mt-3 text-muted-foreground">Turn off share-safe view to work with account notes.</p></div>;
  if(!folderBacked)return <div className="max-w-xl py-12"><h1 className="font-display text-h1">Bring your CRM up to date.</h1><p className="my-4 text-body text-muted-foreground">Run Open CRM with a local workspace folder to investigate notes and imported calls against your account records.</p><pre className="rounded-lg bg-secondary p-4 text-body-sm">npm run crm -- init ~/my-crm{"\n"}cd ~/my-crm{"\n"}./crm ui</pre></div>;
  const running=run?.status==="matching"||run?.status==="checking";
  const groups=[...(run?.accounts??[]),...(run?.decisions.some(d=>!d.accountId)?[{id:"unmatched",name:"Unassigned evidence",passages:run.decisions.filter(d=>!d.accountId).length}]:[])];
  const selected=groups.find(a=>a.id===accountId)??groups[0];
  const decisions=run?.decisions.filter(d=>(d.accountId??"unmatched")===selected?.id)??[];
  const changes=run?.decisions.filter(actionable)??[];
  const applied=changes.filter(d=>d.appliedAt).length;
  const unchanged=run?.decisions.filter(d=>d.kind==="unchanged").length??0;
  const questions=run?.decisions.filter(d=>d.kind==="clarify"||d.kind==="error").length??0;
  const displayed=decisions.filter(d=>filter==="all"||(filter==="changes"?actionable(d):d.kind==="clarify"||d.kind==="error"));
  return <section className="flex flex-col gap-4 lg:h-[calc(100dvh-112px)] lg:min-h-[500px]" aria-label="Account investigation">
    <header className="flex flex-wrap items-center justify-between gap-3 shrink-0"><div><h1 className="font-display text-h1">Bring your accounts up to date.</h1><p className="mt-1 text-body-sm text-muted-foreground">Give the CRM your notes. See what needs to change, and what can stay.</p></div><Button size="sm" onClick={()=>setShowContext(!showContext)}>Data & connection</Button></header>
    {error&&<p role="alert" className="rounded-md border border-destructive bg-destructive-bg px-3 py-2 text-body-sm shrink-0">{error}</p>}
    {(showContext||!calls?.connections.jev)&&<div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface-raised p-3 shrink-0"><p className="flex-1 text-body-sm text-muted-foreground">{calls?.connections.jev?"Jev connected for this server session.":"Connect Jev for this session."} Selected notes, account names, active claims and task records go to TypeSafe. Keys stay in server memory.</p>{!calls?.connections.jev&&<><Input className="max-w-64" type="password" aria-label="Jev API key" autoComplete="off" placeholder="TypeSafe API key" value={key} onChange={e=>setKey(e.target.value)}/><Button disabled={!key.trim()||busy} onClick={()=>void act(async()=>{const value=key;setKey("");await request("/connect",{provider:"jev",key:value});setShowContext(false);})}>Connect Jev</Button></>}</div>}
    <div role="status" aria-live="polite" className="flex flex-wrap items-center justify-between gap-2 border-y border-border py-3 shrink-0 text-body-sm">
      <div className="flex items-center gap-3"><span className={cn("flex items-center gap-2",running?"text-agent-fg":"text-muted-foreground")}>{running?<Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none"/>:run?<CheckCheck className="h-4 w-4"/>:<ScanLine className="h-4 w-4"/>}{!run?"Notes":run.status==="matching"?`Matching accounts · ${run.matched}/${run.total}`:run.matched===run.total?"Accounts matched":`Matched ${run.matched}/${run.total}`}</span><ArrowRight className="h-3 w-3 text-faint-foreground"/><span className={run?.status==="checking"?"text-agent-fg":"text-muted-foreground"}>{run?.status==="checking"?`Checking records · ${run.checked}/${run.total}`:"Compare records"}</span><ArrowRight className="h-3 w-3 text-faint-foreground"/><span>{run?.status==="ready"?`${changes.length} changes · ${unchanged} unchanged · ${questions} to clarify`:run?.status==="error"?"Investigation stopped":"Review changes"}</span></div>{running&&<Button size="sm" variant="ghost" disabled={busy} onClick={()=>void act(async()=>{await request("/stop-investigation",{});})}>Stop investigation</Button>}{applied>0&&<span className="text-accent-fg">{applied} applied to CRM</span>}
    </div>
    {run?.error&&<p role="alert" className="text-body-sm text-destructive-fg shrink-0">{run.error}</p>}
    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(230px,0.9fr)_minmax(175px,0.65fr)_minmax(340px,1.6fr)]">
      <section className="flex min-h-0 flex-col gap-3 rounded-xl border border-border bg-surface-raised p-4" aria-label="Investigation input">
        <div className="flex gap-2"><Button size="sm" variant={mode==="notes"?"primary":"ghost"} onClick={()=>setMode("notes")}>Notes</Button><Button size="sm" variant={mode==="calls"?"primary":"ghost"} onClick={()=>setMode("calls")}>Imported calls</Button></div>
        {mode==="notes"?<><label htmlFor="investigation-notes" className="text-body-sm font-medium">What happened across your accounts?</label><Textarea id="investigation-notes" className="min-h-40 flex-1 resize-none" placeholder={"Name the account, then say what changed. Use one thought per line.\n\nPaste notes or use your computer’s dictation."} value={text} onChange={e=>setText(e.target.value)} maxLength={200000} disabled={!!running}/><p className="text-label text-muted-foreground">Text or system dictation. No audio is recorded by this app.</p></>:<div className="min-h-40 flex-1 overflow-y-auto"><div className="mb-2 flex items-center justify-between"><span className="text-body-sm">{ids.length} selected</span><Button size="sm" variant="ghost" onClick={()=>setIds(ids.length?[]:(calls?.calls??[]).slice(0,50).map(c=>c.id))}>{ids.length?"Clear":"Select up to 50"}</Button></div>{calls?.calls.length?calls.calls.map(c=><label key={c.id} className="flex gap-2 border-b border-border py-3 text-body-sm"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={ids.includes(c.id)} disabled={!!running} onChange={()=>setIds(v=>v.includes(c.id)?v.filter(id=>id!==c.id):[...v,c.id].slice(0,50))}/><span className="break-words">{c.title}</span></label>):<p className="text-body-sm text-muted-foreground">Import transcripts in Calls, then return here to compare them with account records.</p>}</div>}
        <label className="flex gap-2 text-label text-muted-foreground"><input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>Send selected notes and account context to TypeSafe.</span></label>
        <Button className="w-full" variant="primary" disabled={busy||!!running||!consent||!calls?.connections.jev||(mode==="notes"?!text.trim():!ids.length)} onClick={()=>void act(async()=>{const next=await request<InvestigationRun>("/investigate",{...(mode==="notes"?{text}:{ids}),consent});setRun(next);setAccountId("");setFilter("all");})}>{running?<><Loader2 className="h-4 w-4 animate-spin"/>Investigating…</>:<>Investigate {mode==="notes"?"notes":`${ids.length} calls`}<ArrowRight/></>}</Button>
      </section>
      <section className="min-h-0 overflow-y-auto" aria-label="Affected accounts"><h2 className="mb-3 text-body-sm font-medium">Affected accounts <span className="text-muted-foreground">{groups.filter(g=>g.id!=="unmatched").length||""}</span></h2>
        {!groups.length?<div className="border-l-2 border-border pl-4 py-6 text-body-sm text-muted-foreground">{running?"Reading the sources and matching account names…":"Account matches will appear here."}</div>:groups.map(a=>{const ds=run?.decisions.filter(d=>(d.accountId??"unmatched")===a.id)??[];const proposals=ds.filter(actionable);const done=proposals.filter(d=>d.appliedAt).length;return <button key={a.id} onClick={()=>{setAccountId(a.id);setFilter("all");}} aria-pressed={selected?.id===a.id} className={cn("mb-2 w-full rounded-lg border p-3 text-left transition-colors motion-reduce:transition-none",selected?.id===a.id?"border-accent bg-accent-bg":"border-border bg-surface-raised hover:bg-secondary")}><span className="block break-words text-body-sm font-medium">{a.name}</span><span className="mt-2 block text-label text-muted-foreground">{done?`${done} applied · `:""}{proposals.length-done} {proposals.length-done===1?"change":"changes"}{ds.some(d=>d.kind==="unchanged")?" · already known":""}{ds.some(d=>d.kind==="clarify"||d.kind==="error")?" · needs input":""}{running&&ds.length<a.passages?" · checking…":""}</span></button>;})}
      </section>
      <section className="flex min-h-0 flex-col rounded-xl border border-border bg-surface-raised" aria-label="Account changes">
        <div className="shrink-0 border-b border-border p-4"><div className="flex items-start justify-between gap-2"><div><p className="text-label text-muted-foreground">CURRENT RECORD → PROPOSED CHANGE</p><h2 className="mt-1 font-display text-h2">{selected?.name??"What should change?"}</h2></div>{selected&&selected.id!=="unmatched"&&<Button size="sm" variant="ghost" onClick={()=>onOpenAccount(selected.id)}>Open account<ArrowRight/></Button>}</div>{!!decisions.length&&<div className="mt-3 flex flex-wrap gap-1">{([['all','All decisions'],['changes','Changes'],['questions','Needs input']] as const).map(([value,label])=><Button key={value} size="sm" variant={filter===value?"secondary":"ghost"} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</Button>)}</div>}</div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4" aria-live="off">
          {!selected?<div className="flex h-full min-h-48 flex-col justify-center px-4"><ScanLine className="mb-4 h-8 w-8 text-agent-fg"/><h3 className="font-display text-h2">A useful change. Or a reason to leave it alone.</h3><p className="mt-3 text-body text-muted-foreground">Match each note to an account. Check what is already known. Review the exact change before it reaches your CRM.</p><div className="mt-6 space-y-2 text-body-sm text-muted-foreground"><p>Add a new need or commitment</p><p>Replace outdated account knowledge</p><p>Complete a task that was actually done</p><p>Keep existing records when nothing changed</p></div></div>:!displayed.length?<p className="py-8 text-body-sm text-muted-foreground">{running?"Comparing this account’s records with the source…":"No decisions in this group."}</p>:displayed.map(d=><article key={d.id} className="mb-4 border-b border-border pb-4 last:border-0" aria-label={d.title}>
            <div className="flex items-center gap-2 text-body-sm font-medium">{d.appliedAt?<Check className="h-4 w-4 text-accent-fg"/>:d.kind==="unchanged"?<CheckCheck className="h-4 w-4 text-muted-foreground"/>:d.kind==="clarify"||d.kind==="error"?<HelpCircle className="h-4 w-4 text-warning-fg"/>:<span className="h-2 w-2 rounded-full bg-agent"/>}<h3>{d.appliedAt?"Applied · ":""}{d.title}</h3></div>
            {d.before&&<div className="mt-3 border-l-2 border-border pl-3"><p className="text-label text-muted-foreground">{d.dependsOn?"Already proposed in this investigation":d.kind==="unchanged"?"Already in CRM":"Before"}</p><p className="mt-1 text-body-sm">{d.before}</p></div>}
            {d.kind==="add"&&<p className="mt-3 text-label text-muted-foreground">No matching knowledge found in this account.</p>}
            {d.after&&<div className="mt-3 border-l-2 border-accent pl-3"><p className="text-label text-accent-fg">{d.appliedAt?"Now in CRM":"After approval"}</p><p className="mt-1 whitespace-pre-wrap break-words text-body-sm">{d.after}</p></div>}
            {(d.qualification==="conditional"||d.qualification==="unclear")&&<p className="mt-2 text-label text-warning-fg">{d.qualification} — {d.kind==="clarify"?"clarify before changing this record":"condition kept with the evidence"}</p>}
            {d.kind==="clarify"&&<p className="mt-2 text-body-sm text-muted-foreground">Name one account and state what is confirmed, then investigate the clarified note.</p>}
            <details className="mt-3 text-body-sm"><summary className="cursor-pointer text-muted-foreground">Source & decision path</summary><blockquote className="mt-3 whitespace-pre-wrap break-words border-l-2 border-agent pl-3">{d.quote}</blockquote><p className="mt-3 text-label text-muted-foreground">Match account → compare existing records → {d.kind==="unchanged"?"keep unchanged":d.kind==="clarify"?"ask for clarification":"human review"}</p><p className="mt-2 break-all text-label text-faint-foreground">{d.sourceRef} · characters {d.start}–{d.end}{d.model?` · ${d.model}`:""}</p></details>
            {d.op&&!d.appliedAt&&<Button className="mt-3" size="sm" variant="primary" disabled={busy||run?.status!=="ready"||!workspace.accounts.some(a=>a.id===d.accountId&&!a.archivedAt)} onClick={()=>void act(async()=>{await request("/apply-update",{runId:run!.id,decisionId:d.id});})}>Apply this change<Check/></Button>}
          </article>)}
        </div>
      </section>
    </div>
  </section>;
}
