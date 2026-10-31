import { normalizeName } from "./parish-filters";
import type { RiskFeature } from "./types";

/**
 * Cierres viales: los reportes de novedad vial de las direcciones distritales
 * del MIT (GET /risk-layers/road-closures). Cada reporte dice en qué condición
 * está la vía; aquí se ordenan, se filtran y se cuentan para el panel.
 */

export const ROAD_CLOSURES_LAYER_ID = "road-closures";

/** Condiciones de la vía del formulario, de la más a la menos grave, con su color en el mapa y en el panel. */
export const ROAD_CONDITIONS = [
  { label: "Cierre total", short: "Cierre total", color: "#dc2626" },
  { label: "Paso restringido", short: "Restringido", color: "#ea580c" },
  { label: "Paso controlado", short: "Controlado", color: "#d97706" },
  { label: "Habilitado un carril con paso controlado", short: "Un carril controlado", color: "#65a30d" },
  { label: "Habilitado un carril", short: "Un carril", color: "#16a34a" },
] as const;

export type RoadCondition = (typeof ROAD_CONDITIONS)[number]["label"];

/** Periodo de los reportes según su última actualización (horas hacia atrás; null = todos). */
export const CLOSURE_PERIODS = [
  { value: "24h", label: "24 h", hours: 24 },
  { value: "3d", label: "3 días", hours: 72 },
  { value: "7d", label: "7 días", hours: 168 },
  { value: "all", label: "Todos", hours: null },
] as const;

export type ClosurePeriod = (typeof CLOSURE_PERIODS)[number]["value"];

export interface ClosureFilters {
  period: ClosurePeriod;
  /** Condiciones que se muestran (todas al inicio). */
  conditions: readonly RoadCondition[];
  /** "" = todas. */
  province: string;
}

export const DEFAULT_CLOSURE_FILTERS: ClosureFilters = {
  // Como el panel de eventos: al abrir, lo de las últimas 24 h.
  period: "24h",
  conditions: ROAD_CONDITIONS.map((condition) => condition.label),
  province: "",
};

/** Condición de un reporte, o null si no trae una de la lista. */
export function conditionOf(feature: RiskFeature): (typeof ROAD_CONDITIONS)[number] | null {
  const value = normalizeName(String(feature.properties.cond_via ?? ""));
  return ROAD_CONDITIONS.find((condition) => normalizeName(condition.label) === value) ?? null;
}

/** Última actualización del reporte: la que declara el formulario o, si falta, la edición o la creación. */
export function updatedAt(feature: RiskFeature): number | null {
  for (const field of ["fecha_actua", "EditDate", "CreationDate"]) {
    const time = Date.parse(String(feature.properties[field] ?? ""));
    if (Number.isFinite(time)) return time;
  }
  return null;
}

/** Hora estimada de habilitación, si la trae. */
export function reopeningAt(feature: RiskFeature): number | null {
  const time = Date.parse(String(feature.properties.fecha_estim_hab ?? ""));
  return Number.isFinite(time) ? time : null;
}

const rank = (feature: RiskFeature) => {
  const condition = conditionOf(feature);
  return condition ? ROAD_CONDITIONS.indexOf(condition) : ROAD_CONDITIONS.length;
};

/** Reportes del periodo y la provincia elegidos (sin filtrar por condición: así se cuentan todas). */
export function closuresInScope(features: readonly RiskFeature[], filters: ClosureFilters, now: number): RiskFeature[] {
  const hours = CLOSURE_PERIODS.find((period) => period.value === filters.period)?.hours ?? null;
  const since = hours === null ? -Infinity : now - hours * 60 * 60 * 1000;
  return features.filter(
    (feature) =>
      (updatedAt(feature) ?? -Infinity) >= since &&
      (!filters.province || String(feature.properties.despro ?? "") === filters.province),
  );
}

/**
 * Los reportes que se listan y se dibujan: los del periodo, la provincia y las
 * condiciones elegidas, del más grave al menos grave y, en cada condición, del
 * actualizado más recientemente. Los que no traen condición se muestran al final.
 */
export function filterClosures(features: readonly RiskFeature[], filters: ClosureFilters, now: number): RiskFeature[] {
  return closuresInScope(features, filters, now)
    .filter((feature) => {
      const condition = conditionOf(feature);
      return !condition || filters.conditions.includes(condition.label);
    })
    .sort((a, b) => rank(a) - rank(b) || (updatedAt(b) ?? 0) - (updatedAt(a) ?? 0));
}
