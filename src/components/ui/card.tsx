import * as React from "react";
import { cn } from "../../lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Hover lift + border promotion (for clickable cards). */
  interactive?: boolean;
  /** Selected master/detail item: 2px accent left-rule + tint wash. */
  selected?: boolean;
}

export function Card({ className, interactive, selected, ...props }: CardProps) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-card text-card-foreground transition-[border-color,box-shadow,transform] duration-fast ease-out",
        interactive &&
          "cursor-pointer hover:-translate-y-px hover:border-border-strong hover:shadow-e1",
        selected &&
          "border-border-strong bg-accent-bg/30 shadow-e1 [box-shadow:inset_2px_0_0_hsl(var(--accent)),var(--e-1)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 px-5 pt-4 pb-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-h3 text-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5 pt-0", className)} {...props} />;
}

/** Inset surface — prompt blocks, body previews, mono wells. */
export function Well({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-md border border-border bg-surface-sunken p-3", className)}
      {...props}
    />
  );
}
