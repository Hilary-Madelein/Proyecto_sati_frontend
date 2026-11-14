"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangleIcon } from "@/components/ui/icons";
import { formatHour } from "@/lib/format";
import { satiClientGet } from "@/lib/api/sati-client";
import { STATION_HOURLY_BAR_COLOR } from "../../constants";
import type { WeatherStationHour } from "../../types";

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
export interface GalapagosLimit {
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
  /** Umbrales de la alarma de Galápagos. */
  thresholds?: { alarm5hMm: number; alarmBurstMm: number; extreme3hMm: number; extreme6hMm: number };
}

const WIDTH = 248;
// Colores como atributos del SVG (no clases): así también salen en la imagen descargada.
const COLORS = { upper: "#dc2626", lower: "#2a78d6", band: "#f1f5f9", now: "#0f172a", duration: "#1d4ed8", durationLower: "#d97706", durationBand: "#fee2e2", grid: "#e2e8f0", text: "#64748b" };
const LEVELS: Record<GalapagosLevel, { label: string; className: string; icon: string }> = {
  normal: { label: "Sin alarma", className: "bg-emerald-50 text-emerald-900 ring-emerald-200", icon: "text-emerald-600" },
  alarm: { label: "Alarma", className: "bg-amber-50 text-amber-950 ring-amber-300", icon: "text-amber-600" },
  extreme: { label: "Alarma extrema", className: "bg-red-50 text-red-900 ring-red-300", icon: "text-red-600" },
};

const formatMm = (mm: number) => mm.toLocaleString("es-EC", { maximumFractionDigits: 1 });

export type GalapagosRainState = { status: "loading" } | { status: "error" } | { status: "ready"; station: GalapagosStationRain; snapshot: GalapagosRainSnapshot };

/**
 * La lluvia de una estación de Galápagos (GET /galapagos-rain), al abrir su popup.
 * `code` null (otra estación): no se pide nada. La usan esta gráfica y las barras de
 * lluvia por hora (sus dos líneas de límite).
 */
export function useGalapagosRain(code: string | null): GalapagosRainState | null {
  const [state, setState] = useState<GalapagosRainState>({ status: "loading" });

  useEffect(() => {
    if (!code) return;
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

  return code ? state : null;
}

type ReadyState = Extract<GalapagosRainState, { status: "ready" }>;

/**
 * El popup de una estación de Galápagos, de lo más importante a lo de detalle: si hay
 * alarma y por qué, la lluvia de hoy y de las últimas 24 horas, la lluvia de cada hora
 * con los dos límites del día de la estación y el acumulado de ayer y hoy.
 * `fallbackBars`: las barras por hora de siempre, si la estación no tiene límites del día.
 */
export function GalapagosStationDetails({
  state,
  hours,
  last24h,
  fallbackBars,
}: {
  state: ReadyState;
  hours: WeatherStationHour[];
  last24h: { mm: number; hoursWithData: number; until: string | null };
  fallbackBars: ReactNode;
}) {
  const { station, snapshot } = state;
  const limits = DAY_LIMITS[station.code];
  const day = todayByHour(hours);
  const where = limits && day ? standing(day.total, limits.upper.mm, limits.lower.mm) : null;

  return (
    <div className="mt-2 space-y-3">
      <AlarmBanner station={station} thresholds={snapshot.thresholds} />

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Hoy" value={day ? `${formatMm(day.total)} mm` : "–"} note={where && <span className={where.className}>{where.text}</span>} />
        <Stat label="Últimas 24 h" value={`${formatMm(last24h.mm)} mm`} note={last24h.until ? `hasta las ${last24h.until}` : `${last24h.hoursWithData} h con dato`} />
      </div>

      {limits && hours.length > 0 ? (
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Lluvia de cada hora</p>
          <p className="text-[10px] text-slate-500">Escala logarítmica: así se ven las horas de poca lluvia junto a los límites.</p>
          <HourlyLogBars hours={hours} limits={limits} island={station.island} />
        </div>
      ) : (
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Lluvia de cada hora</p>
          {fallbackBars}
        </div>
      )}

      <div>
        <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Acumulado · ayer y hoy</p>
        <TwoDaySection state={state} />
      </div>
    </div>
  );
}

/** Lo primero que se lee: si hay alarma, por qué y cuándo salta. */
function AlarmBanner({ station, thresholds }: { station: GalapagosStationRain; thresholds?: GalapagosRainSnapshot["thresholds"] }) {
  const level = LEVELS[station.level] ?? LEVELS.normal;
  return (
    <div role="status" className={`flex gap-2 rounded-lg px-2.5 py-2 ring-1 ${level.className}`}>
      <AlertTriangleIcon className={`mt-0.5 size-4 shrink-0 ${level.icon}`} />
      <div className="min-w-0">
        <p className="text-[13px] leading-tight font-semibold">{level.label}</p>
        {station.reason && <p className="text-[11px] leading-snug">{station.reason.charAt(0).toUpperCase() + station.reason.slice(1)}.</p>}
        {thresholds && (
          <p className="mt-0.5 text-[10px] leading-snug opacity-75">
            Salta con {formatMm(thresholds.alarm5hMm)} mm en 5 h, o dos tandas de {formatMm(thresholds.alarmBurstMm)} mm.
          </p>
        )}
      </div>
    </div>
  );
}

/** Dónde queda la lluvia de hoy respecto de los dos límites del día de la estación. */
function standing(mm: number, upperMm: number, lowerMm: number): { text: string; className: string } {
  if (mm >= upperMm) return { text: "sobre el límite superior", className: "font-semibold text-red-700" };
  if (mm >= lowerMm) return { text: "entre los dos límites", className: "font-semibold text-amber-700" };
  return { text: "bajo el límite inferior", className: "" };
}

function Stat({ label, value, note }: { label: string; value: string; note?: ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2.5 py-1.5 ring-1 ring-slate-200/70">
      <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="text-base leading-tight font-semibold text-slate-900 tabular-nums">{value}</p>
      {note && <p className="text-[10px] leading-snug text-slate-500">{note}</p>}
    </div>
  );
}

/** La gráfica de dos días de la estación (o, si el backend no entrega sus límites, la comparación por duración). */
function TwoDaySection({ state }: { state: ReadyState }) {
  const { station, snapshot } = state;
  const upper = station.limits?.find((item) => item.key === "upper");
  const lower = station.limits?.find((item) => item.key === "lower");
  return upper && lower && station.twoDays ? (
    <TwoDayChart station={station} now={station.twoDays} upper={upper} lower={lower} />
  ) : (
    <DurationChart station={station} references={snapshot.references} />
  );
}

/** Un límite del día: la lluvia de un día entero del registro de la estación. */
interface DayLimit {
  mm: number;
  /** "31 oct". */
  day: string;
  /** Qué pasó ese día. */
  outcome: string;
}

/**
 * Los dos límites del día de cada estación, de su lluvia horaria validada del INAMHI.
 * Santa Cruz: el 31 de octubre de 2026 (135,4 mm, se desbordó La Cascada) y el 12 de
 * noviembre (28,6 mm, sin inundación). San Cristóbal: el 12 de noviembre (138,7 mm, su
 * único día con inundación) y el 9 de noviembre (10,7 mm, sin consecuencias).
 */
const DAY_LIMITS: Readonly<Record<string, { upper: DayLimit; lower: DayLimit }>> = {
  M0191: { upper: { mm: 135.4, day: "31 oct", outcome: "se desbordó La Cascada" }, lower: { mm: 28.6, day: "12 nov", outcome: "sin inundación reportada" } },
  M0221: { upper: { mm: 138.7, day: "12 nov", outcome: "se inundó una vía en La Lobería" }, lower: { mm: 10.7, day: "9 nov", outcome: "sin consecuencias" } },
};

/** El registro del INAMHI cuenta los días en hora del continente (UTC-5), de 00:00 a 24:00. */
const RECORD_OFFSET_MS = 5 * 60 * 60 * 1000;

/** La lluvia de hoy (día del registro de la última hora con dato), para compararla con los límites del día. */
function todayByHour(hours: readonly WeatherStationHour[]): { total: number } | null {
  const withData = hours.filter((hour) => hour.mm !== null);
  const last = withData.at(-1);
  if (!last) return null;
  const dayOf = (time: string) => new Date(Date.parse(time) - RECORD_OFFSET_MS).toISOString().slice(0, 10);
  const today = dayOf(last.time);
  const total = withData.reduce((sum, hour) => (dayOf(hour.time) === today ? sum + (hour.mm ?? 0) : sum), 0);
  return { total: Math.round(total * 10) / 10 };
}

const LOG_CHART = { height: 104, top: 8, right: 30, bottom: 16, gap: 2, upper: "#dc2626", lower: "#334155", grid: "#eef2f6" };

/**
 * Las barras de la lluvia de cada hora (las de siempre) con los dos límites del día de
 * la estación como líneas entrecortadas. La altura va en escala logarítmica (de
 * mm + 1): con la superior en 135 mm, en escala normal una hora de 10 mm sería una
 * raya; así se lee junto a las líneas.
 */
function HourlyLogBars({ hours, limits, island }: { hours: WeatherStationHour[]; limits: { upper: DayLimit; lower: DayLimit }; island: string }) {
  const { height, top, right, bottom, gap } = LOG_CHART;
  const plotRight = WIDTH - right;
  const baseline = height - bottom;
  const max = Math.max(limits.upper.mm, ...hours.map((hour) => hour.mm ?? 0));
  const scale = (mm: number) => Math.log10(1 + Math.max(0, mm)) / Math.log10(1 + max);
  const y = (mm: number) => baseline - scale(mm) * (baseline - top);
  const slot = plotRight / hours.length;
  const barWidth = Math.max(2, slot - gap);
  const labelled = new Set([0, Math.floor((hours.length - 1) / 2), hours.length - 1]);
  const summary = `Lluvia de cada hora en ${island}: ${hours.map((hour) => `${formatHour(hour.time)} ${hour.mm === null ? "sin dato" : `${formatMm(hour.mm)} mm`}`).join(", ")}. Límite superior ${formatMm(limits.upper.mm)} mm; inferior ${formatMm(limits.lower.mm)} mm.`;

  return (
    <>
      <svg viewBox={`0 0 ${WIDTH} ${height}`} className="mt-1 w-full" role="img" aria-label={summary}>
        {/* Guías de la escala: 1, 10 y 100 mm, salvo las que caen pegadas a una línea de límite (se encimaban). */}
        {[1, 10, 100].filter((mm) => mm < max && Math.abs(y(mm) - y(limits.upper.mm)) > 9 && Math.abs(y(mm) - y(limits.lower.mm)) > 9).map((mm) => (
          <g key={mm}>
            <line x1={0} x2={plotRight} y1={y(mm)} y2={y(mm)} stroke={LOG_CHART.grid} />
            <text x={0} y={y(mm) - 2} fill="#94a3b8" fontSize={7.5}>
              {mm}
            </text>
          </g>
        ))}
        {hours.map((hour, index) => {
          const x = index * slot + gap / 2;
          const start = new Date(Date.parse(hour.time) - 60 * 60 * 1000).toISOString();
          return (
            <g key={hour.time}>
              <title>{`De ${formatHour(start)} a ${formatHour(hour.time)}: ${hour.mm === null ? "sin dato" : `${formatMm(hour.mm)} mm`}`}</title>
              {/* Zona sensible a toda la altura: más grande que la barra. */}
              <rect x={x} y={top} width={barWidth} height={baseline - top} fill="transparent" />
              {hour.mm === null ? (
                <text x={x + barWidth / 2} y={baseline - 2} textAnchor="middle" fill="#94a3b8" fontSize={8}>
                  –
                </text>
              ) : (
                hour.mm > 0 && <rect x={x} y={y(hour.mm)} width={barWidth} height={baseline - y(hour.mm)} rx={Math.min(2, barWidth / 2)} fill={STATION_HOURLY_BAR_COLOR} />
              )}
              {labelled.has(index) && (
                <text x={x + barWidth / 2} y={height - 3} textAnchor={index === 0 ? "start" : index === hours.length - 1 ? "end" : "middle"} fill="#64748b" fontSize={9}>
                  {formatHour(hour.time)}
                </text>
              )}
            </g>
          );
        })}
        <line x1={0} x2={plotRight} y1={baseline} y2={baseline} stroke="#cbd5e1" />
        {/* Los dos límites, finos y entrecortados: no tapan las barras. */}
        {(["upper", "lower"] as const).map((key) => (
          <g key={key}>
            <line x1={0} x2={plotRight} y1={y(limits[key].mm)} y2={y(limits[key].mm)} stroke={LOG_CHART[key]} strokeWidth={1.2} strokeDasharray="4 3" />
            <text x={plotRight + 3} y={y(limits[key].mm) + 3} fill={LOG_CHART[key]} fontSize={9} fontWeight={600}>
              {formatMm(limits[key].mm)}
            </text>
          </g>
        ))}
      </svg>
      <ul className="mt-1 space-y-0.5 text-[11px] text-slate-600">
        <Key color={LOG_CHART.upper} dashed>
          Límite superior: {limits.upper.day}, {formatMm(limits.upper.mm)} mm en el día ({limits.upper.outcome})
        </Key>
        <Key color={LOG_CHART.lower} dashed>
          Límite inferior: {limits.lower.day}, {formatMm(limits.lower.mm)} mm en el día ({limits.lower.outcome})
        </Key>
      </ul>
    </>
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

        {/* Los dos límites, entrecortados; la lluvia de ahora, continua y más gruesa. */}
        <polyline points={path(upper.accumulatedMm)} fill="none" stroke={COLORS.upper} strokeWidth={1.6} strokeDasharray="5 3" strokeLinejoin="round" />
        <text x={plotRight + 3} y={y(upper.totalMm) + 3} fill={COLORS.upper} fontSize={9} fontWeight={600}>
          {Math.round(upper.totalMm)}
        </text>
        <polyline points={path(lower.accumulatedMm)} fill="none" stroke={COLORS.lower} strokeWidth={1.6} strokeDasharray="5 3" strokeLinejoin="round" />
        <text x={plotRight + 3} y={y(lower.totalMm) + 3} fill={COLORS.lower} fontSize={9} fontWeight={600}>
          {Math.round(lower.totalMm)}
        </text>

        {/* Aquí estamos: la línea de ahora, hasta la última hora con dato. */}
        <polyline points={path(now.map((point) => point.accumulatedMm))} fill="none" stroke={COLORS.now} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
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
        <Key color={COLORS.now} height={3}>
          Aquí estamos: <strong className="text-slate-900 tabular-nums">{formatMm(total)} mm</strong> desde ayer
        </Key>
        <Key color={COLORS.upper} dashed>
          {upper.label} ({formatMm(upper.totalMm)} mm)
        </Key>
        <Key color={COLORS.lower} dashed>
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
