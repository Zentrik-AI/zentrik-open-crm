import { CircleDashed, Quote } from "lucide-react";
import type { Note } from "../types";
import { cn } from "../lib/utils";
import { Tooltip } from "./ui/tooltip";

/**
 * The source reference under a fact: a quiet line naming the note behind it, or
 * saying it is a hunch. The fact itself carries the grounding underline. Hovering
 * names the notes; with `onClick`, clicking opens the full trace.
 */
export function Grounding({
  evidence,
  notesById,
  className,
  onClick,
}: {
  evidence?: string[];
  notesById: Map<string, Note>;
  className?: string;
  onClick?: () => void;
}) {
  const notes = (evidence ?? []).map((id) => notesById.get(id)).filter((note): note is Note => Boolean(note));
  const Tag = onClick ? "button" : "span";
  const shared = cn(
    "inline-flex min-w-0 max-w-full items-center gap-1.5 text-label font-normal text-muted-foreground",
    onClick && "rounded-sm text-left transition-colors duration-fast hover:text-foreground focus-visible:outline-none focus-visible:focus-ring",
    className,
  );
  if (notes.length === 0) {
    return (
      <Tag type={onClick ? "button" : undefined} onClick={onClick} className={cn(shared, "text-faint-foreground")}>
        <CircleDashed className="h-3 w-3 shrink-0" aria-hidden />
        Hunch · no source
      </Tag>
    );
  }
  const cited = notes.length === 1 ? `“${notes[0].title}”` : `${notes.length} notes`;
  return (
    <Tooltip
      className="min-w-0 max-w-full"
      content={
        <span className="block max-w-xs space-y-0.5 text-label font-normal">
          {notes.map((note) => (
            <span key={note.id} className="block">
              {note.title} <span className="text-faint-foreground">· {note.sourceRef || "no reference"}</span>
            </span>
          ))}
          {onClick && <span className="block pt-1 text-faint-foreground">Open the trace</span>}
        </span>
      }
    >
      <Tag
        type={onClick ? "button" : undefined}
        onClick={onClick}
        aria-label={onClick ? `grounded in ${cited}` : undefined}
        className={cn(shared, onClick && "hover:text-accent-fg")}
      >
        <Quote className="h-3 w-3 shrink-0 text-accent" aria-hidden />
        <span className="truncate">
          <span className="sr-only">grounded in {notes.length === 1 ? "“" : ""}</span>
          {notes.length === 1 ? notes[0].title : `${notes.length} notes`}
          {notes.length === 1 && <span className="sr-only">”</span>}
        </span>
      </Tag>
    </Tooltip>
  );
}
