import type { Tone } from "./meta";

/** The CSS color for a tone's solid stop — for inline SVG stroke/fill. */
export const toneSolid: Record<Tone, string> = {
  neutral: "hsl(var(--muted-foreground))",
  accent: "hsl(var(--accent))",
  signal: "hsl(var(--signal))",
  account: "hsl(var(--account))",
  agent: "hsl(var(--agent))",
  highlight: "hsl(var(--highlight))",
  success: "hsl(var(--success))",
  warning: "hsl(var(--warning))",
  destructive: "hsl(var(--destructive))",
};

/** Tint background + on-tint text — the badge/chip surface for a tone. */
export const toneChip: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  accent: "bg-accent-bg text-accent-fg",
  signal: "bg-signal-bg text-signal-fg",
  account: "bg-account-bg text-account-fg",
  agent: "bg-agent-bg text-agent-fg",
  highlight: "bg-highlight-bg text-highlight-fg",
  success: "bg-success-bg text-success-fg",
  warning: "bg-warning-bg text-warning-fg",
  destructive: "bg-destructive-bg text-destructive-fg",
};

export const toneSolidBg: Record<Tone, string> = {
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

/** Text tones use the darker `-fg` stops so small labels pass AA on the surface. */
export const toneText: Record<Tone, string> = {
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
