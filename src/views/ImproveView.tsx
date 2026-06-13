import { useState } from "react";
import { Check, Copy, ExternalLink, Github, Lightbulb, MessagesSquare, Send } from "lucide-react";
import type { ChangelogEntry, Idea } from "../types";
import {
  DISCUSSIONS_URL,
  GITHUB_ISSUES_URL,
  feedbackKinds,
  type FeedbackDraft,
} from "../lib/feedback";
import { formatDate } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Well } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Field, Input, Select, Textarea } from "../components/ui/field";
import { Badge } from "../components/ui/badge";
import { IdeaCard } from "../components/idea-card";
import { ZentrikMark } from "../components/zentrik-mark";

export function ImproveView({
  ideas,
  changelog,
  onApproveIdea,
  onSubmitFeedback,
  issueDraft,
  copied,
  onCopyIssueDraft,
}: {
  ideas: Idea[];
  changelog: ChangelogEntry[];
  onApproveIdea: (id: string) => void;
  onSubmitFeedback: (draft: FeedbackDraft) => void;
  issueDraft: { title: string; body: string } | null;
  copied: boolean;
  onCopyIssueDraft: () => void;
}) {
  const [draft, setDraft] = useState<FeedbackDraft>({ kind: "request", title: "", body: "" });
  const set = (patch: Partial<FeedbackDraft>) => setDraft((c) => ({ ...c, ...patch }));
  const maxVotes = ideas.reduce((m, i) => Math.max(m, i.votes), 0);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft.title.trim() || !draft.body.trim()) return;
    onSubmitFeedback(draft);
    setDraft((c) => ({ ...c, title: "", body: "" }));
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-xl border border-idea/30 bg-idea-bg/30 p-4">
        <div className="flex items-center gap-2 text-idea-fg">
          <Lightbulb className="h-4 w-4" />
          <span className="text-label">Improve Open CRM</span>
        </div>
        <h1 className="mt-1.5 font-serif text-h1 text-foreground">Help shape the product</h1>
        <p className="mt-1 max-w-2xl text-body text-muted-foreground">
          This area is about evolving the open-source product — it's separate from your CRM. Nothing here touches your
          accounts, deals, or notes. Suggest a change, see what's on the roadmap, and read what shipped.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Suggest a change</CardTitle>
            <p className="text-body-sm text-muted-foreground">Turn friction or an idea into a ready-to-file GitHub issue.</p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submit}>
              <Field label="Type">
                <Select value={draft.kind} onChange={(e) => set({ kind: e.target.value as FeedbackDraft["kind"] })}>
                  {feedbackKinds.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Title">
                <Input value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="Short, specific summary" />
              </Field>
              <Field label="What's the friction or idea?">
                <Textarea className="min-h-32" value={draft.body} onChange={(e) => set({ body: e.target.value })} placeholder="Describe the workflow, what you expected, and what would be better." />
              </Field>
              <Button type="submit" variant="primary" className="w-full">
                <Send />
                Draft an issue
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Send or share</CardTitle>
            <p className="text-body-sm text-muted-foreground">Copy your drafted issue, or jump to GitHub.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {issueDraft ? (
              <Well className="animate-settle">
                <div className="text-h3 text-foreground">{issueDraft.title}</div>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-5 text-muted-foreground">
                  {issueDraft.body}
                </pre>
                <Button variant="secondary" size="sm" className="mt-3" onClick={onCopyIssueDraft}>
                  {copied ? <Check /> : <Copy />}
                  {copied ? "Copied" : "Copy issue draft"}
                </Button>
              </Well>
            ) : (
              <div className="rounded-md border border-dashed border-border p-3 text-body-sm text-muted-foreground">
                Draft a suggestion to generate a copy-ready GitHub issue.
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <ExternalLinkButton href={GITHUB_ISSUES_URL} icon={Github}>
                Open an issue
              </ExternalLinkButton>
              <ExternalLinkButton href={DISCUSSIONS_URL} icon={MessagesSquare}>
                Discussions
              </ExternalLinkButton>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-2.5 text-label uppercase text-muted-foreground">Roadmap</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ideas.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} maxVotes={maxVotes} onAdvance={() => onApproveIdea(idea.id)} />
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-h2">What shipped</CardTitle>
          <p className="text-body-sm text-muted-foreground">A changelog of how the product has evolved.</p>
        </CardHeader>
        <CardContent>
          <ol className="relative ml-2 space-y-5 border-l border-accent/50 pl-6">
            {changelog.map((entry) => (
              <li key={entry.id} className="relative">
                <span className="absolute -left-[29px] top-1 h-2.5 w-2.5 rounded-full border-2 border-surface bg-accent" aria-hidden />
                <div className="font-mono text-[11px] uppercase tracking-wide text-faint-foreground">{formatDate(entry.date)}</div>
                <div className="mt-0.5 font-serif text-h3 text-foreground">{entry.title}</div>
                <p className="mt-1 text-body text-muted-foreground">{entry.summary}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {entry.tags.map((t) => (
                    <Badge key={t} tone="neutral">
                      {t}
                    </Badge>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <div className="flex justify-center pb-2 pt-1">
        <ZentrikMark tone="prominent" />
      </div>
    </div>
  );
}

function ExternalLinkButton({ href, icon: Icon, children }: { href: string; icon: typeof Github; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border-strong bg-secondary px-3 text-[13px] font-medium text-secondary-foreground transition-colors duration-fast ease-out hover:bg-surface-raised focus-visible:outline-none focus-visible:focus-ring"
    >
      <Icon className="h-[15px] w-[15px]" />
      {children}
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
    </a>
  );
}
