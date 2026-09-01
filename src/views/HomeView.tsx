import { Activity, ArrowRight, Check, ClipboardList, Columns3, Database, Play, ShieldAlert } from "lucide-react";
import type { Account, Task, Workspace } from "../types";
import type { View } from "../lib/nav";
import { isOpenDeal } from "../lib/meta";
import { splitCurrency } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { CountUp } from "../components/ui/count";
import { Sparkline } from "../components/ui/sparkline";
import { Meter } from "../components/ui/meter";
import { MetricCard } from "../components/metric-card";
import { TaskRow } from "../components/task-row";
import { NoteCard } from "../components/note-card";
import { EmptyState } from "../components/ui/empty-state";
import { Private } from "../components/ui/privacy";
import { Button } from "../components/ui/button";
import { onboardingProgress, type OnboardingMode } from "../lib/onboarding";

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
}: {
  workspace: Workspace;
  accountsById: Map<string, Account>;
  metrics: HomeMetrics;
  onboardingMode: OnboardingMode;
  onOpenOnboarding: () => void;
  onNavigate: (v: View) => void;
  onSelectAccount: (id: string) => void;
  onToggleTask: (id: string) => void;
}) {
  const openTasks = workspace.tasks
    .filter((t) => t.status === "open")
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, 6);
  const recentNotes = [...workspace.notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);
  const totalTasks = Math.max(1, workspace.tasks.length);
  const totalAccounts = Math.max(1, workspace.accounts.length);

  const trend = workspace.deals
    .filter((d) => isOpenDeal(d.stage))
    .map((d) => (d.value * d.probability) / 100)
    .sort((x, y) => x - y)
    .reduce<number[]>((acc, v) => [...acc, (acc[acc.length - 1] ?? 0) + v], []);
  const pipeline = splitCurrency(metrics.weightedPipeline);
  const progress = onboardingProgress(workspace);
  const showGettingStarted = onboardingMode !== "demo" && (!progress.hasSource || !progress.hasAction);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-display text-foreground">{greeting()}.</h1>
        <p className="mt-1 text-body text-muted-foreground">
          {metrics.openTasks === 0
            ? "No open tasks — you're all caught up."
            : `${metrics.openTasks} open ${metrics.openTasks === 1 ? "task" : "tasks"}, ${metrics.dueSoon} due soon.`}
        </p>
      </div>

      {onboardingMode === "demo" ? (
        <section className="flex flex-col gap-4 border-y border-accent/40 bg-accent-bg/25 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-label uppercase text-accent-fg">Synthetic demo workspace</div>
            <p className="mt-1 max-w-2xl text-body-sm text-muted-foreground">
              Explore every workflow safely. When you are ready, create a clean workspace around one real account.
            </p>
          </div>
          <Button variant="accent" size="sm" onClick={onOpenOnboarding} className="self-start sm:self-auto">
            Start with my data
            <ArrowRight />
          </Button>
        </section>
      ) : showGettingStarted ? (
        <section className="grid gap-4 border-y border-border py-4 lg:grid-cols-[220px_1fr]">
          <div>
            <div className="text-label uppercase text-accent-fg">First useful loop</div>
            <h2 className="mt-1 font-serif text-h2 text-foreground">Turn context into action</h2>
            <p className="mt-1 text-body-sm text-muted-foreground">Complete these in any order. Your data stays local.</p>
          </div>
          <div className="divide-y divide-border border-y border-border lg:border-y-0">
            <StartRow
              done={progress.hasAccount}
              label="Add an account"
              detail="The company or client whose context you need to remember."
              action="Accounts"
              onClick={() => onNavigate("accounts")}
            />
            <StartRow
              done={progress.hasSource}
              label="Capture a source note"
              detail="Record what happened and where it came from."
              action="Capture"
              onClick={() => onNavigate("notes")}
            />
            <StartRow
              done={progress.hasAction}
              label="Choose the next action"
              detail="Keep human judgment explicit before work moves."
              action="Tasks"
              onClick={() => onNavigate("tasks")}
            />
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
          viz={<Sparkline data={trend.length > 1 ? trend : [0, metrics.weightedPipeline]} tone="signal" width={120} height={22} />}
        />
        <MetricCard
          label="Deals in play"
          tone="account"
          icon={Columns3}
          value={<CountUp value={metrics.openDeals} />}
          viz={<Meter value={(metrics.openDeals / Math.max(1, workspace.deals.length)) * 100} tone="account" ticks={false} label="Open deal share" className="w-full" />}
        />
        <MetricCard
          label="Open tasks"
          tone="warning"
          icon={ClipboardList}
          value={<CountUp value={metrics.openTasks} />}
          viz={<Meter value={(metrics.dueSoon / totalTasks) * 100} tone="warning" ticks={false} label="Due-soon share" className="w-full" />}
        />
        <MetricCard
          label="At-risk accounts"
          tone="destructive"
          icon={ShieldAlert}
          value={<CountUp value={metrics.atRisk} />}
          viz={<Meter value={(metrics.atRisk / totalAccounts) * 100} tone="destructive" ticks={false} label="At-risk share" className="w-full" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-h2">Today</CardTitle>
            <p className="text-body-sm text-muted-foreground">Your open tasks, soonest first.</p>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {openTasks.length === 0 ? (
              <EmptyState title="Inbox zero, the good kind." hint="New tasks appear here as you add them across accounts." />
            ) : (
              openTasks.map((task: Task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  accountName={task.accountId ? accountsById.get(task.accountId)?.name : undefined}
                  onToggle={() => onToggleTask(task.id)}
                  onOpenAccount={task.accountId ? () => onSelectAccount(task.accountId!) : undefined}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="font-serif text-h2">Recent activity</CardTitle>
              <p className="text-body-sm text-muted-foreground">The latest notes across your accounts.</p>
            </div>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            {recentNotes.map((note) => (
              <NoteCard key={note.id} note={note} accountName={accountsById.get(note.accountId)?.name} />
            ))}
            <button
              onClick={() => onNavigate("notes")}
              className="w-full rounded-md py-1.5 text-center text-body-sm text-accent-fg hover:underline focus-visible:outline-none focus-visible:focus-ring"
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
          done ? "border-success bg-success-bg text-success-fg" : "border-border bg-surface text-faint-foreground"
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
