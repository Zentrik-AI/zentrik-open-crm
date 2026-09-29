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

async function request<T>(endpoint: string, body?: unknown): Promise<T> {
  const r = await fetch(
    `/api/calls${endpoint}`,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const value = await r.json();
  if (!r.ok) throw new Error(value.error?.message ?? "The operation failed.");
  return value;
}
const actionable = (d: InvestigationDecision) => !!d.op;
export function InvestigationView({
  active,
  workspace,
  onOpenAccount,
}: {
  active: boolean;
  workspace: Workspace;
  onOpenAccount: (id: string) => void;
}) {
  const shareSafe = useShareSafe();
  const [run, setRun] = useState<InvestigationRun | null>(null);
  const [calls, setCalls] = useState<CallsState>();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"notes" | "calls">("notes");
  const [ids, setIds] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [accountId, setAccountId] = useState("");
  const [showContext, setShowContext] = useState(false);
  const [overview, setOverview] = useState(false);
  const [applying, setApplying] = useState("");
  const [filter, setFilter] = useState<"all" | "changes" | "questions">("all");
  useEffect(() => {
    if (!active || shareSafe || !folderBacked) return;
    let live = true;
    async function load() {
      try {
        const next = await request<InvestigationRun | null>("/investigation");
        if (live) setRun(next);
      } catch (e) {
        if (live) setError((e as Error).message);
      }
    }
    void request<CallsState>("")
      .then((source) => {
        if (live) setCalls(source);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    void load();
    const timer = setInterval(load, 700);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [active, shareSafe]);
  useEffect(() => {
    if (shareSafe) {
      setRun(null);
      setCalls(undefined);
      setText("");
      setKey("");
    }
  }, [shareSafe]);
  async function act(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
      setRun(await request<InvestigationRun | null>("/investigation"));
      setCalls(await request<CallsState>(""));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (run?.status === "ready") setOverview(true);
  }, [run?.id, run?.status]);
  async function applyDecision(decisionId: string) {
    setApplying(decisionId);
    try {
      await request("/apply-update", { runId: run!.id, decisionId });
      setRun(await request<InvestigationRun>("/investigation"));
    } finally {
      setApplying("");
    }
  }
  if (shareSafe)
    return (
      <div className="py-16 text-center">
        <ShieldCheck className="mx-auto mb-3 h-8 w-8" />
        <h1 className="font-display text-h1">Account investigation is hidden</h1>
        <p className="mt-3 text-muted-foreground">Turn off share-safe view to work with account notes.</p>
      </div>
    );
  if (!folderBacked)
    return (
      <div className="max-w-xl py-12">
        <h1 className="font-display text-h1">Bring your CRM up to date.</h1>
        <p className="my-4 text-body text-muted-foreground">
          Run Open CRM with a local workspace folder to investigate notes and imported calls against your account
          records.
        </p>
        <pre className="rounded-lg bg-secondary p-4 text-body-sm">
          npm run crm -- init ~/my-crm{"\n"}cd ~/my-crm{"\n"}./crm ui
        </pre>
      </div>
    );
  const running = run?.status === "matching" || run?.status === "checking";
  const groups = [
    ...(run?.accounts ?? []),
    ...(run?.decisions.some((d) => !d.accountId)
      ? [
          {
            id: "unmatched",
            name: "Unassigned evidence",
            passages: run.decisions.filter((d) => !d.accountId).length,
          },
        ]
      : []),
  ];
  const selected = groups.find((a) => a.id === accountId) ?? groups[0];
  const decisions = run?.decisions.filter((d) => (d.accountId ?? "unmatched") === selected?.id) ?? [];
  const changes = run?.decisions.filter(actionable) ?? [];
  const applied = changes.filter((d) => d.appliedAt).length;
  const unchanged = run?.decisions.filter((d) => d.kind === "unchanged").length ?? 0;
  const questions = run?.decisions.filter((d) => d.kind === "clarify" || d.kind === "error").length ?? 0;
  const displayed = decisions.filter(
    (d) => filter === "all" || (filter === "changes" ? actionable(d) : d.kind === "clarify" || d.kind === "error"),
  );
  return (
    <section
      className="flex flex-col gap-4 lg:h-[calc(100dvh-112px)] lg:min-h-[500px]"
      aria-label="Account investigation"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="font-display text-h1">Bring your accounts up to date.</h1>
          <p className="mt-1 text-body-sm text-muted-foreground">
            Give the CRM your notes. See what needs to change, and what can stay.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowContext(!showContext)}>
          Data & connection
        </Button>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive bg-destructive-bg px-3 py-2 text-body-sm shrink-0"
        >
          {error}
        </p>
      )}
      {(showContext || !calls?.connections.jev) && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface-raised p-3 shrink-0">
          <p className="flex-1 text-body-sm text-muted-foreground">
            {calls?.connections.jev ? "Jev connected for this server session." : "Connect Jev for this session."}{" "}
            Selected notes, account names, active claims and task records go to TypeSafe. Keys stay in server memory.
          </p>
          {!calls?.connections.jev && (
            <>
              <Input
                className="max-w-64"
                type="password"
                aria-label="Jev API key"
                autoComplete="off"
                placeholder="TypeSafe API key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
              <Button
                disabled={!key.trim() || busy}
                onClick={() =>
                  void act(async () => {
                    const value = key;
                    setKey("");
                    await request("/connect", { provider: "jev", key: value });
                    setShowContext(false);
                  })
                }
              >
                Connect Jev
              </Button>
            </>
          )}
        </div>
      )}
      <div
        role="status"
        aria-live="polite"
        className="flex flex-wrap items-center justify-between gap-2 border-y border-border py-3 shrink-0 text-body-sm"
      >
        <div className="flex items-center gap-3">
          <span className={cn("flex items-center gap-2", running ? "text-agent-fg" : "text-muted-foreground")}>
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            ) : run ? (
              <CheckCheck className="h-4 w-4" />
            ) : (
              <ScanLine className="h-4 w-4" />
            )}
            {!run
              ? "Notes"
              : run.status === "matching"
                ? `Matching accounts · ${run.matched}/${run.total}`
                : run.matched === run.total
                  ? "Accounts matched"
                  : `Matched ${run.matched}/${run.total}`}
          </span>
          <ArrowRight className="h-3 w-3 text-faint-foreground" />
          <span className={run?.status === "checking" ? "text-agent-fg" : "text-muted-foreground"}>
            {run?.status === "checking" ? `Checking records · ${run.checked}/${run.total}` : "Compare records"}
          </span>
          <ArrowRight className="h-3 w-3 text-faint-foreground" />
          <span>
            {run?.status === "ready"
              ? `${changes.length} changes · ${unchanged} unchanged · ${questions} to clarify`
              : run?.status === "error"
                ? "Investigation stopped"
                : "Review changes"}
          </span>
        </div>
        {running && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                await request("/stop-investigation", {});
              })
            }
          >
            Stop investigation
          </Button>
        )}
        {applied > 0 && <span className="text-accent-fg">{applied} applied to CRM</span>}
      </div>
      {run?.error && (
        <p role="alert" className="text-body-sm text-destructive-fg shrink-0">
          {run.error}
        </p>
      )}
      {run && (
        <div
          className="investigation-activity shrink-0 rounded-lg border border-border bg-surface-raised px-4 py-3"
          aria-label="Live investigation activity"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-body-sm font-medium">
              {applying
                ? "Saving the approved change…"
                : running
                  ? run.status === "matching"
                    ? "Finding the right accounts"
                    : `Checking ${run.activeAccounts?.length ?? 0} accounts in parallel`
                  : run.status === "error"
                    ? "Review interrupted"
                    : changes.length === applied
                      ? changes.length
                        ? "All proposed changes saved"
                        : "No new changes needed"
                      : "Your update plan is ready"}
            </p>
            <span className="text-label text-muted-foreground">
              {run.checked}/{run.total} passages checked
            </span>
          </div>
          {running && (
            <div className="mt-2 h-1 overflow-hidden rounded bg-secondary">
              <div
                className="investigation-progress h-full bg-agent"
                style={{
                  width: `${run.total ? (100 * run.checked) / run.total : 0}%`,
                }}
              />
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-label text-muted-foreground">
            {run.events?.slice(-3).map((event) => (
              <span key={`${run.id}_${event.id}`} className="investigation-arrive">
                {event.accountId && (
                  <span className="text-foreground">
                    {run.accounts?.find((a) => a.id === event.accountId)?.name} ·{" "}
                  </span>
                )}
                {event.label}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(180px,0.9fr)_minmax(150px,0.7fr)_minmax(0,1.6fr)]">
        <section
          className="flex min-h-0 flex-col gap-3 rounded-xl border border-border bg-surface-raised p-4"
          aria-label="Investigation input"
        >
          <div className="flex gap-2">
            <Button size="sm" variant={mode === "notes" ? "primary" : "ghost"} onClick={() => setMode("notes")}>
              Notes
            </Button>
            <Button size="sm" variant={mode === "calls" ? "primary" : "ghost"} onClick={() => setMode("calls")}>
              Imported calls
            </Button>
          </div>
          {mode === "notes" ? (
            <>
              <label htmlFor="investigation-notes" className="text-body-sm font-medium">
                What happened across your accounts?
              </label>
              <Textarea
                id="investigation-notes"
                className="min-h-40 flex-1 resize-none"
                placeholder={
                  "Name the account, then say what changed. Use one thought per line.\n\nPaste notes or use your computer’s dictation."
                }
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={200000}
                disabled={!!running}
              />
              <p className="text-label text-muted-foreground">
                Text or system dictation. No audio is recorded by this app.
              </p>
            </>
          ) : (
            <div className="min-h-40 flex-1 overflow-y-auto">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-body-sm">{ids.length} selected</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIds(ids.length ? [] : (calls?.calls ?? []).slice(0, 50).map((c) => c.id))}
                >
                  {ids.length ? "Clear" : "Select up to 50"}
                </Button>
              </div>
              {calls?.calls.length ? (
                calls.calls.map((c) => (
                  <label key={c.id} className="flex gap-2 border-b border-border py-3 text-body-sm">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0"
                      checked={ids.includes(c.id)}
                      disabled={!!running}
                      onChange={() =>
                        setIds((v) => (v.includes(c.id) ? v.filter((id) => id !== c.id) : [...v, c.id].slice(0, 50)))
                      }
                    />
                    <span className="break-words">{c.title}</span>
                  </label>
                ))
              ) : (
                <p className="text-body-sm text-muted-foreground">
                  Import transcripts in Calls, then return here to compare them with account records.
                </p>
              )}
            </div>
          )}
          <label className="flex gap-2 text-label text-muted-foreground">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>Send selected notes and account context to TypeSafe.</span>
          </label>
          <Button
            className="w-full"
            variant="primary"
            disabled={
              busy ||
              !!running ||
              !consent ||
              !calls?.connections.jev ||
              (mode === "notes" ? !text.trim() : !ids.length)
            }
            onClick={() =>
              void act(async () => {
                const next = await request<InvestigationRun>("/investigate", {
                  ...(mode === "notes" ? { text } : { ids }),
                  consent,
                });
                setRun(next);
                setAccountId("");
                setOverview(false);
                setFilter("all");
              })
            }
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Investigating…
              </>
            ) : (
              <>
                Investigate {mode === "notes" ? "notes" : `${ids.length} calls`}
                <ArrowRight />
              </>
            )}
          </Button>
        </section>
        <section className="min-h-0 overflow-y-auto" aria-label="Affected accounts">
          <h2 className="mb-3 text-body-sm font-medium">
            Affected accounts{" "}
            <span className="text-muted-foreground">{groups.filter((g) => g.id !== "unmatched").length || ""}</span>
          </h2>
          {run?.status === "ready" && (
            <button
              onClick={() => setOverview(true)}
              aria-pressed={overview}
              className={cn(
                "mb-3 w-full rounded-lg border p-3 text-left text-body-sm",
                overview ? "border-accent bg-accent-bg" : "border-border bg-surface-raised",
              )}
            >
              <span className="block font-medium">All account outcomes</span>
              <span className="mt-1 block text-label text-muted-foreground">
                {changes.length - applied} awaiting approval · {applied} saved
              </span>
            </button>
          )}
          {!groups.length ? (
            <div className="border-l-2 border-border pl-4 py-6 text-body-sm text-muted-foreground">
              {running ? "Reading the sources and matching account names…" : "Account matches will appear here."}
            </div>
          ) : (
            groups.map((a) => {
              const ds = run?.decisions.filter((d) => (d.accountId ?? "unmatched") === a.id) ?? [];
              const proposals = ds.filter(actionable);
              const done = proposals.filter((d) => d.appliedAt).length;
              return (
                <button
                  key={a.id}
                  onClick={() => {
                    setAccountId(a.id);
                    setOverview(false);
                    setFilter("all");
                  }}
                  aria-pressed={!overview && selected?.id === a.id}
                  className={cn(
                    "investigation-arrive mb-2 w-full rounded-lg border p-2.5 text-left transition-colors motion-reduce:transition-none",
                    !overview && selected?.id === a.id
                      ? "border-accent bg-accent-bg"
                      : "border-border bg-surface-raised hover:bg-secondary",
                  )}
                >
                  <span className="flex items-center gap-2 break-words text-body-sm font-medium">
                    {run?.activeAccounts?.includes(a.id) && running && (
                      <Loader2 className="h-3 w-3 shrink-0 animate-spin motion-reduce:animate-none text-agent-fg" />
                    )}
                    {a.name}
                  </span>
                  {running && (
                    <div className="mt-2 h-0.5 bg-secondary">
                      <div
                        className="investigation-progress h-full bg-agent"
                        style={{
                          width: `${Math.min(100, (100 * ds.length) / a.passages)}%`,
                        }}
                      />
                    </div>
                  )}
                  <span className="mt-2 block text-label text-muted-foreground">
                    {done ? `${done} applied · ` : ""}
                    {proposals.length - done} {proposals.length - done === 1 ? "change" : "changes"}
                    {ds.some((d) => d.kind === "unchanged") ? " · already known" : ""}
                    {ds.some((d) => d.kind === "clarify" || d.kind === "error") ? " · needs input" : ""}
                    {running && ds.length < a.passages ? " · checking…" : ""}
                  </span>
                </button>
              );
            })
          )}
        </section>
        <section
          className="flex min-h-0 flex-col rounded-xl border border-border bg-surface-raised"
          aria-label="Account changes"
        >
          <div className="shrink-0 border-b border-border p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-label text-muted-foreground">
                  {overview ? "INVESTIGATION OUTCOME" : "CURRENT RECORD → PROPOSED CHANGE"}
                </p>
                <h2 className="mt-1 font-display text-h2">
                  {overview
                    ? applied === changes.length
                      ? `${applied} changes saved${questions ? ` · ${questions} need input` : ""}.`
                      : "Here is what needs to change."
                    : (selected?.name ?? "What should change?")}
                </h2>
              </div>
              {!overview && selected && selected.id !== "unmatched" && (
                <Button size="sm" variant="ghost" onClick={() => onOpenAccount(selected.id)}>
                  Open account
                  <ArrowRight />
                </Button>
              )}
            </div>
            {!overview && !!decisions.length && (
              <div className="mt-3 flex flex-wrap gap-1">
                {(
                  [
                    ["all", "All decisions"],
                    ["changes", "Changes"],
                    ["questions", "Needs input"],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={filter === value ? "secondary" : "ghost"}
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4" aria-live="off">
            {overview ? (
              <div className="investigation-arrive space-y-1">
                <p className="text-body-sm text-muted-foreground">
                  {applied} saved · {changes.length - applied} awaiting approval · {unchanged} unchanged · {questions}{" "}
                  need clarification. Each saved change includes its source.
                </p>
                {questions > 0 && (
                  <p className="text-label text-warning-fg">
                    {questions} unclear {questions === 1 ? "note stays" : "notes stay"} unresolved; approval will not
                    change those records.
                  </p>
                )}
                {groups.map((a) => {
                  const ds = run!.decisions.filter((d) => (d.accountId ?? "unmatched") === a.id);
                  return (
                    <section key={a.id} className="border-b border-border py-1">
                      <button
                        className="text-body-sm font-medium hover:underline"
                        onClick={() => {
                          setAccountId(a.id);
                          setOverview(false);
                          setFilter("all");
                        }}
                      >
                        {a.name} →
                      </button>
                      <div className="mt-1 space-y-2">
                        {ds.map((d) => (
                          <div
                            key={d.id}
                            className={cn(
                              "investigation-arrive flex items-start justify-between gap-3 text-body-sm",
                              d.appliedAt && "text-accent-fg",
                            )}
                          >
                            <span>
                              {d.title}
                              {d.after && (
                                <span className="block text-label">
                                  → {d.after}
                                  {d.kind === "complete" ? `: ${d.before}` : ""}
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 text-label">
                              {applying === d.id
                                ? "Saving…"
                                : d.appliedAt
                                  ? "Saved ✓"
                                  : d.op
                                    ? "For approval"
                                    : d.kind === "unchanged"
                                      ? "No change"
                                      : "Needs input"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })}

                {questions > 0 && (
                  <p className="text-label text-warning-fg">
                    Unclear evidence stays unresolved. Clarify those notes and run another investigation.
                  </p>
                )}
              </div>
            ) : !selected ? (
              <div className="flex h-full min-h-48 flex-col justify-center px-4">
                <ScanLine className="mb-4 h-8 w-8 text-agent-fg" />
                <h3 className="font-display text-h2">A useful change. Or a reason to leave it alone.</h3>
                <p className="mt-3 text-body text-muted-foreground">
                  Match each note to an account. Check what is already known. Review the exact change before it reaches
                  your CRM.
                </p>
                <div className="mt-6 space-y-2 text-body-sm text-muted-foreground">
                  <p>Add a new need or commitment</p>
                  <p>Replace outdated account knowledge</p>
                  <p>Complete a task that was actually done</p>
                  <p>Keep existing records when nothing changed</p>
                </div>
              </div>
            ) : !displayed.length ? (
              <p className="py-8 text-body-sm text-muted-foreground">
                {running ? "Comparing this account’s records with the source…" : "No decisions in this group."}
              </p>
            ) : (
              displayed.map((d) => (
                <article
                  key={d.id}
                  className="investigation-arrive mb-4 border-b border-border pb-4 last:border-0"
                  aria-label={d.title}
                >
                  <div className="flex items-center gap-2 text-body-sm font-medium">
                    {d.appliedAt ? (
                      <Check className="h-4 w-4 text-accent-fg" />
                    ) : d.kind === "unchanged" ? (
                      <CheckCheck className="h-4 w-4 text-muted-foreground" />
                    ) : d.kind === "clarify" || d.kind === "error" ? (
                      <HelpCircle className="h-4 w-4 text-warning-fg" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-agent" />
                    )}
                    <h3>
                      {d.appliedAt ? "Applied · " : ""}
                      {d.title}
                    </h3>
                  </div>
                  {d.before && (
                    <div className="mt-3 border-l-2 border-border pl-3">
                      <p className="text-label text-muted-foreground">
                        {d.dependsOn
                          ? "Already proposed in this investigation"
                          : d.kind === "unchanged"
                            ? "Already in CRM"
                            : "Before"}
                      </p>
                      <p className="mt-1 text-body-sm">{d.before}</p>
                    </div>
                  )}
                  {d.kind === "add" && (
                    <p className="mt-3 text-label text-muted-foreground">
                      No matching knowledge found in this account.
                    </p>
                  )}
                  {d.after && (
                    <div className="mt-3 border-l-2 border-accent pl-3">
                      <p className="text-label text-accent-fg">{d.appliedAt ? "Now in CRM" : "After approval"}</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-body-sm">{d.after}</p>
                    </div>
                  )}
                  {(d.qualification === "conditional" || d.qualification === "unclear") && (
                    <p className="mt-2 text-label text-warning-fg">
                      {d.qualification} —{" "}
                      {d.kind === "clarify"
                        ? "clarify before changing this record"
                        : "condition kept with the evidence"}
                    </p>
                  )}
                  {d.kind === "clarify" && (
                    <p className="mt-2 text-body-sm text-muted-foreground">
                      Name one account and state what is confirmed, then investigate the clarified note.
                    </p>
                  )}
                  <details className="mt-3 text-body-sm">
                    <summary className="cursor-pointer text-muted-foreground">Source & decision path</summary>
                    <blockquote className="mt-3 whitespace-pre-wrap break-words border-l-2 border-agent pl-3">
                      {d.quote}
                    </blockquote>
                    <p className="mt-3 text-label text-muted-foreground">
                      Match account → compare existing records →{" "}
                      {d.kind === "unchanged"
                        ? "keep unchanged"
                        : d.kind === "clarify"
                          ? "ask for clarification"
                          : "human review"}
                    </p>
                    <p className="mt-2 break-all text-label text-faint-foreground">
                      {d.sourceRef} · characters {d.start}–{d.end}
                      {d.model ? ` · ${d.model}` : ""}
                    </p>
                  </details>
                  {d.op && !d.appliedAt && (
                    <Button
                      className="mt-3"
                      size="sm"
                      variant="primary"
                      disabled={
                        busy ||
                        run?.status !== "ready" ||
                        !workspace.accounts.some((a) => a.id === d.accountId && !a.archivedAt)
                      }
                      onClick={() =>
                        void act(async () => {
                          await applyDecision(d.id);
                        })
                      }
                    >
                      {applying === d.id ? "Saving…" : "Apply this change"}
                      <Check />
                    </Button>
                  )}
                </article>
              ))
            )}
          </div>
          {overview && changes.some((d) => !d.appliedAt) && (
            <div className="shrink-0 border-t border-border bg-surface-raised p-3">
              <p className="mb-2 text-label text-muted-foreground">
                Review each account before approval. Saves stop if a write fails.
              </p>
              <Button
                variant="primary"
                disabled={busy || run?.status !== "ready"}
                onClick={() =>
                  void act(async () => {
                    for (const d of changes.filter((d) => !d.appliedAt)) await applyDecision(d.id);
                  })
                }
              >
                Approve & save {changes.length - applied} changes
                <CheckCheck />
              </Button>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
