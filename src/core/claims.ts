import type { Claim, ClaimKind, Workspace } from "../types.ts";
import { stableId } from "./model.ts";

/**
 * Claims are the source of truth for what a team knows about an account. The
 * `needs` and `risks` lists on each account are kept for readers that predate
 * claims; they are derived here from the active claims of those kinds.
 */

const LEGACY_KINDS: Array<{ kind: ClaimKind; field: "needs" | "risks" }> = [
  { kind: "need", field: "needs" },
  { kind: "risk", field: "risks" },
];

export function activeClaims(workspace: Workspace, accountId: string, kind?: ClaimKind): Claim[] {
  return (workspace.claims ?? []).filter((c) => c.accountId === accountId && c.status === "active" && (!kind || c.kind === kind));
}

/** Rewrite each account's `needs` and `risks` from its active claims. */
export function deriveAccountLists(workspace: Workspace): Workspace {
  if (!workspace.claims) return workspace;
  return {
    ...workspace,
    accounts: workspace.accounts.map((account) => {
      const needs = activeClaims(workspace, account.id, "need").map((c) => c.text);
      const risks = activeClaims(workspace, account.id, "risk").map((c) => c.text);
      const same = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);
      return same(needs, account.needs) && same(risks, account.risks) ? account : { ...account, needs, risks };
    }),
  };
}

/** Turn legacy `needs` and `risks` strings into claims once. A string that
 *  already has an active claim of its kind is left alone, so this is safe to
 *  run on every read. Synthesized claims have no evidence: they are hunches
 *  until someone cites a note. */
export function migrateLegacyClaims(workspace: Workspace): Claim[] {
  const claims = [...(workspace.claims ?? [])];
  for (const account of workspace.accounts) {
    for (const { kind, field } of LEGACY_KINDS) {
      for (const text of account[field] ?? []) {
        if (claims.some((c) => c.accountId === account.id && c.kind === kind && c.status === "active" && c.text === text)) continue;
        claims.push({
          id: stableId("claim", account.id, kind, text),
          accountId: account.id,
          kind,
          text,
          evidence: [],
          status: "active",
          createdAt: account.createdAt ?? workspace.updatedAt,
        });
      }
    }
  }
  return claims;
}
