import { CheckCircle2, CircleDashed, Handshake, Trophy, type LucideIcon } from "lucide-react";
import { cn, formatDate } from "../lib/utils";
import { sourceMeta, dealStageMeta, type Tone } from "../lib/meta";
import type { Deal, Note, Task } from "../types";

type Event = { id: string; date: string; icon: LucideIcon; tone: Tone; title: string; detail: string };

function buildEvents(notes: Note[], tasks: Task[], deals: Deal[]): Event[] {
  const events: Event[] = [];

  for (const n of notes) {
    events.push({
      id: `note-${n.id}`,
      date: n.createdAt,
      icon: sourceMeta[n.source].icon,
      tone: "neutral",
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
      events.push({ id: `deal-${d.id}`, date: d.createdAt, icon: Handshake, tone: "neutral", title: `Deal opened: ${d.name}`, detail: dealStageMeta[d.stage].label });
    }
  }

  return events.sort((a, b) => b.date.localeCompare(a.date));
}

/** A chronological account timeline — notes, tasks, and deal moves on one spine. */
export function AccountTimeline({ notes, tasks, deals }: { notes: Note[]; tasks: Task[]; deals: Deal[] }) {
  const events = buildEvents(notes, tasks, deals);
  if (events.length === 0) {
    return <p className="text-body-sm text-faint-foreground">No activity yet.</p>;
  }

  return (
    <ol className="relative">
      {events.map((ev, i) => {
        const Icon = ev.icon;
        const last = i === events.length - 1;
        return (
          <li key={ev.id} className="relative flex gap-3 pb-4 last:pb-0">
            {!last && <span className="absolute bottom-0 left-[11px] top-7 w-px bg-border" aria-hidden />}
            <span
              className={cn(
                "relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-card",
                ev.tone === "success" ? "text-success" : "text-muted-foreground",
              )}
              aria-hidden
            >
              <Icon className="h-3 w-3" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0 text-body-sm font-medium text-foreground">{ev.title}</div>
                <time className="tnum shrink-0 text-label font-normal text-faint-foreground">{formatDate(ev.date)}</time>
              </div>
              <div className="mt-0.5 text-label font-normal text-muted-foreground">{ev.detail}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
