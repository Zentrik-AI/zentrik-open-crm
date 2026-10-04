import { Clock } from "lucide-react";
import { cn, formatDateFull, formatRelative, splitCurrency } from "../lib/utils";
import { influenceMeta, stageMeta, stageRail, type Tone } from "../lib/meta";
import { toneSolidBg } from "../lib/tone";
import type { Account, Contact } from "../types";
import { Badge } from "./ui/badge";
import { Monogram } from "./ui/monogram";
import { Private, useShareSafe } from "./ui/privacy";

/** Stage colour carries meaning only: growth is green, risk is red, the rest stays neutral. */
export function stageTone(stage: Account["stage"]): Tone {
  return stage === "at_risk" ? "destructive" : stage === "expanding" ? "success" : "neutral";
}

/** Abbreviated currency with a demoted unit; redacted in share-safe mode. */
export function ArrValue({ value, className }: { value: number; className?: string }) {
  const { lead, unit } = splitCurrency(value);
  return (
    <Private redactedLabel="hidden">
      <span className={cn("tnum font-medium text-foreground", className)}>
        {lead}
        {unit && <span className="text-muted-foreground">{unit}</span>}
      </span>
    </Private>
  );
}

/** Plain abbreviated currency (deal values etc. — not privacy-sensitive here). */
export function Money({ value, className }: { value: number; className?: string }) {
  const { lead, unit } = splitCurrency(value);
  return (
    <span className={cn("tnum font-medium text-foreground", className)}>
      {lead}
      {unit && <span className="text-muted-foreground">{unit}</span>}
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
  const tone = stageTone(account.stage);
  return (
    <button
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "group w-full rounded-lg border px-3 py-2.5 text-left transition-[background-color,border-color,box-shadow] duration-fast ease-out focus-visible:outline-none focus-visible:focus-ring",
        selected
          ? "border-accent/60 bg-card shadow-e2 ring-1 ring-accent/25"
          : "border-transparent hover:bg-secondary",
      )}
    >
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-h3 text-foreground">{account.name}</span>
        <ArrValue value={account.arr} className="shrink-0 text-body-sm" />
      </div>
      <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-body-sm text-muted-foreground">
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", tone === "neutral" ? "bg-border-strong" : toneSolidBg[tone])} aria-hidden />
        <span className="truncate">
          {stageMeta[account.stage].label} · {account.owner}
        </span>
      </div>
    </button>
  );
}

/** A slim 4-step progression; at_risk reads as an off-track danger state. */
export function StageRail({ stage }: { stage: Account["stage"] }) {
  const atRisk = stage === "at_risk";
  const currentIndex = atRisk ? null : stageMeta[stage].railIndex ?? 0;

  return (
    <ol className="grid grid-cols-4 gap-1.5" aria-label={`Stage: ${stageMeta[stage].label}`}>
      {stageRail.map((s, i) => {
        const reached = currentIndex != null && i <= currentIndex;
        const current = currentIndex === i;
        return (
          <li key={s} className="min-w-0" aria-current={current ? "step" : undefined}>
            <span
              className={cn(
                "block h-1 rounded-full transition-colors duration-base",
                atRisk ? "bg-destructive/35" : current ? "bg-foreground" : reached ? "bg-foreground/35" : "bg-border",
              )}
              aria-hidden
            />
            <span
              className={cn(
                "mt-1.5 block truncate text-label",
                current ? "text-foreground" : "text-faint-foreground",
              )}
            >
              {stageMeta[s].label}
            </span>
          </li>
        );
      })}
    </ol>
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
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-label text-faint-foreground">{title}</span>
        <span className="tnum text-label text-faint-foreground">{items.length}</span>
      </div>
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 py-2 text-body">
            <span className={cn("mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full", toneSolidBg[tone])} aria-hidden />
            <p className="text-foreground">
              <span className={grounded ? "ground" : "ground-dashed"}>{item}</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ContactRow({ contact }: { contact: Contact }) {
  const meta = influenceMeta[contact.influence];
  const shareSafe = useShareSafe();
  return (
    <div className="flex min-w-0 max-w-full items-center gap-3 py-2">
      <Monogram name={contact.name} tone="neutral" redacted={shareSafe} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-body font-medium text-foreground">
          <Private redactedLabel="name hidden">{contact.name}</Private>
        </div>
        <div className="mt-0.5 truncate text-label text-muted-foreground">
          {contact.role} · {contact.lastSeen ? "last contact " : ""}
          <time dateTime={contact.lastSeen ?? undefined} title={contact.lastSeen ? formatDateFull(contact.lastSeen) : "No verified contact date"} className="tnum">
            {contact.lastSeen ? formatRelative(contact.lastSeen) : "Contact date unknown"}
          </time>
        </div>
      </div>
      <Badge tone="neutral">
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
    <span className={cn("inline-flex items-center gap-1 text-label font-normal", tone)}>
      <Clock className="h-3 w-3" aria-hidden />
      <span className="tnum" title={formatDateFull(due)}>
        {overdue ? `overdue ${formatRelative(due)}` : `due ${formatRelative(due)}`}
      </span>
    </span>
  );
}
