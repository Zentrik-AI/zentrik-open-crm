import { cn } from "../../lib/utils";
import { levelOf, priorityMeta, type Tone } from "../../lib/meta";
import { toneSolidBg, toneText } from "../../lib/tone";
import type { Priority } from "../../types";

/** N segments, first `level` filled with tone — survives grayscale (count carries meaning). */
export function SegmentBar({
  level,
  max = 4,
  tone,
  className,
}: {
  level: number;
  max?: number;
  tone: Tone;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-hidden>
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-2.5 w-1 rounded-[1px]",
            i < level ? toneSolidBg[tone] : "bg-border-strong/50",
          )}
        />
      ))}
    </span>
  );
}

/** Priority as a fill-level chip: mini-bar (low=1 → urgent=4) + label. */
export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const meta = priorityMeta[priority];
  const level = levelOf[priority];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border border-border bg-surface px-1.5 py-0.5 text-label",
        toneText[meta.tone],
        className,
      )}
      aria-label={`Priority: ${meta.label}`}
    >
      <SegmentBar level={level} tone={meta.tone} />
      {meta.label}
    </span>
  );
}
