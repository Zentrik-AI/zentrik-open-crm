import type { Account, Deal, Task, Workspace } from "../types.ts";
import { DAY_MS, isOpenDeal } from "./model.ts";
import { pendingProposals } from "./ops.ts";

/**
 * The daily brief: what needs a person's attention, and why. Every item names
 * the record it is about, so an agent can act on it and cite it.
 */

export type AttentionKind = "task_overdue" | "task_due_soon" | "account_at_risk" | "account_quiet" | "account_ungrounded" | "deal_unattended";

export interface AttentionItem {
  kind: AttentionKind;
  /** 1 is most urgent. */
  rank: number;
  why: string;
  accountId?: string;
  accountName?: string;
  recordId: string;
}

export interface Brief {
  generatedAt: string;
  workspace: string;
  counts: { accounts: number; openDeals: number; openTasks: number; notes: number; pendingProposals: number };
  weightedPipeline: number;
  attention: AttentionItem[];
}

const QUIET_DAYS = 14;
const DUE_SOON_DAYS = 3;
const CLOSING_DAYS = 14;

const days = (ms: number) => Math.max(1, Math.round(ms / DAY_MS));
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function buildBrief(workspace: Workspace, now: Date = new Date()): Brief {
  const t = now.getTime();
  const byId = new Map(workspace.accounts.map((a) => [a.id, a]));
  const nameOf = (id?: string) => (id ? byId.get(id)?.name : undefined);
  const openTasks = workspace.tasks.filter((task) => task.status === "open");
  const openDeals = workspace.deals.filter((deal) => isOpenDeal(deal.stage));
  const attention: AttentionItem[] = [];

  const taskItem = (task: Task, kind: AttentionKind, rank: number, why: string) =>
    attention.push({ kind, rank, why, accountId: task.accountId, accountName: nameOf(task.accountId), recordId: task.id });
  for (const task of openTasks) {
    const diff = new Date(task.due).getTime() - t;
    if (diff < 0) taskItem(task, "task_overdue", 1, `"${task.title}" is ${plural(days(-diff), "day")} overdue (${task.priority}).`);
    else if (diff < DUE_SOON_DAYS * DAY_MS) taskItem(task, "task_due_soon", 3, `"${task.title}" is due within ${plural(days(diff), "day")} (${task.priority}).`);
  }

  const accountItem = (account: Account, kind: AttentionKind, rank: number, why: string) =>
    attention.push({ kind, rank, why, accountId: account.id, accountName: account.name, recordId: account.id });
  for (const account of workspace.accounts) {
    const notes = workspace.notes.filter((note) => note.accountId === account.id);
    if (account.stage === "at_risk") accountItem(account, "account_at_risk", 2, `${account.name} is at risk${account.risks[0] ? `: ${account.risks[0]}` : "."}`);
    if (notes.length === 0) {
      accountItem(account, "account_ungrounded", 4, `${account.name} has no source notes. Capture what you know before acting on it.`);
    } else {
      const quietFor = t - new Date(account.lastTouch).getTime();
      if (quietFor > QUIET_DAYS * DAY_MS) accountItem(account, "account_quiet", 4, `${account.name} has had no recorded touch in ${plural(days(quietFor), "day")}.`);
    }
  }

  const dealItem = (deal: Deal, why: string) =>
    attention.push({ kind: "deal_unattended", rank: 2, why, accountId: deal.accountId, accountName: nameOf(deal.accountId), recordId: deal.id });
  for (const deal of openDeals) {
    const closesIn = new Date(deal.closeDate).getTime() - t;
    const hasNextStep = openTasks.some((task) => task.accountId === deal.accountId);
    if (closesIn < 0) dealItem(deal, `${deal.name} is past its close date and still in ${deal.stage}.`);
    else if (closesIn < CLOSING_DAYS * DAY_MS && !hasNextStep) dealItem(deal, `${deal.name} closes in ${plural(days(closesIn), "day")} and its account has no open task.`);
  }

  attention.sort((a, b) => a.rank - b.rank);

  return {
    generatedAt: now.toISOString(),
    workspace: workspace.name,
    counts: {
      accounts: workspace.accounts.length,
      openDeals: openDeals.length,
      openTasks: openTasks.length,
      notes: workspace.notes.length,
      pendingProposals: pendingProposals(workspace).length,
    },
    weightedPipeline: Math.round(openDeals.reduce((sum, deal) => sum + (deal.value * deal.probability) / 100, 0)),
    attention,
  };
}
