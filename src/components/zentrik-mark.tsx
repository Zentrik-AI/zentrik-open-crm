import { cn } from "../lib/utils";

/** The signature Zentrik spark — a 4-point mark in ink-teal that draws + turns on hover. */
function Spark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn("h-3.5 w-3.5 text-accent", className)}
      fill="none"
      aria-hidden
    >
      <path
        d="M8 1.2 L9.5 6.5 L14.8 8 L9.5 9.5 L8 14.8 L6.5 9.5 L1.2 8 L6.5 6.5 Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * "Evolved with Zentrik" attribution. Quiet by default; on hover the spark turns,
 * the wordmark inks in, and the grounding underline draws beneath it. Links out to
 * zentrik.ai. Use `tone="muted"` in chrome, `tone="prominent"` for a section credit.
 */
export function ZentrikMark({
  tone = "muted",
  className,
}: {
  tone?: "muted" | "prominent";
  className?: string;
}) {
  return (
    <a
      href="https://zentrik.ai"
      target="_blank"
      rel="noreferrer"
      aria-label="Evolved with Zentrik — opens zentrik.ai"
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-md outline-none transition-opacity duration-base ease-out focus-visible:focus-ring",
        tone === "muted" ? "opacity-80 hover:opacity-100" : "",
        className,
      )}
    >
      <Spark className="transition-transform duration-base ease-spring group-hover:rotate-[90deg] group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:rotate-0 motion-reduce:group-hover:scale-100" />
      <span
        className={cn(
          "select-none",
          tone === "prominent" ? "text-body-sm" : "text-[11px]",
        )}
      >
        <span className={tone === "prominent" ? "text-muted-foreground" : "text-faint-foreground"}>Evolved with </span>
        <span className="relative font-medium text-muted-foreground transition-colors duration-fast group-hover:text-foreground">
          Zentrik
          {/* grounding underline draws on hover */}
          <span
            aria-hidden
            className="absolute -bottom-px left-0 h-[1.5px] w-full origin-left scale-x-0 bg-accent transition-transform duration-trace ease-out group-hover:scale-x-100 motion-reduce:transition-none motion-reduce:group-hover:scale-x-100"
          />
        </span>
      </span>
    </a>
  );
}
