import { useMemo, useState } from "react";
import { ArrowUpRight, Download, ExternalLink } from "lucide-react";
import type { Account, Workspace } from "../types";
import { lintWorkspace, type LintCode, type LintFinding } from "../core/memory";
import { findPatterns, signalsBundle, type Pattern } from "../core/patterns";
import { accountStages } from "../core/model";
import { brand } from "../lib/brand";
import { claimKindMeta, stageMeta } from "../lib/meta";
import { cn, formatRelative } from "../lib/utils";
import { ArrValue } from "../components/account-bits";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { EmptyState } from "../components/ui/empty-state";
import { Meter } from "../components/ui/meter";
import { Private, RedactedChip, useShareSafe } from "../components/ui/privacy";

/**
 * The book of accounts. Every account in its stage lane, each tile carrying
 * the one thing about it worth noticing, and below them what several accounts
 * are saying at once. Built for the weekly pass, and for the person with too
 * many accounts to open one by one.
 */

const filters: Array<{ code: LintCode; label: string }> = [
  { code: "overdue_commitment", label: "overdue commitment" },
  { code: "hunch", label: "unsourced claim" },
  { code: "no_economic_buyer", label: "no one who signs off" },
  { code: "stale_evidence", label: "stale evidence" },
  { code: "no_verified_interaction", label: "no verified contact" },
];

function AccountTile({ account, workspace, findings, onOpen }: { account: Account; workspace: Workspace; findings: LintFinding[]; onOpen: () => void }) {
  const claims = (workspace.claims ?? []).filter((c) => c.accountId === account.id && c.status === "active");
  const grounded = claims.filter((c) => c.evidence.length > 0).length;
  const openPipeline = workspace.deals.filter((d) => d.accountId === account.id && d.stage !== "won" && d.stage !== "lost").reduce((s, d) => s + d.value, 0);
  const top = findings.find((f) => f.severity === "warn") ?? findings[0];
  const shareSafe = useShareSafe();
  return (
    <button
      onClick={onOpen}
      className="group w-full rounded-lg border border-border bg-card p-3 text-left transition-[border-color,box-shadow,transform] duration-fast ease-out hover:-translate-y-px hover:border-border-strong hover:shadow-e1 focus-visible:outline-none focus-visible:focus-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-body font-medium text-foreground">{account.name}</div>
          <div className="truncate text-[12px] text-muted-foreground">{account.segment}</div>
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-faint-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      </div>
      <div className="mt-2.5 flex items-baseline justify-between gap-2 text-[12px]">
        <span className="text-muted-foreground">
          {account.owner} ·{" "}
          <span className={cn("font-mono tabular-nums", !account.lastTouch && "text-warning-fg")} title="Last verified contact">
            {account.lastTouch ? formatRelative(account.lastTouch) : "no verified contact"}
          </span>
        </span>
        <ArrValue value={account.arr + openPipeline} className="text-[12px]" />
      </div>
      {claims.length > 0 && (
        <div className="mt-2" title={`${grounded} of ${claims.length} claims grounded`}>
          <Meter value={claims.length ? Math.round((grounded / claims.length) * 100) : null} tone="accent" label="Grounded" display={`${grounded}/${claims.length}`} />
        </div>
      )}
      <p className={cn("mt-2 text-[12px] leading-5", top ? (top.severity === "warn" ? "text-foreground" : "text-muted-foreground") : "text-faint-foreground")}>
        {top ? (shareSafe && /"/.test(top.message) ? <RedactedChip label="detail hidden" /> : top.message) : "Memory is sound."}
      </p>
    </button>
  );
}

function PatternCard({ pattern, workspace, onOpenAccount }: { pattern: Pattern; workspace: Workspace; onOpenAccount: (id: string) => void }) {
  const shareSafe = useShareSafe();
  const kind = pattern.kinds[0].kind;
  const meta = claimKindMeta[kind];
  const [rolesOnly, setRolesOnly] = useState(true);
  function download() {
    const bundle = signalsBundle(workspace, { pattern, shareSafe: rolesOnly, product: brand.name });
    const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2) + "\n"], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `open-crm-signals-${pattern.id.slice(-6)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={meta.tone} dot>
          {meta.label}
        </Badge>
        <span className="text-[12px] text-faint-foreground">{pattern.accounts.length} accounts · {pattern.notes.length} {pattern.notes.length === 1 ? "source" : "sources"}{pattern.hunches ? ` · ${pattern.hunches} unsourced` : ""}</span>
      </div>
      <p className="mt-2 text-body text-foreground">{shareSafe && meta.sensitive ? <RedactedChip label={`${meta.label.toLowerCase()} hidden in share-safe view`} /> : pattern.label}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {pattern.accounts.map((a) => (
          <button key={a.id} onClick={() => onOpenAccount(a.id)} className="rounded-sm border border-border bg-card px-1.5 py-0.5 text-[12px] text-muted-foreground hover:text-accent-fg focus-visible:outline-none focus-visible:focus-ring">
            {a.name}
          </button>
        ))}
      </div>
      {pattern.terms.length > 0 && <p className="mt-2 text-[11px] text-faint-foreground">Grouped on: {pattern.terms.join(", ")}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-3">
        <Button size="sm" variant="secondary" onClick={download} disabled={shareSafe} title={shareSafe ? "Switch to Private view to export" : "Download the sources behind this pattern"}>
          <Download />
          Sources
        </Button>
        <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <input type="checkbox" checked={rolesOnly} onChange={(e) => setRolesOnly(e.target.checked)} />
          People as roles, no emails
        </label>
        <a href={brand.productWorkUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 rounded-sm text-[12px] text-accent-fg hover:underline focus-visible:outline-none focus-visible:focus-ring">
          Decide what to build in {brand.maker}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

export function BookView({ workspace, onSelectAccount }: { workspace: Workspace; onSelectAccount: (id: string) => void }) {
  const [filter, setFilter] = useState<LintCode | null>(null);
  const findings = useMemo(() => lintWorkspace(workspace), [workspace]);
  const patterns = useMemo(() => findPatterns(workspace), [workspace]);
  const active = workspace.accounts.filter((a) => !a.archivedAt);
  const byAccount = new Map<string, LintFinding[]>();
  for (const f of findings) if (f.accountId) byAccount.set(f.accountId, [...(byAccount.get(f.accountId) ?? []), f]);
  const counts = filters.map((f) => ({ ...f, count: new Set(findings.filter((x) => x.code === f.code).map((x) => x.accountId)).size })).filter((f) => f.count > 0);
  const shown = filter ? active.filter((a) => byAccount.get(a.id)?.some((f) => f.code === filter)) : active;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-h1 text-foreground">Book</h1>
          <p className="mt-0.5 text-body-sm text-muted-foreground">
            {active.length} {active.length === 1 ? "account" : "accounts"} by stage. Each tile carries the one thing worth noticing.
          </p>
        </div>
        {counts.length > 0 && (
          <div role="group" aria-label="Show accounts with" className="flex flex-wrap gap-1.5">
            {counts.map((f) => (
              <button
                key={f.code}
                aria-pressed={filter === f.code}
                onClick={() => setFilter(filter === f.code ? null : f.code)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[12px] transition-colors duration-fast focus-visible:outline-none focus-visible:focus-ring",
                  filter === f.code ? "border-accent bg-accent-bg text-accent-fg" : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
                )}
              >
                <span className="font-mono tabular-nums">{f.count}</span> {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {active.length === 0 ? (
        <EmptyState title="No accounts yet." hint="Add one under Accounts and it appears here in its stage." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {accountStages.map((stage) => {
            const lane = shown.filter((a) => a.stage === stage);
            const meta = stageMeta[stage];
            return (
              <section key={stage} aria-label={meta.label} className="min-w-0">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className={cn("text-label uppercase", `text-${meta.tone}-fg`)}>{meta.label}</span>
                  <span className="font-mono text-[11px] tabular-nums text-faint-foreground">{lane.length}</span>
                </div>
                <div className="space-y-2.5">
                  {lane.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-3 text-[12px] text-faint-foreground">{filter ? "None here." : "Empty."}</div>
                  ) : (
                    lane.map((account) => <AccountTile key={account.id} account={account} workspace={workspace} findings={byAccount.get(account.id) ?? []} onOpen={() => onSelectAccount(account.id)} />)
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-h2">What several accounts are saying</CardTitle>
          <p className="text-body-sm text-muted-foreground">
            When more than one account records the same need, objection, or risk, it stops being account work. {brand.name} notices it and hands the sources on; deciding what to build is what {brand.maker} is for.
          </p>
        </CardHeader>
        <CardContent>
          {patterns.length === 0 ? (
            <p className="text-body-sm text-muted-foreground">Nothing is said by more than one account yet. It fills in as you record what each account says.</p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {patterns.map((p) => (
                <PatternCard key={p.id} pattern={p} workspace={workspace} onOpenAccount={onSelectAccount} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Private sensitive={false}>
        <span className="sr-only">Book view</span>
      </Private>
    </div>
  );
}
