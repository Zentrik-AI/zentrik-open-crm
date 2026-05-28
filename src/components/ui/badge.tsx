import * as React from "react";
import { cn } from "../../lib/utils";

type BadgeTone =
  | "default"
  | "muted"
  | "success"
  | "warning"
  | "destructive"
  | "signal"
  | "account"
  | "agent"
  | "idea";

const tones: Record<BadgeTone, string> = {
  default: "border-border bg-secondary text-secondary-foreground",
  muted: "border-border bg-muted text-muted-foreground",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  destructive: "border-destructive/30 bg-destructive/10 text-destructive",
  signal: "border-signal/30 bg-signal/10 text-signal",
  account: "border-account/30 bg-account/10 text-account",
  agent: "border-agent/30 bg-agent/10 text-agent",
  idea: "border-idea/30 bg-idea/10 text-idea",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ className, tone = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
