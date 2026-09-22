import { Clock } from "lucide-react";
import { cn, formatDateFull, formatRelative, splitCurrency } from "../lib/utils";
import { influenceMeta, stageMeta, stageRail, type Tone } from "../lib/meta";
import { toneSolidBg, toneText } from "../lib/tone";
import type { Account, Contact } from "../types";
import { Badge } from "./ui/badge";
import { Ring } from "./ui/ring";
import { Meter } from "./ui/meter";
import { Monogram } from "./ui/monogram";
import { PriorityBadge } from "./ui/segment-bar";
import { Private, useShareSafe } from "./ui/privacy";

/** Abbreviated currency with a demoted unit; redacted in share-safe mode. */
export function ArrValue({ value, className }: { value: number; className?: string }) {
  const { lead, unit } = splitCurrency(value);
  return (
    <Private redactedLabel="hidden">
      <span className={cn("font-mono font-medium tabular-nums text-foreground", className)}>
        {lead}
        {unit && <span className="text-[0.72em] text-muted-foreground">{unit}</span>}
      </span>
    </Private>
  );
}

/** Plain abbreviated currency (deal values etc. — not privacy-sensitive here). */
export function Money({ value, className }: { value: number; className?: string }) {
  const { lead, unit } = splitCurrency(value);
  return (
    <span className={cn("font-mono font-medium tabular-nums text-foreground", className)}>
      {lead}
      {unit && <span className="text-[0.72em] text-muted-foreground">{unit}</span>}
    </span>
  );
}

/** Master list prioritizes recognition; the selected account owns detailed metrics. */
export function AccountListCard({
  account,
  selected,
  onSelect,
}: {
  account: Account;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "w-full rounded-lg border bg-card p-3.5 text-left transition-[border-color,box-shadow,transform] duration-fast ease-out focus-visible:outline-none focus-visible:focus-ring",
        selected
          ? "border-border-strong [box-shadow:inset_2px_0_0_hsl(var(--accent)),var(--e-1)]"
          : "border-border hover:-translate-y-px hover:border-border-strong hover:shadow-e1",
      )}
    >
      <div className="min-w-0">
        <div className="break-words text-body font-medium text-foreground">{account.name}</div>
        <div className="mt-1 text-body-sm text-muted-foreground">{account.segment}</div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-body-sm text-faint-foreground">
          <span>{stageMeta[account.stage].label} · {account.owner}</span>
          <ArrValue value={account.arr} className="text-[12px]" />
        </div>
      </div>
    </button>
  );
}

/** A 4-step progression rail; at_risk reads as an off-track danger state. */
export function StageRail({ stage }: { stage: Account["stage"] }) {
  const atRisk = stage === "at_risk";
  const currentIndex = atRisk ? null : stageMeta[stage].railIndex ?? 0;

  return (
    <div className="flex items-center gap-1.5">
      {stageRail.map((s, i) => {
        const done = currentIndex != null && i < currentIndex;
        const current = currentIndex === i;
        const tone: Tone = current ? stageMeta[s].tone : "neutral";
        return (
          <div key={s} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full items-center">
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  current ? toneSolidBg[tone] : done ? "bg-accent" : atRisk ? "bg-destructive/30" : "bg-border-strong",
                )}
              />
              {i < stageRail.length - 1 && <span className={cn("h-px flex-1", done ? "bg-accent" : "bg-border")} />}
            </div>
            <span className={cn("w-full text-center text-[10px] leading-tight", current ? toneText[tone] : "text-faint-foreground")}>
              {stageMeta[s].label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Needs / Risks as facing claim lists. */
export function InfoList({
  title,
  items,
  tone,
  grounded,
}: {
  title: string;
  items: string[];
  tone: Tone;
  grounded: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-label uppercase text-muted-foreground">{title}</span>
        <span className="font-mono text-[11px] tabular-nums text-faint-foreground">{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item}
            className={cn(
              "flex gap-2.5 rounded-md p-3 text-body",
              grounded
                ? "border border-border bg-surface shadow-e1 dark:bg-surface-raised"
                : "border border-dashed border-border bg-transparent",
            )}
          >
            <span className={cn("mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full", toneSolidBg[tone])} />
            <p className="text-muted-foreground">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ContactRow({ contact }: { contact: Contact }) {
  const meta = influenceMeta[contact.influence];
  const shareSafe = useShareSafe();
  return (
    <div className="flex min-w-0 max-w-full items-center gap-3 rounded-md border border-border bg-surface p-3">
      <Monogram name={contact.name} tone={meta.tone} redacted={shareSafe} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-body font-medium text-foreground">
          <Private redactedLabel="name hidden">{contact.name}</Private>
        </div>
        <div className="mt-0.5 truncate text-[12px] text-muted-foreground">
          {contact.role} · {contact.lastSeen ? "last contact " : ""}
          <time dateTime={contact.lastSeen ?? undefined} title={contact.lastSeen ? formatDateFull(contact.lastSeen) : "No verified contact date"} className="font-mono tabular-nums">
            {contact.lastSeen ? formatRelative(contact.lastSeen) : "Contact date unknown"}
          </time>
        </div>
      </div>
      <Badge tone={meta.tone} dot>
        {meta.label}
      </Badge>
    </div>
  );
}

/** Due chip: relative time, tinted by urgency (overdue = destructive). */
export function DueChip({ due, done }: { due: string; done?: boolean }) {
  const overdue = !done && new Date(due).getTime() < Date.now();
  const soon = !done && !overdue && new Date(due).getTime() - Date.now() < 2 * 24 * 60 * 60 * 1000;
  const tone = done ? "text-faint-foreground" : overdue ? "text-destructive-fg" : soon ? "text-warning-fg" : "text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1 text-[12px]", tone)}>
      <Clock className="h-3 w-3" aria-hidden />
      <span className="font-mono tabular-nums" title={formatDateFull(due)}>
        {overdue ? `overdue ${formatRelative(due)}` : `due ${formatRelative(due)}`}
      </span>
    </span>
  );
}
