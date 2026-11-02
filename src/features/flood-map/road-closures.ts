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

/** Opción de "Estado de atención" (`estd_atencion`) con la que la dirección distrital cierra el evento. */
const EVENT_CLOSED = "Habilitada - Evento Cerrado";

export const CLOSED_EVENT_STYLE = { label: "Evento cerrado", plural: "Eventos cerrados", color: "#0d9488" };

/** Qué reportes se ven: los abiertos, o todos (también los ya cerrados). */
export const CLOSURE_VIEWS = [
  { value: "open", label: "Abiertos" },
  { value: "all", label: "Todos" },
] as const;

export type ClosureView = (typeof CLOSURE_VIEWS)[number]["value"];

export interface ClosureFilters {
  view: ClosureView;
  /** Condiciones que se muestran (todas al inicio). */
  conditions: readonly RoadCondition[];
  /** "" = todas. */
  province: string;
}

export const DEFAULT_CLOSURE_FILTERS: ClosureFilters = {
  view: "open",
  conditions: ROAD_CONDITIONS.map((condition) => condition.label),
  province: "",
};

/**
 * Un cierre puede durar días: sigue abierto, sin vencer por tiempo, hasta que la
 * dirección distrital lo marque habilitado. También los reportes anteriores a ese campo.
 */
export function isClosed(feature: RiskFeature): boolean {
  return feature.properties.estd_atencion === EVENT_CLOSED;
}

/** Condición de un reporte, o null si no trae una de la lista. */
export function conditionOf(feature: RiskFeature): (typeof ROAD_CONDITIONS)[number] | null {
  const value = normalizeName(String(feature.properties.cond_via ?? ""));
  return ROAD_CONDITIONS.find((condition) => normalizeName(condition.label) === value) ?? null;
}

/** Cuándo se reportó: lo primero entre la fecha que declara el formulario y la creación del registro. */
export function reportedAt(feature: RiskFeature): number | null {
  const times = ["fecha_actua", "CreationDate"]
    .map((field) => Date.parse(String(feature.properties[field] ?? "")))
    .filter(Number.isFinite);
  return times.length > 0 ? Math.min(...times) : null;
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

/** Del más grave al menos grave; después, los que no traen condición; al final, los cerrados. */
const rank = (feature: RiskFeature) => {
  if (isClosed(feature)) return ROAD_CONDITIONS.length + 1;
  const condition = conditionOf(feature);
  return condition ? ROAD_CONDITIONS.indexOf(condition) : ROAD_CONDITIONS.length;
};

/** Reportes de la vista y la provincia elegidas (sin filtrar por condición: así se cuentan todas). */
export function closuresInScope(features: readonly RiskFeature[], { view, province }: Pick<ClosureFilters, "view" | "province">): RiskFeature[] {
  return features.filter((feature) => (view === "all" || !isClosed(feature)) && (!province || String(feature.properties.despro ?? "") === province));
}

/**
 * Los reportes que se listan y se dibujan: los de la vista, la provincia y las
 * condiciones elegidas, sin importar su fecha, en el orden de `rank` y, a igual
 * orden, del actualizado más recientemente. Las condiciones solo filtran los abiertos
 * que traen una.
 */
export function filterClosures(features: readonly RiskFeature[], filters: ClosureFilters): RiskFeature[] {
  return closuresInScope(features, filters)
    .filter((feature) => {
      const condition = conditionOf(feature);
      return isClosed(feature) || !condition || filters.conditions.includes(condition.label);
    })
    .sort((a, b) => rank(a) - rank(b) || (updatedAt(b) ?? 0) - (updatedAt(a) ?? 0));
}
