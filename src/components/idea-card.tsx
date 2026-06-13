import { ArrowUpRight } from "lucide-react";
import { cn } from "../lib/utils";
import { ideaStatusMeta } from "../lib/meta";
import type { Idea } from "../types";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Ring } from "./ui/ring";

/** A Loop idea: status, confidence Ring, votes tally + proportional micro-bar. */
export function IdeaCard({
  idea,
  maxVotes,
  onAdvance,
}: {
  idea: Idea;
  maxVotes: number;
  onAdvance: () => void;
}) {
  const meta = ideaStatusMeta[idea.status];
  const votePct = maxVotes > 0 ? (idea.votes / maxVotes) * 100 : 0;
  const released = idea.status === "released";

  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <Badge tone={meta.tone} dot>
          {meta.label}
        </Badge>
        <Ring value={idea.confidence} size="sm" tone="idea" label="Confidence" />
      </div>

      <h3 className="mt-3 font-serif text-h2 text-foreground">{idea.title}</h3>
      <p className="mt-1.5 flex-1 text-body text-muted-foreground">{idea.problem}</p>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-stat tabular-nums text-foreground">{idea.votes}</span>
            <span className="text-[12px] text-muted-foreground">votes</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="h-1 w-16 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
              <span className="block h-full rounded-full bg-accent" style={{ width: `${votePct}%` }} />
            </span>
            <span className="font-mono text-[11px] uppercase tracking-wide text-faint-foreground">
              {idea.targetRelease}
            </span>
          </div>
        </div>
        <Button
          size="sm"
          variant={released ? "secondary" : "idea"}
          onClick={onAdvance}
          disabled={released}
          className={cn(released && "opacity-70")}
        >
          {released ? "Shipped" : "Advance"}
          {!released && <ArrowUpRight />}
        </Button>
      </div>
    </Card>
  );
}
