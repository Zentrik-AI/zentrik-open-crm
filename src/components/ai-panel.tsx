import { Fragment, useState, type ReactNode } from "react";
import { ArrowUp, Check, Copy, FileText, KeyRound, Mail, Sparkles, X } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/field";
import { LiveDot } from "./ui/dot";

export type AiKind = "brief" | "followup" | "ask";

/** Render a small subset of markdown: **bold** inline, blank-line paragraphs. */
function renderInline(line: string): ReactNode {
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="font-semibold text-foreground">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    ),
  );
}

function MarkdownLite({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-body leading-relaxed text-muted-foreground">
      {text.split(/\n/).map((line, i) =>
        line.trim() === "" ? (
          <div key={i} className="h-1" />
        ) : (
          <p key={i}>{renderInline(line)}</p>
        ),
      )}
    </div>
  );
}

export function AiPanel({
  shareSafe,
  hasKey,
  modelLabel,
  noteCount,
  busy,
  result,
  copied,
  error,
  onGenerate,
  onAsk,
  onCopy,
  onClear,
  onOpenSettings,
  onCopyAgentHandoff,
}: {
  shareSafe: boolean;
  hasKey: boolean;
  modelLabel: string;
  noteCount: number;
  busy: AiKind | null;
  result: { kind: AiKind; text: string } | null;
  copied: boolean;
  error: string | null;
  onGenerate: (kind: AiKind) => void;
  onAsk: (question: string) => void;
  onCopy: () => void;
  onClear: () => void;
  onOpenSettings: () => void;
  onCopyAgentHandoff: () => void;
}) {
  const [question, setQuestion] = useState("");
  function ask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!question.trim() || busy) return;
    onAsk(question.trim());
    setQuestion("");
  }
  return (
    <section className="relative overflow-hidden rounded-lg border border-agent/50 bg-agent-bg/40 [box-shadow:inset_2px_0_0_hsl(var(--agent))]">
      <div className="flex items-center justify-between gap-3 border-b border-agent/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-agent" />
          <span className="font-serif text-h3 text-foreground">Agent assist</span>
        </div>
        {hasKey && <Badge tone="agent" dot>{modelLabel}</Badge>}
      </div>

      <div className="p-4">
        {shareSafe && (
          <div className="mb-3 rounded-md border border-accent/40 bg-accent-bg/35 px-3 py-2.5 text-body-sm text-accent-fg">
            Agent actions are paused in Share-safe view so hidden account data cannot be copied or sent accidentally.
          </div>
        )}
        {!hasKey ? (
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
            <div className="flex gap-2.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-agent-bg text-agent-fg">
                <Copy className="h-4 w-4" />
              </span>
              <div>
                <div className="text-h3 text-foreground">Use any agent with explicit context</div>
                <p className="mt-1 text-body-sm text-muted-foreground">
                  Copy this account's notes, open work, and review guardrails into Codex, Claude, or another agent. No API key is required.
                </p>
                <button className="mt-2 text-[12px] text-agent-fg hover:underline focus-visible:outline-none focus-visible:focus-ring" onClick={onOpenSettings}>
                  Or add an Anthropic key for in-browser drafts
                </button>
              </div>
            </div>
            <Button variant="agent" size="sm" onClick={onCopyAgentHandoff} disabled={shareSafe}>
              <Copy />
              Copy agent handoff
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="agent" size="sm" onClick={onCopyAgentHandoff} disabled={shareSafe}>
                <Copy />
                Agent handoff
              </Button>
              <Button variant="agent" size="sm" onClick={() => onGenerate("brief")} disabled={shareSafe || busy !== null}>
                {busy === "brief" ? <LiveDot tone="agent" /> : <FileText />}
                Account brief
              </Button>
              <Button variant="agent" size="sm" onClick={() => onGenerate("followup")} disabled={shareSafe || busy !== null}>
                {busy === "followup" ? <LiveDot tone="agent" /> : <Mail />}
                Draft follow-up
              </Button>
            </div>

            <form onSubmit={ask} className="flex gap-2">
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask anything about this account…"
                disabled={shareSafe || busy !== null}
              />
              <Button type="submit" variant="agent" size="icon" className="h-9 w-9 shrink-0" disabled={shareSafe || busy !== null || !question.trim()} aria-label="Ask">
                {busy === "ask" ? <LiveDot tone="agent" /> : <ArrowUp />}
              </Button>
            </form>

            {busy && (
              <div className="flex items-center gap-2 rounded-md border border-border bg-surface-sunken px-3 py-2.5 text-body-sm text-muted-foreground animate-settle">
                <LiveDot tone="agent" />
                Reading {noteCount} {noteCount === 1 ? "note" : "notes"} and drafting…
              </div>
            )}

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive-bg/40 px-3 py-2.5 text-body-sm text-destructive-fg">
                {error}
              </div>
            )}

            {result && !busy && (
              <div className="rounded-md border border-border bg-surface p-3.5 animate-settle">
                <MarkdownLite text={result.text} />
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5">
                  <span className="text-[11px] text-faint-foreground">
                    Grounded in {noteCount} {noteCount === 1 ? "note" : "notes"} · review before sending
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="ghost" className="h-7" onClick={onCopy}>
                      {copied ? <Check /> : <Copy />}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClear} aria-label="Dismiss">
                      <X />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
