import { useCountUp } from "../../lib/hooks";

/** A number that rolls to its value on change (instant under reduced motion). */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const shown = useCountUp(value, true, 500);
  return <span className={className}>{shown}</span>;
}
