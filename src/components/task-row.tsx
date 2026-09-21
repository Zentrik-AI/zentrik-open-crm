import { type ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "../lib/utils";
import type { Note, Task } from "../types";
import { PriorityBadge } from "./ui/segment-bar";
import { DueChip } from "./account-bits";
import { useMounted, useReducedMotion } from "../lib/hooks";
import { Grounding } from "./grounding";
import { useBuildroom } from "./ui/privacy";

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
          className="pointer-events-none absolute left-0 top-1/2 h-[2px] origin-left bg-success"
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

export function TaskRow({
  task,
  accountName,
  notesById,
  onToggle,
  onOpenAccount,
}: {
  task: Task;
  accountName?: string;
  /** When given, agent-made and cited tasks show what grounds them. */
  notesById?: Map<string, Note>;
  onToggle: () => void;
  onOpenAccount?: () => void;
}) {
  const done = task.status === "done";
  const buildroom = useBuildroom();
  const showGrounding = notesById && !done && !buildroom && (task.origin || task.evidence?.length || task.reason);
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3 transition-colors duration-fast hover:border-border-strong">
      <button
        onClick={onToggle}
        aria-pressed={done}
        aria-label={done ? "Mark not done" : "Mark done"}
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-[background-color,border-color,transform] duration-fast focus-visible:outline-none focus-visible:focus-ring active:scale-90",
          done ? "border-transparent bg-success text-success-foreground" : "border-border-strong bg-surface hover:border-success",
        )}
      >
        {done && <Check className="h-3 w-3" />}
      </button>
      <div className="min-w-0 flex-1">
        <div key={String(done)} className="text-body text-foreground">
          <StrikeLabel done={done}>{task.title}</StrikeLabel>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <DueChip due={task.due} done={done} />
          {accountName &&
            (onOpenAccount ? (
              <button onClick={onOpenAccount} className="rounded-sm text-[12px] text-muted-foreground hover:text-accent-fg focus-visible:outline-none focus-visible:focus-ring">
                {accountName}
              </button>
            ) : (
              <span className="text-[12px] text-muted-foreground">{accountName}</span>
            ))}
          <span className="text-[12px] text-faint-foreground">{task.owner}</span>
        </div>
        {showGrounding && (
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            {task.origin && <span className="text-[12px] text-agent-fg">{task.origin.name}</span>}
            {task.reason && <span className="text-[12px] text-muted-foreground">{task.reason}</span>}
            <Grounding evidence={task.evidence} notesById={notesById} />
          </div>
        )}
      </div>
      <PriorityBadge priority={task.priority} />
    </div>
  );
}
