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
}: {
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
          <span className="font-serif text-h3 text-foreground">AI assist</span>
        </div>
        {hasKey && <Badge tone="agent" dot>{modelLabel}</Badge>}
      </div>

      <div className="p-4">
        {!hasKey ? (
          <div className="flex flex-col items-start gap-3">
            <div className="flex gap-2.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-agent-bg text-agent-fg">
                <KeyRound className="h-4 w-4" />
              </span>
              <p className="text-body-sm text-muted-foreground">
                Add an Anthropic API key to generate an account brief and a follow-up draft,
                grounded in this account's notes. Your key is stored only in this browser and
                sent straight to Anthropic — never to a Zentrik server.
              </p>
            </div>
            <Button variant="agent" size="sm" onClick={onOpenSettings}>
              <KeyRound />
              Add API key in Settings
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="agent" size="sm" onClick={() => onGenerate("brief")} disabled={busy !== null}>
                {busy === "brief" ? <LiveDot tone="agent" /> : <FileText />}
                Account brief
              </Button>
              <Button variant="agent" size="sm" onClick={() => onGenerate("followup")} disabled={busy !== null}>
                {busy === "followup" ? <LiveDot tone="agent" /> : <Mail />}
                Draft follow-up
              </Button>
            </div>

            <form onSubmit={ask} className="flex gap-2">
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask anything about this account…"
                disabled={busy !== null}
              />
              <Button type="submit" variant="agent" size="icon" className="h-9 w-9 shrink-0" disabled={busy !== null || !question.trim()} aria-label="Ask">
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
