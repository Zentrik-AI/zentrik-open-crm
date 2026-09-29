import type { ClaimKind, Op, Workspace } from "../types.ts";

export type InvestigationStatus = "matching" | "checking" | "ready" | "error";
export interface InvestigationDecision {
  id: string; callId: string; sourceRef: string; quote: string; start: number; end: number;
  accountId?: string; accountName?: string;
  kind: "add" | "replace" | "complete" | "unchanged" | "clarify" | "error";
  title: string; before?: string; after?: string;
  qualification?: "explicit" | "conditional" | "unclear";
  dependsOn?: string;
  model?: string; op?: Op; appliedAt?: string; noteId?: string;
}
export interface InvestigationRun {
  id: string; status: InvestigationStatus; startedAt: string; finishedAt?: string;
  accounts?: {id:string;name:string;passages:number}[];
  total: number; matched: number; checked: number; decisions: InvestigationDecision[];
  currentAccount?: string; error?: string;
}
export const investigationKinds: Record<ClaimKind,string> = {
  need: "Customer need", risk: "Risk", objection: "Objection", goal: "Goal", commitment: "Commitment", fact: "Account fact",
};
/** Only records used for decisions participate in the stale-write check. */
export function investigationBaseline(workspace: Workspace, accountId: string): string {
  return JSON.stringify({ account: workspace.accounts.find(a=>a.id===accountId),
    claims:(workspace.claims ?? []).filter(c=>c.accountId===accountId),
    tasks:workspace.tasks.filter(t=>t.accountId===accountId) });
}
