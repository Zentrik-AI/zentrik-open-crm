import { cn, formatDateFull, formatRelative } from "../lib/utils";
import { sourceMeta } from "../lib/meta";
import type { Note } from "../types";
import { Badge } from "./ui/badge";
import { SentimentMark } from "./ui/dot";
import { Tooltip } from "./ui/tooltip";
import { RedactedChip, useBuildroom } from "./ui/privacy";

/** A single source-grounded note / touchpoint. */
export function NoteCard({
  note,
  accountName,
  dealName,
  className,
}: {
  note: Note;
  accountName?: string;
  dealName?: string;
  className?: string;
}) {
  const source = sourceMeta[note.source];
  const buildroom = useBuildroom();

  return (
    <article
      className={cn(
        "rounded-lg border border-border bg-surface p-3.5 transition-colors duration-fast hover:border-border-strong",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <Tooltip
          content={
            <span className="font-mono text-[11px]">
              {note.sourceRef ? `${note.sourceRef} · ` : ""}
              {formatDateFull(note.createdAt)}
            </span>
          }
        >
          <Badge tone="signal" icon={source.icon}>
            {source.label}
          </Badge>
        </Tooltip>
        <SentimentMark sentiment={note.sentiment} />
        {dealName && <Badge tone="account">{dealName}</Badge>}
        <span className="ml-auto flex items-center gap-1.5 text-[12px] text-faint-foreground">
          {accountName && <span className="truncate">{accountName}</span>}
          {accountName && <span aria-hidden>·</span>}
          <time dateTime={note.createdAt} title={formatDateFull(note.createdAt)} className="font-mono tabular-nums">
            Captured {formatRelative(note.createdAt)}
          </time>
        </span>
      </div>

      {buildroom ? (
        <div className="mt-2.5">
          <RedactedChip label="note hidden in share-safe view" />
        </div>
      ) : (
        <>
          <h3 className="mt-2.5 text-h3 text-foreground">{note.title}</h3>
          <p className="mt-1.5 whitespace-pre-line text-body text-muted-foreground">{note.body}</p>
          <p className="mt-2 text-[12px] text-muted-foreground">Source date: {note.occurredAt ? formatDateFull(note.occurredAt) : "unknown"} · {note.interaction ? "Verified interaction" : "Not verified contact"}</p>
        </>
      )}
    </article>
  );
}
