import { Bot, Check, Copy, FolderOpen, X } from "lucide-react";
import type { Account, ActivityEntry, AgentMode, Note, Op, Proposal, Workspace } from "../types";
import { claimKindLabel, dealStageLabel, noteSourceLabel } from "../core/model.ts";
import { pendingProposals, projectPending, proposalApprovalIssue } from "../core/ops.ts";
import { formatDateFull, formatRelative } from "../lib/utils";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, Well } from "../components/ui/card";
import { RedactedChip, useBuildroom } from "../components/ui/privacy";
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
    <div className="flex gap-2 text-body-sm">
      <dt className="w-16 shrink-0 text-label uppercase text-faint-foreground">{label}</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
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
          <div className="text-body font-medium text-foreground">{op.text}</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-faint-foreground">
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
          <p className="whitespace-pre-wrap text-body-sm leading-6 text-muted-foreground">{op.body}</p>
          <div className="font-mono text-[11px] text-faint-foreground">
            {noteSourceLabel[op.source]} · {op.sourceRef || "no source reference"}
          </div>
        </div>
      );
    case "task.add":
      return (
        <div className="space-y-2">
          <div className="text-body font-medium text-foreground">{op.title}</div>
          {op.reason && <p className="text-body-sm text-muted-foreground">{op.reason}</p>}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-faint-foreground">
            <Grounding evidence={op.evidence} notesById={notesById} />
            {op.due && <span className="font-mono">due {op.due.slice(0, 10)}</span>}
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
  const buildroom = useBuildroom();
  const accountId = accountOf(proposal.change.op, workspace);
  const account = accountId ? accountsById.get(accountId) : undefined;
  const conflict = proposalApprovalIssue(workspace, proposal)?.message;
  return (
    <article className="rounded-lg border border-border bg-surface p-4 transition-colors duration-fast hover:border-border-strong">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <Badge tone="agent" icon={Bot}>
          {proposal.actor.name}
        </Badge>
        <span className="text-body-sm text-foreground">{kindLabel[proposal.change.op.type]}</span>
        {account && !buildroom && (
          <button
            onClick={() => onSelectAccount(account.id)}
            className="rounded-sm text-body-sm text-muted-foreground hover:text-accent-fg focus-visible:outline-none focus-visible:focus-ring"
          >
            {account.name}
          </button>
        )}
        <time dateTime={proposal.createdAt} title={formatDateFull(proposal.createdAt)} className="ml-auto font-mono text-[12px] tabular-nums text-faint-foreground">
          {formatRelative(proposal.createdAt)}
        </time>
      </div>

      <Well className="mt-3">
        {buildroom ? <RedactedChip label="detail hidden in share-safe view" /> : <ChangeDetail op={proposal.change.op} workspace={workspace} notesById={notesById} />}
      </Well>

      {conflict && <p role="status" className="mt-3 text-body-sm text-destructive">{conflict}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" disabled={buildroom || Boolean(conflict)} onClick={() => onDecide([proposal.id], "approve")}>
          <Check />
          Approve
        </Button>
        <Button variant="ghost" size="sm" disabled={buildroom} onClick={() => onDecide([proposal.id], "reject")}>
          <X />
          Reject
        </Button>
        {buildroom && <span className="text-[12px] text-faint-foreground">Switch to Private to decide.</span>}
      </div>
    </article>
  );
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const buildroom = useBuildroom();
  return (
    <li className="flex items-baseline gap-3 py-2 text-body-sm">
      <time dateTime={entry.at} title={formatDateFull(entry.at)} className="w-10 shrink-0 font-mono text-[12px] tabular-nums text-faint-foreground">
        {formatRelative(entry.at)}
      </time>
      <span className="shrink-0 text-agent-fg">{entry.actor.name}</span>
      <span className="min-w-0 text-muted-foreground">{buildroom ? "Changed a record" : entry.summary}</span>
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
  const buildroom = useBuildroom();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="font-serif text-h1 text-foreground">Review</h1>
        <p className="mt-0.5 text-body-sm text-muted-foreground">
          {mode === "review" ? "Approve or reject proposed changes." : "Changes apply immediately and stay in the activity log."}
        </p>
      </div>

      {pending.length > 0 ? (
        <section aria-label="Waiting for your review" className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-label uppercase text-muted-foreground">
              {pending.length} waiting
            </div>
            {pending.length > 1 && !buildroom && (
              <Button variant="secondary" size="sm" onClick={() => onDecide(pending.map((p) => p.id), "approve")}>
                <Check />
                Approve all
              </Button>
            )}
          </div>
          {pending.map((proposal) => (
            <ProposalCard key={proposal.id} proposal={proposal} workspace={workspace} accountsById={accountsById} notesById={notesById} onDecide={onDecide} onSelectAccount={onSelectAccount} />
          ))}
        </section>
      ) : (
        <Card className="border-agent/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-agent" />
              {folder ? "No changes waiting" : "Connect an agent"}
            </CardTitle>
            <p className="text-body-sm text-muted-foreground">
              {folder
                ? "Agents can propose updates from this workspace folder."
                : "Sync this workspace to a folder so Codex, Claude, or Cursor can propose updates here."}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {folder ? (
              <>
                <Well className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 font-mono text-[12px] text-foreground">
                    <FolderOpen className="h-3.5 w-3.5 shrink-0 text-agent" />
                    <span className="truncate">{folder.dir}</span>
                  </span>
                  <Button variant="agent" size="sm" onClick={() => onCopy(`${open} && claude`, "Command copied")}>
                    <Copy />
                    Copy command
                  </Button>
                </Well>
                <p className="text-[12px] leading-5 text-faint-foreground">
                  Ask for a daily review, or place a transcript in <code className="font-mono text-muted-foreground">inbox/</code>.
                </p>
              </>
            ) : (
              <>
                <pre className="overflow-x-auto rounded-md border border-border bg-surface-sunken p-3 font-mono text-[12px] leading-6 text-muted-foreground">{SETUP_COMMANDS.join("\n")}</pre>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="agent" size="sm" onClick={() => onCopy(SETUP_COMMANDS.join("\n"), "Commands copied")}>
                    <Copy />
                    Copy commands
                  </Button>
                  <span className="text-[12px] text-faint-foreground">Run these in the Open CRM checkout, then import the workspace from Settings.</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[12px] text-faint-foreground">
        <span>{mode === "review" ? "Review mode · changes wait for approval" : "Direct mode · changes apply immediately"}</span>
        <button
          onClick={() => onSetMode(mode === "review" ? "direct" : "review")}
          className="rounded-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:focus-ring"
        >
          {mode === "review" ? "Switch to direct mode" : "Switch to review mode"}
        </button>
      </div>

      {activity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>What agents did</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {activity.slice(0, 30).map((entry) => (
                <ActivityRow key={entry.id} entry={entry} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
