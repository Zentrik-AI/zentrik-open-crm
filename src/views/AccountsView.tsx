import { useState, type FormEvent } from "react";
import { ChevronRight, ClipboardCopy, LayoutGrid, Plus, Rows3 } from "lucide-react";
import type { Account, AccountPatch, Deal, Note, Op, Task, Workspace } from "../types";
import type { AccountMemory } from "../core/memory";
import { accountStages, priorities, type AccountDraft, type ContactDraft } from "../lib/drafts";
import { stageMeta, isOpenDeal } from "../lib/meta";
import { cn, humanize } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Field, Input, Select } from "../components/ui/field";
import { Badge } from "../components/ui/badge";
import { Ring } from "../components/ui/ring";
import { Meter } from "../components/ui/meter";
import { EmptyState } from "../components/ui/empty-state";
import { Private, useShareSafe } from "../components/ui/privacy";
import { AccountListCard, ArrValue, StageRail, stageTone } from "../components/account-bits";
import { KnowledgeList } from "../components/claims";
import { CommitteeMap } from "../components/committee";
import { PrepareCard } from "../components/prepare";
import { DealCard } from "../components/deal-card";
import { TaskRow } from "../components/task-row";
import { NoteCard } from "../components/note-card";
import { AccountTimeline } from "../components/timeline";
import { AiPanel, type AiKind } from "../components/ai-panel";
import { AccountTable } from "../components/account-table";

function AccountMaintenance({ account, onUpdate, onArchive }: { account: Account; onUpdate: (patch: AccountPatch) => boolean; onArchive: (archived: boolean, reason: string) => boolean }) {
  const [name, setName] = useState(account.name);
  const [owner, setOwner] = useState(account.owner);
  const [reason, setReason] = useState("");
  return <details className="group rounded-xl border border-border bg-card px-5 py-3 shadow-e1 open:pb-5">
    <summary className="flex cursor-pointer list-none items-center gap-2 rounded-sm text-body-sm text-muted-foreground transition-colors duration-fast hover:text-foreground focus-visible:outline-none focus-visible:focus-ring [&::-webkit-details-marker]:hidden">
      <ChevronRight className="h-3.5 w-3.5 transition-transform duration-fast group-open:rotate-90" aria-hidden />
      Edit account / archive
    </summary>
    <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); onUpdate({ name, owner }); }}>
      <Field label="Account name"><Input aria-label="Account name" required value={name} onChange={e => setName(e.target.value)} /></Field>
      <Field label="Account owner"><Input aria-label="Account owner" required value={owner} onChange={e => setOwner(e.target.value)} /></Field>
      <Button type="submit" className="justify-self-start">Save account</Button>
    </form>
    <form className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4" onSubmit={e => { e.preventDefault(); if (onArchive(!account.archivedAt, reason)) setReason(""); }}>
      <Field label="Archive / restore reason" className="min-w-0 flex-1"><Input aria-label="Archive reason" required value={reason} onChange={e => setReason(e.target.value)} /></Field>
      <Button type="submit">{account.archivedAt ? "Restore account" : "Archive account"}</Button>
      <p className="w-full text-label font-normal text-faint-foreground">History stays. Archived work leaves the daily queue until restored.</p>
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
  workspace,
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
  workspace: Workspace;
}) {
  const shareSafe = useShareSafe();
  const [addingAccount, setAddingAccount] = useState(accounts.length === 0);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [layout, setLayout] = useState<"list" | "table">("list");
  const visible = accounts.filter((a) => includeArchived || !a.archivedAt);
  const acct = selectedAccount;
  const acctDeals = acct ? deals.filter((d) => d.accountId === acct.id) : [];
  const acctTasks = acct ? tasks.filter((t) => t.accountId === acct.id) : [];
  const acctNotes = acct
    ? notes.filter((n) => n.accountId === acct.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];
  const notesById = new Map(notes.map((n) => [n.id, n]));
  const openPipeline = acctDeals.filter((d) => isOpenDeal(d.stage)).reduce((s, d) => s + d.value, 0);

  const activeCount = accounts.filter((a) => !a.archivedAt).length;
  const archivedToggle = (
    <label className="flex w-fit cursor-pointer items-center gap-2 text-label font-normal text-muted-foreground hover:text-foreground">
      <input type="checkbox" className="accent-[hsl(var(--accent))]" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
      Include archived accounts
    </label>
  );

  return (
    <div className={cn("min-w-0", layout === "list" && "grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]")}>
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <span className="text-h2 text-foreground">Accounts</span>
              <span className="tnum text-label font-normal text-faint-foreground" title={`${activeCount} active · ${accounts.length} total`}>
                {includeArchived ? accounts.length : activeCount}
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                aria-pressed={layout === "table"}
                onClick={() => setLayout(layout === "table" ? "list" : "table")}
                title={layout === "table" ? "Back to the list and the open account" : "Compare every account on one grid"}
              >
                {layout === "table" ? <Rows3 /> : <LayoutGrid />}
                {layout === "table" ? "List" : "Table"}
              </Button>
              {!addingAccount && (
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setAddingAccount(true)}>
                  <Plus />
                  New
                </Button>
              )}
            </div>
          </div>
          {accounts.length === 0 ? (
            <EmptyState title="No accounts yet" hint="Add one above to get started." />
          ) : layout === "table" ? (
            <AccountTable
              workspace={workspace}
              accounts={visible.map((a) => a.id)}
              selectedId={acct?.id}
              onOpen={(id) => {
                onSelectAccount(id);
                setLayout("list");
              }}
            />
          ) : (
            <div className="-mx-1 space-y-1">
              {visible.map((account) => (
                <AccountListCard key={account.id} account={account} selected={acct?.id === account.id} onSelect={() => onSelectAccount(account.id)} />
              ))}
            </div>
          )}
          {accounts.length > 0 && <div className="pt-1">{archivedToggle}</div>}
        </div>
      </div>

      {layout === "table" ? null : acct ? (
        <div key={acct.id} className="min-w-0 space-y-8 animate-view-enter">
          <header className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="break-words text-h1 text-foreground">{acct.name}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-body-sm text-muted-foreground">
                  <Badge tone={stageTone(acct.stage)} dot>
                    {stageMeta[acct.stage].label}
                  </Badge>
                  <span className="min-w-0">
                    <Private redactedLabel="domain hidden">{acct.domain}</Private>
                    <span className="px-1.5 text-faint-foreground" aria-hidden>·</span>
                    {acct.owner}
                    <span className="px-1.5 text-faint-foreground" aria-hidden>·</span>
                    <span className="tnum" title="Recorded evidence confidence">
                      {acct.sourceConfidence === null ? "Confidence unknown" : `${acct.sourceConfidence}% confidence`}
                    </span>
                  </span>
                </div>
                {acct.archivedAt && (
                  <p className="mt-2 text-body-sm text-muted-foreground">
                    Archived · <Private>{acct.archiveReason}</Private>
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={onCopyMarkdown}
                disabled={shareSafe}
                title={shareSafe ? "Switch to Private view before copying account data" : undefined}
              >
                <ClipboardCopy />
                Copy as Markdown
              </Button>
            </div>
            <StageRail stage={acct.stage} />
          </header>

          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-e1 xl:grid-cols-4">
            <Metric label="Health">
              <div className="flex items-center justify-between gap-3">
                <span className="tnum text-h1 text-foreground">{acct.health === null ? "—" : acct.health}</span>
                <Ring value={acct.health} size="xs" showValue={false} label="Health" />
              </div>
            </Metric>
            <Metric label="Fit">
              <span className="tnum text-h1 text-foreground">{acct.fit}</span>
              <Meter value={acct.fit} tone="neutral" ticks={false} weak={false} label="Fit" className="mt-2" />
            </Metric>
            <Metric label="ARR">
              <ArrValue value={acct.arr} className="text-h1 font-semibold" />
            </Metric>
            <Metric label="Open pipeline">
              <ArrValue value={openPipeline} className="text-h1 font-semibold" />
            </Metric>
          </div>

          {memory && <PrepareCard memory={memory} onTrace={onTrace} onCopyBrief={onCopyBrief} />}

          <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            {memory && <KnowledgeList memory={memory} notes={acctNotes} notesById={notesById} onTrace={onTrace} onAdd={onAddClaim} onResolve={(id, reason) => onResolveClaim(id, reason)} />}
            {memory && <CommitteeMap lanes={memory.committee} draftContact={draftContact} setDraftContact={setDraftContact} onAddContact={onAddContact} />}
          </div>

          {acctDeals.length > 0 && (
            <section className="min-w-0">
              <SectionTitle title="Deals" count={acctDeals.length} />
              <div className="grid gap-3 sm:grid-cols-2">
                {acctDeals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} accountName={acct.name} onAdvance={() => onAdvanceDeal(deal.id)} onLose={() => onLoseDeal(deal.id)} />
                ))}
              </div>
            </section>
          )}

          {acctTasks.length > 0 && (
            <section className="min-w-0">
              <SectionTitle title="Tasks" count={acctTasks.length} />
              <div className="-mx-2 divide-y divide-border/70">
                {acctTasks.map((task) => (
                  <div key={task.id} className="py-0.5">
                    <TaskRow task={task} notesById={notesById} onTrace={onTrace} onToggle={() => onToggleTask(task.id)} />
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="grid gap-8 lg:grid-cols-2">
            <section className="min-w-0">
              <SectionTitle title="Activity" />
              <AccountTimeline notes={acctNotes} tasks={acctTasks} deals={acctDeals} />
            </section>
            <section className="min-w-0">
              <SectionTitle title="Notes" count={acctNotes.length || undefined} />
              {acctNotes.length === 0 ? (
                <p className="text-body-sm text-faint-foreground">No notes yet. Capture one from Notes.</p>
              ) : (
                <div className="space-y-3">
                  {acctNotes.slice(0, 4).map((note) => (
                    <NoteCard key={note.id} note={note} />
                  ))}
                </div>
              )}
            </section>
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
        </div>
      ) : (
        <EmptyState title="No account selected" hint="Pick one from the list, or add one." />
      )}
    </div>
  );
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 bg-card px-4 py-3.5">
      <div className="mb-1 text-label text-faint-foreground">{label}</div>
      {children}
    </div>
  );
}

function SectionTitle({ title, count }: { title: string; count?: number }) {
  return (
    <div className="mb-3 flex items-baseline gap-2">
      <h2 className="text-h2 text-foreground">{title}</h2>
      {count != null && <span className="tnum text-label font-normal text-faint-foreground">{count}</span>}
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
            <p className="mt-0.5 text-body-sm text-muted-foreground">Add the rest later.</p>
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
