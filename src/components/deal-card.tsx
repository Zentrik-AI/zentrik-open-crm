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
    <div className="rounded-xl border border-border bg-card p-4 shadow-e1 transition-[border-color,box-shadow] duration-fast hover:border-border-strong hover:shadow-e2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-h3 text-foreground">{deal.name}</div>
          {onOpenAccount ? (
            <button
              onClick={onOpenAccount}
              className="mt-0.5 rounded-sm text-left text-body-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:focus-ring"
            >
              {accountName}
            </button>
          ) : (
            <div className="mt-0.5 text-body-sm text-muted-foreground">{dealStageMeta[deal.stage].label}</div>
          )}
        </div>
        <ArrValue value={deal.value} className="shrink-0 text-body" />
      </div>

      <div className="mt-3">
        <Meter
          value={deal.probability}
          tone={deal.stage === "won" ? "success" : "neutral"}
          ticks={false}
          weak={false}
          display={`${deal.probability}%`}
          label="Win probability"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className={cn("tnum whitespace-nowrap text-label font-normal", overdue ? "text-destructive-fg" : "text-faint-foreground")}>
          {overdue ? "Overdue " : "Closes "}
          {formatDate(deal.closeDate)}
        </span>
        <div className="-mr-2 flex items-center gap-0.5">
          {open && onLose && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-label text-faint-foreground hover:text-destructive-fg"
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
              className="h-7 px-2 text-label text-foreground"
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
