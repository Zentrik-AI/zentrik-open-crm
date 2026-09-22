import { useState, type FormEvent } from "react";
import { ClipboardCopy, Plus } from "lucide-react";
import type { Account, AccountPatch, Deal, Note, Op, Task } from "../types";
import type { AccountMemory } from "../core/memory";
import { accountStages, priorities, type AccountDraft, type ContactDraft } from "../lib/drafts";
import { stageMeta, isOpenDeal } from "../lib/meta";
import { humanize } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Field, Input, Select } from "../components/ui/field";
import { Badge } from "../components/ui/badge";
import { Ring } from "../components/ui/ring";
import { Meter } from "../components/ui/meter";
import { EmptyState } from "../components/ui/empty-state";
import { Private, useShareSafe } from "../components/ui/privacy";
import { AccountListCard, ArrValue, StageRail } from "../components/account-bits";
import { KnowledgeList } from "../components/claims";
import { CommitteeMap } from "../components/committee";
import { PrepareCard } from "../components/prepare";
import { DealCard } from "../components/deal-card";
import { TaskRow } from "../components/task-row";
import { NoteCard } from "../components/note-card";
import { AccountTimeline } from "../components/timeline";
import { AiPanel, type AiKind } from "../components/ai-panel";

function AccountMaintenance({ account, onUpdate, onArchive }: { account: Account; onUpdate: (patch: AccountPatch) => boolean; onArchive: (archived: boolean, reason: string) => boolean }) {
  const [name, setName] = useState(account.name);
  const [owner, setOwner] = useState(account.owner);
  const [reason, setReason] = useState("");
  return <details className="rounded-lg border border-border p-3">
    <summary className="cursor-pointer text-body-sm">Edit account / archive</summary>
    <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); onUpdate({ name, owner }); }}>
      <Field label="Account name"><Input aria-label="Account name" required value={name} onChange={e => setName(e.target.value)} /></Field>
      <Field label="Account owner"><Input aria-label="Account owner" required value={owner} onChange={e => setOwner(e.target.value)} /></Field>
      <Button type="submit" className="justify-self-start">Save account</Button>
    </form>
    <form className="mt-3 flex flex-wrap items-end gap-3 border-t border-border pt-3" onSubmit={e => { e.preventDefault(); if (onArchive(!account.archivedAt, reason)) setReason(""); }}>
      <Field label="Archive / restore reason" className="min-w-0 flex-1"><Input aria-label="Archive reason" required value={reason} onChange={e => setReason(e.target.value)} /></Field>
      <Button type="submit">{account.archivedAt ? "Restore account" : "Archive account"}</Button>
      <p className="w-full text-[12px] text-muted-foreground">History stays available. Archived accounts and their work leave the daily queue; restoring makes unfinished work visible again.</p>
    </form>
  </details>;
}

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
  onCopyAgentHandoff,
  onOpenSettings,
  onUpdateAccount,
  onArchiveAccount,
  memory,
  onAddClaim,
  onResolveClaim,
  onTrace,
  onCopyBrief,
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
  onCopyAgentHandoff: () => void;
  onOpenSettings: () => void;
  onUpdateAccount: (id: string, patch: AccountPatch) => boolean;
  onArchiveAccount: (id: string, archived: boolean, reason: string) => boolean;
  memory: AccountMemory | null;
  onAddClaim: (op: Extract<Op, { type: "claim.add" }>) => boolean;
  onResolveClaim: (claimId: string, reason: string) => boolean;
  onTrace: (id: string) => void;
  onCopyBrief: () => void;
}) {
  const shareSafe = useShareSafe();
  const [addingAccount, setAddingAccount] = useState(accounts.length === 0);
  const [includeArchived, setIncludeArchived] = useState(false);
  const acct = selectedAccount;
  const acctDeals = acct ? deals.filter((d) => d.accountId === acct.id) : [];
  const acctTasks = acct ? tasks.filter((t) => t.accountId === acct.id) : [];
  const acctNotes = acct
    ? notes.filter((n) => n.accountId === acct.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];
  const notesById = new Map(notes.map((n) => [n.id, n]));
  const openPipeline = acctDeals.filter((d) => isOpenDeal(d.stage)).reduce((s, d) => s + d.value, 0);

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
      <h1 className="sr-only">Accounts</h1>
      <div className="min-w-0 space-y-4">
        {addingAccount && (
          <AccountSetupCard
            draftAccount={draftAccount}
            setDraftAccount={setDraftAccount}
            onAddAccount={(event) => {
              onAddAccount(event);
              if (draftAccount.name.trim()) setAddingAccount(false);
            }}
            onCancel={accounts.length > 0 ? () => setAddingAccount(false) : undefined}
          />
        )}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-label uppercase text-muted-foreground">Accounts</span>
              <span className="font-mono text-[11px] tabular-nums text-faint-foreground">{includeArchived ? `${accounts.length} total` : `${accounts.filter(a => !a.archivedAt).length} active · ${accounts.length} total`}</span>
            </div>
            {!addingAccount && (
              <Button size="sm" variant="ghost" onClick={() => setAddingAccount(true)}>
                <Plus />
                New
              </Button>
            )}
          </div>
          <label className="flex items-center gap-2 text-body-sm"><input type="checkbox" checked={includeArchived} onChange={e => setIncludeArchived(e.target.checked)} />Include archived accounts</label>
          {accounts.length === 0 ? (
            <EmptyState title="No accounts yet." hint="Add a local account above to get started." />
          ) : (
            <div className="space-y-3">
              {accounts.filter(a => includeArchived || !a.archivedAt).map((account) => (
                <AccountListCard key={account.id} account={account} selected={acct?.id === account.id} onSelect={() => onSelectAccount(account.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {acct ? (
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader className="gap-3 border-b border-border pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="font-serif text-h1">{acct.name}</CardTitle>
                  {acct.archivedAt && <p className="text-body-sm text-muted-foreground">Archived · <Private>{acct.archiveReason}</Private></p>}
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
                    {acct.sourceConfidence === null ? "Evidence confidence unknown" : `${acct.sourceConfidence}% recorded confidence`}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7"
                    onClick={onCopyMarkdown}
                    disabled={shareSafe}
                    title={shareSafe ? "Switch to Private view before copying account data" : undefined}
                  >
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
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
                  <Ring value={acct.health} size="lg" label="Health" />
                  <div>
                    <div className="text-label uppercase text-muted-foreground">Health</div>
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

              {memory && <PrepareCard memory={memory} onTrace={onTrace} onCopyBrief={onCopyBrief} />}

              <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                {memory && <KnowledgeList memory={memory} notes={acctNotes} notesById={notesById} onTrace={onTrace} onAdd={onAddClaim} onResolve={(id, reason) => onResolveClaim(id, reason)} />}
                {memory && <CommitteeMap lanes={memory.committee} draftContact={draftContact} setDraftContact={setDraftContact} onAddContact={onAddContact} />}
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

              {acctTasks.length > 0 && (
                <div>
                  <div className="mb-2 text-label uppercase text-muted-foreground">Tasks</div>
                  <div className="space-y-2.5">
                    {acctTasks.map((task) => (
                      <TaskRow key={task.id} task={task} notesById={notesById} onTrace={onTrace} onToggle={() => onToggleTask(task.id)} />
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

              <AiPanel
                shareSafe={shareSafe}
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
                onCopyAgentHandoff={onCopyAgentHandoff}
              />

              {!shareSafe && <AccountMaintenance key={JSON.stringify([acct.id, acct.name, acct.owner, acct.archivedAt])} account={acct} onUpdate={patch => onUpdateAccount(acct.id, patch)} onArchive={(archived, reason) => onArchiveAccount(acct.id, archived, reason)} />}
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
  onCancel,
}: {
  draftAccount: AccountDraft;
  setDraftAccount: React.Dispatch<React.SetStateAction<AccountDraft>>;
  onAddAccount: (e: FormEvent<HTMLFormElement>) => void;
  onCancel?: () => void;
}) {
  const set = (patch: Partial<AccountDraft>) => setDraftAccount((c) => ({ ...c, ...patch }));
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Add account</CardTitle>
            <p className="mt-1 text-body-sm text-muted-foreground">Start with the context you need now. Add the rest later.</p>
          </div>
          {onCancel && (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
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
