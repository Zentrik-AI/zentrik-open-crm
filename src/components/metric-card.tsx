import { type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";
import { type Tone } from "../lib/meta";
import { Card } from "./ui/card";
import { Stat } from "./ui/stat";

/** A Today metric: label + big mono value + a tone-framed icon, with optional viz. */
export function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "signal",
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
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <Stat label={label} value={value} size="xl" delta={delta} />
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center text-faint-foreground"
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
      </div>
      {viz && <div className="mt-3 flex min-h-[24px] items-end">{viz}</div>}
    </Card>
  );
}
