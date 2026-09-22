import { Copy, MessageSquareText } from "lucide-react";
import type { AccountMemory } from "../core/memory";
import { noteDate } from "../core/memory";
import { sourceMeta } from "../lib/meta";
import { cn, formatDate, formatRelative } from "../lib/utils";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { RedactedChip, useShareSafe } from "./ui/privacy";

/**
 * Before you talk to them. Three things, computed from the records: what was
 * recorded since the last real contact, what each side owes, and the questions
 * the gaps in our knowledge make worth asking.
 */
export function PrepareCard({ memory, onTrace, onCopyBrief }: { memory: AccountMemory; onTrace: (id: string) => void; onCopyBrief: () => void }) {
  const shareSafe = useShareSafe();
  const { since, commitments, questions } = memory;
  const commitmentsAll = [...commitments.ours, ...commitments.theirs];
  const empty = since.notes.length === 0 && since.tasksDone.length === 0 && commitmentsAll.length === 0 && questions.length === 0;
  return (
    <Card className="border-accent/30">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-accent" />
            Before you talk to them
          </CardTitle>
          <p className="mt-1 text-body-sm text-muted-foreground">
            {since.from ? (
              <>
                Last verified contact{" "}
                <time dateTime={since.from} className="font-mono tabular-nums text-foreground">
                  {formatRelative(since.from)}
                </time>
                .
              </>
            ) : (
              "No verified contact recorded yet."
            )}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={onCopyBrief} disabled={shareSafe} title={shareSafe ? "Switch to Private view to copy the brief" : "Copy the brief as Markdown"}>
          <Copy />
          Copy brief
        </Button>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="text-body-sm text-muted-foreground">Nothing has changed since you last spoke, nothing is owed, and nothing needs confirming. Capture a note when that changes.</p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="min-w-0">
              <div className="mb-2 text-label uppercase text-muted-foreground">Since last contact</div>
              {since.notes.length === 0 && since.tasksDone.length === 0 ? (
                <p className="text-[12px] text-faint-foreground">Nothing new recorded.</p>
              ) : (
                <ul className="space-y-1.5">
                  {since.notes.slice(0, 5).map((note) => {
                    const Icon = sourceMeta[note.source].icon;
                    return (
                      <li key={note.id} className="flex items-start gap-2 text-body-sm">
                        <Icon className="mt-[3px] h-3.5 w-3.5 shrink-0 text-signal" aria-hidden />
                        <button onClick={() => onTrace(note.id)} className="min-w-0 rounded-sm text-left text-foreground hover:text-accent-fg focus-visible:outline-none focus-visible:focus-ring">
                          {shareSafe ? <RedactedChip label="note hidden" /> : note.title}
                          <span className="ml-1.5 font-mono text-[11px] tabular-nums text-faint-foreground">{formatDate(noteDate(note))}</span>
                        </button>
                      </li>
                    );
                  })}
                  {since.tasksDone.slice(0, 3).map((task) => (
                    <li key={task.id} className="text-body-sm text-muted-foreground">
                      <span className="text-success-fg">Done</span> · {task.title}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="min-w-0">
              <div className="mb-2 text-label uppercase text-muted-foreground">Owed</div>
              {commitmentsAll.length === 0 ? (
                <p className="text-[12px] text-faint-foreground">No open commitments either way.</p>
              ) : (
                <ul className="space-y-1.5">
                  {commitmentsAll.map((g) => (
                    <li key={g.claim.id} className="text-body-sm">
                      <button onClick={() => onTrace(g.claim.id)} className="rounded-sm text-left focus-visible:outline-none focus-visible:focus-ring">
                        <span className={cn("mr-1.5 font-medium", g.claim.owner === "them" ? "text-account-fg" : "text-accent-fg")}>{g.claim.owner === "them" ? "They" : "We"}</span>
                        {shareSafe ? <RedactedChip label="commitment hidden" /> : <span className="text-foreground">{g.claim.text}</span>}
                        {g.claim.due && (
                          <span className={cn("ml-1.5 font-mono text-[11px] tabular-nums", g.overdue ? "text-destructive-fg" : "text-faint-foreground")}>
                            {g.overdue ? `was due ${formatRelative(g.claim.due)}` : `by ${formatDate(g.claim.due)}`}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="min-w-0">
              <div className="mb-2 text-label uppercase text-muted-foreground">Worth asking</div>
              {questions.length === 0 ? (
                <p className="text-[12px] text-faint-foreground">Nothing needs confirming.</p>
              ) : (
                <ol className="space-y-1.5">
                  {questions.map((q, i) => (
                    <li key={`${q.text}-${i}`} className="flex gap-2 text-body-sm">
                      <span className="w-4 shrink-0 font-mono text-[11px] tabular-nums text-faint-foreground">{i + 1}</span>
                      <div className="min-w-0">
                        {q.recordId ? (
                          <button onClick={() => onTrace(q.recordId!)} className="rounded-sm text-left text-foreground hover:text-accent-fg focus-visible:outline-none focus-visible:focus-ring">
                            {shareSafe ? <RedactedChip label="question hidden" /> : q.text}
                          </button>
                        ) : (
                          <span className="text-foreground">{q.text}</span>
                        )}
                        <div className="text-[11px] text-faint-foreground">{q.why}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
