import { useEffect, useState } from "react";
import { CalendarPlus, Plus } from "lucide-react";
import type { Account, Note, Task, TaskPatch } from "../types";
import { priorities, type TaskDraft } from "../lib/drafts";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Field, Input, Select } from "../components/ui/field";
import { TaskRow } from "../components/task-row";
import { EmptyState } from "../components/ui/empty-state";
import { useShareSafe } from "../components/ui/privacy";
import { dateInputValue } from "../lib/utils";

const DAY = 24 * 60 * 60 * 1000;

export function TasksView({
  tasks,
  accounts,
  accountsById,
  notesById,
  onToggleTask,
  onAddTask,
  onSelectAccount,
  onExportICS,
  onUpdateTask,
  onTrace,
}: {
  notesById: Map<string, Note>;
  tasks: Task[];
  accounts: Account[];
  accountsById: Map<string, Account>;
  onToggleTask: (id: string) => void;
  onAddTask: (draft: TaskDraft) => boolean;
  onSelectAccount: (id: string) => void;
  onExportICS: (taskIds: string[]) => void;
  onUpdateTask: (id: string, patch: TaskPatch) => boolean;
  onTrace: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const shareSafe = useShareSafe();
  const [owner, setOwner] = useState(() => { try { return sessionStorage.getItem("open-crm.task-owner") || ""; } catch { return ""; } });
  const [editing, setEditing] = useState<string | null>(null);
  const [showAllDone, setShowAllDone] = useState(false);
  const [draft, setDraft] = useState<TaskDraft>({
    title: "",
    accountId: accounts.find(a => !a.archivedAt)?.id ?? "",
    due: "",
    owner: "",
    priority: "medium",
  });
  useEffect(() => {
    if (!accounts.some(a => a.id === draft.accountId && !a.archivedAt)) setDraft(current => ({ ...current, accountId: accounts.find(a => !a.archivedAt)?.id ?? "" }));
  }, [accounts, draft.accountId]);

  const now = Date.now();
  const owners = [...new Set([...tasks.map((task) => task.owner.trim() || "Unassigned"), ...(owner ? [owner] : [])])].sort();
  const selectedOwner = owner;
  const scoped = selectedOwner ? tasks.filter((task) => (task.owner.trim() || "Unassigned") === selectedOwner) : tasks;
  const archived = (task: Task) => Boolean(accountsById.get(task.accountId ?? "")?.archivedAt);
  const open = scoped.filter((t) => t.status === "open" && !archived(t));
  const overdue = open.filter((t) => new Date(t.due).getTime() < now).sort((a, b) => a.due.localeCompare(b.due));
  const soon = open
    .filter((t) => new Date(t.due).getTime() >= now && new Date(t.due).getTime() - now < 3 * DAY)
    .sort((a, b) => a.due.localeCompare(b.due));
  const later = open
    .filter((t) => new Date(t.due).getTime() - now >= 3 * DAY)
    .sort((a, b) => a.due.localeCompare(b.due));
  const done = scoped.filter((t) => t.status === "done").sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "") || a.id.localeCompare(b.id));

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft.title.trim()) return;
    if (!onAddTask(draft)) return;
    setDraft((c) => ({ ...c, title: "", due: "" }));
    setAdding(false);
  }

  const groups: Array<{ key: string; label: string; items: Task[] }> = [
    { key: "overdue", label: "Overdue", items: overdue },
    { key: "soon", label: "Due soon", items: soon },
    { key: "later", label: "Upcoming", items: later },
    { key: "waiting", label: "Waiting · review dates, not send instructions", items: scoped.filter(t => t.status === "waiting" && !archived(t)) },
    { key: "done", label: "Done", items: showAllDone ? done : done.slice(0, 8) },
    { key: "cancelled", label: "Cancelled", items: scoped.filter(t => t.status === "cancelled") },
    { key: "archived", label: "Archived account work · excluded from due queues", items: scoped.filter(t => archived(t) && (t.status === "open" || t.status === "waiting")) },
  ];

  return (
    <div className="mx-auto grid w-full max-w-3xl grid-cols-[minmax(0,1fr)] gap-7">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-h1 text-foreground">Tasks</h1>
          <p className="mt-1 text-body-sm text-muted-foreground">
            <span className="tnum">{open.length}</span> open
            {overdue.length > 0 && (
              <>
                {" · "}
                <span className="tnum font-medium text-destructive-fg">{overdue.length}</span> overdue
              </>
            )}
            {selectedOwner && (
              <>
                {" · "}
                <span className="tnum">{scoped.length}</span> of <span className="tnum">{tasks.length}</span> for {selectedOwner}
              </>
            )}
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="min-w-0 flex-1 sm:w-[148px] sm:flex-none">
            <Select
              aria-label="Filter by owner"
              className="h-8 text-body-sm"
              value={selectedOwner}
              onChange={(event) => { setOwner(event.target.value); try { sessionStorage.setItem("open-crm.task-owner", event.target.value); } catch { /* preference only */ } setShowAllDone(false); }}
            >
              <option value="">All owners</option>
              {owners.map((name) => <option key={name} value={name}>{name}</option>)}
            </Select>
          </div>
          <Button variant="secondary" size="sm" onClick={() => onExportICS(open.map((task) => task.id))} disabled={open.length === 0} title="Download open tasks as a calendar file" aria-label={`Export ${open.length} to calendar`} className="px-2.5 sm:px-3">
            <CalendarPlus />
            <span className="hidden sm:inline">Export {open.length} to calendar</span>
          </Button>
          <Button variant="primary" size="sm" onClick={() => setAdding((v) => !v)}>
            <Plus />
            New task
          </Button>
        </div>
      </div>

      {adding && !shareSafe && (
        <Card className="animate-settle">
          <CardContent className="pt-5">
            <form className="grid items-start gap-3 sm:grid-cols-2" onSubmit={submit}>
              <Field label="Task" className="sm:col-span-2">
                <Input value={draft.title} onChange={(e) => setDraft((c) => ({ ...c, title: e.target.value }))} placeholder="Send recap email" />
              </Field>
              <Field label="Owner" hint="Blank uses the account owner.">
                <Input aria-label="Owner" value={draft.owner} onChange={(event) => setDraft((current) => ({ ...current, owner: event.target.value }))} placeholder={accountsById.get(draft.accountId)?.owner || "Unassigned"} />
              </Field>
              <Field label="Account">
                <Select aria-label="Account" value={draft.accountId} onChange={(e) => setDraft((c) => ({ ...c, accountId: e.target.value }))}>
                  {accounts.filter(a => !a.archivedAt).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Due">
                <Input type="date" value={draft.due} onChange={(e) => setDraft((c) => ({ ...c, due: e.target.value }))} />
              </Field>
              <Field label="Priority">
                <Select value={draft.priority} onChange={(e) => setDraft((c) => ({ ...c, priority: e.target.value as TaskDraft["priority"] }))}>
                  {priorities.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="submit" variant="primary" className="justify-self-start sm:col-span-2">
                Add
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {scoped.length === 0 ? (
        <EmptyState
          title={selectedOwner ? `No tasks for ${selectedOwner}` : "No tasks yet"}
          action={!shareSafe && <Button variant="secondary" size="sm" onClick={() => setAdding(true)}><Plus />Add a task</Button>}
        />
      ) : (
        groups
          .filter((g) => g.items.length > 0)
          .map((g, groupIndex) => (
            <section key={g.key} className="-mx-2 animate-settle" style={{ animationDelay: `${Math.min(groupIndex, 7) * 40}ms` }}>
              <div className="mb-1 flex items-center gap-2 px-2">
                {g.key === "overdue" && <span className="h-1.5 w-1.5 rounded-full bg-destructive" aria-hidden />}
                <span className="text-body-sm font-medium text-foreground">{g.label}</span>
                <span className="tnum text-body-sm text-faint-foreground">{g.key === "done" && done.length > g.items.length ? `${g.items.length} of ${done.length}` : g.items.length}</span>
              </div>
              <div className="divide-y divide-border/70">
                {g.items.map((task) => (
                  <div key={task.id} className="py-0.5">
                  <TaskRow
                    task={task}
                    accountName={task.accountId ? accountsById.get(task.accountId)?.name : undefined}
                    notesById={notesById}
                    onTrace={onTrace}
                    onToggle={() => onToggleTask(task.id)}
                    onOpenAccount={task.accountId ? () => onSelectAccount(task.accountId!) : undefined}
                    onEdit={() => setEditing(editing === task.id ? null : task.id)}
                  />
                  {!shareSafe && editing === task.id && <TaskEditor key={JSON.stringify(task)} task={task} onSave={patch => { if (!Object.keys(patch).length || onUpdateTask(task.id, patch)) setEditing(null); }} onCancel={() => setEditing(null)} />}
                  </div>
                ))}
              </div>
              {g.key === "done" && done.length > 8 && <Button variant="ghost" size="sm" className="mt-1" onClick={() => setShowAllDone((current) => !current)}>{showAllDone ? "Show recent completed tasks" : `Show all ${done.length} completed tasks`}</Button>}
            </section>
          ))
      )}
    </div>
  );
}

function TaskEditor({ task, onSave, onCancel }: { task: Task; onSave: (patch: TaskPatch) => void; onCancel: () => void }) {
  const [patch, setPatch] = useState<TaskPatch>({ title: task.title, owner: task.owner, priority: task.priority, status: task.status, reason: task.reason ?? "", due: dateInputValue(task.due) });
  return <form aria-label="Edit task" className="animate-settle mx-2 mb-3 mt-1 grid gap-3 rounded-xl bg-surface-sunken p-4 sm:grid-cols-2" onSubmit={event => {
    event.preventDefault();
    const changed = Object.fromEntries(Object.entries(patch).filter(([key, value]) => key === "due" ? value !== dateInputValue(task.due) : value !== (task[key as keyof Task] ?? "")));
    onSave(changed);
  }}>
    <Field label="Task title" className="sm:col-span-2"><Input aria-label="Task title" required value={patch.title} onChange={e => setPatch(p => ({...p, title: e.target.value}))} /></Field>
    <Field label="Task owner"><Input aria-label="Task owner" required value={patch.owner} onChange={e => setPatch(p => ({...p, owner: e.target.value}))} /></Field>
    <Field label={patch.status === "waiting" ? "Review date" : "Due date"}><Input aria-label="Task date" type="date" required value={patch.due} onChange={e => setPatch(p => ({...p, due: e.target.value}))} /></Field>
    <Field label="Task status"><Select aria-label="Task status" value={patch.status} onChange={e => setPatch(p => ({...p, status: e.target.value as Task["status"]}))}>{["open", "waiting", "done", "cancelled"].map(s => <option key={s}>{s}</option>)}</Select></Field>
    <Field label="Task priority"><Select aria-label="Task priority" value={patch.priority} onChange={e => setPatch(p => ({...p, priority: e.target.value as Task["priority"]}))}>{priorities.map(s => <option key={s}>{s}</option>)}</Select></Field>
    <Field label="Reason / waiting trigger" className="sm:col-span-2"><Input aria-label="Task reason" required={patch.status === "waiting" || patch.status === "cancelled"} value={patch.reason} onChange={e => setPatch(p => ({...p, reason: e.target.value}))} /></Field>
    <div className="flex gap-2"><Button type="submit" variant="primary">Save task</Button><Button type="button" onClick={onCancel}>Cancel</Button></div>
  </form>;
}
