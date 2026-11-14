"use client";

import { useEffect, useState, type ReactNode } from "react";
import { satiClientGet } from "@/lib/api/sati-client";

/** Códigos del INAMHI de las dos estaciones de Galápagos: tienen su propia gráfica y su propia alarma. */
export const GALAPAGOS_STATION_CODES: readonly string[] = ["M0191", "M0221"];
type GalapagosLevel = "normal" | "alarm" | "extreme";

interface GalapagosStationRain {
  code: string;
  island: string;
  mm3h: number;
  mm6h: number;
  mm24h: number;
  level: GalapagosLevel;
  /** Por qué está en ese nivel; null en normal. */
  reason: string | null;
  /** Lo máximo que llovió en 1, 2, 3… horas seguidas dentro de las últimas 24 (mm). */
  maxByDurationMm: number[];
  /** "Aquí estamos": lluvia acumulada desde las 00:00 de ayer; `hour` va de 1 a 48. */
  twoDays?: { hour: number; accumulatedMm: number }[];
  /** Los dos límites de la estación, sacados de su propio registro. */
  limits?: GalapagosLimit[];
}

interface GalapagosReference {
  key: "upper" | "lower";
  island: string;
  date: string;
  /** Para la leyenda, en pocas palabras. */
  shortLabel?: string;
  totalMm: number;
  /** Lo máximo que llovió en 1, 2, 3… 24 horas seguidas (mm). */
  maxByDurationMm: number[];
}

/** Uno de los dos límites de una estación: su lluvia acumulada en cada una de las 48 horas de sus dos días. */
interface GalapagosLimit {
  key: "upper" | "lower";
  label: string;
  totalMm: number;
  accumulatedMm: number[];
}

/** Respuesta de GET /galapagos-rain. */
interface GalapagosRainSnapshot {
  stations: GalapagosStationRain[];
  references: GalapagosReference[];
  limits?: GalapagosLimit[];
}

const WIDTH = 248;
// Colores como atributos del SVG (no clases): así también salen en la imagen descargada.
const COLORS = { upper: "#dc2626", lower: "#2a78d6", band: "#f1f5f9", now: "#0f172a", duration: "#1d4ed8", durationLower: "#d97706", durationBand: "#fee2e2", grid: "#e2e8f0", text: "#64748b" };
const LEVELS: Record<GalapagosLevel, { label: string; className: string }> = {
  normal: { label: "Sin alarma", className: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  alarm: { label: "Alarma", className: "bg-amber-50 text-amber-900 ring-amber-300" },
  extreme: { label: "Alarma extrema", className: "bg-red-50 text-red-800 ring-red-300" },
};

const formatMm = (mm: number) => mm.toLocaleString("es-EC", { maximumFractionDigits: 1 });

type State = { status: "loading" } | { status: "error" } | { status: "ready"; station: GalapagosStationRain; snapshot: GalapagosRainSnapshot };

/**
 * Gráfica propia de las dos estaciones de Galápagos, con la lluvia de ahora frente a
 * lo que pasó en esas mismas estaciones. Se consulta al abrir el popup.
 */
export function GalapagosRainChart({ code }: { code: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    satiClientGet<GalapagosRainSnapshot>("/galapagos-rain", undefined, controller.signal)
      .then((snapshot) => {
        const station = snapshot.stations.find((item) => item.code === code);
        setState(station ? { status: "ready", station, snapshot } : { status: "error" });
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setState({ status: "error" });
      });
    return () => controller.abort();
  }, [code]);

  if (state.status === "loading") return <p className="mt-2 text-xs text-slate-400">Cargando la comparación…</p>;
  if (state.status === "error") return <p className="mt-2 text-xs text-slate-500">No se pudo cargar la comparación.</p>;

  const { station, snapshot } = state;
  const upper = station.limits?.find((item) => item.key === "upper");
  const lower = station.limits?.find((item) => item.key === "lower");
  const level = LEVELS[station.level] ?? LEVELS.normal;
  // Con los límites de la estación, el acumulado de dos días; si el backend aún no los entrega, la comparación por duración.
  const twoDays = upper && lower && station.twoDays;

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{twoDays ? "Acumulado · ayer y hoy" : "Frente a otros episodios"}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${level.className}`}>{level.label}</span>
      </div>
      {twoDays ? <TwoDayChart station={station} now={station.twoDays ?? []} upper={upper} lower={lower} /> : <DurationChart station={station} references={snapshot.references} />}
      {station.reason && <p className="mt-1 text-[11px] font-medium text-slate-800">{station.reason.charAt(0).toUpperCase() + station.reason.slice(1)}.</p>}
    </div>
  );
}

const TWO_DAYS = { height: 150, top: 14, right: 30, bottom: 20, left: 6, hours: 48 };

/**
 * La lluvia acumulada desde las 00:00 de ayer ("Aquí estamos") entre los dos límites
 * de la estación, sacados de su propio registro. En Santa Cruz, el inferior son el 11
 * y 12 de noviembre de 2026 (30 mm en dos días, sin daños mayores) y el superior, el
 * 30 y 31 de octubre (229 mm, cuando se desbordó La Cascada). En San Cristóbal, el
 * 9 y 10 de noviembre (24 mm) y el 11 y 12 (189 mm, una vía inundada). Así se ve de
 * un vistazo qué tan lejos está hoy de uno y de otro.
 */
function TwoDayChart({ station, now, upper, lower }: { station: GalapagosStationRain; now: { hour: number; accumulatedMm: number }[]; upper: GalapagosLimit; lower: GalapagosLimit }) {
  const { height, top, right, bottom, left, hours } = TWO_DAYS;
  const current = now.at(-1);
  const total = current?.accumulatedMm ?? 0;
  const max = Math.max(upper.totalMm, total) * 1.08;
  const plotRight = WIDTH - right;
  const baseline = height - bottom;
  const x = (hour: number) => left + (hour / hours) * (plotRight - left);
  const y = (mm: number) => top + (1 - mm / max) * (baseline - top);
  /** Curva desde el cero de las 00:00 de ayer. */
  const path = (values: readonly number[]) => [`${x(0)},${y(0)}`, ...values.map((mm, index) => `${x(index + 1)},${y(mm)}`)].join(" ");
  const band = `${path(upper.accumulatedMm)} ${[...lower.accumulatedMm].map((mm, index) => `${x(index + 1)},${y(mm)}`).reverse().join(" ")} ${x(0)},${y(0)}`;
  const nowX = x(current?.hour ?? 0);
  const nowY = y(total);
  // El rótulo va a la derecha del punto mientras quepa; después, a la izquierda.
  const labelLeft = (current?.hour ?? 0) > 30;
  const summary = `Lluvia acumulada en ${station.island} desde las 00:00 de ayer: ${formatMm(total)} mm. ${lower.label}: ${formatMm(lower.totalMm)} mm. ${upper.label}: ${formatMm(upper.totalMm)} mm.`;

  return (
    <>
      <svg viewBox={`0 0 ${WIDTH} ${height}`} className="mt-1 w-full" role="img" aria-label={summary}>
        <polygon points={band} fill={COLORS.band} />
        <line x1={left} x2={plotRight} y1={baseline} y2={baseline} stroke={COLORS.grid} />
        <line x1={x(24)} x2={x(24)} y1={top} y2={baseline} stroke={COLORS.grid} />

        <polyline points={path(upper.accumulatedMm)} fill="none" stroke={COLORS.upper} strokeWidth={1.6} strokeLinejoin="round" />
        <text x={plotRight + 3} y={y(upper.totalMm) + 3} fill={COLORS.upper} fontSize={9} fontWeight={600}>
          {Math.round(upper.totalMm)}
        </text>
        <polyline points={path(lower.accumulatedMm)} fill="none" stroke={COLORS.lower} strokeWidth={1.6} strokeLinejoin="round" />
        <text x={plotRight + 3} y={y(lower.totalMm) + 3} fill={COLORS.lower} fontSize={9} fontWeight={600}>
          {Math.round(lower.totalMm)}
        </text>

        {/* Aquí estamos: la línea de ahora, entrecortada, hasta la última hora con dato. */}
        <polyline points={path(now.map((point) => point.accumulatedMm))} fill="none" stroke={COLORS.now} strokeWidth={2.2} strokeDasharray="5 3" strokeLinejoin="round" />
        <circle cx={nowX} cy={nowY} r={3.6} fill={COLORS.now} stroke="#ffffff" strokeWidth={1.2} />
        <text x={nowX + (labelLeft ? -6 : 6)} y={Math.max(top + 2, nowY - 7)} textAnchor={labelLeft ? "end" : "start"} fill={COLORS.now} fontSize={9.5} fontWeight={700}>
          Aquí estamos
        </text>

        <text x={x(12)} y={height - 5} textAnchor="middle" fill={COLORS.text} fontSize={9}>
          ayer
        </text>
        <text x={x(36)} y={height - 5} textAnchor="middle" fill={COLORS.text} fontSize={9}>
          hoy
        </text>
      </svg>

      <ul className="mt-1 space-y-0.5 text-[11px] text-slate-600">
        <Key color={COLORS.now} dashed>
          Aquí estamos: <strong className="text-slate-900 tabular-nums">{formatMm(total)} mm</strong> desde ayer
        </Key>
        <Key color={COLORS.upper}>
          {upper.label} ({formatMm(upper.totalMm)} mm)
        </Key>
        <Key color={COLORS.lower}>
          {lower.label} ({formatMm(lower.totalMm)} mm)
        </Key>
      </ul>
    </>
  );
}

const DURATION = { height: 124, top: 8, right: 30, bottom: 18, left: 6, hours: 24, ticks: [3, 6, 12, 24] };

/**
 * Respaldo, por si el backend no entrega los límites: lo máximo que ha llovido en 3,
 * 6, 12 y 24 horas seguidas dentro de las últimas 24, frente a dos episodios (el
 * desborde de Santa Cruz del 30 y 31 de octubre de 2026 y la lluvia de San Cristóbal
 * del 12 de noviembre).
 */
function DurationChart({ station, references }: { station: GalapagosStationRain; references: GalapagosReference[] }) {
  const upper = references.find((item) => item.key === "upper");
  const lower = references.find((item) => item.key === "lower");
  if (!upper || !lower) return null;
  const { height, top, right, bottom, left, hours, ticks } = DURATION;
  const current = station.maxByDurationMm.slice(0, hours);
  const max = Math.max(upper.totalMm, ...current) * 1.06;
  const plotRight = WIDTH - right;
  const baseline = height - bottom;
  /** Posición de una duración en horas (de 1 a 24). */
  const x = (duration: number) => left + ((duration - 1) / (hours - 1)) * (plotRight - left);
  const y = (mm: number) => top + (1 - mm / max) * (baseline - top);
  const points = (values: readonly number[]) => values.map((mm, index) => `${x(index + 1)},${y(mm)}`).join(" ");
  const band = `${points(upper.maxByDurationMm)} ${lower.maxByDurationMm.map((mm, index) => `${x(index + 1)},${y(mm)}`).reverse().join(" ")}`;
  const label = (reference: GalapagosReference) => reference.shortLabel ?? `${reference.island}, ${reference.date}`;
  const summary = `Lluvia máxima según la duración en ${station.island}: ${formatMm(station.mm3h)} mm en 3 horas, ${formatMm(station.mm6h)} mm en 6 horas y ${formatMm(station.mm24h)} mm en 24 horas. ${label(upper)}: ${formatMm(upper.totalMm)} mm. ${label(lower)}: ${formatMm(lower.totalMm)} mm.`;

  return (
    <>
      <svg viewBox={`0 0 ${WIDTH} ${height}`} className="mt-1 w-full" role="img" aria-label={summary}>
        <polygon points={band} fill={COLORS.durationBand} opacity={0.7} />
        <line x1={left} x2={plotRight} y1={baseline} y2={baseline} stroke={COLORS.grid} />
        <polyline points={points(lower.maxByDurationMm)} fill="none" stroke={COLORS.durationLower} strokeWidth={1.5} strokeLinejoin="round" />
        <text x={plotRight + 3} y={y(lower.totalMm) + 3} fill={COLORS.durationLower} fontSize={9} fontWeight={600}>
          {Math.round(lower.totalMm)}
        </text>
        <polyline points={points(upper.maxByDurationMm)} fill="none" stroke={COLORS.upper} strokeWidth={1.5} strokeLinejoin="round" />
        <text x={plotRight + 3} y={y(upper.totalMm) + 3} fill={COLORS.upper} fontSize={9} fontWeight={600}>
          {Math.round(upper.totalMm)}
        </text>
        {current.length > 0 && (
          <>
            <polyline points={points(current)} fill="none" stroke={COLORS.duration} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={x(current.length)} cy={y(current.at(-1) ?? 0)} r={3} fill={COLORS.duration} />
          </>
        )}
        {ticks.map((duration) => (
          <g key={duration}>
            <line x1={x(duration)} x2={x(duration)} y1={baseline} y2={baseline + 3} stroke={COLORS.text} />
            <text x={x(duration)} y={height - 5} textAnchor={duration === hours ? "end" : "middle"} fill={COLORS.text} fontSize={9}>
              {duration} h
            </text>
          </g>
        ))}
      </svg>

      <ul className="mt-1 space-y-0.5 text-[11px] text-slate-600">
        <Key color={COLORS.duration} height={3}>
          Ahora: <strong className="text-slate-900 tabular-nums">{formatMm(station.mm24h)} mm</strong> en 24 h
        </Key>
        <Key color={COLORS.upper}>{label(upper)}</Key>
        <Key color={COLORS.durationLower}>{label(lower)}</Key>
      </ul>
    </>
  );
}

/** Una línea de la leyenda: la muestra de la línea y su texto. */
function Key({ color, height = 2, dashed = false, children }: { color: string; height?: number; dashed?: boolean; children: ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className={dashed ? "w-4 shrink-0 border-t-2 border-dashed" : "w-4 shrink-0 rounded"}
        style={dashed ? { borderColor: color } : { background: color, height }}
      />
      <span>{children}</span>
    </li>
  );
}
