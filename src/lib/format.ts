const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Ecuador continental usa UTC-5 todo el año (sin horario de verano).
const ECUADOR_UTC_OFFSET_MS = -5 * 60 * 60 * 1000;

const pad = (value: number) => value.toString().padStart(2, "0");

/**
 * Formatea una fecha ISO en hora de Ecuador, p. ej. "02 oct, 10:45".
 * Se hace a mano (sin Intl) para que el servidor y el navegador produzcan
 * exactamente el mismo texto y no haya errores de hidratación.
 */
export function formatDateTime(iso: string) {
  const date = new Date(new Date(iso).getTime() + ECUADOR_UTC_OFFSET_MS);
  const day = pad(date.getUTCDate());
  const month = MONTHS[date.getUTCMonth()];
  return `${day} ${month}, ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

/**
 * Tiempo transcurrido, p. ej. "hace 3 h" o "hace 6 días". Depende del reloj:
 * usar solo en componentes que se pintan en el navegador (p. ej. el mapa).
 */
export function formatTimeAgo(iso: string, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return minutes <= 1 ? "hace un momento" : `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "hace 1 día" : `hace ${days} días`;
}

/** Diferencia con signo y un decimal, p. ej. "+5,8" o "-0,4". */
export function formatSigned(value: number) {
  const text = Math.abs(value).toFixed(1).replace(".", ",");
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${text}`;
}

/** Día y mes en hora de Ecuador, p. ej. "1 oct". */
export function formatDayMonth(iso: string) {
  const date = new Date(new Date(iso).getTime() + ECUADOR_UTC_OFFSET_MS);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

/** Fecha de calendario AAAA-MM-DD (sin hora ni zona), p. ej. "2026-10-03" -> "3 oct". */
export function formatCalendarDate(ymd: string) {
  const [, month, day] = ymd.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}
