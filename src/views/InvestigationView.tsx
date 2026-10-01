import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  CheckCheck,
  CircleDashed,
  GitCompareArrows,
  HelpCircle,
  Loader2,
  Lock,
  Plus,
  Quote,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { Workspace } from "../types";
import type { CallsState } from "../core/calls";
import type { InvestigationDecision, InvestigationRun } from "../core/investigation";
import { Button } from "../components/ui/button";
import { Input, Textarea } from "../components/ui/field";
import { Monogram } from "../components/ui/monogram";
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
const needsInput = (d: InvestigationDecision) => d.kind === "clarify" || d.kind === "error";
const stagger = (i: number) => ({ animationDelay: `${Math.min(i, 8) * 45}ms` });

type StepState = "idle" | "active" | "done";

/** One segment of the three-step progress rail. */
function Step({ n, state, label, progress }: { n: number; state: StepState; label: ReactNode; progress?: number }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="h-1 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "investigation-progress h-full rounded-full",
            state === "done" ? "bg-foreground/80" : "bg-agent",
          )}
          style={{ width: state === "done" ? "100%" : state === "active" ? `${Math.max(n === 3 ? 0 : 6, progress ?? 0)}%` : "0%" }}
        />
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-body-sm">
        <span
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tnum",
            state === "done"
              ? "bg-foreground text-background"
              : state === "active"
                ? "bg-agent text-white"
                : "border border-border-strong text-faint-foreground",
          )}
          aria-hidden
        >
          {state === "done" ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : n}
        </span>
        <span className={cn("truncate", state === "idle" ? "text-faint-foreground" : "font-medium text-foreground")}>
          {label}
        </span>
      </div>
    </div>
  );
}

/** Small outcome chip used on account rows and in the outcome list. */
function Chip({ tone, children }: { tone: "change" | "saved" | "known" | "ask"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1 rounded-md px-1.5 text-label font-medium",
        tone === "change" && "bg-agent-bg text-agent-fg",
        tone === "saved" && "bg-success-bg text-success-fg",
        tone === "known" && "bg-secondary text-muted-foreground",
        tone === "ask" && "bg-warning-bg text-warning-fg",
      )}
    >
      {children}
    </span>
  );
}

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
  const [ranText, setRanText] = useState("");
  const [editing, setEditing] = useState(true);
  const noteRef = useRef<HTMLTextAreaElement>(null);
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
      <div className="py-20 text-center">
        <ShieldCheck className="mx-auto mb-4 h-8 w-8 text-faint-foreground" />
        <h1 className="text-h1">Account investigation is hidden</h1>
        <p className="mt-2 text-body-sm text-muted-foreground">Turn off share-safe view to work with account notes.</p>
      </div>
    );
  if (!folderBacked)
    return (
      <div className="max-w-xl py-12">
        <h1 className="text-h1">Bring your CRM up to date</h1>
        <p className="my-4 text-body text-muted-foreground">
          Run Open CRM on a workspace folder to check notes and calls against your account records.
        </p>
        <pre className="rounded-lg border border-border bg-surface-sunken p-4 font-mono text-body-sm">
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
  const questions = run?.decisions.filter(needsInput).length ?? 0;
  const bulk = changes.filter((d) => !d.appliedAt && d.review !== "check");
  const toCheck = changes.filter((d) => !d.appliedAt && d.review === "check").length;
  const displayed = decisions.filter(
    (d) => filter === "all" || (filter === "changes" ? actionable(d) : needsInput(d)),
  );
  const matchState: StepState = !run ? "idle" : run.status === "matching" ? "active" : "done";
  const checkState: StepState = !run || run.status === "matching" ? "idle" : run.status === "checking" ? "active" : "done";
  const reviewState: StepState = run?.status === "ready" ? (changes.length === applied ? "done" : "active") : "idle";
  const connected = !!calls?.connections.jev;
  const routed = mode === "notes" && !!run && !editing && ranText === text;
  const noteLines = routed
    ? ranText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => ({ line, found: run!.decisions.filter((d) => line.includes(d.quote.trim())) }))
    : [];
  const openAccountGroup = (id: string) => {
    setAccountId(id);
    setOverview(false);
    setFilter("all");
  };

  return (
    <section
      className="flex flex-col gap-5 lg:h-[calc(100dvh-112px)] lg:min-h-[520px]"
      aria-label="Account investigation"
    >
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1">Bring your accounts up to date</h1>
          <p className="mt-1 text-body-sm text-muted-foreground">Paste what happened. Approve only what should change.</p>
        </div>
        <Button size="sm" onClick={() => setShowContext(!showContext)} aria-expanded={showContext || !connected}>
          <span
            className={cn("h-1.5 w-1.5 rounded-full", connected ? "bg-success" : "bg-warning")}
            aria-hidden
          />
          Data & connection
        </Button>
      </header>

      {error && (
        <p role="alert" className="shrink-0 rounded-lg border border-destructive/40 bg-destructive-bg px-3 py-2 text-body-sm text-destructive-fg">
          {error}
        </p>
      )}

      {(showContext || !connected) && (
        <div className="investigation-arrive flex shrink-0 flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3 shadow-e1">
          <Lock className="h-4 w-4 shrink-0 text-faint-foreground" aria-hidden />
          <p className="min-w-[240px] flex-1 text-body-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {connected ? "Jev connected for this server session." : "Connect Jev for this session."}
            </span>{" "}
            After you consent, the note and related account records go to TypeSafe. Keys stay in server memory.
          </p>
          {!connected && (
            <div className="flex w-full gap-2 sm:w-auto">
              <Input
                className="sm:w-64"
                type="password"
                aria-label="Jev API key"
                autoComplete="off"
                placeholder="TypeSafe API key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
              <Button
                variant="primary"
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
            </div>
          )}
        </div>
      )}

      <div role="status" aria-live="polite" className="shrink-0">
        <div className="flex items-start gap-3">
          <Step
            n={1}
            state={matchState}
            progress={run?.total ? (100 * run.matched) / run.total : 0}
            label={
              !run
                ? "Match accounts"
                : run.status === "matching"
                  ? `Matching accounts · ${run.matched}/${run.total}`
                  : run.matched === run.total
                    ? "Accounts matched"
                    : `Matched ${run.matched}/${run.total}`
            }
          />
          <Step
            n={2}
            state={checkState}
            progress={run?.total ? (100 * run.checked) / run.total : 0}
            label={run?.status === "checking" ? `Checking records · ${run.checked}/${run.total}` : "Compare records"}
          />
          <Step
            n={3}
            state={reviewState}
            progress={changes.length ? (100 * applied) / changes.length : 0}
            label={
              run?.status === "ready"
                ? `${changes.length} changes · ${unchanged} unchanged · ${questions} to clarify`
                : run?.status === "error"
                  ? "Investigation stopped"
                  : "Review changes"
            }
          />
          {running && (
            <Button
              size="sm"
              variant="ghost"
              className="-mt-1"
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
        </div>
        <div className="mt-2 flex min-h-[20px] items-center justify-between gap-3 text-label text-faint-foreground">
          <div className="flex min-w-0 items-center gap-2" aria-label="Live investigation activity">
            {run && (
              <>
                {running || applying ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-agent motion-reduce:animate-none" />
                ) : (
                  (run.status === "error" || changes.length === applied) && <Sparkles className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="truncate">
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
                          : ""}
                </span>
                {running &&
                  run.events?.slice(-1).map((event) => (
                    <span key={`${run.id}_${event.id}`} className="investigation-arrive hidden truncate md:inline">
                      ·{" "}
                      {event.accountId && (
                        <span className="text-muted-foreground">
                          {run.accounts?.find((a) => a.id === event.accountId)?.name}{" "}
                        </span>
                      )}
                      {event.label}
                    </span>
                  ))}
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {run && <span className="tnum">{run.checked}/{run.total} checked</span>}
            {applied > 0 && <span className="font-medium text-success-fg">{applied} applied to CRM</span>}
          </div>
        </div>
      </div>
      {run?.error && (
        <p role="alert" className="shrink-0 text-body-sm text-destructive-fg">
          {run.error}
        </p>
      )}

      <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(260px,340px)_minmax(220px,280px)_minmax(0,1fr)]">
        {/* 1 · The note */}
        <section
          className="flex min-h-0 flex-col gap-3 rounded-xl border border-border bg-surface-raised p-4 shadow-e1"
          aria-label="Investigation input"
        >
          <div className="flex rounded-lg bg-secondary p-0.5" role="group" aria-label="Source">
            {(
              [
                ["notes", "Notes"],
                ["calls", "Imported calls"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                aria-pressed={mode === value}
                className={cn(
                  "h-8 flex-1 rounded-md text-body-sm font-medium transition-[background-color,color,box-shadow] duration-fast focus-visible:outline-none focus-visible:focus-ring",
                  mode === value ? "bg-surface-raised text-foreground shadow-e1" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === "notes" ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="investigation-notes" className="text-body-sm font-medium">
                  What happened across your accounts?
                </label>
                {routed && !running && (
                  <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                )}
              </div>
              {routed ? (
                <ol className="min-h-40 flex-1 space-y-1 overflow-y-auto rounded-lg bg-surface-sunken p-1.5" aria-label="How each line was read">
                  {noteLines.map(({ line, found }, i) => {
                    const d = found[0];
                    const tone = !d
                      ? "pending"
                      : d.appliedAt
                        ? "saved"
                        : actionable(d)
                          ? d.review === "check"
                            ? "check"
                            : "change"
                          : needsInput(d)
                            ? "question"
                            : "known";
                    const label = {
                      pending: "Reading…",
                      saved: "Saved",
                      check: "Check closely",
                      change: d?.title ?? "",
                      question: "Needs a person",
                      known: "Already known",
                    }[tone];
                    const account = d?.accountName;
                    const body = account && line.startsWith(account) ? line.slice(account.length).replace(/^\s*[:\-–]\s*/, "") : line;
                    return (
                      <li key={`${run!.id}_${i}`} className="investigation-arrive" style={stagger(i)}>
                        <button
                          type="button"
                          disabled={!d}
                          onClick={() => d && openAccountGroup(d.accountId ?? "unmatched")}
                          className="flex w-full gap-2.5 rounded-md px-2 py-1 text-left transition-colors duration-fast hover:bg-surface-raised disabled:cursor-default disabled:hover:bg-transparent"
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "mt-1 w-1 shrink-0 self-stretch rounded-full",
                              tone === "pending" && "animate-pulse bg-border motion-reduce:animate-none",
                              tone === "saved" && "bg-success",
                              (tone === "change" || tone === "check") && "bg-agent",
                              tone === "question" && "bg-warning",
                              tone === "known" && "bg-border",
                            )}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-x-2 text-label">
                              <span className="font-semibold text-foreground">{account ?? (d ? "No account named" : "")}</span>
                              <span
                                className={cn(
                                  "font-medium",
                                  tone === "saved" && "text-success-fg",
                                  (tone === "change" || tone === "check") && "text-agent-fg",
                                  tone === "check" && "text-warning-fg",
                                  tone === "question" && "text-warning-fg",
                                  (tone === "known" || tone === "pending") && "text-faint-foreground",
                                )}
                              >
                                {label}
                              </span>
                            </span>
                            <span className="line-clamp-1 text-body-sm text-muted-foreground">{body}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              ) : (
              <Textarea
                id="investigation-notes"
                ref={noteRef}
                className="min-h-40 flex-1 resize-none border-transparent bg-surface-sunken text-body leading-7 shadow-none focus:bg-surface-raised"
                placeholder={"Northstar: sent the security checklist.\nMeridian: review cleared for renewal.\n\nOne account and one thought per line."}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={200000}
                disabled={!!running}
              />
              )}
            </>
          ) : (
            <div className="min-h-40 flex-1 overflow-y-auto">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-body-sm text-muted-foreground tnum">{ids.length} selected</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIds(ids.length ? [] : (calls?.calls ?? []).slice(0, 50).map((c) => c.id))}
                >
                  {ids.length ? "Clear" : "Select up to 50"}
                </Button>
              </div>
              {calls?.calls.length ? (
                <div className="divide-y divide-border">
                  {calls.calls.map((c) => (
                    <label key={c.id} className="flex cursor-pointer gap-2.5 py-2.5 text-body-sm">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--foreground))]"
                        checked={ids.includes(c.id)}
                        disabled={!!running}
                        onChange={() =>
                          setIds((v) => (v.includes(c.id) ? v.filter((id) => id !== c.id) : [...v, c.id].slice(0, 50)))
                        }
                      />
                      <span className="break-words">{c.title}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-body-sm text-muted-foreground">Import transcripts in Calls to check them here.</p>
              )}
            </div>
          )}
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 text-body-sm text-muted-foreground transition-colors has-[:checked]:border-accent/50 has-[:checked]:bg-accent-bg/50 has-[:checked]:text-foreground">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--accent))]"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>Send selected notes and account context to TypeSafe.</span>
          </label>
          <Button
            className="w-full"
            size="lg"
            variant="primary"
            disabled={
              busy || !!running || !consent || !connected || (mode === "notes" ? !text.trim() : !ids.length)
            }
            onClick={() =>
              void act(async () => {
                const next = await request<InvestigationRun>("/investigate", {
                  ...(mode === "notes" ? { text } : { ids }),
                  consent,
                });
                setRun(next);
                setRanText(text);
                setEditing(false);
                noteRef.current?.scrollTo({ top: 0 });
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

        {/* 2 · The accounts it touches */}
        <section className="flex min-h-0 flex-col" aria-label="Affected accounts">
          <h2 className="mb-2.5 flex items-baseline gap-2 px-1 text-body-sm font-semibold">
            Affected accounts
            <span className="font-normal text-faint-foreground tnum">
              {groups.filter((g) => g.id !== "unmatched").length || ""}
            </span>
          </h2>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
            {run?.status === "ready" && (
              <button
                onClick={() => setOverview(true)}
                aria-pressed={overview}
                className={cn(
                  "investigation-arrive w-full rounded-xl border p-3 text-left transition-[border-color,box-shadow,background-color] duration-fast",
                  overview
                    ? "border-foreground/80 bg-surface-raised shadow-e2"
                    : "border-border bg-surface-raised shadow-e1 hover:border-border-strong",
                )}
              >
                <span className="flex items-center gap-2 text-body-sm font-semibold">
                  <GitCompareArrows className="h-4 w-4 text-faint-foreground" />
                  All account outcomes
                </span>
                <span className="mt-1 block text-label text-muted-foreground tnum">
                  {changes.length - applied} awaiting approval · {applied} saved
                </span>
              </button>
            )}
            {!groups.length ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-center text-body-sm text-faint-foreground">
                {running ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-agent motion-reduce:animate-none" />
                    Reading and matching accounts…
                  </>
                ) : (
                  "Account matches will appear here."
                )}
              </div>
            ) : (
              groups.map((a, i) => {
                const ds = run?.decisions.filter((d) => (d.accountId ?? "unmatched") === a.id) ?? [];
                const proposals = ds.filter(actionable);
                const done = proposals.filter((d) => d.appliedAt).length;
                const pending = proposals.length - done;
                const isSelected = !overview && selected?.id === a.id;
                const checking = running && ds.length < a.passages;
                return (
                  <button
                    key={a.id}
                    style={stagger(i)}
                    onClick={() => openAccountGroup(a.id)}
                    aria-pressed={isSelected}
                    className={cn(
                      "investigation-arrive group flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-[border-color,box-shadow,background-color] duration-fast motion-reduce:transition-none",
                      isSelected
                        ? "border-foreground/80 bg-surface-raised shadow-e2"
                        : "border-border bg-surface-raised shadow-e1 hover:border-border-strong",
                    )}
                  >
                    {a.id === "unmatched" ? (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-warning text-warning-fg">
                        <HelpCircle className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <Monogram name={a.name} size="sm" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 break-words text-body-sm font-medium">
                        {a.name}
                        {run?.activeAccounts?.includes(a.id) && running && (
                          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-agent motion-reduce:animate-none" />
                        )}
                      </span>
                      {running ? (
                        <span className="mt-2 block h-1 overflow-hidden rounded-full bg-secondary">
                          <span
                            className="investigation-progress block h-full rounded-full bg-agent"
                            style={{ width: `${Math.min(100, (100 * ds.length) / a.passages)}%` }}
                          />
                        </span>
                      ) : null}
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        {done > 0 && (
                          <Chip tone="saved">
                            <Check className="h-3 w-3" /> {done} applied
                          </Chip>
                        )}
                        {pending > 0 && (
                          <Chip tone="change">
                            {pending} {pending === 1 ? "change" : "changes"}
                          </Chip>
                        )}
                        {ds.some((d) => d.kind === "unchanged") && <Chip tone="known">already known</Chip>}
                        {ds.some(needsInput) && <Chip tone="ask">needs input</Chip>}
                        {ds.some((d) => d.review === "check" && !d.appliedAt) && <Chip tone="ask">check closely</Chip>}
                        {checking && <span className="text-label text-faint-foreground">checking…</span>}
                        {!running && !ds.length && <span className="text-label text-faint-foreground">0 changes</span>}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* 3 · What should change */}
        <section
          className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface-raised shadow-e1"
          aria-label="Account changes"
        >
          <div className="shrink-0 border-b border-border px-5 py-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-label text-faint-foreground">
                  {overview ? "Investigation outcome" : selected ? "Current record → proposed change" : "Proposed changes"}
                </p>
                <h2 className="mt-0.5 truncate text-h2">
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
              <div className="mt-3 inline-flex rounded-lg bg-secondary p-0.5">
                {(
                  [
                    ["all", "All decisions"],
                    ["changes", "Changes"],
                    ["questions", "Needs input"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                    className={cn(
                      "h-7 rounded-md px-2.5 text-label font-medium transition-[background-color,color,box-shadow] duration-fast focus-visible:outline-none focus-visible:focus-ring",
                      filter === value ? "bg-surface-raised text-foreground shadow-e1" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4" aria-live="off">
            {overview ? (
              <div className="investigation-arrive">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(
                    [
                      ["Saved", applied, "text-success-fg"],
                      ["For approval", changes.length - applied, "text-agent-fg"],
                      ["Unchanged", unchanged, "text-muted-foreground"],
                      ["To clarify", questions, "text-warning-fg"],
                    ] as const
                  ).map(([label, value, tone]) => (
                    <div key={label} className="rounded-lg bg-surface-sunken px-3 py-2.5">
                      <div className={cn("text-[22px] font-semibold leading-none tracking-[-0.03em] tnum", tone)}>{value}</div>
                      <div className="mt-1.5 text-label text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>
                {questions > 0 && (
                  <p className="mt-3 flex items-center gap-2 text-label text-warning-fg">
                    <HelpCircle className="h-3.5 w-3.5" />
                    {questions} {questions === 1 ? "line needs" : "lines need"} a person.
                  </p>
                )}
                <div className="mt-4 divide-y divide-border">
                  {groups.map((a, i) => {
                    const ds = run!.decisions.filter((d) => (d.accountId ?? "unmatched") === a.id);
                    return (
                      <section key={a.id} className="investigation-arrive py-3" style={stagger(i)}>
                        <button
                          className="flex items-center gap-1.5 text-body-sm font-semibold hover:underline"
                          onClick={() => openAccountGroup(a.id)}
                        >
                          {a.name}
                          <ArrowRight className="h-3.5 w-3.5 text-faint-foreground" />
                        </button>
                        <div className="mt-2 space-y-2">
                          {ds.map((d) => (
                            <div key={d.id} className="flex items-start justify-between gap-3 text-body-sm">
                              <span className={cn("min-w-0", d.appliedAt && "text-muted-foreground")}>
                                {d.title}
                                {d.after && (
                                  <span className="mt-0.5 block text-label text-faint-foreground">
                                    → {d.after}
                                    {d.kind === "complete" ? `: ${d.before}` : ""}
                                  </span>
                                )}
                              </span>
                              <span className="shrink-0">
                                {applying === d.id ? (
                                  <Chip tone="change">Saving…</Chip>
                                ) : d.appliedAt ? (
                                  <Chip tone="saved">
                                    <Check className="h-3 w-3" /> Saved
                                  </Chip>
                                ) : d.op && d.review === "check" ? (
                                  <Chip tone="ask">Check closely</Chip>
                                ) : d.op ? (
                                  <Chip tone="change">For approval</Chip>
                                ) : d.kind === "unchanged" ? (
                                  <Chip tone="known">No change</Chip>
                                ) : (
                                  <Chip tone="ask">Needs input</Chip>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </div>
            ) : !selected ? (
              <div className="flex h-full min-h-56 flex-col items-center justify-center text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-agent-bg text-agent">
                  <ScanLine className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-h2">A useful change, or a reason to leave it alone</h3>
                <div className="mt-6 grid w-full max-w-md grid-cols-3 gap-2 text-left">
                  {(
                    [
                      [CircleDashed, "Match each line to an account"],
                      [GitCompareArrows, "Compare with what the CRM knows"],
                      [CheckCheck, "Approve only what is right"],
                    ] as const
                  ).map(([Icon, label], i) => (
                    <div key={label} className="rounded-lg border border-border p-3">
                      <Icon className="h-4 w-4 text-faint-foreground" />
                      <p className="mt-2 text-label text-muted-foreground">
                        <span className="tnum text-faint-foreground">{i + 1}. </span>
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : !displayed.length ? (
              <p className="py-10 text-center text-body-sm text-muted-foreground">
                {running ? "Comparing this account’s records with the note…" : "No decisions in this group."}
              </p>
            ) : (
              <div className="space-y-3">
                {displayed.map((d, i) => (
                  <article
                    key={d.id}
                    style={stagger(i)}
                    className={cn(
                      "investigation-arrive rounded-xl border p-4 transition-[border-color,background-color] duration-base",
                      d.appliedAt ? "border-success/40 bg-success-bg/40" : needsInput(d) ? "border-warning/40" : "border-border",
                    )}
                    aria-label={d.title}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                          d.appliedAt
                            ? "investigation-saved bg-success text-white"
                            : d.kind === "unchanged"
                              ? "bg-secondary text-muted-foreground"
                              : needsInput(d)
                                ? "bg-warning-bg text-warning-fg"
                                : "bg-agent-bg text-agent",
                        )}
                        aria-hidden
                      >
                        {d.appliedAt ? (
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        ) : d.kind === "unchanged" ? (
                          <CheckCheck className="h-3.5 w-3.5" />
                        ) : needsInput(d) ? (
                          <HelpCircle className="h-3.5 w-3.5" />
                        ) : d.kind === "add" ? (
                          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <h3 className="text-h3">
                        {d.appliedAt ? "Applied · " : ""}
                        {d.title}
                      </h3>
                      {d.review === "check" && !d.appliedAt && (
                        <span title="Jev chose this change with less than its usual confidence. Read the source before applying." className="ml-auto">
                          <Chip tone="ask">Check closely · {Math.round((d.confidence ?? 0) * 100)}% sure</Chip>
                        </span>
                      )}
                    </div>

                    {(d.before || d.after || d.kind === "add") && (
                      <div className="mt-3 grid gap-2">
                        {d.before && (
                          <div className="rounded-lg bg-surface-sunken px-3 py-2.5">
                            <p className="text-label text-faint-foreground">
                              {d.dependsOn
                                ? "Already proposed in this investigation"
                                : d.kind === "unchanged"
                                  ? "Already in CRM"
                                  : "Before"}
                            </p>
                            <p
                              className={cn(
                                "mt-1 text-body-sm",
                                d.appliedAt && d.kind !== "unchanged" && "text-muted-foreground line-through decoration-muted-foreground/50",
                              )}
                            >
                              {d.before}
                            </p>
                          </div>
                        )}
                        {d.kind === "add" && !d.before && (
                          <p className="text-label text-faint-foreground">No matching knowledge found in this account.</p>
                        )}
                        {d.after && (
                          <div
                            className={cn(
                              "rounded-lg border-l-2 px-3 py-2.5",
                              d.appliedAt ? "border-success bg-success-bg/60" : "border-accent bg-accent-bg/50",
                            )}
                          >
                            <p className={cn("text-label", d.appliedAt ? "text-success-fg" : "text-accent-fg")}>
                              {d.appliedAt ? "Now in CRM" : "After approval"}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap break-words text-body-sm">{d.after}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {(d.qualification === "conditional" || d.qualification === "unclear") && (
                      <p className="mt-2 text-label text-warning-fg">
                        {d.qualification} —{" "}
                        {d.kind === "clarify" ? "clarify before changing this record" : "condition kept with the evidence"}
                      </p>
                    )}
                    {d.kind === "clarify" && (
                      <p className="mt-2 text-body-sm text-muted-foreground">
                        Name the account and what was confirmed, then investigate again.
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <details className="group min-w-0 flex-1 text-body-sm">
                        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-label text-muted-foreground hover:text-foreground">
                          <Quote className="h-3.5 w-3.5" />
                          Source & decision path
                        </summary>
                        <blockquote className="mt-3 whitespace-pre-wrap break-words border-l-2 border-agent pl-3 text-body-sm">
                          {d.quote}
                        </blockquote>
                        <p className="mt-2 text-label text-muted-foreground">
                          Match account → compare existing records →{" "}
                          {d.kind === "unchanged" ? "keep unchanged" : d.kind === "clarify" ? "ask for clarification" : "human review"}
                        </p>
                        <p className="mt-1 break-all font-mono text-[11.5px] text-faint-foreground">
                          {d.sourceRef} · characters {d.start}–{d.end}
                          {d.model ? ` · ${d.model}` : ""}
                        </p>
                      </details>
                      {d.op && !d.appliedAt && (
                        <Button
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
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
          {overview && bulk.length > 0 && (
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-raised px-5 py-3">
              <p className="text-label text-muted-foreground">
                {toCheck ? `${toCheck} to check on its own first.` : ""}
              </p>
              <Button
                variant="primary"
                disabled={busy || run?.status !== "ready"}
                onClick={() =>
                  void act(async () => {
                    for (const d of bulk) await applyDecision(d.id);
                  })
                }
              >
                Approve & save {bulk.length} changes
                <CheckCheck />
              </Button>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
