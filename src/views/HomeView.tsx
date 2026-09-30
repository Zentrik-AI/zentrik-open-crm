import { Activity, ArrowRight, Check, ClipboardList, Columns3, Database, Play, ScanLine, ShieldAlert } from "lucide-react";
import type { Account, Task, Workspace } from "../types";
import type { View } from "../lib/nav";
import { splitCurrency } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { MetricCard } from "../components/metric-card";
import { TaskRow } from "../components/task-row";
import { NoteCard } from "../components/note-card";
import { EmptyState } from "../components/ui/empty-state";
import { Private } from "../components/ui/privacy";
import { Button } from "../components/ui/button";
import { onboardingProgress, type OnboardingMode } from "../lib/onboarding";
import { pendingProposals } from "../core/ops.ts";

export type HomeMetrics = {
  weightedPipeline: number;
  openDeals: number;
  openTasks: number;
  dueSoon: number;
  atRisk: number;
};

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function HomeView({
  workspace,
  accountsById,
  metrics,
  onboardingMode,
  onOpenOnboarding,
  onNavigate,
  onSelectAccount,
  onToggleTask,
  onTrace,
}: {
  workspace: Workspace;
  accountsById: Map<string, Account>;
  metrics: HomeMetrics;
  onboardingMode: OnboardingMode;
  onOpenOnboarding: () => void;
  onNavigate: (v: View) => void;
  onSelectAccount: (id: string) => void;
  onToggleTask: (id: string) => void;
  onTrace: (id: string) => void;
}) {
  const openTasks = workspace.tasks
    .filter((t) => t.status === "open" && !accountsById.get(t.accountId ?? "")?.archivedAt)
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, 6);
  const recentNotes = [...workspace.notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 2);
  const notesById = new Map(workspace.notes.map((note) => [note.id, note]));
  const waiting = pendingProposals(workspace);

  const pipeline = splitCurrency(metrics.weightedPipeline);
  const progress = onboardingProgress(workspace);
  const showGettingStarted = onboardingMode !== "demo" && (!progress.hasSource || !progress.hasAction);

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display text-foreground">{greeting()}.</h1>
          <p className="mt-1.5 text-body text-muted-foreground">
            {metrics.openTasks === 0
              ? "No open tasks — you're all caught up."
              : `${metrics.openTasks} open ${metrics.openTasks === 1 ? "task" : "tasks"}, ${metrics.dueSoon} due soon.`}
          </p>
        </div>
        {onboardingMode === "demo" && (
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface-raised px-3 text-label text-muted-foreground shadow-e1">
              <span className="h-1.5 w-1.5 rounded-full bg-highlight" aria-hidden />
              Synthetic demo workspace
            </span>
            <Button size="sm" onClick={onOpenOnboarding}>
              Start with my data
              <ArrowRight />
            </Button>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => onNavigate("updates")}
        className="group flex w-full items-center gap-4 rounded-xl border border-border bg-surface-raised px-5 py-4 text-left shadow-e1 transition-[border-color,box-shadow] duration-fast hover:border-border-strong hover:shadow-e2 focus-visible:outline-none focus-visible:focus-ring"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-agent-bg text-agent">
          <ScanLine className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-h3 text-foreground">Paste what happened after your calls</span>
          <span className="mt-0.5 block text-body-sm text-muted-foreground">Open CRM matches each line to an account and proposes the update.</span>
        </span>
        <span className="hidden items-center gap-1.5 text-body-sm font-medium text-foreground sm:flex">
          Update accounts
          <ArrowRight className="h-4 w-4 transition-transform duration-fast group-hover:translate-x-0.5" />
        </span>
      </button>

      {waiting.length > 0 && (
        <section className="flex flex-col gap-3 rounded-xl border border-agent/30 bg-agent-bg/60 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-body-sm text-foreground">
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-agent px-1.5 text-[11px] font-semibold text-white tnum">{waiting.length}</span>
            {waiting.length === 1 ? "change" : "changes"} ready for review.
          </p>
          <Button variant="agent" size="sm" onClick={() => onNavigate("review")} className="self-start sm:self-auto">
            Review
            <ArrowRight />
          </Button>
        </section>
      )}

      {onboardingMode !== "demo" && showGettingStarted ? (
        <section className="rounded-xl border border-border bg-surface-raised p-5 shadow-e1">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-label text-accent-fg">First useful loop</p>
              <h2 className="mt-0.5 text-h2 text-foreground">Turn context into action</h2>
            </div>
            <p className="text-label text-faint-foreground">Any order · your data stays local</p>
          </div>
          <div className="mt-3 divide-y divide-border">
            <StartRow
              done={progress.hasAccount}
              label="Add an account"
              detail="The company whose context you need to remember."
              action="Accounts"
              onClick={() => onNavigate("accounts")}
            />
            <StartRow
              done={progress.hasSource}
              label="Capture a source note"
              detail="What happened, and where it came from."
              action="Capture"
              onClick={() => onNavigate("notes")}
            />
            <StartRow
              done={progress.hasAction}
              label="Choose the next action"
              detail="Keep the decision with a person."
              action="Tasks"
              onClick={() => onNavigate("tasks")}
            />
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          label="Weighted pipeline"
          tone="signal"
          icon={Database}
          value={
            <Private redactedLabel="hidden">
              <span>
                {pipeline.lead}
                {pipeline.unit && <span className="text-[0.72em] text-muted-foreground">{pipeline.unit}</span>}
              </span>
            </Private>
          }
        />
        <MetricCard
          label="Deals in play"
          tone="account"
          icon={Columns3}
          value={metrics.openDeals}
        />
        <MetricCard
          label="Open tasks"
          tone="warning"
          icon={ClipboardList}
          value={metrics.openTasks}
        />
        <MetricCard
          label="At-risk accounts"
          tone="destructive"
          icon={ShieldAlert}
          value={metrics.atRisk}
        />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-h2">Next actions</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => onNavigate("tasks")}>
              All tasks
              <ArrowRight />
            </Button>
          </CardHeader>
          <CardContent className="divide-y divide-border/70">
            {openTasks.length === 0 ? (
              <EmptyState title="No open tasks" hint="Add a next action from an account or the Tasks view." />
            ) : (
              openTasks.map((task: Task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  accountName={task.accountId ? accountsById.get(task.accountId)?.name : undefined}
                  notesById={notesById}
                  onTrace={onTrace}
                  onToggle={() => onToggleTask(task.id)}
                  onOpenAccount={task.accountId ? () => onSelectAccount(task.accountId!) : undefined}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-h2">Recent activity</CardTitle>
            <Activity className="h-4 w-4 text-faint-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            {recentNotes.map((note) => (
              <NoteCard key={note.id} note={note} accountName={accountsById.get(note.accountId)?.name} />
            ))}
            <button
              onClick={() => onNavigate("notes")}
              className="w-full rounded-lg py-2 text-center text-body-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:focus-ring"
            >
              View all notes →
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StartRow({
  done,
  label,
  detail,
  action,
  onClick,
}: {
  done: boolean;
  label: string;
  detail: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 py-3 first:pt-0 last:pb-0">
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
          done ? "border-success bg-success text-white" : "border-border bg-surface text-faint-foreground"
        }`}
        aria-label={done ? "Complete" : "Not complete"}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : <Play className="h-3 w-3" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-h3 text-foreground">{label}</div>
        <p className="text-body-sm text-muted-foreground">{detail}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={onClick}>
        {action}
        <ArrowRight />
      </Button>
    </div>
  );
}
