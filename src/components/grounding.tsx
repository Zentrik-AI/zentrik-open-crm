import type { Note } from "../types";
import { cn } from "../lib/utils";
import { Tooltip } from "./ui/tooltip";

/**
 * The grounding underline. A solid rule means the work cites source notes; a
 * dashed rule means it is a hunch. Hovering names the notes behind it.
 */
export function Grounding({ evidence, notesById, className }: { evidence?: string[]; notesById: Map<string, Note>; className?: string }) {
  const notes = (evidence ?? []).map((id) => notesById.get(id)).filter((note): note is Note => Boolean(note));
  if (notes.length === 0) {
    return <span className={cn("border-b border-dashed border-border-strong pb-px text-[12px] text-faint-foreground", className)}>a hunch · no source cited</span>;
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
        </span>
      }
    >
      <span className={cn("border-b border-accent pb-px text-[12px] text-accent-fg", className)}>
        grounded in {notes.length === 1 ? `“${notes[0].title}”` : `${notes.length} notes`}
      </span>
    </Tooltip>
  );
}
