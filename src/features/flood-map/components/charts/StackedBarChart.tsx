"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/** Una serie del gráfico: se apilan en este orden, de abajo hacia arriba. */
export interface ChartSeries {
  key: string;
  /** Nombre en la leyenda, p. ej. "Preventivas". */
  label: string;
  /** Tras la cifra en el cuadro, p. ej. "3 preventivas". */
  plural: string;
  color: string;
}

/** Una columna: un periodo (día o semana), su cifra en cada serie y, opcional, más detalle para el cuadro. */
export interface ChartBar {
  key: string;
  values: Record<string, number>;
  /** Líneas de texto extra en el cuadro, p. ej. "3 altos". */
  details?: string[];
}

const PAD = { top: 16, bottom: 20, x: 4 };
/** Ancho máximo de una columna, y espacio (del color del fondo) entre sus dos partes. */
const MAX_BAR = 24;
const GAP = 2;
const RADIUS = 4;

/**
 * Columnas apiladas por periodo, con las cifras del periodo al pasar el cursor
 * o al enfocarlo. Tocar una columna con datos llama a `onSelect` (si se pasa).
 * Se dibuja al ancho real del contenedor, así el texto mantiene su tamaño.
 */
export function StackedBarChart({
  bars,
  series,
  height,
  label,
  titleOf,
  subtitleOf,
  axisLabelOf,
  selected = null,
  onSelect,
  tooltipClassName = "top-0 -translate-y-[105%]",
}: {
  bars: readonly ChartBar[];
  series: readonly ChartSeries[];
  height: number;
  /** Texto accesible del gráfico. */
  label: string;
  /** Título del periodo en el cuadro y para lectores de pantalla, p. ej. "Semana del 26 oct". */
  titleOf: (key: string) => string;
  /** Línea bajo el título en el cuadro, más tenue (p. ej. el rango de horas del periodo). */
  subtitleOf?: (key: string) => string;
  /** Texto bajo la columna (solo en algunas, para no amontonar), o null. */
  axisLabelOf: (index: number) => string | null;
  selected?: string | null;
  onSelect?: (key: string) => void;
  /** Dónde sale el cuadro del periodo: por defecto, sobre el gráfico. */
  tooltipClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(160, Math.round(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const valueOf = (bar: ChartBar, item: ChartSeries) => bar.values[item.key] ?? 0;
  const totalOf = (bar: ChartBar) => series.reduce((sum, item) => sum + valueOf(bar, item), 0);
  const max = Math.max(1, ...bars.map(totalOf));
  const plotHeight = height - PAD.top - PAD.bottom;
  const baseline = PAD.top + plotHeight;
  const slot = (width - PAD.x * 2) / Math.max(1, bars.length);
  const barWidth = Math.min(MAX_BAR, Math.max(3, slot * 0.62));
  const y = (value: number) => (value / max) * plotHeight;
  const activeIndex = bars.findIndex((bar) => bar.key === hovered);
  const active = activeIndex >= 0 ? bars[activeIndex] : null;

  return (
    <div ref={ref} className="relative min-w-0">
      <svg
        width={width}
        height={height}
        // Con viewBox, si el contenedor se angosta antes de volver a medirlo, el gráfico se escala en vez de desbordar.
        viewBox={`0 0 ${width} ${height}`}
        className="block max-w-full"
        role="group"
        aria-label={label}
      >
        {/* Referencia: el periodo con más acciones. */}
        <line x1={PAD.x} x2={width - PAD.x} y1={PAD.top} y2={PAD.top} className="stroke-slate-100" strokeWidth={1} />
        <text x={PAD.x} y={PAD.top - 5} className="fill-slate-400 text-[10px] tabular-nums">
          {max}
        </text>
        <line x1={PAD.x} x2={width - PAD.x} y1={baseline} y2={baseline} className="stroke-slate-200" strokeWidth={1} />

        {bars.map((bar, index) => {
          const center = PAD.x + slot * (index + 0.5);
          const x = center - barWidth / 2;
          const total = totalOf(bar);
          const clickable = total > 0 && !!onSelect;
          const dimmed = selected !== null && selected !== bar.key;
          const axisLabel = axisLabelOf(index);
          // Partes de abajo hacia arriba; la de más arriba lleva la punta redondeada.
          const parts = series.filter((item) => valueOf(bar, item) > 0);
          let top = baseline;
          return (
            <g
              key={bar.key}
              role={onSelect ? "button" : undefined}
              tabIndex={clickable ? 0 : -1}
              aria-pressed={onSelect ? selected === bar.key : undefined}
              aria-label={`${titleOf(bar.key)}: ${[...series.map((item) => `${valueOf(bar, item)} ${item.plural}`), ...(bar.details ?? [])].join(", ")}`}
              onPointerEnter={() => setHovered(bar.key)}
              onPointerLeave={() => setHovered(null)}
              onFocus={() => setHovered(bar.key)}
              onBlur={() => setHovered(null)}
              onClick={() => clickable && onSelect?.(bar.key)}
              onKeyDown={(event) => {
                if ((event.key === "Enter" || event.key === " ") && clickable) {
                  event.preventDefault();
                  onSelect?.(bar.key);
                }
              }}
              className={cn("outline-none", clickable && "cursor-pointer")}
            >
              {/* Zona sensible: toda la columna, más ancha que la barra. */}
              <rect
                x={center - slot / 2}
                y={PAD.top}
                width={slot}
                height={plotHeight}
                className={hovered === bar.key ? "fill-slate-100" : "fill-transparent"}
              />
              {parts.map((item, partIndex) => {
                const value = valueOf(bar, item);
                top -= y(value);
                const partHeight = y(value) - (partIndex > 0 ? GAP : 0);
                const isTop = partIndex === parts.length - 1;
                return (
                  <path
                    key={item.key}
                    d={barPath(x, top, barWidth, partHeight, isTop ? Math.min(RADIUS, barWidth / 2) : 0)}
                    fill={item.color}
                    opacity={dimmed ? 0.3 : 1}
                  />
                );
              })}
              {selected === bar.key && (
                <line x1={x} x2={x + barWidth} y1={baseline + 4} y2={baseline + 4} className="stroke-blue-600" strokeWidth={2} strokeLinecap="round" />
              )}
              {axisLabel && (
                // En los extremos, alineado al borde: centrado se saldría del gráfico ("31 oc").
                <text
                  x={index === bars.length - 1 ? width - PAD.x : index === 0 ? PAD.x : center}
                  y={height - 4}
                  textAnchor={index === bars.length - 1 ? "end" : index === 0 ? "start" : "middle"}
                  className="fill-slate-500 text-[10px]"
                >
                  {axisLabel}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {active && (
        <div
          role="status"
          className={cn(
            "pointer-events-none absolute z-10 w-52 -translate-x-1/2 rounded-lg bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-slate-900/10",
            tooltipClassName,
          )}
          // Medio ancho del cuadro (w-52 = 208 px) de margen, para que no se salga por los lados.
          style={{ left: Math.min(Math.max(PAD.x + slot * (activeIndex + 0.5), 104), width - 104) }}
        >
          <p className={cn("font-semibold text-slate-700", !subtitleOf && "mb-1")}>{titleOf(active.key)}</p>
          {subtitleOf && <p className="mb-1 text-[11px] text-slate-400">{subtitleOf(active.key)}</p>}
          {/* De arriba hacia abajo, como se ven apiladas en la columna. */}
          {[...series].reverse().map((item) => (
            <p key={item.key} className="flex items-center gap-1.5 text-slate-500">
              <span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="font-semibold text-slate-900 tabular-nums">{valueOf(active, item)}</span>
              {item.plural}
            </p>
          ))}
          {active.details?.map((line) => (
            <p key={line} className="pl-4.5 text-slate-500">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** Leyenda de las series; con una sola no hace falta (el título dice qué se ve). */
export function SeriesLegend({ series, className }: { series: readonly ChartSeries[]; className?: string }) {
  if (series.length < 2) return null;
  return (
    <span className={cn("flex gap-3 text-xs text-slate-500", className)}>
      {series.map((item) => (
        <span key={item.key} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-xs" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </span>
  );
}

/** Rectángulo con las esquinas de arriba redondeadas y la base recta (sobre la línea de base). */
function barPath(x: number, y: number, width: number, height: number, radius: number): string {
  if (height <= 0) return "";
  const r = Math.min(radius, height);
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}
