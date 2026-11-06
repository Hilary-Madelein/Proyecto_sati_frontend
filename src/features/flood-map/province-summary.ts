import type { ProvinceFeature } from "./hooks/useProvinceGeometries";
import { normalizeName } from "./parish-filters";
import type { CantonAnalysis, EventSeverity, HazardEvent, ParishAlert, RiskFeature } from "./types";

/** Por qué se ordenan las provincias en el ranking (y se colorean en el mapa). */
export type RankIndicator = "events" | "closures";

export const RANK_INDICATORS: ReadonlyArray<{ id: RankIndicator; label: string; unit: string }> = [
  { id: "events", label: "Eventos", unit: "eventos" },
  { id: "closures", label: "Cierres", unit: "cierres abiertos" },
];

/** Las cifras de la frase de arriba, de un ámbito (el país o una provincia). */
export interface HeadlineFigures {
  events: number;
  critical: number;
  closuresOpen: number | null;
  closuresFull: number | null;
  /** Parroquias en alerta muy alta (roja) y alta (naranja); null si no hay pronóstico. */
  parishes: Record<"red" | "orange", number> | null;
}

/** Suma de lo que hay en los cantones de un ámbito (expuestos, preparación y respuesta). */
export interface CantonTotals {
  schools: number;
  schoolsHighFlood: number;
  students: number;
  healthCenters: number;
  healthFloodSusceptible: number;
  bridges: number;
  bridgesBad: number;
  shelters: number;
  machinery: number;
  roadEventsOpen: number;
}


/** Clave de provincia (la misma de ProvinceFeature.key): sin tildes ni mayúsculas. */
const keyOf = (name: string | null | undefined) => (name ? normalizeName(name) : null);

export function headlineFigures(
  events: readonly HazardEvent[],
  closures: readonly RiskFeature[] | null,
  isClosed: (feature: RiskFeature) => boolean,
  isFullClosure: (feature: RiskFeature) => boolean,
  parishes: readonly ParishAlert[] | null,
): HeadlineFigures {
  const open = closures?.filter((feature) => !isClosed(feature)) ?? null;
  return {
    events: events.length,
    critical: events.filter((event) => event.severity === ("critical" satisfies EventSeverity)).length,
    closuresOpen: open?.length ?? null,
    closuresFull: open?.filter(isFullClosure).length ?? null,
    parishes: parishes && {
      red: parishes.filter((parish) => parish.semaphore === "red").length,
      orange: parishes.filter((parish) => parish.semaphore === "orange").length,
    },
  };
}

/** Valor del indicador en cada provincia (por su clave). */
export function provinceValues(
  indicator: RankIndicator,
  input: {
    events: readonly HazardEvent[];
    openClosures: readonly RiskFeature[] | null;
  },
): Map<string, number> {
  const values = new Map<string, number>();
  const add = (name: string | null | undefined) => {
    const key = keyOf(name);
    if (key) values.set(key, (values.get(key) ?? 0) + 1);
  };
  if (indicator === "events") input.events.forEach((event) => add(event.province));
  else input.openClosures?.forEach((feature) => add(String(feature.properties.despro ?? "")));
  return values;
}

/** Las provincias con más, de mayor a menor (solo las que tienen algo). */
export function rankProvinces(values: ReadonlyMap<string, number>, provinces: readonly ProvinceFeature[], limit = 5) {
  return provinces
    .map((province) => ({ province, value: values.get(province.key) ?? 0 }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value || a.province.key.localeCompare(b.province.key))
    .slice(0, limit);
}

export function cantonTotals(cantons: readonly CantonAnalysis[]): CantonTotals {
  const sum = (value: (canton: CantonAnalysis) => number) => cantons.reduce((total, canton) => total + value(canton), 0);
  // La maquinaria es un inventario por provincia que cada cantón repite: se cuenta una vez por provincia.
  const machinery = new Map<string, number>();
  for (const canton of cantons) machinery.set(canton.province, Math.max(machinery.get(canton.province) ?? 0, canton.response.provinceMachinery));
  return {
    schools: sum((canton) => canton.exposed.schools),
    schoolsHighFlood: sum((canton) => canton.exposed.schoolsHighFlood),
    students: sum((canton) => canton.exposed.students),
    healthCenters: sum((canton) => canton.exposed.healthCenters),
    healthFloodSusceptible: sum((canton) => canton.exposed.healthFloodSusceptible),
    bridges: sum((canton) => canton.exposed.bridges),
    bridgesBad: sum((canton) => canton.exposed.bridgesBad),
    shelters: sum((canton) => canton.response.shelters),
    machinery: [...machinery.values()].reduce((total, value) => total + value, 0),
    roadEventsOpen: sum((canton) => canton.response.roadEventsOpen),
  };
}
