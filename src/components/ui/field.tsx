import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

const controlBase =
  "min-w-0 w-full rounded-md border border-border bg-surface-sunken px-3 text-body text-foreground outline-none transition-[border-color,box-shadow] duration-fast placeholder:text-faint-foreground focus:border-ring focus:focus-ring disabled:opacity-50";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  numeric?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, numeric, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(controlBase, "h-9", numeric && "font-mono tabular-nums", className)}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(controlBase, "min-h-[88px] resize-y py-2 leading-relaxed", className)}
        {...props}
      />
    );
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(controlBase, "h-9 cursor-pointer appearance-none pr-9", className)}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
      </div>
    );
  },
);

/** Label eyebrow over a control, with optional hint / error text. */
export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const id = React.useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  const control =
    React.isValidElement(children) && describedBy
      ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
          "aria-describedby": describedBy,
          "aria-invalid": error ? true : undefined,
        })
      : children;

  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="block text-label uppercase text-muted-foreground">{label}</span>
      {control}
      {error ? (
        <span id={`${id}-err`} className="block text-[12px] text-destructive-fg">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className="block text-[12px] text-faint-foreground">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
