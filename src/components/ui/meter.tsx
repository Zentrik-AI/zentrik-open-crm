import { cn, clampPct } from "../../lib/utils";
import { thresholdTone, type Tone } from "../../lib/meta";
import { toneSolidBg } from "../../lib/tone";
import { useMounted, useReducedMotion } from "../../lib/hooks";

/**
 * A horizontal bar for a 0–100 value. Grows from the left on mount; weak
 * evidence (<40, or `weak`) renders a hatched fill so it reads as a different
 * KIND, not merely shorter. The mono value is kept adjacent via `display`.
 */
export function Meter({
  value,
  tone,
  ticks = true,
  weak,
  target,
  display,
  label,
  className,
  barClassName,
}: {
  value: number;
  tone?: Tone;
  ticks?: boolean;
  weak?: boolean;
  target?: number;
  display?: string;
  label?: string;
  className?: string;
  barClassName?: string;
}) {
  const pct = clampPct(value);
  const t = tone ?? thresholdTone(pct);
  const isWeak = weak ?? pct < 40;
  const reduced = useReducedMotion();
  const mounted = useMounted();
  const shown = reduced || mounted ? pct : 0;

  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span
        className={cn("relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken", barClassName)}
        role="progressbar"
        aria-label={label}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {ticks &&
          [25, 50, 75].map((tick) => (
            <span
              key={tick}
              className="absolute top-0 h-full w-px bg-border"
              style={{ left: `${tick}%` }}
              aria-hidden
            />
          ))}
        <span
          className={cn(
            "absolute left-0 top-0 h-full rounded-full",
            isWeak ? "hatch-weak bg-warning/30" : toneSolidBg[t],
          )}
          style={{
            width: `${shown}%`,
            transition: reduced ? undefined : "width var(--d-base) var(--ease-out)",
          }}
          aria-hidden
        />
        {target != null && (
          <span
            className="absolute top-[-2px] h-[10px] w-0.5 rounded-full bg-foreground/40"
            style={{ left: `calc(${clampPct(target)}% - 1px)` }}
            aria-hidden
          />
        )}
      </span>
      {display != null && (
        <span className="shrink-0 font-mono text-[12px] font-medium tabular-nums text-foreground">
          {display}
        </span>
      )}
    </span>
  );
}
