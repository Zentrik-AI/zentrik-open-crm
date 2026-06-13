import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { type Tone } from "../../lib/meta";
import { toneChip, toneSolidBg } from "../../lib/tone";
import { LiveDot } from "./dot";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  /** A leading status dot in the tone color. */
  dot?: boolean;
  /** Animate the dot (running / live). Implies `dot`. */
  live?: boolean;
  /** A leading lucide glyph (e.g. signal source). */
  icon?: LucideIcon;
  /** Ghost variant: transparent with a strong border (e.g. "Buildroom-safe"). */
  ghost?: boolean;
}

export function Badge({
  className,
  tone = "neutral",
  dot,
  live,
  icon: Icon,
  ghost,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-label font-medium",
        ghost ? "border border-border-strong bg-transparent text-muted-foreground" : toneChip[tone],
        className,
      )}
      {...props}
    >
      {live ? (
        <LiveDot tone={tone} />
      ) : dot ? (
        <span className={cn("h-1.5 w-1.5 rounded-full", toneSolidBg[tone])} aria-hidden />
      ) : null}
      {Icon && <Icon className="h-3 w-3" aria-hidden />}
      {children}
    </span>
  );
}
