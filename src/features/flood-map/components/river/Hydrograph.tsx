"use client";

import { useMemo, useState, type PointerEvent } from "react";
import { useElementWidth } from "@/hooks/useElementWidth";
import { formatDateTime, formatDayMonth } from "@/lib/format";
import { HYDROGRAPH_COLORS } from "../../constants";
import type { RiverForecast } from "../../types";

const HEIGHT = 220;
const MARGIN = { top: 12, right: 12, bottom: 26, left: 52 };
const DAY_MS = 24 * 60 * 60 * 1000;
// Medianoche en Ecuador (UTC-5) para las marcas del eje de tiempo.
const ECUADOR_OFFSET_MS = -5 * 60 * 60 * 1000;

interface Point {
  t: number;
  min: number | null;
  p25: number | null;
  median: number | null;
  p75: number | null;
  max: number | null;
  highRes: number | null;
}

const formatFlow = (value: number) =>
  value.toLocaleString("es-EC", { maximumFractionDigits: value < 10 ? 1 : 0 });

/** Paso "redondo" para el eje Y (1, 2 o 5 × 10ⁿ). */
function niceStep(max: number, ticks: number) {
  const raw = max / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].find((factor) => factor * magnitude >= raw) ?? 10;
  return step * magnitude;
}

/**
 * Hidrograma del pronóstico de caudal: bandas del ensamble (mín–máx y 25–75 %),
 * mediana y pronóstico de alta resolución, con cruz y tooltip al pasar el cursor.
 */
export function Hydrograph({ forecast }: { forecast: RiverForecast }) {
  const [containerRef, width] = useElementWidth<HTMLDivElement>();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const points = useMemo<Point[]>(
    () =>
      forecast.times.map((time, index) => ({
        t: Date.parse(time),
        min: forecast.ensemble.min[index],
        p25: forecast.ensemble.p25[index],
        median: forecast.ensemble.median[index],
        p75: forecast.ensemble.p75[index],
        max: forecast.ensemble.max[index],
        highRes: forecast.highRes[index],
      })),
    [forecast],
  );

  // La cruz se ajusta a los pasos con ensamble (cada 3 h): ahí hay valores de todas las series.
  const snapPoints = useMemo(() => points.filter((point) => point.median !== null), [points]);

  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 0);
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const t0 = points[0]?.t ?? 0;
  const t1 = points.at(-1)?.t ?? 1;
  const dataMax = Math.max(1, ...points.flatMap((point) => [point.max ?? 0, point.highRes ?? 0]));
  const yStep = niceStep(dataMax, 4);
  const yMax = Math.ceil(dataMax / yStep) * yStep;

  const x = (t: number) => MARGIN.left + ((t - t0) / Math.max(t1 - t0, 1)) * innerWidth;
  const y = (value: number) => MARGIN.top + innerHeight - (value / yMax) * innerHeight;

  const line = (key: "median" | "highRes") =>
    points
      .filter((point) => point[key] !== null)
      .map((point, index) => `${index === 0 ? "M" : "L"}${x(point.t).toFixed(1)},${y(point[key]!).toFixed(1)}`)
      .join("");

  const band = (low: "min" | "p25", high: "max" | "p75") => {
    const valid = points.filter((point) => point[low] !== null && point[high] !== null);
    if (valid.length === 0) return "";
    const top = valid.map((point) => `${x(point.t).toFixed(1)},${y(point[high]!).toFixed(1)}`);
    const bottom = [...valid].reverse().map((point) => `${x(point.t).toFixed(1)},${y(point[low]!).toFixed(1)}`);
    return `M${top.join("L")}L${bottom.join("L")}Z`;
  };

  const yTicks = Array.from({ length: Math.round(yMax / yStep) + 1 }, (_, index) => index * yStep);
  const dayEvery = innerWidth / ((t1 - t0) / DAY_MS) < 42 ? 2 : 1;
  const firstMidnight = Math.ceil((t0 + ECUADOR_OFFSET_MS) / DAY_MS) * DAY_MS - ECUADOR_OFFSET_MS;
  const xTicks: number[] = [];
  for (let t = firstMidnight, i = 0; t <= t1; t += DAY_MS, i++) if (i % dayEvery === 0) xTicks.push(t);

  const hovered = hoverIndex === null ? null : snapPoints[hoverIndex];

  const handlePointer = (event: PointerEvent<SVGRectElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const t = t0 + ((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * (t1 - t0);
    let best = 0;
    snapPoints.forEach((point, index) => {
      if (Math.abs(point.t - t) < Math.abs(snapPoints[best].t - t)) best = index;
    });
    setHoverIndex(best);
  };

  return (
    <div>
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600" aria-label="Leyenda">
        <LegendLine color={HYDROGRAPH_COLORS.highRes} label="Alta resolución" />
        <LegendLine color={HYDROGRAPH_COLORS.ensemble} label="Mediana del ensamble" />
        <LegendBand opacity={0.24} label="Percentil 25–75" />
        <LegendBand opacity={0.1} label="Mínimo–máximo" />
      </ul>

      <div ref={containerRef} className="relative">
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`Pronóstico de caudal de ${formatDayMonth(forecast.times[0])} a ${formatDayMonth(forecast.times.at(-1)!)}; máximo pronosticado ${formatFlow(dataMax)} m³/s`}
            className="block select-none"
          >
            {yTicks.map((tick) => (
              <g key={tick}>
                <line x1={MARGIN.left} x2={MARGIN.left + innerWidth} y1={y(tick)} y2={y(tick)} stroke="#e2e8f0" strokeWidth={1} />
                <text x={MARGIN.left - 6} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-slate-500 text-[10px] tabular-nums">
                  {formatFlow(tick)}
                </text>
              </g>
            ))}
            <text x={10} y={MARGIN.top + innerHeight / 2} transform={`rotate(-90 10 ${MARGIN.top + innerHeight / 2})`} textAnchor="middle" className="fill-slate-500 text-[10px]">
              m³/s
            </text>
            {xTicks.map((tick) => (
              <text key={tick} x={x(tick)} y={HEIGHT - 8} textAnchor="middle" className="fill-slate-500 text-[10px]">
                {formatDayMonth(new Date(tick).toISOString())}
              </text>
            ))}

            <path d={band("min", "max")} fill={HYDROGRAPH_COLORS.ensemble} fillOpacity={0.1} />
            <path d={band("p25", "p75")} fill={HYDROGRAPH_COLORS.ensemble} fillOpacity={0.24} />
            <path d={line("median")} fill="none" stroke={HYDROGRAPH_COLORS.ensemble} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <path d={line("highRes")} fill="none" stroke={HYDROGRAPH_COLORS.highRes} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

            {hovered && (
              <g pointerEvents="none">
                <line x1={x(hovered.t)} x2={x(hovered.t)} y1={MARGIN.top} y2={MARGIN.top + innerHeight} stroke="#94a3b8" strokeWidth={1} />
                {hovered.highRes !== null && (
                  <circle cx={x(hovered.t)} cy={y(hovered.highRes)} r={4} fill={HYDROGRAPH_COLORS.highRes} stroke="#fff" strokeWidth={2} />
                )}
                <circle cx={x(hovered.t)} cy={y(hovered.median!)} r={4} fill={HYDROGRAPH_COLORS.ensemble} stroke="#fff" strokeWidth={2} />
              </g>
            )}

            {/* Zona de captura más grande que las líneas: basta acercarse a la fecha. */}
            <rect
              x={MARGIN.left}
              y={MARGIN.top}
              width={innerWidth}
              height={innerHeight}
              fill="transparent"
              onPointerMove={handlePointer}
              onPointerLeave={() => setHoverIndex(null)}
            />
          </svg>
        )}

        {hovered && (
          <div
            className="pointer-events-none absolute top-2 z-10 w-48 rounded-lg bg-slate-900/95 px-3 py-2 text-[11px] text-slate-200 shadow-lg"
            style={x(hovered.t) > width / 2 ? { left: Math.max(x(hovered.t) - 204, 0) } : { left: x(hovered.t) + 12 }}
          >
            <p className="mb-1 font-medium text-white">{formatDateTime(new Date(hovered.t).toISOString())}</p>
            <TooltipRow color={HYDROGRAPH_COLORS.highRes} value={hovered.highRes} label="Alta resolución" />
            <TooltipRow color={HYDROGRAPH_COLORS.ensemble} value={hovered.median} label="Mediana" />
            <p className="mt-1 text-slate-400">
              25–75 %: {hovered.p25 !== null && hovered.p75 !== null ? `${formatFlow(hovered.p25)}–${formatFlow(hovered.p75)}` : "—"}
              <br />
              Mín–máx: {hovered.min !== null && hovered.max !== null ? `${formatFlow(hovered.min)}–${formatFlow(hovered.max)}` : "—"}
            </p>
          </div>
        )}
      </div>

      <DailyTable points={points} />
    </div>
  );
}

function LegendLine({ color, label }: { color: string; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden="true" className="h-0.5 w-4 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </li>
  );
}

function LegendBand({ opacity, label }: { opacity: number; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className="h-2.5 w-4 rounded-sm"
        style={{ backgroundColor: HYDROGRAPH_COLORS.ensemble, opacity: Math.min(opacity * 2.5, 1) }}
      />
      {label}
    </li>
  );
}

function TooltipRow({ color, value, label }: { color: string; value: number | null; label: string }) {
  return (
    <p className="flex items-center gap-1.5">
      <span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ backgroundColor: color }} />
      <strong className="font-semibold text-white tabular-nums">{value === null ? "—" : `${formatFlow(value)} m³/s`}</strong>
      <span className="text-slate-400">{label}</span>
    </p>
  );
}

/** Vista de tabla (accesible y sin depender del cursor): máximos por día. */
function DailyTable({ points }: { points: Point[] }) {
  const days = new Map<string, { highRes: number | null; median: number | null; max: number | null }>();
  for (const point of points) {
    const key = formatDayMonth(new Date(point.t).toISOString());
    const day = days.get(key) ?? { highRes: null, median: null, max: null };
    const bigger = (a: number | null, b: number | null) => (b === null ? a : a === null ? b : Math.max(a, b));
    days.set(key, { highRes: bigger(day.highRes, point.highRes), median: bigger(day.median, point.median), max: bigger(day.max, point.max) });
  }
  const show = (value: number | null) => (value === null ? "—" : formatFlow(value));

  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer font-medium text-blue-700">Ver datos por día</summary>
      <table className="mt-2 w-full text-left tabular-nums">
        <thead className="text-[11px] text-slate-500">
          <tr>
            <th className="py-1 font-medium">Día</th>
            <th className="py-1 text-right font-medium">Alta res. máx.</th>
            <th className="py-1 text-right font-medium">Mediana máx.</th>
            <th className="py-1 text-right font-medium">Ensamble máx.</th>
          </tr>
        </thead>
        <tbody className="text-slate-700">
          {[...days].map(([day, values]) => (
            <tr key={day} className="border-t border-slate-100">
              <td className="py-1">{day}</td>
              <td className="py-1 text-right">{show(values.highRes)}</td>
              <td className="py-1 text-right">{show(values.median)}</td>
              <td className="py-1 text-right">{show(values.max)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[11px] text-slate-500">Valores en m³/s.</p>
    </details>
  );
}
