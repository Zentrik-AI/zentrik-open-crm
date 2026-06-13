import { type ReactNode } from "react";
import { cn } from "../../lib/utils";

/** The signature motif: a half-drawn loop terminated by the grounding tick. */
function LoopMotif({ className }: { className?: string }) {
  return (
    <svg
      width="56"
      height="40"
      viewBox="0 0 56 40"
      fill="none"
      className={cn("text-accent", className)}
      aria-hidden
    >
      <path
        d="M4 28 C 4 10, 24 4, 32 16 C 38 25, 26 34, 20 28 C 16 24, 22 18, 28 22 L 44 32"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.55"
        strokeDasharray="2 5"
      />
      <path d="M44 32 L 52 32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M52 32 L 52 25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyState({
  title,
  hint,
  action,
  className,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center",
        className,
      )}
    >
      <LoopMotif />
      <div className="max-w-sm">
        <div className="font-serif text-h2 text-foreground">{title}</div>
        {hint && <p className="mt-1.5 text-body-sm text-muted-foreground">{hint}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
