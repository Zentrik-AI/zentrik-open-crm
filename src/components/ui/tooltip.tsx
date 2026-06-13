import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";

type Coords = { top: number; left: number; placement: "top" | "bottom" };

/**
 * Lightweight provenance tooltip. Wraps a trigger; shows on hover + focus.
 * Content should carry provenance ("from: …"), not restate the label.
 */
export function Tooltip({
  content,
  children,
  className,
  maxWidth = 260,
}: {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  maxWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const margin = 8;
    const above = rect.top > 120;
    setCoords({
      top: above ? rect.top - margin : rect.bottom + margin,
      left: Math.min(window.innerWidth - margin, Math.max(margin, rect.left + rect.width / 2)),
      placement: above ? "top" : "bottom",
    });
  }, [open]);

  if (!content) return <>{children}</>;

  return (
    <span
      ref={triggerRef}
      className={cn("inline-flex rounded-sm focus-visible:outline-none focus-visible:focus-ring", className)}
      tabIndex={0}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open &&
        coords &&
        createPortal(
          <span
            id={id}
            role="tooltip"
            className="pointer-events-none fixed z-[120] -translate-x-1/2 rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-[12px] leading-snug text-foreground shadow-e2 animate-settle"
            style={{
              top: coords.top,
              left: coords.left,
              maxWidth,
              transform: `translate(-50%, ${coords.placement === "top" ? "-100%" : "0"})`,
            }}
          >
            {content}
          </span>,
          document.body,
        )}
    </span>
  );
}
