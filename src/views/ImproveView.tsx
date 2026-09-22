import { useState } from "react";
import { Copy, Download, ExternalLink, Github } from "lucide-react";
import {
  GITHUB_ISSUES_URL, createGitHubIssueDraft, createPublicFeedbackBundle,
  feedbackKinds, readFeedbackDraft, saveFeedbackDraft, deleteFeedbackDraft, type FeedbackDraft,
} from "../lib/feedback";
import { Card, CardContent, CardHeader, CardTitle, Well } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Field, Input, Select, Textarea } from "../components/ui/field";
import { brand } from "../lib/brand";

export function ImproveView() {
  const [initial] = useState(() => {
    try { return { draft: readFeedbackDraft(window.localStorage), error: "" }; }
    catch { return { draft: null, error: "The saved feedback draft could not be read. Saving will replace the previous feedback draft." }; }
  });
  const [draft, setDraft] = useState<FeedbackDraft>(initial.draft ?? { kind: "request", title: "", body: "" });
  const [mode, setMode] = useState<"private" | "public">("private");
  const [reviewed, setReviewed] = useState(false);
  const [message, setMessage] = useState(initial.error);
  const valid = Boolean(draft.title.trim() && draft.body.trim());
  let validationError = "";
  if (valid) {
    try { createPublicFeedbackBundle(draft, true); }
    catch (error) { validationError = error instanceof Error ? error.message : "Invalid feedback."; }
  }
  const canShare = mode === "public" && reviewed && valid && !validationError;
  const issue = createGitHubIssueDraft(draft);

  function set(patch: Partial<FeedbackDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setReviewed(false);
    setMessage("Unsaved changes. Save before leaving this view.");
  }

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      saveFeedbackDraft(window.localStorage, draft);
      setMessage("Draft saved in this browser. Nothing was sent anywhere.");
    } catch {
      setMessage("Could not save in this browser. Keep this view open and copy your text before leaving.");
    }
  }

  function removeDraft() {
    if (!window.confirm("Delete this feedback draft from this browser? CRM records will not change.")) return;
    try {
      deleteFeedbackDraft(window.localStorage);
      setDraft({ kind: "request", title: "", body: "" });
      setReviewed(false);
      setMode("private");
      setMessage("Local feedback draft deleted. CRM records were not changed.");
    } catch {
      setMessage("Could not delete the saved draft. Your text is still here.");
    }
  }

  async function copy() {
    if (!canShare) return;
    try {
      const bundle = createPublicFeedbackBundle(draft, reviewed);
      const prepared = createGitHubIssueDraft(bundle.feedback);
      await navigator.clipboard.writeText("# " + prepared.title + "\n\n" + prepared.body);
      setMessage("Issue text copied. Review and submit it yourself on GitHub; nothing has been posted.");
    } catch {
      setMessage("Could not copy. Select the preview text or download the feedback bundle instead.");
    }
  }

  function download() {
    if (!canShare) return;
    let url: string | undefined;
    try {
      const bundle = createPublicFeedbackBundle(draft, reviewed);
      url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2) + "\n"], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "open-crm-feedback.v1.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setMessage("Feedback download requested. The file contains only your feedback and format labels. Nothing was sent.");
    } catch {
      setMessage("Could not download feedback. Copy the reviewed issue text instead.");
    } finally {
      if (url) { const objectUrl = url; window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000); }
    }
  }

  return (
    <div className="grid gap-6">
      <section>
        <h1 className="font-serif text-h1 text-foreground">Help shape {brand.name}</h1>
        <p className="mt-2 max-w-2xl text-body text-muted-foreground">Describe a workflow problem or suggest a change. Save it locally, then review what you share.</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0 self-start">
          <CardHeader><CardTitle>Write feedback</CardTitle><p className="text-body-sm text-muted-foreground">Your draft stays in this browser until you share it.</p></CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={save}>
              <Field label="Type"><Select value={draft.kind} onChange={(event) => set({ kind: event.target.value as FeedbackDraft["kind"] })}>{feedbackKinds.map((kind) => <option key={kind.id} value={kind.id}>{kind.label}</option>)}</Select></Field>
              <Field label="Title"><Input required value={draft.title} onChange={(event) => set({ title: event.target.value })} placeholder="Short, specific summary" /></Field>
              <Field label="What's the friction or idea?"><Textarea required className="min-h-32" value={draft.body} onChange={(event) => set({ body: event.target.value })} placeholder="Describe the workflow and expected result using a fictional example." /></Field>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="primary" disabled={!valid}>Save local draft</Button>
                <Button type="button" variant="ghost" onClick={removeDraft}>Delete local draft</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="min-w-0 self-start">
          <CardHeader><CardTitle>Review the handoff</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Field label="Sharing"><Select value={mode} onChange={(event) => { setMode(event.target.value as "private" | "public"); setReviewed(false); setMessage(""); }}><option value="private">Private — keep local</option><option value="public">Public — prepare for GitHub</option></Select></Field>
            {mode === "private" ? (
              <p className="text-body-sm text-muted-foreground">Saved locally, separate from your CRM records. Choose public sharing when you want to prepare a GitHub issue.</p>
            ) : (
              <>
                <p className="text-body-sm text-muted-foreground">Only the feedback you write is included. Review it for private information before sharing publicly.</p>
                {validationError && <p role="alert" className="text-body-sm text-destructive-fg">{validationError}</p>}
                <Well><h2 className="text-h3 [overflow-wrap:anywhere]">{issue.title}</h2><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-body-sm text-muted-foreground [overflow-wrap:anywhere]">{issue.body}</pre></Well>
                <label className="flex items-start gap-2 text-body-sm"><input type="checkbox" className="mt-1 accent-primary" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />I reviewed this text and removed private information. It is safe to share publicly.</label>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" disabled={!canShare} onClick={copy}><Copy />Copy issue text</Button>
                  <Button variant="secondary" disabled={!canShare} onClick={download}><Download />Download feedback bundle</Button>
                </div>
                {canShare && <a href={GITHUB_ISSUES_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-body-sm text-primary underline"><Github className="h-4 w-4" />Open GitHub to submit manually<ExternalLink className="h-3.5 w-3.5" /></a>}
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <p role="status" aria-live="polite" className="text-body-sm text-muted-foreground">{message || "Nothing is sent automatically. You choose what to share and when."}</p>

    </div>
  );
}
