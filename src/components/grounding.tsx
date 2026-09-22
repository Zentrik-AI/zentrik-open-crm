import type { Note } from "../types";
import { cn } from "../lib/utils";
import { Tooltip } from "./ui/tooltip";

/**
 * The grounding underline. A solid rule means the work cites source notes; a
 * dashed rule means it is a hunch. Hovering names the notes behind it; with
 * `onClick`, clicking opens the full trace.
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
    "pb-px text-[12px]",
    onClick && "rounded-sm text-left focus-visible:outline-none focus-visible:focus-ring",
    className,
  );
  if (notes.length === 0) {
    return (
      <Tag type={onClick ? "button" : undefined} onClick={onClick} className={cn(shared, "border-b border-dashed border-border-strong text-faint-foreground", onClick && "hover:text-foreground")}>
        a hunch · no source cited
      </Tag>
    );
  }
  return (
    <Tooltip
      content={
        <span className="block max-w-xs space-y-0.5 text-[11px]">
          {notes.map((note) => (
            <span key={note.id} className="block">
              {note.title} <span className="font-mono text-faint-foreground">· {note.sourceRef || "no reference"}</span>
            </span>
          ))}
          {onClick && <span className="block pt-1 text-faint-foreground">Click to see the full trace</span>}
        </span>
      }
    >
      <Tag type={onClick ? "button" : undefined} onClick={onClick} className={cn(shared, "border-b border-accent text-accent-fg", onClick && "hover:border-b-2")}>
        grounded in {notes.length === 1 ? `“${notes[0].title}”` : `${notes.length} notes`}
      </Tag>
    </Tooltip>
  );
}
