import { useState } from "react";
import { NotebookPen } from "lucide-react";
import type { Account, Note } from "../types";
import type { NoteDraft } from "../lib/drafts";
import { noteSources, sourceMeta } from "../lib/meta";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Field, Input, Select, Textarea } from "../components/ui/field";
import { NoteCard } from "../components/note-card";

export function NotesView({
  notes,
  accounts,
  accountsById,
  onAddNote,
  groundsById,
  onTrace,
}: {
  notes: Note[];
  accounts: Account[];
  accountsById: Map<string, Account>;
  onAddNote: (draft: NoteDraft) => boolean;
  /** How many claims and tasks cite each note. */
  groundsById: Map<string, number>;
  onTrace: (id: string) => void;
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
    if (onAddNote(draft)) setDraft((c) => ({ ...c, title: "", body: "", sourceRef: "", occurredAt: "", interaction: false }));
  }

  const selectedAccount = accounts.find((account) => account.id === draft.accountId);
  const canInteract = ["call", "email", "meeting", "support"].includes(draft.source);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-h1 text-foreground">Notes</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">
          <span className="tnum">{notes.length}</span> {notes.length === 1 ? "source" : "sources"} across every account, newest first
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        <section aria-label="All notes" className="min-w-0">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-16 text-center">
              <NotebookPen className="h-5 w-5 text-faint-foreground" aria-hidden />
              <p className="text-body-sm text-muted-foreground">No notes yet. The first one you capture lands here.</p>
            </div>
          ) : (
            <Card className="overflow-hidden">
              <div className="divide-y divide-border">
                {sorted.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    accountName={accountsById.get(note.accountId)?.name}
                    grounds={groundsById.get(note.id) ?? 0}
                    onTrace={onTrace}
                    className="rounded-none border-0 bg-transparent px-5 py-4 hover:bg-secondary/40"
                  />
                ))}
              </div>
            </Card>
          )}
        </section>

        <Card className="order-first lg:sticky lg:top-20 lg:order-none">
          <CardHeader>
            <CardTitle>Capture note</CardTitle>
            <p className="text-body-sm text-muted-foreground">Link a call, email or meeting to an account.</p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submit}>
              <div className="grid grid-cols-2 gap-3">
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
                  <Select value={draft.source} onChange={(e) => set({ source: e.target.value as NoteDraft["source"], interaction: false })}>
                    {noteSources.map((s) => (
                      <option key={s} value={s}>
                        {sourceMeta[s].label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Source date">
                  <Input aria-label="Source date" type="date" value={draft.occurredAt ?? ""} onChange={(e) => set({ occurredAt: e.target.value })} />
                </Field>
                {selectedAccount && selectedAccount.contacts.length > 0 && (
                  <Field label="Contact">
                    <Select value={draft.contactId} onChange={(e) => set({ contactId: e.target.value })}>
                      <option value="">No contact</option>
                      {selectedAccount.contacts.map((contact) => (
                        <option key={contact.id} value={contact.id}>
                          {contact.name} · {contact.role}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
              </div>
              {canInteract && (
                <label className="flex items-center gap-2 text-body-sm text-muted-foreground">
                  <input type="checkbox" className="accent-primary" checked={draft.interaction ?? false} onChange={(e) => set({ interaction: e.target.checked })} />
                  Record as a verified interaction
                </label>
              )}
              <Field label="Source reference">
                <Input value={draft.sourceRef} onChange={(e) => set({ sourceRef: e.target.value })} placeholder="Optional · call on Aug 31, ticket #184…" />
              </Field>
              <Field label="Title">
                <Input value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="Short summary" />
              </Field>
              <Field label="Body">
                <Textarea className="min-h-32" value={draft.body} onChange={(e) => set({ body: e.target.value })} placeholder="What was said, observed or requested?" />
              </Field>
              <Button type="submit" variant="primary" className="w-full">
                <NotebookPen />
                Add source note
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
