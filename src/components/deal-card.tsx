import { ArrowRight } from "lucide-react";
import { cn, formatDate } from "../lib/utils";
import { dealStageMeta, pipelineColumns } from "../lib/meta";
import type { Deal } from "../types";
import { ArrValue } from "./account-bits";
import { Button } from "./ui/button";
import { Meter } from "./ui/meter";

const nextStage = (deal: Deal) => {
  const i = pipelineColumns.indexOf(deal.stage);
  if (i < 0 || i >= pipelineColumns.length - 1) return null;
  return pipelineColumns[i + 1];
};

export function DealCard({
  deal,
  accountName,
  onAdvance,
  onLose,
  onOpenAccount,
}: {
  deal: Deal;
  accountName: string;
  onAdvance?: () => void;
  onLose?: () => void;
  onOpenAccount?: () => void;
}) {
  const overdue = new Date(deal.closeDate).getTime() < Date.now() && deal.stage !== "won";
  const advanceTo = nextStage(deal);
  const open = deal.stage !== "won" && deal.stage !== "lost";

  return (
    <div className="rounded-lg border border-border bg-surface p-3 shadow-e1 transition-[border-color,transform] duration-fast hover:-translate-y-px hover:border-border-strong">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 text-h3 text-foreground">{deal.name}</div>
        <ArrValue value={deal.value} className="shrink-0 text-[13px]" />
      </div>
      <button
        onClick={onOpenAccount}
        className="mt-0.5 rounded-sm text-[12px] text-muted-foreground hover:text-accent-fg focus-visible:outline-none focus-visible:focus-ring"
      >
        {accountName}
      </button>

      <div className="mt-2.5">
        <Meter
          value={deal.probability}
          tone={dealStageMeta[deal.stage].tone}
          ticks={false}
          display={`${deal.probability}%`}
          label="Win probability"
        />
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className={cn("font-mono text-[11px] tabular-nums", overdue ? "text-destructive-fg" : "text-faint-foreground")}>
          {overdue ? "overdue " : "close "}
          {formatDate(deal.closeDate)}
        </span>
        <div className="flex items-center gap-1">
          {open && onLose && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px] text-faint-foreground hover:text-destructive-fg"
              onClick={onLose}
              aria-label={`Mark ${deal.name} lost`}
            >
              Lost
            </Button>
          )}
          {advanceTo && onAdvance && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px]"
              onClick={onAdvance}
              aria-label={`Advance ${deal.name} to ${dealStageMeta[advanceTo].label}`}
            >
              {dealStageMeta[advanceTo].label}
              <ArrowRight />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
