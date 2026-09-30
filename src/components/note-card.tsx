import { CircleCheck } from "lucide-react";
import { cn, formatDateFull, formatRelative } from "../lib/utils";
import { sourceMeta } from "../lib/meta";
import type { Note } from "../types";
import { Badge } from "./ui/badge";
import { SentimentMark } from "./ui/dot";
import { Tooltip } from "./ui/tooltip";
import { RedactedChip, useShareSafe } from "./ui/privacy";

const shortDate = (value: string) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));

/** A single source-grounded note / touchpoint. */
export function NoteCard({
  note,
  accountName,
  dealName,
  className,
  grounds,
  onTrace,
}: {
  note: Note;
  accountName?: string;
  dealName?: string;
  className?: string;
  /** How many claims and tasks cite this note. */
  grounds?: number;
  onTrace?: (id: string) => void;
}) {
  const source = sourceMeta[note.source];
  const shareSafe = useShareSafe();

  return (
    <article
      className={cn(
        "rounded-xl border border-border bg-card p-4 transition-colors duration-fast hover:border-border-strong",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Tooltip
          content={
            <span className="block space-y-0.5">
              {note.sourceRef && <span className="block font-mono text-label">{note.sourceRef}</span>}
              <span className="block tnum text-muted-foreground">Captured {formatDateFull(note.createdAt)}</span>
              {!note.occurredAt && <span className="block text-muted-foreground">Source date unknown</span>}
              {!note.interaction && <span className="block text-muted-foreground">Not a verified interaction</span>}
            </span>
          }
        >
          <Badge icon={source.icon}>{source.label}</Badge>
        </Tooltip>
        {note.sentiment !== "neutral" && <SentimentMark sentiment={note.sentiment} className="text-label" />}
        {dealName && <Badge tone="account" className="min-w-0 truncate">{dealName}</Badge>}
        <time
          dateTime={note.createdAt}
          title={formatDateFull(note.createdAt)}
          className="ml-auto shrink-0 tnum text-label text-faint-foreground"
        >
          {formatRelative(note.createdAt)}
        </time>
      </div>

      {shareSafe ? (
        <div className="mt-3">
          <RedactedChip label="note hidden in share-safe view" />
        </div>
      ) : (
        <>
          <h3 className="mt-2.5 text-h3 text-foreground [overflow-wrap:anywhere]">{note.title}</h3>
          <p className="mt-1 line-clamp-3 whitespace-pre-line text-body-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
            {note.body}
          </p>
          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-label text-faint-foreground">
            {accountName && <span className="min-w-0 truncate text-muted-foreground">{accountName}</span>}
            {note.occurredAt && (
              <>
                {accountName && <span aria-hidden>·</span>}
                <span className="tnum">{shortDate(note.occurredAt)}</span>
              </>
            )}
            {note.interaction && (
              <>
                {(accountName || note.occurredAt) && <span aria-hidden>·</span>}
                <span className="inline-flex items-center gap-1 text-success-fg">
                  <CircleCheck className="h-3 w-3" aria-hidden />
                  Verified interaction
                </span>
              </>
            )}
            {onTrace && grounds !== undefined && (
              <button
                onClick={() => onTrace(note.id)}
                className={cn(
                  "ml-auto rounded-sm border-b pb-px transition-colors focus-visible:outline-none focus-visible:focus-ring",
                  grounds > 0
                    ? "border-accent/60 text-accent-fg hover:border-accent"
                    : "border-dashed border-border-strong text-faint-foreground hover:text-foreground",
                )}
              >
                <span className="tnum">
                  {grounds > 0 ? `grounds ${grounds} ${grounds === 1 ? "record" : "records"}` : "grounds nothing yet"}
                </span>
              </button>
            )}
          </div>
        </>
      )}
    </article>
  );
}
