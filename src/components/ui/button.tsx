import * as React from "react";
import { cn } from "../../lib/utils";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "accent"
  | "agent"
  | "idea"
  | "destructive"
  | "destructive-solid";
type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground border border-transparent shadow-e1 hover:opacity-90 active:scale-[.98]",
  secondary:
    "bg-secondary text-secondary-foreground border border-border-strong hover:bg-surface-raised active:scale-[.99]",
  ghost: "bg-transparent text-muted-foreground border border-transparent hover:bg-secondary hover:text-foreground",
  accent: "bg-transparent text-accent-fg border border-accent hover:bg-accent-bg active:scale-[.99]",
  agent: "bg-transparent text-agent-fg border border-agent hover:bg-agent-bg active:scale-[.99]",
  idea: "bg-transparent text-idea-fg border border-idea hover:bg-idea-bg active:scale-[.99]",
  destructive:
    "bg-transparent text-destructive-fg border border-destructive hover:bg-destructive-bg active:scale-[.99]",
  "destructive-solid":
    "bg-destructive text-destructive-foreground border border-transparent hover:opacity-90 active:scale-[.98]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-body-sm",
  md: "h-9 px-3.5 text-body-sm",
  lg: "h-10 px-4 text-body",
  icon: "h-9 w-9 p-0",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "md", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-sans font-medium transition-[background-color,box-shadow,transform,opacity,color] duration-fast ease-out focus-visible:outline-none focus-visible:focus-ring disabled:pointer-events-none disabled:opacity-45 [&_svg]:h-[15px] [&_svg]:w-[15px] [&_svg]:shrink-0",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
