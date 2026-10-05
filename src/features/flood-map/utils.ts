import { EVENT_PERIODS, RIVER_ALERT_LEVELS, RIVER_NORMAL_COLOR, SEVERITY_STYLES } from "./constants";
import type { AlertLevel, EventFilters, HazardEvent, RiverAlert } from "./types";

/** Ordena por severidad (crítico primero) y luego por fecha, del más reciente al más antiguo. */
export function sortEventsBySeverity(events: HazardEvent[]) {
  return [...events].sort(
    (a, b) =>
      SEVERITY_STYLES[a.severity].rank - SEVERITY_STYLES[b.severity].rank ||
      Date.parse(b.occurredAt) - Date.parse(a.occurredAt),
  );
}

/**
 * Aplica los filtros de eventos. `now` es la hora de la consulta al backend
 * (no la del reloj), así el servidor y el navegador filtran exactamente igual.
 * Con `ignoreSeverity`, sirve para contar cuántos hay de cada severidad.
 */
export function filterEvents(
  events: HazardEvent[],
  filters: EventFilters,
  now: string,
  { ignoreSeverity = false } = {},
): HazardEvent[] {
  const hours = EVENT_PERIODS.find((period) => period.value === filters.period)?.hours ?? Infinity;
  const since = Date.parse(now) - hours * 60 * 60 * 1000;
  return events.filter(
    (event) =>
      Date.parse(event.occurredAt) >= since &&
      (ignoreSeverity || filters.severities.includes(event.severity)) &&
      (!filters.province || event.province === filters.province) &&
      (!filters.hazardType || event.hazardType === filters.hazardType),
  );
}

/** Nivel de alerta de un tramo para un día del pronóstico (índice 0 = primer día). */
export function alertLevelForDay(alert: RiverAlert, dayIndex: number): AlertLevel {
  return alert.dailyLevels[dayIndex] ?? 0;
}

export function alertLevelStyle(level: AlertLevel) {
  return level === 0
    ? { label: "Normal", color: RIVER_NORMAL_COLOR }
    : (RIVER_ALERT_LEVELS.find((item) => item.level === level) ?? { label: `${level} años`, color: "#000000" });
}
