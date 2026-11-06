import type { ParishAlert, RainCategory, RainWindow, Semaphore } from "./types";

/** Filtros de la alerta por parroquia; se aplican igual a la lista y al mapa. */
export interface ParishFilters {
  /** Niveles que se listan y se dibujan en el mapa (cada uno se enciende y apaga); al inicio, rojo y naranja. */
  levels: readonly Semaphore[];
  /** null = todas: cada parroquia toma el nivel más alto. Con una, el nivel es solo el de esa ventana. */
  window: RainWindow | null;
  category: RainCategory | null;
  /** "" = todas. */
  province: string;
  query: string;
}

export const DEFAULT_LEVELS: readonly Semaphore[] = ["red", "orange"];

export const DEFAULT_PARISH_FILTERS: ParishFilters = { levels: DEFAULT_LEVELS, window: null, category: null, province: "", query: "" };

/** Categorías del documento, de mayor a menor (así se ofrecen como filtro). */
export const RAIN_CATEGORIES: readonly { id: RainCategory; label: string; semaphore: Semaphore }[] = [
  { id: "extrema", label: "Extrema", semaphore: "red" },
  { id: "torrencial", label: "Torrencial", semaphore: "red" },
  { id: "intensa", label: "Intensa", semaphore: "orange" },
  { id: "fuerte", label: "Fuerte", semaphore: "yellow" },
  { id: "moderada", label: "Moderada", semaphore: "yellow" },
  { id: "ligera", label: "Ligera", semaphore: "green" },
  { id: "minima", label: "Mínima", semaphore: "green" },
];

/**
 * Las parroquias con el nivel de una sola ventana, de la más a la menos grave; sin
 * pronóstico en esa ventana no salen. Sin ventana quedan como las manda el backend.
 */
export function parishesForWindow(parishes: readonly ParishAlert[], window: RainWindow | null): readonly ParishAlert[] {
  if (!window) return parishes;
  const rank = ({ category }: ParishAlert) => RAIN_CATEGORIES.findIndex((item) => item.id === category);
  const mm = (parish: ParishAlert) => parish.forecast[`mm${window}`] ?? -1;
  return parishes
    .flatMap((parish) => {
      const item = RAIN_CATEGORIES.find(({ id }) => id === parish.forecast[`category${window}`]);
      return item && mm(parish) >= 0 ? [{ ...parish, semaphore: item.semaphore, category: item.id, categoryLabel: item.label, decidedBy: window }] : [];
    })
    .sort((a, b) => rank(a) - rank(b) || mm(b) - mm(a));
}

/** Sin tildes ni mayúsculas, para buscar "Cañar" con "canar" o unir nombres de distintas fuentes. */
export const normalizeName = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

export function isFiltered(filters: ParishFilters): boolean {
  const sameLevels = filters.levels.length === DEFAULT_LEVELS.length && DEFAULT_LEVELS.every((level) => filters.levels.includes(level));
  return !sameLevels || filters.window !== null || filters.category !== null || filters.province !== "" || filters.query.trim() !== "";
}

/**
 * Aplica los filtros a las parroquias: primero la ventana, que decide su nivel. Provincia y nombre (de la parroquia o de
 * su cantón) recortan todo, también los contadores; los niveles encendidos y la
 * categoría eligen qué parroquias se listan y se dibujan.
 */
export function filterParishes(parishes: readonly ParishAlert[], filters: ParishFilters) {
  const search = normalizeName(filters.query.trim());
  const all = parishesForWindow(parishes, filters.window);
  const matching = all.filter(
    (parish) =>
      (!filters.province || normalizeName(parish.province) === normalizeName(filters.province)) &&
      (!search || normalizeName(parish.name).includes(search) || normalizeName(parish.canton).includes(search)),
  );
  const counts = Object.fromEntries(
    (["red", "orange", "yellow", "green"] as const).map((level) => [level, matching.filter((parish) => parish.semaphore === level).length]),
  ) as Record<Semaphore, number>;
  const byColor = matching.filter((parish) => filters.levels.includes(parish.semaphore));
  const categories = RAIN_CATEGORIES.map((item) => ({ ...item, count: byColor.filter((parish) => parish.category === item.id).length })).filter(
    (item) => item.count > 0,
  );
  const listed = filters.category ? byColor.filter((parish) => parish.category === filters.category) : byColor;
  return { all, counts, categories, listed };
}
