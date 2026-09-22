import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { Trace, TraceNode } from "../core/memory";
import { cn, formatDate } from "../lib/utils";
import { Button } from "./ui/button";
import { RedactedChip, useBuildroom } from "./ui/privacy";

/**
 * The evidence trace: where a record came from, and what rests on it. Drawn
 * on one spine. Solid segments are grounded, dashed ones are hunches. Any node
 * can become the focus.
 */

const kindLabel: Record<TraceNode["kind"], string> = { source: "Source", note: "Note", claim: "We know", task: "Action", deal: "Deal", contact: "Person" };

function Node({ node, focus, onNavigate }: { node: TraceNode; focus?: boolean; onNavigate: (id: string) => void }) {
  const buildroom = useBuildroom();
  const hunch = node.tone === "hunch";
  const navigable = node.kind === "note" || node.kind === "claim" || node.kind === "task";
  const dot = node.tone === "done" ? "bg-success" : node.tone === "open" ? "bg-warning" : hunch ? "border-2 border-dashed border-border-strong bg-surface" : "bg-accent";
  const body = (
    <>
      <div className="text-label uppercase text-faint-foreground">{kindLabel[node.kind]}{hunch ? " · hunch" : ""}</div>
      <div className={cn("text-body text-foreground", focus && "font-serif text-h3")}>{buildroom && node.kind !== "contact" ? <RedactedChip label="hidden in share-safe view" /> : node.title}</div>
      {node.detail && <div className="text-[12px] text-muted-foreground">{buildroom && node.kind === "source" ? <RedactedChip label="reference hidden" /> : node.detail}</div>}
      {node.date && <div className="font-mono text-[11px] tabular-nums text-faint-foreground">{formatDate(node.date)}</div>}
    </>
  );
  return (
    <li className="relative pl-7">
      <span className={cn("absolute left-0 top-[9px] h-3 w-3 rounded-full ring-2 ring-surface", dot, focus && "scale-125")} aria-hidden />
      {navigable && !focus ? (
        <button onClick={() => onNavigate(node.id)} className="w-full rounded-md border border-transparent p-2 text-left transition-colors duration-fast hover:border-border-strong hover:bg-surface focus-visible:outline-none focus-visible:focus-ring">
          {body}
        </button>
      ) : (
        <div className={cn("p-2", focus && "rounded-md border border-border bg-surface")}>{body}</div>
      )}
    </li>
  );
}

export function TraceSheet({ trace, onClose, onNavigate }: { trace: Trace | null; onClose: () => void; onNavigate: (id: string) => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!trace) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [trace, onClose]);
  if (!trace) return null;
  const spineHunch = trace.focus.tone === "hunch";
  return (
    <div className="fixed inset-0 z-[140]" role="dialog" aria-modal="true" aria-label="Why this exists">
      <button className="absolute inset-0 bg-[hsl(28_14%_6%/0.35)] backdrop-blur-[1px]" aria-label="Close" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col border-l border-border bg-background shadow-e2 animate-fade">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <div className="font-serif text-h3 text-foreground">Why this exists</div>
            <div className="text-[12px] text-muted-foreground">{spineHunch ? "It rests on nothing recorded." : "Every step names its source."}</div>
          </div>
          <Button ref={closeRef} size="icon" variant="ghost" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <ol className={cn("relative ml-[5px] border-l", spineHunch ? "border-dashed border-border-strong" : "border-accent")}>
            {trace.upstream.length > 0 && <li className="mb-1 pl-7 text-label uppercase text-faint-foreground">Rests on</li>}
            {trace.upstream.map((node) => (
              <Node key={node.id} node={node} onNavigate={onNavigate} />
            ))}
            <li className="mb-1 mt-3 pl-7 text-label uppercase text-faint-foreground">{trace.upstream.length ? "So" : "Recorded"}</li>
            <Node node={trace.focus} focus onNavigate={onNavigate} />
            {trace.downstream.length > 0 && (
              <>
                <li className="mb-1 mt-3 pl-7 text-label uppercase text-faint-foreground">Which supports</li>
                {trace.downstream.map((node) => (
                  <Node key={node.id} node={node} onNavigate={onNavigate} />
                ))}
              </>
            )}
          </ol>
        </div>
      </aside>
    </div>
  );
}
