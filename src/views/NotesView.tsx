import { useState } from "react";
import { NotebookPen } from "lucide-react";
import type { Account, Note } from "../types";
import type { NoteDraft } from "../lib/drafts";
import { noteSources, sourceMeta } from "../lib/meta";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Field, Input, Select, Textarea } from "../components/ui/field";
import { NoteCard } from "../components/note-card";
import { EmptyState } from "../components/ui/empty-state";

export function NotesView({
  notes,
  accounts,
  accountsById,
  onAddNote,
}: {
  notes: Note[];
  accounts: Account[];
  accountsById: Map<string, Account>;
  onAddNote: (draft: NoteDraft) => void;
}) {
  const [draft, setDraft] = useState<NoteDraft>({
    accountId: accounts[0]?.id ?? "",
    contactId: "",
    source: "note",
    title: "",
    body: "",
    sourceRef: "",
  });
  const set = (patch: Partial<NoteDraft>) => setDraft((c) => ({ ...c, ...patch }));
  const sorted = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft.title.trim() || !draft.body.trim()) return;
    onAddNote(draft);
    setDraft((c) => ({ ...c, title: "", body: "", sourceRef: "" }));
  }

  const selectedAccount = accounts.find((account) => account.id === draft.accountId);

  return (
    <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <h1 className="sr-only">Notes</h1>
      <Card className="self-start">
        <CardHeader>
          <CardTitle>Capture note</CardTitle>
          <p className="text-body-sm text-muted-foreground">A call, email, meeting, review, or observation — linked to an account.</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <Field label="Account">
              <Select value={draft.accountId} onChange={(e) => set({ accountId: e.target.value, contactId: "" })}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Source">
              <Select value={draft.source} onChange={(e) => set({ source: e.target.value as NoteDraft["source"] })}>
                {noteSources.map((s) => (
                  <option key={s} value={s}>
                    {sourceMeta[s].label}
                  </option>
                ))}
              </Select>
            </Field>
            {selectedAccount && selectedAccount.contacts.length > 0 && (
              <Field label="Contact" hint="Optional — connect the source to a person.">
                <Select value={draft.contactId} onChange={(e) => set({ contactId: e.target.value })}>
                  <option value="">No contact selected</option>
                  {selectedAccount.contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name} · {contact.role}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Source reference" hint="Optional — enough detail to find the original again.">
              <Input
                value={draft.sourceRef}
                onChange={(e) => set({ sourceRef: e.target.value })}
                placeholder="Call on Aug 31, support ticket #184…"
              />
            </Field>
            <Field label="Title">
              <Input value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="Short summary" />
            </Field>
            <Field label="Body">
              <Textarea className="min-h-36" value={draft.body} onChange={(e) => set({ body: e.target.value })} placeholder="What was said, observed, or requested?" />
            </Field>
            <Button type="submit" variant="primary" className="w-full">
              <NotebookPen />
              Add source note
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-h2">Notes</CardTitle>
          <p className="text-body-sm text-muted-foreground">Source memory across every account, newest first.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {sorted.length === 0 ? (
            <EmptyState title="Quiet on every channel." hint="The first note you capture lands right here." />
          ) : (
            sorted.map((note) => (
              <NoteCard key={note.id} note={note} accountName={accountsById.get(note.accountId)?.name} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
