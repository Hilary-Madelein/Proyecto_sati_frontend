import { RIVER_ALERT_LEVELS, RIVER_NORMAL_COLOR, SEVERITY_STYLES } from "./constants";
import type { AlertLevel, ForecastDay, HazardEvent, RainAvailability, RiverAlert } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Tolerancia al buscar el paso del modelo que corresponde a un día. */
const TIME_TOLERANCE_MS = 60 * 60 * 1000;

/** Ordena por severidad (crítico primero) y luego por fecha, del más reciente al más antiguo. */
export function sortEventsBySeverity(events: HazardEvent[]) {
  return [...events].sort(
    (a, b) =>
      SEVERITY_STYLES[a.severity].rank - SEVERITY_STYLES[b.severity].rank ||
      Date.parse(b.occurredAt) - Date.parse(a.occurredAt),
  );
}

/**
 * Paso de tiempo de la capa diaria del WRF para un día de pronóstico: el día N
 * es la lluvia de las 24 h que terminan N días después del inicio de la corrida.
 * Null si la corrida no llega hasta ese día.
 */
export function rainTimeForDay(rain: RainAvailability | null, day: ForecastDay): string | null {
  if (!rain?.run) return null;
  const target = Date.parse(rain.run) + day * DAY_MS;
  return rain.runTimes.find((time) => Math.abs(Date.parse(time) - target) <= TIME_TOLERANCE_MS) ?? null;
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
