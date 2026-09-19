import { useState } from "react";
import { CalendarPlus, Plus } from "lucide-react";
import type { Account, Note, Task } from "../types";
import { priorities, type TaskDraft } from "../lib/drafts";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Field, Input, Select } from "../components/ui/field";
import { TaskRow } from "../components/task-row";
import { EmptyState } from "../components/ui/empty-state";

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
}: {
  notesById: Map<string, Note>;
  tasks: Task[];
  accounts: Account[];
  accountsById: Map<string, Account>;
  onToggleTask: (id: string) => void;
  onAddTask: (draft: TaskDraft) => void;
  onSelectAccount: (id: string) => void;
  onExportICS: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<TaskDraft>({
    title: "",
    accountId: accounts[0]?.id ?? "",
    due: "",
    owner: accounts[0]?.owner ?? "",
    priority: "medium",
  });

  const now = Date.now();
  const open = tasks.filter((t) => t.status === "open");
  const overdue = open.filter((t) => new Date(t.due).getTime() < now).sort((a, b) => a.due.localeCompare(b.due));
  const soon = open
    .filter((t) => new Date(t.due).getTime() >= now && new Date(t.due).getTime() - now < 3 * DAY)
    .sort((a, b) => a.due.localeCompare(b.due));
  const later = open
    .filter((t) => new Date(t.due).getTime() - now >= 3 * DAY)
    .sort((a, b) => a.due.localeCompare(b.due));
  const done = tasks.filter((t) => t.status === "done").sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft.title.trim()) return;
    onAddTask(draft);
    setDraft((c) => ({ ...c, title: "", due: "" }));
    setAdding(false);
  }

  const groups: Array<{ key: string; label: string; items: Task[] }> = [
    { key: "overdue", label: "Overdue", items: overdue },
    { key: "soon", label: "Due soon", items: soon },
    { key: "later", label: "Upcoming", items: later },
    { key: "done", label: "Done", items: done.slice(0, 8) },
  ];

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-h1 text-foreground">Tasks</h1>
          <p className="mt-0.5 text-body-sm text-muted-foreground">
            {open.length} open · {overdue.length} overdue
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onExportICS} disabled={open.length === 0}>
            <CalendarPlus />
            Add to calendar
          </Button>
          <Button variant="primary" size="sm" onClick={() => setAdding((v) => !v)}>
            <Plus />
            New task
          </Button>
        </div>
      </div>

      {adding && (
        <Card className="animate-settle">
          <CardContent className="pt-4">
            <form className="grid items-end gap-3 sm:grid-cols-[1.6fr_1fr_140px_120px_auto]" onSubmit={submit}>
              <Field label="Task">
                <Input value={draft.title} onChange={(e) => setDraft((c) => ({ ...c, title: e.target.value }))} placeholder="Send recap email" />
              </Field>
              <Field label="Account">
                <Select value={draft.accountId} onChange={(e) => setDraft((c) => ({ ...c, accountId: e.target.value }))}>
                  {accounts.map((a) => (
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
              <Button type="submit" variant="primary">
                Add
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {open.length + done.length === 0 ? (
        <EmptyState title="No tasks yet." hint="Add your first task above." />
      ) : (
        groups
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <div key={g.key}>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-label uppercase text-muted-foreground">{g.label}</span>
                <span className="font-mono text-[11px] tabular-nums text-faint-foreground">{g.items.length}</span>
              </div>
              <div className="space-y-2.5">
                {g.items.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    accountName={task.accountId ? accountsById.get(task.accountId)?.name : undefined}
                    notesById={notesById}
                    onToggle={() => onToggleTask(task.id)}
                    onOpenAccount={task.accountId ? () => onSelectAccount(task.accountId!) : undefined}
                  />
                ))}
              </div>
            </div>
          ))
      )}
    </div>
  );
}
