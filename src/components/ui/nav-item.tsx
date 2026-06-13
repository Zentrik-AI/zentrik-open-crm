import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

/** Sidebar nav row. Active state uses the grounding-tick as the indicator. */
export function NavItem({
  icon: Icon,
  label,
  active,
  count,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-[34px] w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:focus-ring",
        active
          ? "bg-accent-bg text-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      {/* grounding-tick active indicator */}
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent transition-opacity duration-fast",
          active ? "opacity-100" : "opacity-0",
        )}
      />
      <Icon className={cn("h-[17px] w-[17px] shrink-0", active ? "text-accent" : "")} />
      <span className="truncate">{label}</span>
      {count != null && count > 0 && (
        <span
          className={cn(
            "ml-auto font-mono text-[11px] tabular-nums",
            active ? "text-accent-fg" : "text-faint-foreground",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
