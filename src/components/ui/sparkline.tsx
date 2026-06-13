import { cn } from "../../lib/utils";
import { toneSolid } from "../../lib/tone";
import type { Tone } from "../../lib/meta";

/** A hand-built trend line with a soft area fill and a terminal dot. */
export function Sparkline({
  data,
  width = 64,
  height = 18,
  tone,
  className,
  strokeWidth = 1.5,
}: {
  data: number[];
  width?: number;
  height?: number;
  tone?: Tone;
  className?: string;
  strokeWidth?: number;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pad = strokeWidth + 1;
  const innerH = height - pad * 2;
  const stepX = width / (data.length - 1);
  const pts = data.map((d, i) => {
    const x = i * stepX;
    const y = pad + innerH * (1 - (d - min) / span);
    return [x, y] as const;
  });
  const t: Tone = tone ?? (data[data.length - 1] >= data[0] ? "success" : "destructive");
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")} ${width},${height} 0,${height}`;
  const [lx, ly] = pts[pts.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      aria-hidden
    >
      <polygon points={area} fill={toneSolid[t]} opacity={0.08} />
      <polyline
        points={line}
        fill="none"
        stroke={toneSolid[t]}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lx} cy={ly} r={strokeWidth + 0.5} fill={toneSolid[t]} />
    </svg>
  );
}
