import { Bot, Check, Copy, FolderOpen, X } from "lucide-react";
import type { Account, ActivityEntry, AgentMode, Note, Op, Proposal, Workspace } from "../types";
import { claimKindLabel, dealStageLabel, noteSourceLabel } from "../core/model.ts";
import { pendingProposals, projectPending, proposalApprovalIssue } from "../core/ops.ts";
import { cn, formatDateFull, formatRelative } from "../lib/utils";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { RedactedChip, useShareSafe } from "../components/ui/privacy";
import { Grounding } from "../components/grounding";

const SETUP_COMMANDS = ["npm run crm -- init ~/crm", "cd ~/crm && ./crm ui"];

const kindLabel: Record<Op["type"], string> = {
  "account.add": "New account",
  "account.update": "Account update",
  "account.archive": "Account archive / restore",
  "contact.add": "New contact",
  "deal.add": "New deal",
  "deal.move": "Deal stage",
  "task.add": "New task",
  "task.set_status": "Task status",
  "task.update": "Task update",
  "note.add": "New note",
  "claim.add": "New fact",
  "claim.resolve": "Fact resolved",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-body-sm">
      <dt className="w-20 shrink-0 text-label leading-5 text-faint-foreground">{label.charAt(0).toUpperCase() + label.slice(1)}</dt>
      <dd className="min-w-0 text-foreground [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

const showValue = (value: unknown) => value == null ? "unknown" : Array.isArray(value) ? value.join(" · ") : String(value);

function ComparedValue({ current, proposed }: { current: unknown; proposed: unknown }) {
  return <><span className="text-muted-foreground">{showValue(current)}</span><span aria-label="changes to"> → </span><span>{showValue(proposed)}</span></>;
}

/** The substance of a proposed change, in the words a person would use. */
function ChangeDetail({ op, workspace, notesById }: { op: Op; workspace: Workspace; notesById: Map<string, Note> }) {
  switch (op.type) {
    case "account.archive":
      return <p>{op.archived ? "Archive" : "Restore"} account · {op.reason}. History is retained.</p>;
    case "task.update":
      return <dl className="space-y-1">{Object.entries(op.patch).map(([key, value]) => <Field key={key} label={key}><ComparedValue current={workspace.tasks.find(t => t.id === op.taskId)?.[key as keyof import("../types").Task]} proposed={value} /></Field>)}</dl>;
    case "claim.add":
      return (
        <div className="space-y-2">
          <div className="text-body font-medium text-foreground [overflow-wrap:anywhere]">{op.text}</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-label text-faint-foreground">
            <span>{claimKindLabel[op.kind].singular}{op.kind === "commitment" && op.owner ? ` · ${op.owner === "them" ? "theirs" : "ours"}` : ""}{op.due ? ` · by ${op.due.slice(0, 10)}` : ""}</span>
            <Grounding evidence={op.evidence} notesById={notesById} />
          </div>
        </div>
      );
    case "claim.resolve": {
      const current = workspace.claims?.find((c) => c.id === op.claimId);
      return (
        <div className="space-y-2">
          <p className="text-body-sm text-muted-foreground">
            No longer true: <span className="text-foreground">{current?.text ?? op.claimId}</span>
          </p>
          <p className="text-body-sm text-muted-foreground">{op.reason}</p>
          {op.replacement && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-body font-medium text-foreground">Now: {op.replacement.text}</span>
              <Grounding evidence={op.replacement.evidence} notesById={notesById} />
            </div>
          )}
        </div>
      );
    }
    case "note.add":
      return (
        <div className="space-y-2">
          <div className="text-body font-medium text-foreground">{op.title}</div>
          <p className="line-clamp-4 whitespace-pre-wrap text-body-sm leading-6 text-muted-foreground">{op.body}</p>
          <div className="flex flex-wrap items-center gap-x-2 text-label text-faint-foreground">
            <span>{noteSourceLabel[op.source]}</span>
            <span aria-hidden>·</span>
            {op.sourceRef ? <span className="break-all font-mono">{op.sourceRef}</span> : <span>no source reference</span>}
          </div>
        </div>
      );
    case "task.add":
      return (
        <div className="space-y-2">
          <div className="text-body font-medium text-foreground">{op.title}</div>
          {op.reason && <p className="text-body-sm text-muted-foreground">{op.reason}</p>}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-label text-faint-foreground">
            <Grounding evidence={op.evidence} notesById={notesById} />
            {op.due && <span className="tnum">due {op.due.slice(0, 10)}</span>}
            {op.priority && <span>{op.priority}</span>}
            {op.owner && <span>{op.owner}</span>}
          </div>
        </div>
      );
    case "task.set_status":
      return (
        <p className="text-body-sm text-muted-foreground">
          {op.status}:{" "}
          <span className="text-foreground">{workspace.tasks.find((t) => t.id === op.taskId)?.title ?? op.taskId}</span>
        </p>
      );
    case "deal.add":
      return (
        <dl className="space-y-1">
          <Field label="Deal">{op.name}</Field>
          <Field label="Value">{`$${(op.value ?? 0).toLocaleString("en-US")} · ${dealStageLabel[op.stage ?? "lead"]}`}</Field>
        </dl>
      );
    case "deal.move":
      return (
        <p className="text-body-sm text-muted-foreground">
          Move <span className="text-foreground">{workspace.deals.find((d) => d.id === op.dealId)?.name ?? op.dealId}</span> to{" "}
          <span className="text-foreground">{dealStageLabel[op.stage]}</span>
        </p>
      );
    case "account.add":
      return (
        <dl className="space-y-1">
          <Field label="Name">{op.name}</Field>
          {op.segment && <Field label="About">{op.segment}</Field>}
          {op.owner && <Field label="Owner">{op.owner}</Field>}
        </dl>
      );
    case "account.update":
      return (
        <dl className="space-y-1">
          {Object.entries(op.patch).map(([key, value]) => (
            <Field key={key} label={key}>
              <ComparedValue current={workspace.accounts.find(a => a.id === op.accountId)?.[key as keyof Account]} proposed={value} />
            </Field>
          ))}
        </dl>
      );
    case "contact.add":
      return (
        <dl className="space-y-1">
          <Field label="Person">{`${op.name} — ${op.role}`}</Field>
          {op.email && <Field label="Email">{op.email}</Field>}
        </dl>
      );
  }
}

function accountOf(op: Op, workspace: Workspace): string | undefined {
  if ("accountId" in op && op.accountId) return op.accountId;
  if (op.type === "deal.move") return workspace.deals.find((d) => d.id === op.dealId)?.accountId;
  if (op.type === "task.set_status" || op.type === "task.update") return workspace.tasks.find((t) => t.id === op.taskId)?.accountId;
  if (op.type === "claim.resolve") return workspace.claims?.find((c) => c.id === op.claimId)?.accountId;
  return undefined;
}

function ProposalCard({
  proposal,
  workspace,
  accountsById,
  notesById,
  onDecide,
  onSelectAccount,
}: {
  proposal: Proposal;
  workspace: Workspace;
  accountsById: Map<string, Account>;
  notesById: Map<string, Note>;
  onDecide: (ids: string[], decision: "approve" | "reject") => void;
  onSelectAccount: (id: string) => void;
}) {
  const shareSafe = useShareSafe();
  const accountId = accountOf(proposal.change.op, workspace);
  const account = accountId ? accountsById.get(accountId) : undefined;
  const conflict = proposalApprovalIssue(workspace, proposal)?.message;
  return (
    <article className="group relative px-5 py-4 transition-colors duration-fast hover:bg-secondary/30">
      <span className="absolute inset-y-4 left-0 w-0.5 rounded-full bg-agent/70" aria-hidden />
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <Badge tone="agent" icon={Bot}>
          {proposal.actor.name}
        </Badge>
        <span className="text-body-sm font-medium text-foreground">{kindLabel[proposal.change.op.type]}</span>
        {account && !shareSafe && (
          <>
            <span className="text-faint-foreground" aria-hidden>·</span>
            <button
              onClick={() => onSelectAccount(account.id)}
              className="rounded-sm text-body-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:focus-ring"
            >
              {account.name}
            </button>
          </>
        )}
        <time dateTime={proposal.createdAt} title={formatDateFull(proposal.createdAt)} className="ml-auto tnum text-label text-faint-foreground">
          {formatRelative(proposal.createdAt)}
        </time>
      </div>

      <div className="mt-2.5">
        {shareSafe ? <RedactedChip label="detail hidden in share-safe view" /> : <ChangeDetail op={proposal.change.op} workspace={workspace} notesById={notesById} />}
      </div>

      {conflict && <p role="status" className="mt-3 rounded-lg bg-destructive-bg px-3 py-2 text-body-sm text-destructive-fg">{conflict}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" disabled={shareSafe || Boolean(conflict)} onClick={() => onDecide([proposal.id], "approve")}>
          <Check />
          Approve
        </Button>
        <Button variant="ghost" size="sm" disabled={shareSafe} onClick={() => onDecide([proposal.id], "reject")}>
          <X />
          Reject
        </Button>
        {shareSafe && <span className="text-label text-faint-foreground">Switch to Private to decide.</span>}
      </div>
    </article>
  );
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const shareSafe = useShareSafe();
  return (
    <li className="flex items-baseline gap-3 px-5 py-2.5 text-body-sm">
      <time dateTime={entry.at} title={formatDateFull(entry.at)} className="w-8 shrink-0 tnum text-label text-faint-foreground">
        {formatRelative(entry.at)}
      </time>
      <span className="shrink-0 text-agent-fg">{entry.actor.name}</span>
      <span className="min-w-0 text-muted-foreground [overflow-wrap:anywhere]">{shareSafe ? "Changed a record" : entry.summary}</span>
    </li>
  );
}

export function ReviewView({
  workspace,
  accountsById,
  folder,
  onDecide,
  onSetMode,
  onSelectAccount,
  onCopy,
}: {
  workspace: Workspace;
  accountsById: Map<string, Account>;
  /** Set when the app runs on a workspace folder that agents can reach. */
  folder: { dir?: string; name?: string } | null;
  onDecide: (ids: string[], decision: "approve" | "reject") => void;
  onSetMode: (mode: AgentMode) => void;
  onSelectAccount: (id: string) => void;
  onCopy: (text: string, label: string) => void;
}) {
  // Oldest first: a note reads before the task that builds on it, and approving
  // top to bottom always works.
  const pending = [...pendingProposals(workspace)].reverse();
  // Grounding may cite a note that is itself still waiting for review.
  const notesById = new Map(projectPending(workspace).notes.map((note) => [note.id, note]));
  const mode = workspace.agentMode ?? "review";
  const activity = workspace.activity ?? [];
  const open = folder?.dir ? `cd ${folder.dir}` : "";
  const shareSafe = useShareSafe();

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h1 text-foreground">Review</h1>
          <p className="mt-1 text-body-sm text-muted-foreground">
            {mode === "review" ? "Approve or reject what agents propose." : "Agent changes apply immediately and stay in the log."}
          </p>
        </div>
        <div role="group" aria-label="Agent mode" className="inline-flex rounded-lg border border-border bg-surface-sunken p-0.5">
          {(["review", "direct"] as const).map((value) => (
            <button
              key={value}
              onClick={() => mode !== value && onSetMode(value)}
              aria-pressed={mode === value}
              title={value === "review" ? "Changes wait for your approval" : "Changes apply immediately"}
              className={cn(
                "h-7 rounded-md px-3 text-body-sm font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:focus-ring",
                mode === value ? "bg-surface-raised text-foreground shadow-e1" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value === "review" ? "Ask first" : "Direct"}
            </button>
          ))}
        </div>
      </header>

      {pending.length > 0 ? (
        <section aria-label="Waiting for your review" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-h3 text-foreground">
              Waiting <span className="ml-1 tnum font-medium text-faint-foreground">{pending.length}</span>
            </h2>
            {pending.length > 1 && !shareSafe && (
              <Button variant="primary" size="sm" onClick={() => onDecide(pending.map((p) => p.id), "approve")}>
                <Check />
                Approve all
              </Button>
            )}
          </div>
          <Card className="divide-y divide-border overflow-hidden">
            {pending.map((proposal) => (
              <ProposalCard key={proposal.id} proposal={proposal} workspace={workspace} accountsById={accountsById} notesById={notesById} onDecide={onDecide} onSelectAccount={onSelectAccount} />
            ))}
          </Card>
        </section>
      ) : (
        <Card className="flex flex-col items-center px-6 py-12 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-agent-bg text-agent-fg">
            <Bot className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="mt-4 text-h2 text-foreground">{folder ? "No changes waiting" : "Connect an agent"}</h2>
          <p className="mt-1 max-w-sm text-body-sm text-muted-foreground">
            {folder
              ? "Run an agent in this folder and its proposals land here."
              : "Run Open CRM on a folder so agents can propose updates here."}
          </p>
          {folder ? (
            <div className="mt-5 flex w-full max-w-md flex-col items-center gap-3">
              <span className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-border bg-surface-sunken px-3 py-2 font-mono text-label text-muted-foreground">
                <FolderOpen className="h-3.5 w-3.5 shrink-0 text-faint-foreground" aria-hidden />
                <span className="truncate" title={folder.dir}>{folder.dir}</span>
              </span>
              <Button variant="agent" size="sm" onClick={() => onCopy(`${open} && claude`, "Command copied")}>
                <Copy />
                Copy command
              </Button>
            </div>
          ) : (
            <div className="mt-5 flex w-full max-w-md flex-col items-center gap-3">
              <pre className="w-full overflow-x-auto rounded-lg border border-border bg-surface-sunken px-4 py-3 text-left font-mono text-label leading-6 text-muted-foreground">{SETUP_COMMANDS.join("\n")}</pre>
              <Button variant="agent" size="sm" onClick={() => onCopy(SETUP_COMMANDS.join("\n"), "Commands copied")}>
                <Copy />
                Copy commands
              </Button>
            </div>
          )}
        </Card>
      )}

      {activity.length > 0 && (
        <section aria-label="Agent activity" className="space-y-3">
          <h2 className="text-h3 text-foreground">What agents did</h2>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {activity.slice(0, 30).map((entry) => (
                <ActivityRow key={entry.id} entry={entry} />
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}
