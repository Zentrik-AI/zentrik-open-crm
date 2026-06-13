import { CheckCircle2, CircleDashed, Handshake, Trophy, type LucideIcon } from "lucide-react";
import { cn, formatDate } from "../lib/utils";
import { sourceMeta, dealStageMeta, type Tone } from "../lib/meta";
import { toneSolidBg, toneText } from "../lib/tone";
import type { Deal, Note, Task } from "../types";

type Event = { id: string; date: string; icon: LucideIcon; tone: Tone; title: string; detail: string };

function buildEvents(notes: Note[], tasks: Task[], deals: Deal[]): Event[] {
  const events: Event[] = [];

  for (const n of notes) {
    events.push({
      id: `note-${n.id}`,
      date: n.createdAt,
      icon: sourceMeta[n.source].icon,
      tone: "signal",
      title: n.title,
      detail: `${sourceMeta[n.source].label} · ${n.sentiment}`,
    });
  }
  for (const t of tasks) {
    if (t.status === "done" && t.completedAt) {
      events.push({ id: `task-done-${t.id}`, date: t.completedAt, icon: CheckCircle2, tone: "success", title: `Completed: ${t.title}`, detail: t.owner });
    } else {
      events.push({ id: `task-${t.id}`, date: t.createdAt, icon: CircleDashed, tone: "neutral", title: `Task: ${t.title}`, detail: `due ${formatDate(t.due)}` });
    }
  }
  for (const d of deals) {
    if (d.stage === "won") {
      events.push({ id: `deal-won-${d.id}`, date: d.closeDate, icon: Trophy, tone: "success", title: `Won: ${d.name}`, detail: dealStageMeta[d.stage].label });
    } else {
      events.push({ id: `deal-${d.id}`, date: d.createdAt, icon: Handshake, tone: "account", title: `Deal opened: ${d.name}`, detail: dealStageMeta[d.stage].label });
    }
  }

  return events.sort((a, b) => b.date.localeCompare(a.date));
}

/** A chronological account timeline — notes, tasks, and deal moves on one spine. */
export function AccountTimeline({ notes, tasks, deals }: { notes: Note[]; tasks: Task[]; deals: Deal[] }) {
  const events = buildEvents(notes, tasks, deals);
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-transparent p-4 text-body-sm text-muted-foreground">
        No activity yet. Notes, tasks, and deal moves will appear here.
      </div>
    );
  }

  return (
    <ol className="relative ml-2 space-y-5 border-l border-border pl-6">
      {events.map((ev) => {
        const Icon = ev.icon;
        return (
          <li key={ev.id} className="relative">
            <span
              className={cn(
                "absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full border-2 border-surface",
                toneSolidBg[ev.tone],
              )}
              aria-hidden
            >
              <Icon className="h-3 w-3 text-surface" />
            </span>
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-body font-medium text-foreground">{ev.title}</div>
              <time className="shrink-0 font-mono text-[11px] tabular-nums text-faint-foreground">{formatDate(ev.date)}</time>
            </div>
            <div className={cn("mt-0.5 text-[12px]", toneText[ev.tone])}>{ev.detail}</div>
          </li>
        );
      })}
    </ol>
  );
}
