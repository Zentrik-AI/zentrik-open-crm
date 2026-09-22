import { useEffect, useState } from "react";
import { CalendarPlus, Plus } from "lucide-react";
import type { Account, Note, Task, TaskPatch } from "../types";
import { priorities, type TaskDraft } from "../lib/drafts";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Field, Input, Select } from "../components/ui/field";
import { TaskRow } from "../components/task-row";
import { EmptyState } from "../components/ui/empty-state";
import { useBuildroom } from "../components/ui/privacy";
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
  const buildroom = useBuildroom();
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
    <div className="mx-auto grid max-w-3xl gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-h1 text-foreground">Tasks</h1>
          <p className="mt-0.5 text-body-sm text-muted-foreground">
            {open.length} open · {overdue.length} overdue{selectedOwner && ` · ${scoped.length} of ${tasks.length} tasks in this owner view`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => onExportICS(open.map((task) => task.id))} disabled={open.length === 0}>
            <CalendarPlus />
            Export {open.length} to calendar
          </Button>
          <Button variant="primary" size="sm" onClick={() => setAdding((v) => !v)}>
            <Plus />
            New task
          </Button>
        </div>
      </div>

      <Field label="Filter by owner" className="max-w-xs">
        <Select value={selectedOwner} onChange={(event) => { setOwner(event.target.value); try { sessionStorage.setItem("open-crm.task-owner", event.target.value); } catch { /* preference only */ } setShowAllDone(false); }}>
          <option value="">All owners</option>
          {owners.map((name) => <option key={name} value={name}>{name}</option>)}
        </Select>
      </Field>

      {adding && !buildroom && (
        <Card className="animate-settle">
          <CardContent className="pt-4">
            <form className="grid items-start gap-3 sm:grid-cols-2" onSubmit={submit}>
              <Field label="Task" className="sm:col-span-2">
                <Input value={draft.title} onChange={(e) => setDraft((c) => ({ ...c, title: e.target.value }))} placeholder="Send recap email" />
              </Field>
              <Field label="Owner" hint="Leave blank to use the selected account's owner.">
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
        <EmptyState title="No tasks in this view." hint="Choose another owner or add a task." />
      ) : (
        groups
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <div key={g.key}>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-label uppercase text-muted-foreground">{g.label}</span>
                <span className="font-mono text-[11px] tabular-nums text-faint-foreground">{g.key === "done" && done.length > g.items.length ? `${g.items.length} of ${done.length}` : g.items.length}</span>
              </div>
              <div className="space-y-2.5">
                {g.items.map((task) => (
                  <div key={task.id}>
                  <TaskRow
                    task={task}
                    accountName={task.accountId ? accountsById.get(task.accountId)?.name : undefined}
                    notesById={notesById}
                    onTrace={onTrace}
                    onToggle={() => onToggleTask(task.id)}
                    onOpenAccount={task.accountId ? () => onSelectAccount(task.accountId!) : undefined}
                    onEdit={() => setEditing(editing === task.id ? null : task.id)}
                  />
                  {!buildroom && editing === task.id && <TaskEditor key={JSON.stringify(task)} task={task} onSave={patch => { if (!Object.keys(patch).length || onUpdateTask(task.id, patch)) setEditing(null); }} onCancel={() => setEditing(null)} />}
                  </div>
                ))}
              </div>
              {g.key === "done" && done.length > 8 && <Button variant="ghost" size="sm" onClick={() => setShowAllDone((current) => !current)}>{showAllDone ? "Show recent completed tasks" : `Show all ${done.length} completed tasks`}</Button>}
            </div>
          ))
      )}
    </div>
  );
}

function TaskEditor({ task, onSave, onCancel }: { task: Task; onSave: (patch: TaskPatch) => void; onCancel: () => void }) {
  const [patch, setPatch] = useState<TaskPatch>({ title: task.title, owner: task.owner, priority: task.priority, status: task.status, reason: task.reason ?? "", due: dateInputValue(task.due) });
  return <form aria-label="Edit task" className="mt-2 grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2" onSubmit={event => {
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
