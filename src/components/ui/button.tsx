import * as React from "react";
import { cn } from "../../lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "icon";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground border-primary hover:bg-primary/90",
  secondary:
    "bg-secondary text-secondary-foreground border-border hover:bg-muted",
  ghost:
    "bg-transparent text-foreground border-transparent hover:bg-muted",
  destructive:
    "bg-destructive text-destructive-foreground border-destructive hover:bg-destructive/90",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  icon: "h-9 w-9 p-0",
};

export function Button({
  className,
  variant = "secondary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md border font-medium transition focus-visible:outline-none focus-visible:shadow-focus disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
