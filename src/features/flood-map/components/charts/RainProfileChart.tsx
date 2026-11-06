import { cn } from "@/lib/cn";

export interface RainProfilePoint {
  /** "3 h", "6 h"… */
  label: string;
  mm: number | null;
}

const WIDTH = 220;
const HEIGHT = 112;
const PAD = { top: 18, right: 14, bottom: 20, left: 14 };
const formatMm = (mm: number) => mm.toLocaleString("es-EC", { maximumFractionDigits: 1 });

/**
 * Lluvia pronosticada acumulada en un punto: cuánto habrá llovido a las 3, 6, 12 y 24 h.
 * Una línea que sube muestra cuándo llega la lluvia; plana, que ya no suma más.
 */
export function RainProfileChart({ points, className }: { points: readonly RainProfilePoint[]; className?: string }) {
  const values = points.map(({ mm }) => mm ?? 0);
  const max = Math.max(1, ...values);
  const x = (index: number) => PAD.left + (index / Math.max(1, points.length - 1)) * (WIDTH - PAD.left - PAD.right);
  const y = (mm: number) => PAD.top + (1 - mm / max) * (HEIGHT - PAD.top - PAD.bottom);
  const drawn = points.map((point, index) => ({ ...point, x: x(index), y: y(point.mm ?? 0) }));
  const line = drawn.filter((point) => point.mm !== null).map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={cn("block w-full", className)}
      role="img"
      aria-label={`Lluvia pronosticada acumulada: ${points.map((point) => `${point.label} ${point.mm === null ? "sin dato" : `${formatMm(point.mm)} mm`}`).join(", ")}`}
    >
      <line x1={PAD.left} x2={WIDTH - PAD.right} y1={HEIGHT - PAD.bottom} y2={HEIGHT - PAD.bottom} className="stroke-slate-300" strokeWidth={1} />
      <polyline points={line} fill="none" className="stroke-blue-600" strokeWidth={2} strokeLinejoin="round" />
      {drawn.map((point) => (
        <g key={point.label}>
          {point.mm !== null && <circle cx={point.x} cy={point.y} r={3.5} className="fill-white stroke-blue-600" strokeWidth={2} />}
          <text x={point.x} y={point.y - 7} textAnchor="middle" className="fill-slate-800 text-[10px] font-semibold tabular-nums">
            {point.mm === null ? "—" : formatMm(point.mm)}
          </text>
          <text x={point.x} y={HEIGHT - 6} textAnchor="middle" className="fill-slate-500 text-[10px]">
            {point.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
