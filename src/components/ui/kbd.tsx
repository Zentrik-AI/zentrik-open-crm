import { cn } from "../../lib/utils";

/** A keyboard hint chip. Pass keys like ["⌘", "K"] or ["G", "A"]. */
export function Kbd({ keys, className }: { keys: string[]; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {keys.map((k, i) => (
        <kbd
          key={`${k}-${i}`}
          className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-sm border border-border bg-surface-sunken px-1 font-mono text-kbd text-muted-foreground"
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}
