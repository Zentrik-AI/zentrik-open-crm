import { useMemo, useState } from "react";
import { ArrowUpRight, Check, CircleAlert, Download, ExternalLink } from "lucide-react";
import type { Account, Workspace } from "../types";
import { lintWorkspace, type LintCode, type LintFinding } from "../core/memory";
import { findPatterns, signalsBundle, type Pattern } from "../core/patterns";
import { accountStages } from "../core/model";
import { brand } from "../lib/brand";
import { claimKindMeta, stageMeta } from "../lib/meta";
import { cn, formatCurrency, formatRelative } from "../lib/utils";
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
  const warn = top?.severity === "warn";
  return (
    <button
      onClick={onOpen}
      className="group w-full rounded-xl border border-border bg-card p-3.5 text-left shadow-e1 transition-[border-color,box-shadow,transform] duration-fast ease-out hover:-translate-y-px hover:border-border-strong hover:shadow-e2 focus-visible:outline-none focus-visible:focus-ring motion-reduce:hover:translate-y-0"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-body font-medium text-foreground">{account.name}</div>
          <div className="truncate text-label font-normal text-faint-foreground">{account.segment}</div>
        </div>
        <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint-foreground opacity-0 transition-opacity duration-fast group-hover:opacity-100" aria-hidden />
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2 text-label font-normal">
        <span className="min-w-0 truncate text-muted-foreground">
          {account.owner} <span className="text-faint-foreground">·</span>{" "}
          <span className={cn("tnum", !account.lastTouch && "text-warning-fg")} title="Last verified contact">
            {account.lastTouch ? `${formatRelative(account.lastTouch)} ago` : "no verified contact"}
          </span>
        </span>
        <Private redactedLabel="hidden">
          <span className="tnum shrink-0 font-medium text-foreground">{formatCurrency(account.arr + openPipeline)}</span>
        </Private>
      </div>
      {claims.length > 0 && (
        <div className="mt-2.5" title={`${grounded} of ${claims.length} claims grounded`}>
          <Meter value={claims.length ? Math.round((grounded / claims.length) * 100) : null} tone="accent" ticks={false} weak={false} label="Grounded" display={`${grounded}/${claims.length}`} />
        </div>
      )}
      <div className="mt-3 flex items-start gap-1.5 border-t border-border pt-2.5 text-label font-normal leading-[18px]">
        {top ? (
          <CircleAlert className={cn("mt-px h-3.5 w-3.5 shrink-0", warn ? "text-warning" : "text-faint-foreground")} aria-hidden />
        ) : (
          <Check className="mt-px h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
        )}
        <span className={cn("line-clamp-3", top ? (warn ? "text-foreground" : "text-muted-foreground") : "text-faint-foreground")}>
          {top ? (shareSafe && /"/.test(top.message) ? <RedactedChip label="detail hidden" /> : top.message) : "Memory is sound."}
        </span>
      </div>
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
    <div className="grid gap-3 py-4 first:pt-0 last:pb-0 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-8">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          <span className="text-label font-normal text-faint-foreground">
            <span className="tnum">{pattern.accounts.length}</span> accounts · <span className="tnum">{pattern.notes.length}</span> {pattern.notes.length === 1 ? "source" : "sources"}
            {pattern.hunches ? <> · <span className="tnum">{pattern.hunches}</span> unsourced</> : null}
          </span>
        </div>
        <p className="mt-2 text-body font-medium text-foreground">{shareSafe && meta.sensitive ? <RedactedChip label={`${meta.label.toLowerCase()} hidden in share-safe view`} /> : pattern.label}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-1 text-body-sm">
          {pattern.accounts.map((a, i) => (
            <span key={a.id} className="inline-flex items-center gap-1">
              {i > 0 && <span className="text-faint-foreground" aria-hidden>·</span>}
              <button onClick={() => onOpenAccount(a.id)} className="rounded-sm text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:focus-ring">
                {a.name}
              </button>
            </span>
          ))}
        </div>
        {pattern.terms.length > 0 && <p className="mt-1 text-label font-normal text-faint-foreground">Grouped on: {pattern.terms.join(", ")}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 lg:flex-col lg:items-end lg:justify-center">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-label font-normal text-muted-foreground">
            <input type="checkbox" className="accent-[hsl(var(--accent))]" checked={rolesOnly} onChange={(e) => setRolesOnly(e.target.checked)} />
            People as roles, no emails
          </label>
          <Button size="sm" variant="secondary" onClick={download} disabled={shareSafe} title={shareSafe ? "Switch to Private view to export" : "Download the sources behind this pattern"}>
            <Download />
            Sources
          </Button>
        </div>
        <a href={brand.productWorkUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-sm text-label text-accent-fg hover:underline focus-visible:outline-none focus-visible:focus-ring">
          Decide what to build in {brand.maker}
          <ExternalLink className="h-3 w-3" aria-hidden />
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
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-7">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-h1 text-foreground">Book</h1>
          <p className="mt-1 text-body-sm text-muted-foreground">
            <span className="tnum">{active.length}</span> {active.length === 1 ? "account" : "accounts"} by stage
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
                  "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-label transition-colors duration-fast focus-visible:outline-none focus-visible:focus-ring",
                  filter === f.code
                    ? "border-accent/50 bg-accent-bg text-accent-fg"
                    : "border-border bg-surface-raised text-muted-foreground hover:border-border-strong hover:text-foreground",
                )}
              >
                <span className={cn("tnum", filter === f.code ? "text-accent-fg" : "text-foreground")}>{f.count}</span> {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {active.length === 0 ? (
        <EmptyState title="No accounts yet" hint="Add an account and it appears here by stage." />
      ) : (
        <div className="grid gap-x-3 gap-y-6 md:grid-cols-2 xl:grid-cols-5">
          {accountStages.map((stage, index) => {
            const lane = shown.filter((a) => a.stage === stage);
            const meta = stageMeta[stage];
            const risk = stage === "at_risk";
            return (
              <section key={stage} aria-label={meta.label} className="min-w-0 animate-settle" style={{ animationDelay: `${index * 40}ms` }}>
                <div className="mb-2 flex h-6 items-center gap-2 px-0.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full", risk ? "bg-destructive" : "bg-faint-foreground/60")} aria-hidden />
                  <span className="text-body-sm font-medium text-foreground">{meta.label}</span>
                  <span className="tnum text-body-sm text-faint-foreground">{lane.length}</span>
                </div>
                <div className="space-y-2">
                  {lane.length === 0 ? (
                    <div className="flex h-[72px] items-center justify-center rounded-xl bg-surface-sunken/70 text-label font-normal text-faint-foreground">{filter ? "None here." : "Empty."}</div>
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
        <CardHeader className="pb-2">
          <CardTitle className="text-h2">What several accounts are saying</CardTitle>
          <p className="text-body-sm text-muted-foreground">The same need, objection or risk, heard from more than one account.</p>
        </CardHeader>
        <CardContent className="pt-2">
          {patterns.length === 0 ? (
            <p className="py-2 text-body-sm text-faint-foreground">Nothing shared across accounts yet.</p>
          ) : (
            <div className="divide-y divide-border">
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
