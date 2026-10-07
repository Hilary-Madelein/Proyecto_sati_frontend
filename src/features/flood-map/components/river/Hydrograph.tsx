"use client";

import { useMemo, useState, type PointerEvent } from "react";
import { useElementWidth } from "@/hooks/useElementWidth";
import { formatDateTime, formatDayMonth } from "@/lib/format";
import { HYDROGRAPH_COLORS } from "../../constants";
import type { RiverForecast, RiverReturnPeriods } from "../../types";
import { alertLevelStyle } from "../../utils";
import type { AlertLevel } from "../../types";

const HEIGHT = 250;
const MARGIN = { top: 12, right: 12, bottom: 26, left: 52 };
const DAY_MS = 24 * 60 * 60 * 1000;
// Medianoche en Ecuador (UTC-5) para las marcas del eje de tiempo.
const ECUADOR_OFFSET_MS = -5 * 60 * 60 * 1000;
/** Opacidad de las franjas de periodo de retorno: fondo, por debajo de los datos. */
const RETURN_PERIOD_OPACITY = 0.28;

interface ForecastPoint {
  kind: "forecast";
  t: number;
  min: number | null;
  p25: number | null;
  mean: number | null;
  p75: number | null;
  max: number | null;
  highRes: number | null;
}

interface AntecedentPoint {
  kind: "antecedent";
  t: number;
  flow: number;
}

type HoverPoint = ForecastPoint | AntecedentPoint;

interface HydrographProps {
  forecast: RiverForecast;
  /** Umbrales de 2 a 100 años; null mientras se calculan o si no hay. */
  returnPeriods: RiverReturnPeriods | null;
  returnPeriodsLoading: boolean;
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

const returnPeriodColor = (years: number) => alertLevelStyle(years as AlertLevel).color;

/**
 * Hidrograma por ensambles, como el del Hydroviewer: franjas de periodo de
 * retorno al fondo, condiciones antecedentes, banda mínimo–máximo y 25–75 %
 * del ensamble, promedio del ensamble y pronóstico de alta resolución, con
 * cruz y tooltip al pasar el cursor.
 */
export function Hydrograph({ forecast, returnPeriods, returnPeriodsLoading }: HydrographProps) {
  const [containerRef, width] = useElementWidth<HTMLDivElement>();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const points = useMemo<ForecastPoint[]>(
    () =>
      forecast.times.map((time, index) => ({
        kind: "forecast",
        t: Date.parse(time),
        min: forecast.ensemble.min[index],
        p25: forecast.ensemble.p25[index],
        mean: forecast.ensemble.mean[index],
        p75: forecast.ensemble.p75[index],
        max: forecast.ensemble.max[index],
        highRes: forecast.highRes[index],
      })),
    [forecast],
  );

  const antecedent = useMemo<AntecedentPoint[]>(
    () =>
      (forecast.antecedent?.times ?? [])
        .map((time, index) => ({ kind: "antecedent" as const, t: Date.parse(time), flow: forecast.antecedent!.flow[index] }))
        .filter((point): point is AntecedentPoint => point.flow !== null),
    [forecast],
  );

  // La cruz se ajusta a los antecedentes y a los pasos con ensamble (cada 3 h), donde hay valores de todas las series.
  const snapPoints = useMemo<HoverPoint[]>(
    () => [...antecedent, ...points.filter((point) => point.mean !== null && point.t > (antecedent.at(-1)?.t ?? -Infinity))],
    [antecedent, points],
  );

  const thresholds = returnPeriods?.thresholds ?? [];
  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 0);
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const forecastStart = points[0]?.t ?? 0;
  const t0 = antecedent[0]?.t ?? forecastStart;
  const t1 = points.at(-1)?.t ?? 1;
  const dataMax = Math.max(
    1,
    ...points.flatMap((point) => [point.max ?? 0, point.highRes ?? 0]),
    ...antecedent.map((point) => point.flow),
  );
  // El umbral de 2 años siempre se ve: muestra cuánto falta para la alerta.
  const shownMax = Math.max(dataMax, (thresholds[0]?.flow ?? 0) * 1.1);
  const yStep = niceStep(shownMax, 4);
  const yMax = Math.ceil(shownMax / yStep) * yStep;

  const x = (t: number) => MARGIN.left + ((t - t0) / Math.max(t1 - t0, 1)) * innerWidth;
  const y = (value: number) => MARGIN.top + innerHeight - (Math.min(value, yMax) / yMax) * innerHeight;

  const path = (series: { t: number; value: number | null }[]) =>
    series
      .filter((point) => point.value !== null)
      .map((point, index) => `${index === 0 ? "M" : "L"}${x(point.t).toFixed(1)},${y(point.value!).toFixed(1)}`)
      .join("");
  const line = (key: "mean" | "highRes" | "min" | "max") => path(points.map((point) => ({ t: point.t, value: point[key] })));

  const band = (low: "min" | "p25", high: "max" | "p75") => {
    const valid = points.filter((point) => point[low] !== null && point[high] !== null);
    if (valid.length === 0) return "";
    const top = valid.map((point) => `${x(point.t).toFixed(1)},${y(point[high]!).toFixed(1)}`);
    const bottom = [...valid].reverse().map((point) => `${x(point.t).toFixed(1)},${y(point[low]!).toFixed(1)}`);
    return `M${top.join("L")}L${bottom.join("L")}Z`;
  };

  // Franjas: de cada umbral al siguiente (la última, hasta el borde superior).
  const bands = thresholds
    .map((threshold, index) => ({ ...threshold, top: thresholds[index + 1]?.flow ?? Infinity }))
    .filter((threshold) => threshold.flow < yMax);

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

  const exceeded = (value: number | null) =>
    value === null ? null : ([...thresholds].reverse().find((threshold) => value >= threshold.flow) ?? null);

  return (
    <div>
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600" aria-label="Leyenda">
        <LegendLine color={HYDROGRAPH_COLORS.highRes} label="Alta resolución" />
        <LegendLine color={HYDROGRAPH_COLORS.ensemble} label="Promedio del ensamble" />
        <LegendBand opacity={0.24} label="Percentil 25–75" />
        <LegendBand opacity={0.1} dashed label="Mínimo–máximo" />
        {antecedent.length > 0 && <LegendLine color={HYDROGRAPH_COLORS.antecedent} dot label="Condiciones antecedentes" />}
      </ul>

      <div ref={containerRef} className="relative">
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`Pronóstico de caudal por ensambles de ${formatDayMonth(forecast.times[0])} a ${formatDayMonth(forecast.times.at(-1)!)}; máximo pronosticado ${formatFlow(dataMax)} m³/s${thresholds[0] ? `; caudal de 2 años ${formatFlow(thresholds[0].flow)} m³/s` : ""}`}
            className="block select-none"
          >
            {/* Periodos de retorno: fondo de color con su nombre a la derecha. */}
            {bands.map((band) => (
              <g key={band.years}>
                <rect
                  x={MARGIN.left}
                  width={innerWidth}
                  y={y(Math.min(band.top, yMax))}
                  height={Math.max(y(band.flow) - y(Math.min(band.top, yMax)), 0)}
                  fill={returnPeriodColor(band.years)}
                  fillOpacity={RETURN_PERIOD_OPACITY}
                />
                <text
                  x={MARGIN.left + innerWidth - 4}
                  y={y(band.flow) - 3}
                  textAnchor="end"
                  className="fill-slate-600 text-[9px] font-medium"
                >
                  {band.years} años
                </text>
              </g>
            ))}

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

            {/* Inicio del pronóstico: separa lo ya ocurrido de lo pronosticado. */}
            {antecedent.length > 0 && (
              <g>
                <line x1={x(forecastStart)} x2={x(forecastStart)} y1={MARGIN.top} y2={MARGIN.top + innerHeight} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />
                <text x={x(forecastStart) + 4} y={MARGIN.top + 9} className="fill-slate-500 text-[9px]">
                  Pronóstico →
                </text>
              </g>
            )}

            <path d={band("min", "max")} fill={HYDROGRAPH_COLORS.ensemble} fillOpacity={0.1} />
            <path d={line("max")} fill="none" stroke={HYDROGRAPH_COLORS.ensemble} strokeOpacity={0.6} strokeWidth={1} strokeDasharray="4 3" />
            <path d={line("min")} fill="none" stroke={HYDROGRAPH_COLORS.ensemble} strokeOpacity={0.6} strokeWidth={1} strokeDasharray="4 3" />
            <path d={band("p25", "p75")} fill={HYDROGRAPH_COLORS.ensemble} fillOpacity={0.24} />
            <path d={line("mean")} fill="none" stroke={HYDROGRAPH_COLORS.ensemble} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <path d={line("highRes")} fill="none" stroke={HYDROGRAPH_COLORS.highRes} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

            {antecedent.length > 0 && (
              <g>
                <path
                  d={path(antecedent.map((point) => ({ t: point.t, value: point.flow })))}
                  fill="none"
                  stroke={HYDROGRAPH_COLORS.antecedent}
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
                {antecedent.map((point) => (
                  <circle key={point.t} cx={x(point.t)} cy={y(point.flow)} r={3.5} fill={HYDROGRAPH_COLORS.antecedent} stroke="#fff" strokeWidth={1.5} />
                ))}
              </g>
            )}

            {hovered && (
              <g pointerEvents="none">
                <line x1={x(hovered.t)} x2={x(hovered.t)} y1={MARGIN.top} y2={MARGIN.top + innerHeight} stroke="#64748b" strokeWidth={1} />
                {hovered.kind === "antecedent" ? (
                  <circle cx={x(hovered.t)} cy={y(hovered.flow)} r={5} fill={HYDROGRAPH_COLORS.antecedent} stroke="#fff" strokeWidth={2} />
                ) : (
                  <>
                    {hovered.highRes !== null && (
                      <circle cx={x(hovered.t)} cy={y(hovered.highRes)} r={4} fill={HYDROGRAPH_COLORS.highRes} stroke="#fff" strokeWidth={2} />
                    )}
                    <circle cx={x(hovered.t)} cy={y(hovered.mean!)} r={4} fill={HYDROGRAPH_COLORS.ensemble} stroke="#fff" strokeWidth={2} />
                  </>
                )}
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
            className="pointer-events-none absolute top-2 z-10 w-52 rounded-lg bg-slate-900/95 px-3 py-2 text-[11px] text-slate-200 shadow-lg"
            style={x(hovered.t) > width / 2 ? { left: Math.max(x(hovered.t) - 220, 0) } : { left: x(hovered.t) + 12 }}
          >
            <p className="mb-1 font-medium text-white">{formatDateTime(new Date(hovered.t).toISOString())}</p>
            {hovered.kind === "antecedent" ? (
              <TooltipRow color={HYDROGRAPH_COLORS.antecedent} value={hovered.flow} label="Antecedente" />
            ) : (
              <>
                <TooltipRow color={HYDROGRAPH_COLORS.highRes} value={hovered.highRes} label="Alta resolución" />
                <TooltipRow color={HYDROGRAPH_COLORS.ensemble} value={hovered.mean} label="Promedio" />
                <p className="mt-1 text-slate-400">
                  25–75 %: {hovered.p25 !== null && hovered.p75 !== null ? `${formatFlow(hovered.p25)}–${formatFlow(hovered.p75)}` : "—"}
                  <br />
                  Mín–máx: {hovered.min !== null && hovered.max !== null ? `${formatFlow(hovered.min)}–${formatFlow(hovered.max)}` : "—"}
                </p>
              </>
            )}
            <ExceedanceNote threshold={exceeded(hovered.kind === "antecedent" ? hovered.flow : hovered.max)} kind={hovered.kind} />
          </div>
        )}
      </div>

      <ReturnPeriodsLegend returnPeriods={returnPeriods} loading={returnPeriodsLoading} />
      <DailyTable points={points} antecedent={antecedent} />
    </div>
  );
}

function ExceedanceNote({ threshold, kind }: { threshold: { years: number; flow: number } | null; kind: HoverPoint["kind"] }) {
  if (!threshold) return null;
  return (
    <p className="mt-1 flex items-center gap-1.5 text-white">
      <span aria-hidden="true" className="size-2 rounded-sm" style={{ backgroundColor: returnPeriodColor(threshold.years) }} />
      {kind === "antecedent" ? "Superó" : "El máximo supera"} el caudal de {threshold.years} años
    </p>
  );
}

/** Umbrales con su valor: el color de la franja nunca va solo. */
function ReturnPeriodsLegend({ returnPeriods, loading }: { returnPeriods: RiverReturnPeriods | null; loading: boolean }) {
  if (!returnPeriods) {
    return (
      <p className="mt-2 text-[11px] text-slate-500">
        {loading ? "Calculando los periodos de retorno de este río…" : "Periodos de retorno no disponibles para este río."}
      </p>
    );
  }
  return (
    <div className="mt-2">
      <p className="text-[11px] font-medium text-slate-600">Periodos de retorno (m³/s)</p>
      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
        {returnPeriods.thresholds.map((threshold) => (
          <li key={threshold.years} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: returnPeriodColor(threshold.years) }} />
            {threshold.years} años: <strong className="font-semibold text-slate-800 tabular-nums">{formatFlow(threshold.flow)}</strong>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-slate-400">{returnPeriods.method}</p>
    </div>
  );
}

function LegendLine({ color, label, dot = false }: { color: string; label: string; dot?: boolean }) {
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden="true" className="relative flex h-2 w-4 items-center">
        <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: color }} />
        {dot && <span className="absolute left-1/2 size-2 -translate-x-1/2 rounded-full ring-1 ring-white" style={{ backgroundColor: color }} />}
      </span>
      {label}
    </li>
  );
}

function LegendBand({ opacity, label, dashed = false }: { opacity: number; label: string; dashed?: boolean }) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className="h-2.5 w-4 rounded-sm"
        style={{
          backgroundColor: `color-mix(in srgb, ${HYDROGRAPH_COLORS.ensemble} ${Math.round(Math.min(opacity * 2.5, 1) * 100)}%, transparent)`,
          outline: dashed ? `1px dashed ${HYDROGRAPH_COLORS.ensemble}` : undefined,
        }}
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

/** Vista de tabla (accesible y sin depender del cursor): antecedentes y máximos por día. */
function DailyTable({ points, antecedent }: { points: ForecastPoint[]; antecedent: AntecedentPoint[] }) {
  type Day = { antecedent: number | null; highRes: number | null; mean: number | null; max: number | null };
  const days = new Map<string, Day>();
  const bigger = (a: number | null, b: number | null) => (b === null ? a : a === null ? b : Math.max(a, b));
  const day = (t: number) => {
    const key = formatDayMonth(new Date(t).toISOString());
    if (!days.has(key)) days.set(key, { antecedent: null, highRes: null, mean: null, max: null });
    return days.get(key)!;
  };
  for (const point of antecedent) day(point.t).antecedent = point.flow;
  for (const point of points) {
    const entry = day(point.t);
    entry.highRes = bigger(entry.highRes, point.highRes);
    entry.mean = bigger(entry.mean, point.mean);
    entry.max = bigger(entry.max, point.max);
  }
  const show = (value: number | null) => (value === null ? "—" : formatFlow(value));

  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer font-medium text-blue-700">Ver datos por día</summary>
      <table className="mt-2 w-full text-left tabular-nums">
        <thead className="text-[11px] text-slate-500">
          <tr>
            <th className="py-1 font-medium">Día</th>
            <th className="py-1 text-right font-medium">Antecedente</th>
            <th className="py-1 text-right font-medium">Alta res. máx.</th>
            <th className="py-1 text-right font-medium">Promedio máx.</th>
            <th className="py-1 text-right font-medium">Ensamble máx.</th>
          </tr>
        </thead>
        <tbody className="text-slate-700">
          {[...days].map(([label, values]) => (
            <tr key={label} className="border-t border-slate-100">
              <td className="py-1">{label}</td>
              <td className="py-1 text-right">{show(values.antecedent)}</td>
              <td className="py-1 text-right">{show(values.highRes)}</td>
              <td className="py-1 text-right">{show(values.mean)}</td>
              <td className="py-1 text-right">{show(values.max)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[11px] text-slate-500">Valores en m³/s. Antecedente: caudal con que arrancó el pronóstico de ese día.</p>
    </details>
  );
}
