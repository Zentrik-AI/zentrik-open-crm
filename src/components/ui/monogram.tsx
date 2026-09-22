import { EyeOff } from "lucide-react";
import { cn, initials } from "../../lib/utils";
import type { Tone } from "../../lib/meta";

const ringColor: Record<Tone, string> = {
  neutral: "hsl(var(--border-strong))",
  accent: "hsl(var(--accent))",
  signal: "hsl(var(--signal))",
  account: "hsl(var(--account))",
  agent: "hsl(var(--agent))",
  highlight: "hsl(var(--highlight))",
  success: "hsl(var(--success))",
  warning: "hsl(var(--warning))",
  destructive: "hsl(var(--destructive))",
};

const sizes = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-9 w-9 text-[13px]",
} as const;

/** Initials avatar with an optional influence ring (1.5px colored outer stroke). */
export function Monogram({
  name,
  tone,
  size = "md",
  redacted = false,
  className,
}: {
  name: string;
  tone?: Tone;
  size?: keyof typeof sizes;
  /** In share-safe mode the initials must not be computed or painted. */
  redacted?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-sans font-medium",
        redacted ? "hatch-redact bg-surface-sunken text-muted-foreground" : "bg-account-bg text-account-fg",
        sizes[size],
        className,
      )}
      style={
        tone
          ? { boxShadow: `0 0 0 1.5px hsl(var(--surface)), 0 0 0 3px ${ringColor[tone]}` }
          : undefined
      }
      aria-hidden
    >
      {redacted ? <EyeOff className="h-3.5 w-3.5 opacity-70" /> : initials(name)}
    </span>
  );
}
