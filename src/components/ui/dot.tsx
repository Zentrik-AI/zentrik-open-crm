import { cn } from "../../lib/utils";
import { sentimentMeta, type Tone } from "../../lib/meta";
import type { Sentiment } from "../../types";

const toneText: Record<Tone, string> = {
  neutral: "text-muted-foreground",
  accent: "text-accent-fg",
  signal: "text-signal-fg",
  account: "text-account-fg",
  agent: "text-agent-fg",
  highlight: "text-highlight-fg",
  success: "text-success-fg",
  warning: "text-warning-fg",
  destructive: "text-destructive-fg",
};

const toneBg: Record<Tone, string> = {
  neutral: "bg-muted-foreground",
  accent: "bg-accent",
  signal: "bg-signal",
  account: "bg-account",
  agent: "bg-agent",
  highlight: "bg-highlight",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
};

/** A live/running indicator: a soft-pulsing dot with a static ring fallback. */
export function LiveDot({ tone = "agent", className }: { tone?: Tone; className?: string }) {
  return (
    <span className={cn("relative inline-flex h-2 w-2", className)} aria-hidden>
      <span className={cn("absolute inset-0 rounded-full opacity-60 animate-pulse-soft", toneBg[tone])} />
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", toneBg[tone])} />
    </span>
  );
}

/** Sentiment as dot + glyph + (optional) label. Never color-alone. */
export function SentimentMark({
  sentiment,
  withLabel = true,
  className,
}: {
  sentiment: Sentiment;
  withLabel?: boolean;
  className?: string;
}) {
  const meta = sentimentMeta[sentiment];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-body-sm", toneText[meta.tone], className)}>
      <span aria-hidden className="text-[10px] leading-none">
        {meta.glyph}
      </span>
      {withLabel && <span>{meta.label}</span>}
    </span>
  );
}

/** Freshness as a peripheral dot: vivid signal when new, fading to muted as it ages. */
export function FreshnessDot({ value, className }: { value: number; className?: string }) {
  const tone: Tone = value > 0.6 ? "signal" : value > 0.25 ? "account" : "neutral";
  const opacity = 0.35 + value * 0.65;
  return (
    <span
      className={cn("inline-block h-1.5 w-1.5 rounded-full", toneBg[tone], className)}
      style={{ opacity }}
      aria-hidden
    />
  );
}
