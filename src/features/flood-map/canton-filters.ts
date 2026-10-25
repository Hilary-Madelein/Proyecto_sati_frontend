import type { CantonAnalysis, RainCategory, Semaphore } from "./types";

/** Filtros del análisis por cantón; se aplican igual a la lista y al mapa. */
export interface CantonFilters {
  /** "alerted" = alerta alta y moderada (lo que se muestra al inicio). */
  color: Semaphore | "alerted";
  category: RainCategory | null;
  /** "" = todas. */
  province: string;
  query: string;
}

export const DEFAULT_CANTON_FILTERS: CantonFilters = { color: "alerted", category: null, province: "", query: "" };

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

export function isFiltered(filters: CantonFilters): boolean {
  return filters.color !== "alerted" || filters.category !== null || filters.province !== "" || filters.query.trim() !== "";
}

/**
 * Aplica los filtros. Provincia y nombre recortan todo (también los contadores
 * por color); el color y la categoría eligen qué cantones se listan y se pintan.
 */
export function filterCantons(cantons: readonly CantonAnalysis[], filters: CantonFilters) {
  const search = normalizeName(filters.query.trim());
  const withData = cantons.filter(
    (canton) =>
      canton.decidedBy !== null &&
      (!filters.province || canton.province === filters.province) &&
      (!search || normalizeName(canton.name).includes(search)),
  );
  const counts: Record<Semaphore, number> = {
    red: withData.filter((canton) => canton.semaphore === "red").length,
    yellow: withData.filter((canton) => canton.semaphore === "yellow").length,
    green: withData.filter((canton) => canton.semaphore === "green").length,
  };
  const byColor = withData.filter((canton) =>
    filters.color === "alerted" ? canton.semaphore !== "green" : canton.semaphore === filters.color,
  );
  const categories = RAIN_CATEGORIES.map((item) => ({ ...item, count: byColor.filter((canton) => canton.category === item.id).length })).filter(
    (item) => item.count > 0,
  );
  const listed = filters.category ? byColor.filter((canton) => canton.category === filters.category) : byColor;
  return { counts, categories, listed };
}
