import { cn, clampPct } from "../../lib/utils";
import { thresholdTone, type Tone } from "../../lib/meta";
import { toneSolid } from "../../lib/tone";
import { useCountUp, useMounted, useReducedMotion } from "../../lib/hooks";

const dims = {
  xs: { box: 24, stroke: 3, font: "text-[9px]" },
  sm: { box: 36, stroke: 3.5, font: "text-[11px]" },
  md: { box: 44, stroke: 4, font: "text-[13px]" },
  lg: { box: 64, stroke: 5, font: "text-[17px]" },
} as const;

/**
 * A donut dial for a 0–100 value. The arc fills on mount, the number counts up
 * in tabular mono, and the color crosses thresholds. `pending` dashes the track
 * to say "evidence pending". The literal number always stays centered.
 */
export function Ring({
  value,
  size = "md",
  tone,
  pending = false,
  showValue = true,
  suffix = "",
  label,
  className,
}: {
  value: number;
  size?: keyof typeof dims;
  tone?: Tone;
  pending?: boolean;
  showValue?: boolean;
  suffix?: string;
  label?: string;
  className?: string;
}) {
  const pct = clampPct(value);
  const t = tone ?? thresholdTone(pct);
  const { box, stroke, font } = dims[size];
  const r = (box - stroke) / 2;
  const c = 2 * Math.PI * r;
  const reduced = useReducedMotion();
  const mounted = useMounted();
  const display = useCountUp(pct, showValue, 600);
  const shown = reduced || mounted ? pct : 0;
  const offset = c * (1 - shown / 100);

  return (
    <span
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: box, height: box }}
      role="img"
      aria-label={`${label ? `${label}: ` : ""}${pct}${suffix || "%"}`}
    >
      <svg width={box} height={box} className="-rotate-90">
        <circle
          cx={box / 2}
          cy={box / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={stroke}
          strokeDasharray={pending ? "2 3" : undefined}
        />
        <circle
          cx={box / 2}
          cy={box / 2}
          r={r}
          fill="none"
          stroke={toneSolid[t]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{
            transition: reduced ? undefined : "stroke-dashoffset var(--d-base) var(--ease-out)",
          }}
        />
      </svg>
      {showValue && (
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center font-mono font-medium tabular-nums",
            font,
          )}
        >
          {display}
          {suffix && <span className="ml-px text-[0.7em] text-muted-foreground">{suffix}</span>}
        </span>
      )}
    </span>
  );
}
