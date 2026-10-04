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
