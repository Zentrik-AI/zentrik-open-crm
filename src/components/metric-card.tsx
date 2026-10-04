import { type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";
import { type Tone } from "../lib/meta";
import { Card } from "./ui/card";

/**
 * A metric tile: a sentence-case label, one tabular number, an optional delta
 * and viz. The icon stays neutral; `tone` is kept for callers but colour is
 * reserved for the delta, which describes an outcome.
 */
export function MetricCard({
  label,
  value,
  icon: Icon,
  tone: _tone = "signal",
  delta,
  viz,
  className,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  delta?: { dir: "up" | "down"; label: string; good?: boolean };
  viz?: ReactNode;
  className?: string;
}) {
  const good = delta ? (delta.good ?? delta.dir === "up") : false;
  const Arrow = delta?.dir === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-body-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 shrink-0 text-faint-foreground" aria-hidden />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="tnum text-stat-xl leading-none text-foreground">{value}</span>
        {delta && (
          <span className={cn("tnum inline-flex items-center gap-0.5 text-label", good ? "text-success-fg" : "text-destructive-fg")}>
            <Arrow className="h-3 w-3" aria-hidden />
            {delta.label}
          </span>
        )}
      </div>
      {viz && <div className="mt-3 flex min-h-[24px] items-end">{viz}</div>}
    </Card>
  );
}
