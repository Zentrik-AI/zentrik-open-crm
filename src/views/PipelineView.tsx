import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import type { Account, Deal } from "../types";
import type { DealDraft } from "../lib/drafts";
import { dealStages } from "../lib/drafts";
import { dealStageMeta, pipelineColumns, isOpenDeal } from "../lib/meta";
import { cn, formatCurrency, splitCurrency } from "../lib/utils";
import { Button } from "../components/ui/button";
import { Field, Input, Select } from "../components/ui/field";
import { Card, CardContent } from "../components/ui/card";
import { DealCard } from "../components/deal-card";
import { Private } from "../components/ui/privacy";

export function PipelineView({
  deals,
  accounts,
  accountsById,
  onAdvanceDeal,
  onLoseDeal,
  onSelectAccount,
  onAddDeal,
}: {
  deals: Deal[];
  accounts: Account[];
  accountsById: Map<string, Account>;
  onAdvanceDeal: (id: string) => void;
  onLoseDeal: (id: string) => void;
  onSelectAccount: (id: string) => void;
  onAddDeal: (draft: DealDraft) => boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<DealDraft>({
    accountId: accounts[0]?.id ?? "",
    name: "",
    value: "",
    stage: "lead",
    closeDate: "",
    owner: "",
  });
  useEffect(() => {
    if (!accounts.some(a => a.id === draft.accountId)) setDraft(current => ({ ...current, accountId: accounts[0]?.id ?? "", owner: "" }));
  }, [accounts, draft.accountId]);

  const weighted = deals
    .filter((d) => isOpenDeal(d.stage))
    .reduce((sum, d) => sum + (d.value * d.probability) / 100, 0);
  const w = splitCurrency(weighted);
  const openCount = deals.filter((d) => isOpenDeal(d.stage)).length;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft.name.trim() || !draft.accountId) return;
    if (!onAddDeal(draft)) return;
    setDraft((c) => ({ ...c, name: "", value: "", closeDate: "" }));
    setAdding(false);
  }

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-7">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-h1 text-foreground">Pipeline</h1>
          <p className="mt-1 text-body-sm text-muted-foreground">
            <span>
              <Private redactedLabel="hidden">
                <span className="tnum font-medium text-foreground">
                  {w.lead}
                  {w.unit}
                </span>
              </Private>{" "}
              weighted pipeline
            </span>
            <span className="text-faint-foreground" aria-hidden> · </span>
            <span>
              <span className="tnum font-medium text-foreground">{openCount}</span> open deals
            </span>
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setAdding((v) => !v)}>
          <Plus />
          New deal
        </Button>
      </div>

      {adding && (
        <Card className="animate-settle">
          <CardContent className="pt-5">
            <form className="grid items-end gap-3 md:grid-cols-[1.4fr_1fr_120px_140px_auto]" onSubmit={submit}>
              <Field label="Deal name">
                <Input value={draft.name} onChange={(e) => setDraft((c) => ({ ...c, name: e.target.value }))} placeholder="Acme — platform pilot" />
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
              <Field label="Value (USD)">
                <Input numeric value={draft.value} onChange={(e) => setDraft((c) => ({ ...c, value: e.target.value }))} placeholder="24000" inputMode="numeric" />
              </Field>
              <Field label="Stage">
                <Select value={draft.stage} onChange={(e) => setDraft((c) => ({ ...c, stage: e.target.value as DealDraft["stage"] }))}>
                  {dealStages.map((s) => (
                    <option key={s} value={s}>
                      {dealStageMeta[s].label}
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

      <div className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:scroll-px-0 sm:px-0">
        {pipelineColumns.map((stage, index) => {
          const colDeals = deals.filter((d) => d.stage === stage);
          const colSum = colDeals.reduce((s, d) => s + d.value, 0);
          const won = stage === "won";
          return (
            <section
              key={stage}
              aria-label={dealStageMeta[stage].label}
              className="flex min-w-[256px] flex-1 shrink-0 snap-start flex-col rounded-xl bg-surface-sunken/70 p-1.5 animate-settle"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <div className="flex h-9 items-center justify-between gap-2 px-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", won ? "bg-success" : "bg-faint-foreground/60")} aria-hidden />
                  <span className="truncate text-body-sm font-medium text-foreground">{dealStageMeta[stage].label}</span>
                  <span className="tnum text-body-sm text-faint-foreground">{colDeals.length}</span>
                </div>
                {colSum > 0 && (
                  <Private redactedLabel="hidden">
                    <span className="tnum text-label text-muted-foreground">{formatCurrency(colSum)}</span>
                  </Private>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                {colDeals.length === 0 ? (
                  <div className="flex min-h-[88px] items-center justify-center text-label text-faint-foreground">No deals</div>
                ) : (
                  colDeals.map((deal) => (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      accountName={accountsById.get(deal.accountId)?.name ?? "Unknown"}
                      onAdvance={() => onAdvanceDeal(deal.id)}
                      onLose={() => onLoseDeal(deal.id)}
                      onOpenAccount={() => onSelectAccount(deal.accountId)}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
