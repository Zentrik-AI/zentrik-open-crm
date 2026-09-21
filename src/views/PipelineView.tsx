import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import type { Account, Deal } from "../types";
import type { DealDraft } from "../lib/drafts";
import { dealStages } from "../lib/drafts";
import { dealStageMeta, pipelineColumns, isOpenDeal } from "../lib/meta";
import { splitCurrency } from "../lib/utils";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Field, Input, Select } from "../components/ui/field";
import { Card, CardContent } from "../components/ui/card";
import { ArrValue } from "../components/account-bits";
import { DealCard } from "../components/deal-card";
import { Stat } from "../components/ui/stat";
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
    <div className="grid gap-5">
      <h1 className="font-serif text-h1 text-foreground">Pipeline</h1>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-6">
          <Stat
            label="Weighted pipeline"
            value={
              <Private redactedLabel="hidden">
                <span>
                  {w.lead}
                  {w.unit && <span className="text-[0.72em] text-muted-foreground">{w.unit}</span>}
                </span>
              </Private>
            }
            size="xl"
          />
          <Stat label="Open deals" value={openCount} size="xl" />
        </div>
        <Button variant="primary" size="sm" onClick={() => setAdding((v) => !v)}>
          <Plus />
          New deal
        </Button>
      </div>

      {adding && (
        <Card className="animate-settle">
          <CardContent className="pt-4">
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

      <div className="flex gap-4 overflow-x-auto pb-2">
        {pipelineColumns.map((stage) => {
          const colDeals = deals.filter((d) => d.stage === stage);
          const colSum = colDeals.reduce((s, d) => s + d.value, 0);
          return (
            <div key={stage} className="flex w-[280px] shrink-0 flex-col">
              <div className="mb-2.5 flex items-center justify-between px-0.5">
                <Badge tone={dealStageMeta[stage].tone} dot>
                  {dealStageMeta[stage].label}
                </Badge>
                <div className="flex items-center gap-2 text-[12px] text-faint-foreground">
                  <span className="font-mono tabular-nums">{colDeals.length}</span>
                  {colSum > 0 && <ArrValue value={colSum} className="text-[12px]" />}
                </div>
              </div>
              <div className="flex-1 space-y-2.5 rounded-lg border border-dashed border-border bg-surface-sunken/40 p-2">
                {colDeals.length === 0 ? (
                  <div className="px-2 py-6 text-center text-[12px] text-faint-foreground">No deals</div>
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
