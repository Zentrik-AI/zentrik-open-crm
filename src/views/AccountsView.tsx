import { type FormEvent } from "react";
import { ClipboardCopy, Plus, UserPlus } from "lucide-react";
import type { Account, Deal, Note, Task } from "../types";
import { accountStages, contactInfluences, priorities, type AccountDraft, type ContactDraft } from "../lib/drafts";
import { stageMeta, isOpenDeal } from "../lib/meta";
import { humanize } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Field, Input, Select } from "../components/ui/field";
import { Badge } from "../components/ui/badge";
import { Ring } from "../components/ui/ring";
import { Meter } from "../components/ui/meter";
import { EmptyState } from "../components/ui/empty-state";
import { Private, useBuildroom } from "../components/ui/privacy";
import {
  AccountListCard,
  ArrValue,
  ContactRow,
  InfoList,
  StageRail,
} from "../components/account-bits";
import { DealCard } from "../components/deal-card";
import { TaskRow } from "../components/task-row";
import { NoteCard } from "../components/note-card";
import { AccountTimeline } from "../components/timeline";
import { AiPanel, type AiKind } from "../components/ai-panel";

export interface AiViewState {
  hasKey: boolean;
  modelLabel: string;
  busy: AiKind | null;
  result: { kind: AiKind; text: string } | null;
  copied: boolean;
  error: string | null;
}

export function AccountsView({
  accounts,
  selectedAccount,
  deals,
  tasks,
  notes,
  draftAccount,
  draftContact,
  setDraftAccount,
  setDraftContact,
  onAddAccount,
  onAddContact,
  onSelectAccount,
  onAdvanceDeal,
  onLoseDeal,
  onToggleTask,
  ai,
  onAiGenerate,
  onAiAsk,
  onAiCopy,
  onAiClear,
  onCopyMarkdown,
  onOpenSettings,
}: {
  accounts: Account[];
  selectedAccount: Account | undefined;
  deals: Deal[];
  tasks: Task[];
  notes: Note[];
  draftAccount: AccountDraft;
  draftContact: ContactDraft;
  setDraftAccount: React.Dispatch<React.SetStateAction<AccountDraft>>;
  setDraftContact: React.Dispatch<React.SetStateAction<ContactDraft>>;
  onAddAccount: (e: FormEvent<HTMLFormElement>) => void;
  onAddContact: (e: FormEvent<HTMLFormElement>) => void;
  onSelectAccount: (id: string) => void;
  onAdvanceDeal: (id: string) => void;
  onLoseDeal: (id: string) => void;
  onToggleTask: (id: string) => void;
  ai: AiViewState;
  onAiGenerate: (kind: AiKind) => void;
  onAiAsk: (question: string) => void;
  onAiCopy: () => void;
  onAiClear: () => void;
  onCopyMarkdown: () => void;
  onOpenSettings: () => void;
}) {
  const buildroom = useBuildroom();
  const acct = selectedAccount;
  const acctDeals = acct ? deals.filter((d) => d.accountId === acct.id) : [];
  const acctTasks = acct ? tasks.filter((t) => t.accountId === acct.id) : [];
  const acctNotes = acct
    ? notes.filter((n) => n.accountId === acct.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];
  const openPipeline = acctDeals.filter((d) => isOpenDeal(d.stage)).reduce((s, d) => s + d.value, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <h1 className="sr-only">Accounts</h1>
      <div className="space-y-4">
        <AccountSetupCard draftAccount={draftAccount} setDraftAccount={setDraftAccount} onAddAccount={onAddAccount} />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-label uppercase text-muted-foreground">Accounts</span>
            <span className="font-mono text-[11px] tabular-nums text-faint-foreground">{accounts.length}</span>
          </div>
          {accounts.length === 0 ? (
            <EmptyState title="No accounts yet." hint="Add a local account above to get started." />
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <AccountListCard key={account.id} account={account} selected={acct?.id === account.id} onSelect={() => onSelectAccount(account.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {acct ? (
        <div className="space-y-5">
          <Card>
            <CardHeader className="gap-3 border-b border-border pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="font-serif text-h1">{acct.name}</CardTitle>
                  <p className="mt-1 text-body-sm text-muted-foreground">
                    <Private redactedLabel="domain hidden">{acct.domain}</Private>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={stageMeta[acct.stage].tone} dot>
                    {stageMeta[acct.stage].label}
                  </Badge>
                  <Badge tone="account">{acct.owner}</Badge>
                  <Badge tone="signal" dot>
                    {acct.sourceConfidence}% evidence
                  </Badge>
                  <Button size="sm" variant="ghost" className="h-7" onClick={onCopyMarkdown}>
                    <ClipboardCopy />
                    Copy as Markdown
                  </Button>
                </div>
              </div>
              <div className="pt-1">
                <StageRail stage={acct.stage} />
              </div>
            </CardHeader>

            <CardContent className="space-y-5 pt-5">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
                  <Ring value={acct.health} size="lg" label="Health" />
                  <div>
                    <div className="text-label uppercase text-muted-foreground">Health</div>
                    <div className="text-[12px] text-faint-foreground">vitality</div>
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-surface p-3">
                  <div className="text-label uppercase text-muted-foreground">Fit</div>
                  <div className="mt-2">
                    <Meter value={acct.fit} tone="account" display={`${acct.fit}`} label="Fit" />
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-surface p-3">
                  <div className="text-label uppercase text-muted-foreground">ARR</div>
                  <div className="mt-1.5 text-stat-xl">
                    <ArrValue value={acct.arr} />
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-surface p-3">
                  <div className="text-label uppercase text-muted-foreground">Open pipeline</div>
                  <div className="mt-1.5 text-stat-xl">
                    <ArrValue value={openPipeline} />
                  </div>
                </div>
              </div>

              <AiPanel
                hasKey={ai.hasKey}
                modelLabel={ai.modelLabel}
                noteCount={acctNotes.length}
                busy={ai.busy}
                result={ai.result}
                copied={ai.copied}
                error={ai.error}
                onGenerate={onAiGenerate}
                onAsk={onAiAsk}
                onCopy={onAiCopy}
                onClear={onAiClear}
                onOpenSettings={onOpenSettings}
              />

              <div className="grid gap-4 lg:grid-cols-2">
                <InfoList title="Needs" items={acct.needs} tone="success" grounded />
                {buildroom ? (
                  <InfoList title="Risks" items={["Risk notes are hidden in share-safe view"]} tone="warning" grounded={false} />
                ) : (
                  <InfoList title="Risks" items={acct.risks} tone="warning" grounded={false} />
                )}
              </div>

              {acctDeals.length > 0 && (
                <div>
                  <div className="mb-2 text-label uppercase text-muted-foreground">Deals</div>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {acctDeals.map((deal) => (
                      <DealCard key={deal.id} deal={deal} accountName={acct.name} onAdvance={() => onAdvanceDeal(deal.id)} onLose={() => onLoseDeal(deal.id)} />
                    ))}
                  </div>
                </div>
              )}

              <ContactsPanel account={acct} draftContact={draftContact} setDraftContact={setDraftContact} onAddContact={onAddContact} />

              {acctTasks.length > 0 && (
                <div>
                  <div className="mb-2 text-label uppercase text-muted-foreground">Tasks</div>
                  <div className="space-y-2.5">
                    {acctTasks.map((task) => (
                      <TaskRow key={task.id} task={task} onToggle={() => onToggleTask(task.id)} />
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <div className="mb-3 text-label uppercase text-muted-foreground">Activity</div>
                  <AccountTimeline notes={acctNotes} tasks={acctTasks} deals={acctDeals} />
                </div>
                <div>
                  <div className="mb-3 text-label uppercase text-muted-foreground">Notes</div>
                  {acctNotes.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-4 text-body-sm text-muted-foreground">
                      No notes yet. Capture one from the Notes tab.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {acctNotes.slice(0, 4).map((note) => (
                        <NoteCard key={note.id} note={note} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <EmptyState title="No account selected." hint="Pick an account on the left, or add one." />
      )}
    </div>
  );
}

function AccountSetupCard({
  draftAccount,
  setDraftAccount,
  onAddAccount,
}: {
  draftAccount: AccountDraft;
  setDraftAccount: React.Dispatch<React.SetStateAction<AccountDraft>>;
  onAddAccount: (e: FormEvent<HTMLFormElement>) => void;
}) {
  const set = (patch: Partial<AccountDraft>) => setDraftAccount((c) => ({ ...c, ...patch }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Add account</CardTitle>
        <p className="text-body-sm text-muted-foreground">Start a real local workspace without importing a whole CRM first.</p>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={onAddAccount}>
          <Field label="Account name">
            <Input value={draftAccount.name} onChange={(e) => set({ name: e.target.value })} placeholder="Acme Studio" />
          </Field>
          <Field label="Domain">
            <Input value={draftAccount.domain} onChange={(e) => set({ domain: e.target.value })} placeholder="acme.example" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Segment">
              <Input value={draftAccount.segment} onChange={(e) => set({ segment: e.target.value })} placeholder="Founder-led B2B" />
            </Field>
            <Field label="Owner">
              <Input value={draftAccount.owner} onChange={(e) => set({ owner: e.target.value })} placeholder="Maya" />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Stage">
              <Select value={draftAccount.stage} onChange={(e) => set({ stage: e.target.value as AccountDraft["stage"] })}>
                {accountStages.map((stage) => (
                  <option key={stage} value={stage}>
                    {humanize(stageMeta[stage].label)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={draftAccount.priority} onChange={(e) => set({ priority: e.target.value as AccountDraft["priority"] })}>
                {priorities.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Primary contact">
              <Input value={draftAccount.contactName} onChange={(e) => set({ contactName: e.target.value })} placeholder="Lena Park" />
            </Field>
            <Field label="Contact role">
              <Input value={draftAccount.contactRole} onChange={(e) => set({ contactRole: e.target.value })} placeholder="Founder" />
            </Field>
          </div>
          <Button type="submit" variant="primary" className="w-full">
            <Plus />
            Add account
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ContactsPanel({
  account,
  draftContact,
  setDraftContact,
  onAddContact,
}: {
  account: Account;
  draftContact: ContactDraft;
  setDraftContact: React.Dispatch<React.SetStateAction<ContactDraft>>;
  onAddContact: (e: FormEvent<HTMLFormElement>) => void;
}) {
  const set = (patch: Partial<ContactDraft>) => setDraftContact((c) => ({ ...c, ...patch }));
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="text-label uppercase text-muted-foreground">Contacts</div>
        <Badge tone="neutral">{account.contacts.length} people</Badge>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {account.contacts.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-3 text-body-sm text-muted-foreground">No contacts yet.</div>
        ) : (
          account.contacts.map((contact) => <ContactRow key={contact.id} contact={contact} />)
        )}
      </div>
      <form className="mt-4 grid items-end gap-3 lg:grid-cols-[1fr_1fr_150px_auto]" onSubmit={onAddContact}>
        <Field label="Name">
          <Input value={draftContact.name} onChange={(e) => set({ name: e.target.value })} placeholder="New contact" />
        </Field>
        <Field label="Role">
          <Input value={draftContact.role} onChange={(e) => set({ role: e.target.value })} placeholder="Operations lead" />
        </Field>
        <Field label="Influence">
          <Select value={draftContact.influence} onChange={(e) => set({ influence: e.target.value as ContactDraft["influence"] })}>
            {contactInfluences.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" variant="secondary">
          <UserPlus />
          Add
        </Button>
      </form>
    </div>
  );
}
