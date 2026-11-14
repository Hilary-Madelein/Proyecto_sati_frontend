"use client";

import { useEffect, useState } from "react";
import { satiClientGet } from "@/lib/api/sati-client";
import { formatHour } from "@/lib/format";

/** Códigos del INAMHI de las dos estaciones de Galápagos: tienen su propia gráfica y su propia alarma. */
export const GALAPAGOS_STATION_CODES: readonly string[] = ["M0191", "M0221"];

type GalapagosLevel = "normal" | "alarm" | "extreme";

interface GalapagosStationRain {
  code: string;
  island: string;
  lastTime: string | null;
  mm3h: number;
  mm6h: number;
  mm24h: number;
  /** Lluvia de los tres días anteriores a las últimas 24 horas; null si no se pudo leer. */
  priorMm: number | null;
  loaded: boolean;
  alarmThresholdMm: number;
  level: GalapagosLevel;
  reason: string | null;
  /** Lo máximo que llovió en 1, 2, 3… horas seguidas dentro de las últimas 24 (mm). */
  maxByDurationMm: number[];
}

interface GalapagosReference {
  key: "upper" | "lower";
  island: string;
  date: string;
  outcome: string;
  totalMm: number;
  max3hMm: number;
  max6hMm: number;
  /** Lo máximo que llovió en 1, 2, 3… 24 horas seguidas (mm). */
  maxByDurationMm: number[];
}

/** Respuesta de GET /galapagos-rain. */
interface GalapagosRainSnapshot {
  stations: GalapagosStationRain[];
  references: GalapagosReference[];
  thresholds: { extreme3hMm: number; extreme6hMm: number };
}

const WIDTH = 248;
const HEIGHT = 132;
const PAD = { top: 10, right: 30, bottom: 18, left: 6 };
/** Duraciones que se rotulan en el eje (horas). */
const TICKS = [3, 6, 12, 24];
const HOURS = 24;
// Colores como atributos del SVG (no clases): así también salen en la imagen descargada.
const COLORS = { upper: "#dc2626", lower: "#d97706", band: "#fee2e2", current: "#1d4ed8", threshold: "#64748b", grid: "#e2e8f0", text: "#64748b" };
const LEVELS: Record<GalapagosLevel, { label: string; className: string }> = {
  normal: { label: "Sin alarma", className: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  alarm: { label: "Alarma", className: "bg-amber-50 text-amber-900 ring-amber-300" },
  extreme: { label: "Alarma extrema", className: "bg-red-50 text-red-800 ring-red-300" },
};

const formatMm = (mm: number) => mm.toLocaleString("es-EC", { maximumFractionDigits: 1 });

type State = { status: "loading" } | { status: "error" } | { status: "ready"; station: GalapagosStationRain; snapshot: GalapagosRainSnapshot };

/**
 * Gráfica solo de las estaciones de Galápagos: lo máximo que ha llovido en 1, 3, 6,
 * 12 y 24 horas seguidas dentro de las últimas 24, frente a lo que pasó en esas
 * mismas estaciones. El borde superior es Santa Cruz el 30 y 31 de octubre de 2026
 * (se desbordó La Cascada); el inferior, San Cristóbal el 12 de noviembre (una vía
 * inundada). Se compara por duración y no hora por hora porque lo que separó el
 * desborde del resto fue la intensidad en pocas horas. La línea punteada es el
 * umbral de la alarma de 24 horas que se envía por Telegram. Se consulta al abrir
 * el popup.
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

  if (state.status === "loading") return <p className="mt-2 text-xs text-slate-400">Cargando la comparación de Galápagos…</p>;
  if (state.status === "error") return <p className="mt-2 text-xs text-slate-500">No se pudo cargar la comparación de Galápagos.</p>;

  const { station, snapshot } = state;
  const upper = snapshot.references.find((item) => item.key === "upper");
  const lower = snapshot.references.find((item) => item.key === "lower");
  if (!upper || !lower) return null;

  const current = station.maxByDurationMm.slice(0, HOURS);
  const max = Math.max(upper.totalMm, ...current, station.alarmThresholdMm) * 1.06;
  /** Posición de una duración en horas (de 1 a 24). */
  const x = (hours: number) => PAD.left + ((hours - 1) / (HOURS - 1)) * (WIDTH - PAD.left - PAD.right);
  const y = (mm: number) => PAD.top + (1 - mm / max) * (HEIGHT - PAD.top - PAD.bottom);
  const points = (values: readonly number[]) => values.map((mm, index) => `${x(index + 1)},${y(mm)}`).join(" ");
  const band = `${points(upper.maxByDurationMm)} ${lower.maxByDurationMm.map((mm, index) => `${x(index + 1)},${y(mm)}`).reverse().join(" ")}`;
  const baseline = HEIGHT - PAD.bottom;
  const right = WIDTH - PAD.right;
  const level = LEVELS[station.level];
  const summary = `Lluvia máxima según la duración en ${station.island}: ${formatMm(station.mm3h)} mm en 3 horas, ${formatMm(station.mm6h)} mm en 6 horas y ${formatMm(station.mm24h)} mm en 24 horas. Borde superior, ${upper.island} el ${upper.date}: ${formatMm(upper.totalMm)} mm. Borde inferior, ${lower.island} el ${lower.date}: ${formatMm(lower.totalMm)} mm. Umbral de alarma: ${station.alarmThresholdMm} mm.`;

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Lluvia máxima por duración · Galápagos</p>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${level.className}`}>{level.label}</span>
      </div>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="mt-1 w-full" role="img" aria-label={summary}>
        {/* Entre los dos bordes: de "vía inundada" a "desborde de la cañada". */}
        <polygon points={band} fill={COLORS.band} opacity={0.7} />
        <line x1={PAD.left} x2={right} y1={baseline} y2={baseline} stroke={COLORS.grid} />
        <line x1={PAD.left} x2={right} y1={y(station.alarmThresholdMm)} y2={y(station.alarmThresholdMm)} stroke={COLORS.threshold} strokeDasharray="3 3" />
        <text x={right + 3} y={y(station.alarmThresholdMm) + 3} fill={COLORS.threshold} fontSize={9}>
          {station.alarmThresholdMm}
        </text>

        <polyline points={points(lower.maxByDurationMm)} fill="none" stroke={COLORS.lower} strokeWidth={1.5} strokeLinejoin="round" />
        <text x={right + 3} y={y(lower.totalMm) + 3} fill={COLORS.lower} fontSize={9} fontWeight={600}>
          {Math.round(lower.totalMm)}
        </text>
        <polyline points={points(upper.maxByDurationMm)} fill="none" stroke={COLORS.upper} strokeWidth={1.5} strokeLinejoin="round" />
        <text x={right + 3} y={y(upper.totalMm) + 3} fill={COLORS.upper} fontSize={9} fontWeight={600}>
          {Math.round(upper.totalMm)}
        </text>

        {current.length > 0 && (
          <>
            <polyline points={points(current)} fill="none" stroke={COLORS.current} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={x(current.length)} cy={y(current.at(-1) ?? 0)} r={3} fill={COLORS.current} />
          </>
        )}

        {TICKS.map((hours) => (
          <g key={hours}>
            <line x1={x(hours)} x2={x(hours)} y1={baseline} y2={baseline + 3} stroke={COLORS.text} />
            <text x={x(hours)} y={HEIGHT - 5} textAnchor={hours === HOURS ? "end" : "middle"} fill={COLORS.text} fontSize={9}>
              {hours} h
            </text>
          </g>
        ))}
      </svg>

      <ul className="mt-1 space-y-0.5 text-[11px] text-slate-600">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="w-4 shrink-0 rounded" style={{ background: COLORS.current, height: 3 }} />
          <span>
            Ahora, lo máximo en cada duración: <strong className="text-slate-900 tabular-nums">{formatMm(station.mm24h)} mm</strong> en 24 h
            {station.lastTime && ` (hasta las ${formatHour(station.lastTime)})`}
          </span>
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="w-4 shrink-0 rounded" style={{ background: COLORS.upper, height: 2 }} />
          <span>
            Borde superior: {upper.island}, {upper.date} ({formatMm(upper.totalMm)} mm; {upper.outcome})
          </span>
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="w-4 shrink-0 rounded" style={{ background: COLORS.lower, height: 2 }} />
          <span>
            Borde inferior: {lower.island}, {lower.date} ({formatMm(lower.totalMm)} mm; {lower.outcome})
          </span>
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="w-4 shrink-0 border-t border-dashed" style={{ borderColor: COLORS.threshold }} />
          <span>
            Umbral de alarma: {station.alarmThresholdMm} mm en 24 h
            {station.loaded && station.priorMm !== null && ` (bajó a la mitad: ${formatMm(station.priorMm)} mm en los tres días anteriores)`}
          </span>
        </li>
      </ul>

      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
        <Intensity label="En 3 horas" mm={station.mm3h} lower={lower.max3hMm} upper={upper.max3hMm} limit={snapshot.thresholds.extreme3hMm} />
        <Intensity label="En 6 horas" mm={station.mm6h} lower={lower.max6hMm} upper={upper.max6hMm} limit={snapshot.thresholds.extreme6hMm} />
      </dl>
      {station.reason && <p className="mt-1.5 text-[11px] leading-snug text-slate-700">{station.reason}.</p>}
      <p className="mt-1.5 text-[10px] leading-snug text-slate-400">
        Estación en la costa: en la parte alta puede llover más. Al pasar el umbral se envía la alarma por Telegram.
      </p>
    </div>
  );
}

/** La intensidad de ahora frente a la de los dos bordes: es lo que separó el desborde del resto. */
function Intensity({ label, mm, lower, upper, limit }: { label: string; mm: number; lower: number; upper: number; limit: number }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className={`font-semibold tabular-nums ${mm >= limit ? "text-red-700" : "text-slate-900"}`}>{formatMm(mm)} mm</dd>
      <dd className="text-[10px] text-slate-400 tabular-nums">
        bordes: {formatMm(lower)} – {formatMm(upper)}
      </dd>
    </div>
  );
}
