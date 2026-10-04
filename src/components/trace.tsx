import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { Trace, TraceNode } from "../core/memory";
import { cn, formatDate } from "../lib/utils";
import { Button } from "./ui/button";
import { RedactedChip, useShareSafe } from "./ui/privacy";

/**
 * The evidence trace: where a record came from, and what rests on it. Drawn
 * on one spine. Solid segments are grounded, dashed ones are hunches. Any node
 * can become the focus.
 */

const kindLabel: Record<TraceNode["kind"], string> = { source: "Source", note: "Note", claim: "We know", task: "Action", deal: "Deal", contact: "Person" };

function Node({ node, focus, onNavigate }: { node: TraceNode; focus?: boolean; onNavigate: (id: string) => void }) {
  const shareSafe = useShareSafe();
  const hunch = node.tone === "hunch";
  const navigable = node.kind === "note" || node.kind === "claim" || node.kind === "task";
  const dot = node.tone === "done" ? "bg-success" : node.tone === "open" ? "bg-warning" : hunch ? "border-2 border-dashed border-border-strong bg-surface" : "bg-accent";
  const body = (
    <>
      <div className="text-label font-normal text-faint-foreground">{kindLabel[node.kind]}{hunch ? " · hunch" : ""}</div>
      <div className={cn("mt-0.5 text-body text-foreground", focus && "text-h3")}>{shareSafe && node.kind !== "contact" ? <RedactedChip label="hidden in share-safe view" /> : node.title}</div>
      {node.detail && <div className="mt-0.5 text-body-sm text-muted-foreground">{shareSafe && node.kind === "source" ? <RedactedChip label="reference hidden" /> : node.detail}</div>}
      {node.date && <div className="tnum mt-0.5 text-label font-normal text-faint-foreground">{formatDate(node.date)}</div>}
    </>
  );
  return (
    <li className="relative pl-6">
      <span className={cn("absolute -left-[5.5px] top-[12px] h-2.5 w-2.5 rounded-full ring-4 ring-background", dot)} aria-hidden />
      {navigable && !focus ? (
        <button onClick={() => onNavigate(node.id)} className="w-full rounded-lg px-3 py-2 text-left transition-colors duration-fast hover:bg-secondary focus-visible:outline-none focus-visible:focus-ring">
          {body}
        </button>
      ) : (
        <div className={cn("px-3 py-2", focus && "rounded-lg border border-border bg-card shadow-e1")}>{body}</div>
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
      <button className="absolute inset-0 bg-black/30 animate-fade" aria-label="Close" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col border-l border-border bg-background shadow-e3 animate-view-enter">
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-h2 text-foreground">Why this exists</h2>
            <div className="text-body-sm text-muted-foreground">{spineHunch ? "Rests on nothing recorded" : "Every step names its source"}</div>
          </div>
          <Button ref={closeRef} size="icon" variant="ghost" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <ol className={cn("relative ml-[5px] border-l", spineHunch ? "border-dashed border-border-strong" : "border-accent/50")}>
            {trace.upstream.length > 0 && <li className="mb-1 pl-6 text-label text-muted-foreground">Rests on</li>}
            {trace.upstream.map((node) => (
              <Node key={node.id} node={node} onNavigate={onNavigate} />
            ))}
            <li className="mb-1 mt-4 pl-6 text-label text-muted-foreground">{trace.upstream.length ? "So" : "Recorded"}</li>
            <Node node={trace.focus} focus onNavigate={onNavigate} />
            {trace.downstream.length > 0 && (
              <>
                <li className="mb-1 mt-4 pl-6 text-label text-muted-foreground">Which supports</li>
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
