import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

/** Sidebar nav row. Active state uses the grounding-tick as the indicator. */
export function NavItem({
  icon: Icon,
  label,
  active,
  count,
  attention,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  count?: number;
  /** Show the count as an agent-violet pill: something is waiting for a decision. */
  attention?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-body-sm font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:focus-ring",
        active
          ? "bg-secondary text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))]"
          : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-foreground" : "text-faint-foreground group-hover:text-muted-foreground")} strokeWidth={active ? 2.1 : 1.9} />
      <span className="truncate">{label}</span>
      {count != null && count > 0 && (
        <span
          className={cn(
            "ml-auto tnum text-label",
            attention ? "rounded-full bg-agent px-1.5 text-[11px] font-semibold leading-[18px] text-white" : "text-faint-foreground",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
