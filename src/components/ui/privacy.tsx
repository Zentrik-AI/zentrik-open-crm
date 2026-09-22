import { createContext, useContext, type ReactNode } from "react";
import { EyeOff } from "lucide-react";
import { cn } from "../../lib/utils";

/** Share-safe mode is render-time state. When on, sensitive values
 *  are NEVER rendered into the DOM — the component returns a redacted chip
 *  instead of its children, so a real value can never flash or be inspected. */
const ShareSafeContext = createContext(false);

export function PrivacyProvider({
  shareSafe,
  children,
}: {
  shareSafe: boolean;
  children: ReactNode;
}) {
  return <ShareSafeContext.Provider value={shareSafe}>{children}</ShareSafeContext.Provider>;
}

export function useShareSafe() {
  return useContext(ShareSafeContext);
}

/** The canonical redacted marker: dashed strong border + diagonal hatch + eye-off
 *  glyph reading "hidden". Carries no real data. */
export function RedactedChip({
  label = "hidden",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "hatch-redact inline-flex items-center gap-1 rounded-sm border border-dashed border-border-strong px-1.5 py-0.5 align-middle text-label text-muted-foreground",
        className,
      )}
      title="Hidden in share-safe view"
    >
      <EyeOff className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}

/**
 * Render `children` privately; in share-safe mode render a RedactedChip instead.
 * `sensitive` defaults to true — pass false to always show. When redacted, the
 * children are not evaluated into the DOM at all.
 */
export function Private({
  children,
  redactedLabel = "hidden",
  sensitive = true,
  className,
}: {
  children: ReactNode;
  redactedLabel?: string;
  sensitive?: boolean;
  className?: string;
}) {
  const shareSafe = useShareSafe();
  if (shareSafe && sensitive) {
    return <RedactedChip label={redactedLabel} className={className} />;
  }
  return <>{children}</>;
}
