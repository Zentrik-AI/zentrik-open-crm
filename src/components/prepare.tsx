import { Check, Copy } from "lucide-react";
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
  const label = "mb-2 text-label text-faint-foreground";
  const quiet = "text-body-sm text-faint-foreground";
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0">
          <CardTitle>Before you talk to them</CardTitle>
          <p className="mt-0.5 text-body-sm text-muted-foreground">
            {since.from ? (
              <>
                Last contact{" "}
                <time dateTime={since.from} className="tnum">
                  {formatRelative(since.from)}
                </time>
              </>
            ) : (
              "No verified contact yet"
            )}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={onCopyBrief} disabled={shareSafe} title={shareSafe ? "Switch to Private view to copy the brief" : "Copy the brief as Markdown"}>
          <Copy />
          Copy brief
        </Button>
      </CardHeader>
      {empty ? (
        <CardContent className="pt-4">
          <p className="text-body-sm text-muted-foreground">Nothing new, nothing owed, nothing to confirm.</p>
        </CardContent>
      ) : (
        <div className="grid divide-y divide-border lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          <div className="min-w-0 px-5 py-4">
            <div className={label}>Since last contact</div>
            {since.notes.length === 0 && since.tasksDone.length === 0 ? (
              <p className={quiet}>Nothing new recorded.</p>
            ) : (
              <ul className="space-y-2">
                {since.notes.slice(0, 5).map((note) => {
                  const Icon = sourceMeta[note.source].icon;
                  return (
                    <li key={note.id} className="flex items-start gap-2 text-body-sm">
                      <Icon className="mt-[3px] h-3.5 w-3.5 shrink-0 text-faint-foreground" aria-hidden />
                      <button onClick={() => onTrace(note.id)} className="min-w-0 rounded-sm text-left text-foreground hover:text-accent-fg focus-visible:outline-none focus-visible:focus-ring">
                        {shareSafe ? <RedactedChip label="note hidden" /> : note.title}
                        <span className="tnum ml-1.5 text-label font-normal text-faint-foreground">{formatDate(noteDate(note))}</span>
                      </button>
                    </li>
                  );
                })}
                {since.tasksDone.slice(0, 3).map((task) => (
                  <li key={task.id} className="flex items-start gap-2 text-body-sm text-muted-foreground">
                    <Check className="mt-[3px] h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
                    <span className="min-w-0">
                      <span className="sr-only">Done: </span>
                      {task.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="min-w-0 px-5 py-4">
            <div className={label}>Owed</div>
            {commitmentsAll.length === 0 ? (
              <p className={quiet}>No open commitments.</p>
            ) : (
              <ul className="space-y-2">
                {commitmentsAll.map((g) => (
                  <li key={g.claim.id} className="text-body-sm">
                    <button onClick={() => onTrace(g.claim.id)} className="rounded-sm text-left hover:text-accent-fg focus-visible:outline-none focus-visible:focus-ring">
                      <span className="mr-1.5 font-medium text-muted-foreground">{g.claim.owner === "them" ? "They" : "We"}</span>
                      {shareSafe ? <RedactedChip label="commitment hidden" /> : <span className="text-foreground">{g.claim.text}</span>}
                    </button>
                    {g.claim.due && (
                      <div className={cn("tnum mt-0.5 text-label font-normal", g.overdue ? "text-destructive-fg" : "text-faint-foreground")}>
                        {g.overdue ? `Was due ${formatRelative(g.claim.due)}` : `By ${formatDate(g.claim.due)}`}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="min-w-0 px-5 py-4">
            <div className={label}>Worth asking</div>
            {questions.length === 0 ? (
              <p className={quiet}>Nothing needs confirming.</p>
            ) : (
              <ol className="space-y-2">
                {questions.map((q, i) => (
                  <li key={`${q.text}-${i}`} className="flex gap-2 text-body-sm">
                    <span className="tnum w-3 shrink-0 text-label leading-5 text-faint-foreground">{i + 1}</span>
                    <div className="min-w-0">
                      {q.recordId ? (
                        <button onClick={() => onTrace(q.recordId!)} className="rounded-sm text-left text-foreground hover:text-accent-fg focus-visible:outline-none focus-visible:focus-ring">
                          {shareSafe ? <RedactedChip label="question hidden" /> : q.text}
                        </button>
                      ) : (
                        <span className="text-foreground">{q.text}</span>
                      )}
                      <div className="mt-0.5 text-label font-normal text-faint-foreground">{q.why}</div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
