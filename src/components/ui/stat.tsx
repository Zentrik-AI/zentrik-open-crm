import { type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "../../lib/utils";

/** Label eyebrow + mono value + optional delta chip. The atom of every metric. */
export function Stat({
  label,
  value,
  size = "md",
  delta,
  children,
  className,
}: {
  label: string;
  value: ReactNode;
  size?: "md" | "xl";
  delta?: { dir: "up" | "down"; label: string; good?: boolean };
  children?: ReactNode;
  className?: string;
}) {
  const good = delta ? (delta.good ?? delta.dir === "up") : false;
  const Arrow = delta?.dir === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-label uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={cn("font-mono font-medium tabular-nums text-foreground", size === "xl" ? "text-stat-xl" : "text-stat")}>
          {value}
        </span>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-mono text-[11px] tabular-nums",
              good ? "text-success" : "text-destructive",
            )}
          >
            <Arrow className="h-3 w-3" aria-hidden />
            {delta.label}
          </span>
        )}
      </div>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
