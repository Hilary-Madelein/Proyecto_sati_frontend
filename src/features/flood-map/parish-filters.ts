import type { ParishAlert, RainCategory, Semaphore } from "./types";

/** Filtros de la alerta por parroquia; se aplican igual a la lista y al mapa. */
export interface ParishFilters {
  /** Niveles que se listan y se dibujan en el mapa (cada uno se enciende y apaga); al inicio, rojo y naranja. */
  levels: readonly Semaphore[];
  category: RainCategory | null;
  /** "" = todas. */
  province: string;
  query: string;
}

export const DEFAULT_LEVELS: readonly Semaphore[] = ["red", "orange"];

export const DEFAULT_PARISH_FILTERS: ParishFilters = { levels: DEFAULT_LEVELS, category: null, province: "", query: "" };

/** Categorías del documento, de mayor a menor (así se ofrecen como filtro). */
export const RAIN_CATEGORIES: readonly { id: RainCategory; label: string }[] = [
  { id: "extrema", label: "Extrema" },
  { id: "torrencial", label: "Torrencial" },
  { id: "intensa", label: "Intensa" },
  { id: "fuerte", label: "Fuerte" },
  { id: "moderada", label: "Moderada" },
  { id: "ligera", label: "Ligera" },
  { id: "minima", label: "Mínima" },
];

/** Sin tildes ni mayúsculas, para buscar "Cañar" con "canar" o unir nombres de distintas fuentes. */
export const normalizeName = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

export function isFiltered(filters: ParishFilters): boolean {
  const sameLevels = filters.levels.length === DEFAULT_LEVELS.length && DEFAULT_LEVELS.every((level) => filters.levels.includes(level));
  return !sameLevels || filters.category !== null || filters.province !== "" || filters.query.trim() !== "";
}

/**
 * Aplica los filtros a las parroquias. Provincia y nombre (de la parroquia o de
 * su cantón) recortan todo, también los contadores; los niveles encendidos y la
 * categoría eligen qué parroquias se listan y se dibujan.
 */
export function filterParishes(parishes: readonly ParishAlert[], filters: ParishFilters) {
  const search = normalizeName(filters.query.trim());
  const matching = parishes.filter(
    (parish) =>
      (!filters.province || parish.province === filters.province) &&
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
  return { counts, categories, listed };
}
