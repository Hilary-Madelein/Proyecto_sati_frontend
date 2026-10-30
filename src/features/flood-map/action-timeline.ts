import type { RiskFeature, RiskLayerData } from "./types";

/**
 * Línea de tiempo de las acciones del MIT: las preventivas (limpieza de cunetas,
 * alcantarillas…) y las de respuesta (despeje de derrumbes, variantes…), de las
 * dos encuestas que trae el backend, ordenadas por su fecha de inicio.
 */

export type ActionKind = "preventive" | "response";

/** Capas de las que salen las acciones, con el color que tienen en el mapa. */
export const ACTION_LAYERS: readonly { id: string; kind: ActionKind; label: string; color: string }[] = [
  { id: "rve-preventive-works", kind: "preventive", label: "Preventiva", color: "#15803d" },
  { id: "mit-response-actions", kind: "response", label: "Respuesta", color: "#b45309" },
];

export const ACTION_LAYER_IDS = ACTION_LAYERS.map((layer) => layer.id);

export interface TimelineAction {
  /** Único entre las dos capas (capa + entidad). */
  key: string;
  layerId: string;
  kind: ActionKind;
  feature: RiskFeature;
  /** Lo que se hizo, p. ej. "Limpieza de cunetas, Limpieza de alcantarillas". */
  title: string;
  /** Inicio y fin en milisegundos; null si la encuesta no los trae. */
  start: number | null;
  end: number | null;
  /** Día de inicio en Ecuador (AAAA-MM-DD), para agrupar; null sin fecha. */
  day: string | null;
  /** Código de la vía (E35) y tramo. */
  road: string | null;
  section: string | null;
  canton: string | null;
  province: string | null;
  /** Operadores de maquinaria y máquinas en total (la segunda solo en las de respuesta). */
  operators: number;
  machines: number;
}

export type ActionStatus = "planned" | "ongoing" | "done";

// Ecuador continental usa UTC-5 todo el año.
const ECUADOR_OFFSET_MS = -5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Día en Ecuador (AAAA-MM-DD) de un instante. */
export function ecuadorDay(time: number): string {
  return new Date(time + ECUADOR_OFFSET_MS).toISOString().slice(0, 10);
}

/** Lunes (AAAA-MM-DD) de la semana de un día. */
export function weekOf(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  const sinceMonday = (date.getUTCDay() + 6) % 7;
  return new Date(date.getTime() - sinceMonday * DAY_MS).toISOString().slice(0, 10);
}

const LOWERCASE_WORDS = new Set(["de", "del", "la", "las", "los", "y", "el"]);

/** "SANTO DOMINGO DE LOS TSACHILAS" → "Santo Domingo de los Tsachilas" (las encuestas guardan los lugares en mayúsculas). */
export function placeName(name: string): string {
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) => (i > 0 && LOWERCASE_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

const text = (value: unknown) => {
  const trimmed = String(value ?? "").trim();
  return trimmed && trimmed.toUpperCase() !== "NA" ? trimmed : null;
};
const count = (value: unknown) => {
  const number = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(number) && number > 0 ? number : 0;
};
const time = (value: unknown) => {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
};

/** Las acciones de las dos capas, de la más reciente a la más antigua; las que no tienen fecha, al final. */
export function timelineActions(layers: Partial<Record<string, RiskLayerData | null>>): TimelineAction[] {
  const actions = ACTION_LAYERS.flatMap(({ id, kind, label }) =>
    (layers[id]?.features ?? []).map((feature, index): TimelineAction => {
      const p = feature.properties;
      const start = time(p.fecha_inicio);
      return {
        key: `${id}:${feature.id ?? index}`,
        layerId: id,
        kind,
        feature,
        title: text(p.Acciones) ?? `Acción ${label.toLowerCase()}`,
        start,
        end: time(p.fecha_fin),
        day: start === null ? null : ecuadorDay(start),
        road: text(p.Via_RVE),
        section: text(p.nombre_via),
        canton: text(p.descanto),
        province: text(p.despro),
        operators: count(p.persnl_operd_maq),
        machines: count(p.total_maquinaria_respt),
      };
    }),
  );
  return actions.sort((a, b) => (b.start ?? -Infinity) - (a.start ?? -Infinity));
}

/** Si la acción aún no empieza, está en curso (empezó y su fin es posterior a hoy) o terminó. */
export function actionStatus(action: TimelineAction, now: number): ActionStatus {
  const today = ecuadorDay(now);
  if (action.day && action.day > today) return "planned";
  if (action.end !== null && ecuadorDay(action.end) >= today) return "ongoing";
  return "done";
}

/** Días que dura, contando el de inicio y el de fin; null si le falta alguna fecha. */
export function actionDays(action: TimelineAction): number | null {
  if (action.start === null || action.end === null) return null;
  const days = Math.round((Date.parse(ecuadorDay(action.end)) - Date.parse(ecuadorDay(action.start))) / DAY_MS) + 1;
  return days > 0 ? days : null;
}

export interface WeekCount {
  /** Lunes de la semana (AAAA-MM-DD). */
  week: string;
  preventive: number;
  response: number;
}

/**
 * Acciones que empezaron cada semana, desde la semana de la primera hasta la
 * actual (las semanas sin acciones también, en cero, para no deformar el tiempo).
 * Las acciones con inicio en el futuro cuentan en su semana.
 */
export function weeklyCounts(actions: readonly TimelineAction[], now: number): WeekCount[] {
  const days = actions.flatMap((action) => (action.day ? [action.day] : []));
  if (days.length === 0) return [];
  const first = weekOf(days.reduce((a, b) => (a < b ? a : b)));
  const last = weekOf([ecuadorDay(now), ...days].reduce((a, b) => (a > b ? a : b)));
  const weeks = new Map<string, WeekCount>();
  for (let week = first; week <= last; week = new Date(Date.parse(week) + 7 * DAY_MS).toISOString().slice(0, 10)) {
    weeks.set(week, { week, preventive: 0, response: 0 });
  }
  for (const action of actions) {
    const row = action.day ? weeks.get(weekOf(action.day)) : undefined;
    if (row) row[action.kind] += 1;
  }
  return [...weeks.values()];
}

export interface ActionSummary {
  total: number;
  preventive: number;
  response: number;
  provinces: number;
  /** Cantones distintos (por provincia: hay cantones con el mismo nombre en dos provincias). */
  cantons: number;
}

export function actionSummary(actions: readonly TimelineAction[]): ActionSummary {
  return {
    total: actions.length,
    preventive: actions.filter((action) => action.kind === "preventive").length,
    response: actions.filter((action) => action.kind === "response").length,
    provinces: new Set(actions.flatMap((action) => (action.province ? [action.province] : []))).size,
    cantons: new Set(actions.flatMap((action) => (action.canton ? [`${action.province ?? ""}/${action.canton}`] : []))).size,
  };
}
