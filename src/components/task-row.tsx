import { type ReactNode } from "react";
import { Check, CircleDashed, FileText, Sparkles } from "lucide-react";
import { cn, formatDate, formatDateFull, formatRelative } from "../lib/utils";
import { levelOf, priorityMeta } from "../lib/meta";
import type { Note, Priority, Task } from "../types";
import { useMounted, useReducedMotion } from "../lib/hooks";
import { Tooltip } from "./ui/tooltip";
import { useShareSafe } from "./ui/privacy";

const DAY = 24 * 60 * 60 * 1000;

/** An animated strike that draws through completed text. */
function StrikeLabel({ children, done }: { children: ReactNode; done: boolean }) {
  const reduced = useReducedMotion();
  const mounted = useMounted();
  const drawn = !done ? false : reduced ? true : mounted;
  return (
    <span className="relative inline">
      <span className={cn(done && "text-faint-foreground transition-colors")}>{children}</span>
      {done && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 top-1/2 h-px origin-left bg-faint-foreground"
          style={{
            width: "100%",
            transform: `scaleX(${drawn ? 1 : 0})`,
            transition: reduced ? undefined : "transform var(--d-base) var(--ease-out)",
          }}
        />
      )}
    </span>
  );
}

/** Priority as three quiet bars. Only urgent takes colour, and a word. */
function PriorityMark({ priority }: { priority: Priority }) {
  const level = Math.min(levelOf[priority], 3);
  const urgent = priority === "urgent";
  const label = priorityMeta[priority].label;
  return (
    <span
      role="img"
      aria-label={`Priority: ${label}`}
      title={`${label} priority`}
      className={cn("inline-flex h-5 items-center gap-1.5 text-label", urgent ? "text-destructive-fg" : "text-faint-foreground")}
    >
      <span className="flex items-end gap-[2px]" aria-hidden>
        {[5, 8, 11].map((h, i) => (
          <span
            key={h}
            className={cn("w-[3px] rounded-[1px]", i < level ? (urgent ? "bg-destructive" : "bg-muted-foreground") : "bg-border-strong")}
            style={{ height: h }}
          />
        ))}
      </span>
      {urgent && <span>{label}</span>}
    </span>
  );
}

/** The date part of the meta line: red when overdue, amber when due within two days. */
function DueText({ task, done }: { task: Task; done: boolean }) {
  const at = new Date(task.due).getTime();
  if (task.status === "waiting" || task.status === "cancelled") {
    const word = task.status === "waiting" ? "Waiting · review" : "Cancelled · was due";
    return (
      <span className="text-muted-foreground" title={formatDateFull(task.due)}>
        {word} <span className="tnum">{formatDate(task.due)}</span>
      </span>
    );
  }
  const overdue = !done && at < Date.now();
  const soon = !done && !overdue && at - Date.now() < 2 * DAY;
  return (
    <span
      className={cn("tnum", done ? "text-faint-foreground" : overdue ? "font-medium text-destructive-fg" : soon ? "text-warning-fg" : "text-muted-foreground")}
      title={formatDateFull(task.due)}
    >
      {done ? `Due ${formatDate(task.due)}` : overdue ? `Overdue ${formatRelative(task.due)}` : `Due ${formatRelative(task.due)}`}
    </span>
  );
}

/** A quiet source line: a small icon and muted text, clickable into the trace. */
function SourceLine({ task, notesById, onTrace }: { task: Task; notesById: Map<string, Note>; onTrace?: (id: string) => void }) {
  const notes = (task.evidence ?? []).map((id) => notesById.get(id)).filter((note): note is Note => Boolean(note));
  const onClick = onTrace ? () => onTrace(task.id) : undefined;
  const Tag = onClick ? "button" : "span";
  const interactive = onClick && "rounded-sm text-left hover:text-foreground focus-visible:outline-none focus-visible:focus-ring";
  const source =
    notes.length > 0 ? (
      <Tooltip
        content={
          <span className="block max-w-xs space-y-0.5 text-label">
            {notes.map((note) => (
              <span key={note.id} className="block">
                {note.title} <span className="font-mono text-faint-foreground">· {note.sourceRef || "no reference"}</span>
              </span>
            ))}
            {onClick && <span className="block pt-1 text-faint-foreground">Click to see the full trace</span>}
          </span>
        }
      >
        <Tag type={onClick ? "button" : undefined} onClick={onClick} className={cn("inline-flex min-w-0 items-center gap-1.5", interactive)}>
          <FileText className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
          <span className="truncate">{notes.length === 1 ? notes[0].title : `${notes.length} source notes`}</span>
        </Tag>
      </Tooltip>
    ) : (
      <Tag type={onClick ? "button" : undefined} onClick={onClick} className={cn("inline-flex min-w-0 items-center gap-1.5 text-faint-foreground", interactive)}>
        <CircleDashed className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">No source cited</span>
      </Tag>
    );
  return (
    <div className="mt-1 flex min-w-0 items-center gap-x-2 text-label font-normal text-muted-foreground">
      {task.origin && (
        <span className="inline-flex shrink-0 items-center gap-1" title={`Proposed by ${task.origin.name}`}>
          <Sparkles className="h-3.5 w-3.5 text-agent" aria-hidden />
          <span className="text-agent-fg">{task.origin.name}</span>
        </span>
      )}
      <span className="min-w-0 shrink">{source}</span>
      {task.reason && (
        <span className="hidden min-w-0 truncate text-faint-foreground sm:inline" title={task.reason}>
          · {task.reason}
        </span>
      )}
    </div>
  );
}

export function TaskRow({
  task,
  accountName,
  notesById,
  onTrace,
  onToggle,
  onOpenAccount,
  onEdit,
}: {
  task: Task;
  accountName?: string;
  /** When given, agent-made and cited tasks show what grounds them. */
  notesById?: Map<string, Note>;
  /** Opens the evidence trace for this task. */
  onTrace?: (id: string) => void;
  onToggle: () => void;
  onOpenAccount?: () => void;
  onEdit?: () => void;
}) {
  const done = task.status === "done";
  const shareSafe = useShareSafe();
  const showGrounding = notesById && !done && !shareSafe && (task.origin || task.evidence?.length || task.reason);
  return (
    <div className="group flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors duration-fast hover:bg-secondary/70">
      <button
        onClick={onToggle}
        aria-pressed={done}
        aria-label={done || task.status === "cancelled" ? "Reopen task" : "Mark done"}
        className={cn(
          "mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-[background-color,border-color,transform] duration-fast focus-visible:outline-none focus-visible:focus-ring active:scale-90",
          done ? "border-transparent bg-success text-success-foreground" : "border-border-strong bg-surface hover:border-success",
        )}
      >
        {done && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <div key={String(done)} className="text-body leading-5 text-foreground">
          <StrikeLabel done={done}>{task.title}</StrikeLabel>
        </div>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 text-label font-normal">
          <DueText task={task} done={done} />
          {accountName && (
            <>
              <span className="text-faint-foreground" aria-hidden>·</span>
              {onOpenAccount ? (
                <button onClick={onOpenAccount} className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:focus-ring">
                  {accountName}
                </button>
              ) : (
                <span className="text-muted-foreground">{accountName}</span>
              )}
            </>
          )}
          {task.owner && (
            <>
              <span className="text-faint-foreground" aria-hidden>·</span>
              <span className="text-faint-foreground">{task.owner}</span>
            </>
          )}
        </div>
        {showGrounding && <SourceLine task={task} notesById={notesById} onTrace={onTrace} />}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!shareSafe && onEdit && (
          <button
            className="rounded-md px-1.5 py-0.5 text-label text-muted-foreground transition-opacity duration-fast hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:focus-ring [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:focus-visible:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100"
            onClick={onEdit}
            aria-label={`Edit task: ${task.title}`}
          >
            Edit
          </button>
        )}
        {!done && <PriorityMark priority={task.priority} />}
      </div>
    </div>
  );
}
