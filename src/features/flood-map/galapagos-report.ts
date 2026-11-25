/*
 * Reporte descargable de una estación de Galápagos: una imagen con la lluvia de ayer
 * y hoy frente a los dos límites de la estación. Arriba, la lluvia de cada hora en
 * barras translúcidas (una dentro de otra); abajo, el acumulado del evento de lluvia
 * (vuelve a cero tras 12 horas sin llover), como en el popup.
 * Se dibuja como SVG (sin dependencias) y se pasa a PNG en el navegador.
 */

export interface ReportLimit {
  /** "Límite superior: 30-31 oct, desborde". */
  label: string;
  totalMm: number;
  /** Lluvia acumulada en cada una de las 48 horas de sus dos días. */
  accumulatedMm: number[];
}

/** El mar ahora, medido por el mareógrafo de Santa Cruz. */
export interface SeaReading {
  time: string;
  /** Altura (m) respecto de su nivel medio de los últimos días. */
  levelM: number;
  high: boolean;
  place: string;
}

/** La casilla de la matriz lluvia × mar. */
/** «notice» (aviso): el nivel de Santa Cruz por zonas, en sus estaciones. */
export type GalapagosScenario = "normal" | "precaution" | "notice" | "alert" | "emergency";
export const SCENARIO_LABELS: Record<GalapagosScenario, string> = { normal: "Normal", precaution: "Precaución", notice: "Aviso", alert: "Alerta", emergency: "Emergencia" };

/** "+0,47 m" o "−0,31 m". */
export const formatSeaLevel = (levelM: number) => `${levelM > 0 ? "+" : levelM < 0 ? "−" : ""}${Math.abs(levelM).toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;

/** El evento de lluvia que se acumula: termina tras 12 horas sin lluvia. */
export interface RainEvent {
  /** Cuándo empezó a llover (ISO 8601). */
  start: string;
  totalMm: number;
  /** Lo que cayó antes de las 00:00 de ayer: con eso arranca la gráfica. */
  carriedMm: number;
  /** Ya pasaron 12 horas sin lluvia. */
  ended: boolean;
}

/** Las 24 horas siguientes según tres modelos globales (Open-Meteo): mediana y rango. Solo tendencia. */
export interface RainForecast {
  /** Cada hora por la hora en que termina (ISO 8601): mediana de los modelos y el mayor y menor (mm). */
  hours: { time: string; mm: number; lowMm: number; highMm: number }[];
  totalMm: number;
  lowMm: number;
  highMm: number;
  source?: string;
  /**
   * El pronóstico ajustado con lo que midió la estación cuando los modelos daban algo parecido
   * (manda el pronóstico; el registro pesa poco): total, rango y cada hora. null sin registro suficiente.
   */
  expected?: { mm: number; lowMm: number; highMm: number; cases: number; modelWeight?: number; hours: { time: string; mm: number }[] } | null;
}

/** Las horas que se dibujan: lo esperado (corregido) si lo hay; si no, la mediana de los modelos. */
export function forecastHours(forecast: RainForecast): { time: string; mm: number; lowMm: number; highMm: number }[] {
  return forecast.expected ? forecast.expected.hours.map((hour) => ({ ...hour, lowMm: hour.mm, highMm: hour.mm })) : forecast.hours;
}

/**
 * El acumulado pronosticado a continuación de lo medido: arranca en el último dato (`hour`, `mm`)
 * y suma la mediana de cada hora pronosticada, hasta `lastHour` (72: las 24:00 de mañana; el acumulado
 * se alarga un día cuando hay pronóstico, para que se vea entero aunque se consulte a las 23:50).
 * `firstTime` es la hora 1 de la gráfica (ISO 8601).
 */
export function forecastCurve(forecast: RainForecast | null | undefined, firstTime: string | undefined, from: { hour: number; mm: number }, lastHour = 72): { hour: number; mm: number }[] {
  if (!forecast || !firstTime || forecast.hours.length === 0) return [];
  const hours = forecastHours(forecast);
  const first = Date.parse(firstTime);
  const points = [from];
  let total = from.mm;
  for (const hour of hours) {
    const at = Math.round((Date.parse(hour.time) - first) / 3_600_000) + 1;
    if (at <= from.hour) continue;
    if (at > lastHour) break;
    total += hour.mm;
    points.push({ hour: at, mm: Math.round(total * 10) / 10 });
  }
  return points.length > 1 ? points : [];
}

/** "17:00 del 15 nov": una hora del registro (hora del continente). */
export function recordHourLabel(time: string): string {
  const date = new Date(Date.parse(time) - 5 * 60 * 60 * 1000);
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${String(date.getUTCHours()).padStart(2, "0")}:00 del ${date.getUTCDate()} ${months[date.getUTCMonth()]}`;
}

/** Qué se acumula, en pocas palabras: "18,8 mm en este evento". */
export function eventSummary(totalMm: string, event: RainEvent | null | undefined): string {
  if (event === undefined) return `${totalMm} mm desde ayer`;
  if (event === null) return "sin lluvia desde ayer";
  return event.ended ? `${totalMm} mm, evento terminado` : `${totalMm} mm en este evento`;
}

export interface GalapagosReportInput {
  code: string;
  island: string;
  /** Nombre de la estación (para las que no son del INAMHI). */
  name?: string | null;
  /** Red de la estación, si no es la del INAMHI. */
  network?: string;
  /** Estación de la que salen los límites, si no son los suyos. */
  limitsCode?: string;
  level: "normal" | "notice" | "alarm" | "extreme";
  /** Por qué está en ese nivel; null en normal. */
  reason: string | null;
  /** "Aquí estamos": desde las 00:00 de ayer, la lluvia de cada hora y lo acumulado del evento; `hour` va de 1 a 48. */
  now: { hour: number; accumulatedMm: number; mm?: number; time?: string }[];
  /** El evento que se acumula; null si no ha llovido desde ayer. */
  event?: RainEvent | null;
  upper: ReportLimit;
  lower: ReportLimit;
  sea?: SeaReading | null;
  scenario?: GalapagosScenario;
  /** Cuándo se descargó: se dice junto a la hora del último dato de la estación. */
  downloadedAt?: Date;
  /** Las 24 horas siguientes según los modelos; sin él, el reporte no lleva ese panel. */
  forecast?: RainForecast | null;
  /** Zona de Santa Cruz: con ella, el reporte es el de la lluvia en 3 horas (sin límites). */
  zone?: "low" | "high";
  mm3h?: number;
  /** Lluvia de las 24 horas antes de las últimas 3 (mm). */
  prev24hMm?: number;
}

const W = 1400;
const H = 1160;
const SCALE = 2;
/** Alto que suma el panel del pronóstico de 24 horas. */
const FORECAST_PANEL = 280;
const C = { upper: "#e34948", lower: "#2a78d6", now: "#111111", ink: "#0b0b0b", ink2: "#52514e", ink3: "#8a8983", grid: "#e6e5e1", surface: "#fcfcfb" };
const FONT = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
/** El registro del INAMHI cuenta los días en hora del continente (UTC-5). */
const RECORD_OFFSET_MS = 5 * 60 * 60 * 1000;
/**
 * Momentos del episodio del límite superior que se marcan con una línea vertical:
 * `hour` es la hora (1 a 48) desde las 00:00 de su primer día. En Santa Cruz, la
 * inundación de La Cascada del 31 de octubre de 2026: empezó a la 01:00 y su nivel
 * máximo se reportó a las 04:00.
 */
const UPPER_EVENTS: Readonly<Record<string, readonly { hour: number; label: string; time: string; highlight?: boolean }[]>> = {
  M0191: [
    { hour: 25, label: "Inicio de la inundación en La Cascada", time: "01:00 del 31 oct", highlight: true },
    { hour: 28, label: "Nivel máximo de inundación reportado", time: "04:00 del 31 oct" },
  ],
};
const LEVEL_TEXT ={ normal: "sin alarma", notice: "en aviso", alarm: "en alarma", extreme: "en alarma extrema" } as const;

const fmt = (value: number, decimals = 1) => value.toLocaleString("es-EC", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pad = (value: number) => String(value).padStart(2, "0");

/** De la curva acumulada, la lluvia de cada hora. */
function hourly(accumulated: readonly number[]): number[] {
  return accumulated.map((mm, index) => Math.max(0, Math.round((mm - (accumulated[index - 1] ?? 0)) * 10) / 10));
}

/** Tope del eje y el paso de sus marcas: números redondos, con aire arriba. */
function axis(max: number): { top: number; step: number } {
  const step = [2, 5, 10, 20, 25, 50, 100, 200].find((size) => (max * 1.12) / size <= 5) ?? 500;
  return { top: Math.max(step, Math.ceil((max * 1.12) / step) * step), step };
}

function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && line.length + word.length + 1 > maxChars) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

interface TextOptions {
  size?: number;
  fill?: string;
  weight?: number;
  anchor?: "start" | "middle" | "end";
  /** Borde del color del fondo, para leerse encima de las barras. */
  halo?: boolean;
}

function text(x: number, y: number, content: string, { size = 15, fill = C.ink2, weight = 400, anchor = "start", halo = false }: TextOptions = {}): string {
  const outline = halo ? ` stroke="${C.surface}" stroke-width="5" stroke-linejoin="round" paint-order="stroke"` : "";
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" fill="${fill}" font-weight="${weight}" text-anchor="${anchor}"${outline}>${esc(content)}</text>`;
}

/** El día (del registro) de la última hora con dato y su hora, "09:00". */
function lastDatum(now: GalapagosReportInput["now"]): { date: Date; hourLabel: string } {
  const last = now.at(-1);
  const time = last?.time ? Date.parse(last.time) : Date.now();
  const date = new Date(time - RECORD_OFFSET_MS);
  return { date, hourLabel: last ? `${pad(last.hour % 24)}:00` : "–" };
}

/** Partes de "Límite superior: 30-31 oct, desborde": el nombre y el detalle. */
function limitParts(limit: ReportLimit): { name: string; detail: string } {
  const [name, ...rest] = limit.label.split(":");
  return { name: name.trim(), detail: rest.join(":").trim() };
}

/** El reporte como SVG (1400 × 1160). */
export function galapagosReportSvg(input: GalapagosReportInput): string {
  const { island, code, upper, lower, now, event } = input;
  const carried = event?.carriedMm ?? 0;
  const current = now.at(-1);
  const hoursNow = current?.hour ?? 0;
  const total = current?.accumulatedMm ?? 0;
  const nowCurve = now.map((point) => point.accumulatedMm);
  // La lluvia de cada hora llega aparte: el acumulado es solo del evento.
  const nowHourly = now.every((point) => point.mm !== undefined) ? now.map((point) => point.mm ?? 0) : hourly(nowCurve);
  const series = { upper: hourly(upper.accumulatedMm), lower: hourly(lower.accumulatedMm), now: nowHourly };
  const { date, hourLabel } = lastDatum(now);
  const dayName = `${date.getUTCDate()} de ${MONTHS[date.getUTCMonth()]}`;
  // La lluvia de hoy: la de las horas que siguen a las 24 de ayer.
  const today = hoursNow > 24 ? Math.round(nowHourly.slice(24).reduce((sum, mm) => sum + mm, 0) * 10) / 10 : null;
  const since = event ? ` desde las ${recordHourLabel(event.start)}` : "";
  const upperSameHour = upper.accumulatedMm[hoursNow - 1] ?? 0;
  const lowerSameHour = lower.accumulatedMm[hoursNow - 1] ?? 0;

  const left = 92;
  const right = 1212;
  const x = (hour: number) => left + (hour / 48) * (right - left);
  const slot = (right - left) / 48;
  const parts: string[] = [];
  const push = (...items: string[]) => parts.push(...items);

  // ── Cabecera ──
  // Tras la fecha, la hora en que se generó (GMT-5, la del registro).
  const downloaded = input.downloadedAt ? new Date(input.downloadedAt.getTime() - RECORD_OFFSET_MS) : null;
  const updated = downloaded ? `, ${pad(downloaded.getUTCHours())}:${pad(downloaded.getUTCMinutes())} (GMT-5)` : "";
  // Una estación de otra red se dice por su nombre; sus límites son los de la estación del INAMHI.
  const other = input.network ? { name: input.name ?? code, limits: input.limitsCode ?? code } : null;
  push(text(left, 66, `${island}${other ? ` · ${other.name}` : ""} hoy, ${dayName}${updated}, frente a sus límites`, { size: other ? 28 : 31, fill: C.ink, weight: 700 }));
  const eventText =
    event === undefined
      ? `Desde ayer, ${fmt(total)} mm.`
      : event === null
        ? "Sin evento de lluvia desde ayer."
        : `${event.ended ? "Último evento, ya terminado" : "Evento en curso"}: ${fmt(total)} mm${since}${carried > 0 ? ` (${fmt(carried)} mm antes de las 00:00 de ayer)` : ""}.`;
  const headline = `${today === null ? `Hasta las ${hourLabel}.` : `Hoy: ${fmt(today)} mm hasta las ${hourLabel}.`} ${eventText} Límites de dos días: ${fmt(lower.totalMm, 0)} y ${fmt(upper.totalMm, 0)} mm.`;
  push(text(left, 104, headline, { size: 17.5 }));
  // La estación publica cada hora con retraso: se dice cuándo se descargó y hasta qué hora hay dato.
  const asOf = downloaded ? `Último dato publicado: ${hourLabel} · ` : "";
  const stationText = other ? `Estación ${other.name}, ${input.network} · límites de la estación ${other.limits}, INAMHI` : `Estación ${code}, INAMHI`;
  push(text(left, 132, `${asOf}${stationText} · cada episodio se muestra con sus dos días completos, con las horas del registro`, { size: 14.5, fill: C.ink3 }));

  // ── Leyenda ──
  const legend: Array<[string, number, string]> = [
    [C.now, 0.88, `Ayer y hoy, ${dayName} (hasta las ${hourLabel})`],
    [C.upper, 0.38, upper.label],
    [C.lower, 0.45, lower.label],
  ];
  let legendX = left + 6;
  for (const [color, opacity, label] of legend) {
    push(`<rect x="${legendX}" y="161" width="24" height="15" fill="${color}" fill-opacity="${opacity}"/>`, text(legendX + 36, 174, label, { size: 15.5, fill: C.ink }));
    legendX += 36 + label.length * 8.3 + 34;
  }

  // ── Arriba: la lluvia de cada hora, tres barras por hora, una dentro de otra ──
  const top1 = 232;
  const base1 = 512;
  const scale1 = axis(Math.max(1, ...series.upper, ...series.lower, ...series.now));
  const y1 = (mm: number) => base1 - (mm / scale1.top) * (base1 - top1);
  push(text(left, 208, "Lluvia de cada hora, ayer y hoy", { size: 18, fill: C.ink, weight: 700 }));
  for (let mm = 0; mm <= scale1.top; mm += scale1.step) {
    push(`<line x1="${left}" x2="${right}" y1="${y1(mm)}" y2="${y1(mm)}" stroke="${C.grid}"/>`, text(left - 10, y1(mm) + 5, String(mm), { size: 14, anchor: "end" }));
  }
  const bars = (values: readonly number[], width: number, color: string, opacity: number) =>
    values
      .map((mm, index) => (mm > 0 ? `<rect x="${(x(index + 0.5) - (slot * width) / 2).toFixed(1)}" y="${y1(mm).toFixed(1)}" width="${(slot * width).toFixed(1)}" height="${(base1 - y1(mm)).toFixed(1)}" fill="${color}" fill-opacity="${opacity}"/>` : ""))
      .join("");
  push(bars(series.upper, 0.92, C.upper, 0.38), bars(series.lower, 0.62, C.lower, 0.45), bars(series.now, 0.32, C.now, 0.88));
  push(`<line x1="${x(24)}" x2="${x(24)}" y1="${top1}" y2="${base1}" stroke="${C.ink3}" stroke-width="1"/>`);
  const events = UPPER_EVENTS[input.limitsCode ?? code] ?? [];
  const eventLine = (hour: number, top: number, base: number, xf = x) => `<line x1="${xf(hour)}" x2="${xf(hour)}" y1="${top}" y2="${base}" stroke="${C.upper}" stroke-width="2" stroke-dasharray="7 5"/>`;
  if (hoursNow > 0 && hoursNow < 48) {
    push(`<line x1="${x(hoursNow)}" x2="${x(hoursNow)}" y1="${top1}" y2="${base1}" stroke="${C.now}" stroke-width="1.4" stroke-dasharray="3 5"/>`);
    // Encima de la gráfica, para no tapar las barras.
    push(text(Math.max(left + 400, x(hoursNow)), top1 - 9, `último dato: ${hourLabel}`, { size: 13.5, anchor: "middle" }));
  }
  // La hora más lluviosa del límite superior y la de ahora, con su valor encima.
  const peak = (values: readonly number[]) => values.reduce((best, mm, index) => (mm > values[best] ? index : best), 0);
  const upperPeak = peak(series.upper);
  push(text(Math.min(right - 120, Math.max(left + 120, x(upperPeak + 0.5))), y1(series.upper[upperPeak]) - 9, `${limitParts(upper).name}: ${fmt(series.upper[upperPeak])} mm en una hora`, { size: 14, fill: C.ink, anchor: "middle", halo: true }));
  if (series.now.length > 0) {
    const nowPeak = peak(series.now);
    if (series.now[nowPeak] >= 1) {
      push(text(x(nowPeak + 0.5), y1(series.now[nowPeak]) - 9, `${fmt(series.now[nowPeak])} mm`, { size: 14, fill: C.ink, weight: 700, anchor: "middle", halo: true }));
    }
  }
  // Abajo de cada gráfica: una marca por hora y la etiqueta cada 3 horas.
  const ticks = (base: number, xf = x, span = 48) =>
    Array.from({ length: span + 1 }, (_, hour) => {
      const labelled = hour % (span > 48 ? 6 : 3) === 0;
      const mark = `<line x1="${xf(hour)}" x2="${xf(hour)}" y1="${base}" y2="${base + (labelled ? 8 : 4)}" stroke="${C.ink3}" stroke-width="1"/>`;
      return labelled ? mark + text(xf(hour), base + 26, hour === span ? "24:00" : `${pad(hour % 24)}:00`, { size: 13.5, anchor: "middle" }) : mark;
    }).join("");
  push(ticks(base1), text(x(12), base1 + 54, "primer día", { size: 15, fill: C.ink3, anchor: "middle" }), text(x(36), base1 + 54, "segundo día", { size: 15, fill: C.ink3, anchor: "middle" }));
  push(`<text transform="translate(${left - 50} ${(top1 + base1) / 2}) rotate(-90)" font-size="15" fill="${C.ink2}" text-anchor="middle">mm en cada hora</text>`);

  // ── Abajo: el acumulado de ayer y hoy, como en el popup; con pronóstico, se alarga hasta mañana ──
  const ahead = forecastCurve(input.forecast, now[0]?.time, { hour: hoursNow, mm: total });
  const span2 = ahead.length > 1 ? 72 : 48;
  const xb = (hour: number) => left + (hour / span2) * (right - left);
  const top2 = 628;
  const base2 = 946;

  const scale2 = axis(Math.max(upper.totalMm, total, carried, ahead.at(-1)?.mm ?? 0));
  const y2 = (mm: number) => base2 - (mm / scale2.top) * (base2 - top2);
  /** `from`: con cuánto arranca a las 00:00 del primer día. */
  const curve = (values: readonly number[], from = 0) => [`${xb(0)},${y2(from).toFixed(1)}`, ...values.map((mm, index) => `${xb(index + 1).toFixed(1)},${y2(mm).toFixed(1)}`)].join(" ");
  push(text(left, 604, event === undefined ? "Acumulado de ayer y hoy" : "Acumulado del evento de lluvia", { size: 18, fill: C.ink, weight: 700 }));
  for (let mm = 0; mm <= scale2.top; mm += scale2.step) {
    push(`<line x1="${left}" x2="${right}" y1="${y2(mm)}" y2="${y2(mm)}" stroke="${C.grid}"/>`, text(left - 10, y2(mm) + 5, String(mm), { size: 14, anchor: "end" }));
  }
  const band = `${curve(upper.accumulatedMm)} ${lower.accumulatedMm.map((mm, index) => `${xb(index + 1).toFixed(1)},${y2(mm).toFixed(1)}`).reverse().join(" ")} ${xb(0)},${y2(0)}`;
  push(`<polygon points="${band}" fill="${C.upper}" fill-opacity="0.10"/>`);
  push(`<line x1="${xb(24)}" x2="${xb(24)}" y1="${top2}" y2="${base2}" stroke="${C.ink3}" stroke-width="1"/>`);
  for (const [limit, color] of [[upper, C.upper], [lower, C.lower]] as const) {
    const { name, detail } = limitParts(limit);
    const endY = y2(limit.totalMm);
    push(`<polyline points="${curve(limit.accumulatedMm)}" fill="none" stroke="${color}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/>`);
    push(`<circle cx="${xb(48)}" cy="${endY}" r="5.5" fill="${color}" stroke="${C.surface}" stroke-width="2"/>`);
    // El rótulo del límite, a la derecha de donde termina su curva.
    const labelY = limit === lower ? Math.min(endY, base2 - 28) : Math.max(endY, top2 + 18);
    push(text((span2 > 48 ? xb(48) : right) + 16, labelY - 13, name, { size: 14.5, fill: C.ink }), text((span2 > 48 ? xb(48) : right) + 16, labelY + 6, detail, { size: 14.5, fill: C.ink }), text((span2 > 48 ? xb(48) : right) + 16, labelY + 25, `${fmt(limit.totalMm, 0)} mm`, { size: 14.5, fill: C.ink }));
  }
  // Los momentos del episodio del límite superior: la línea, el punto sobre su curva y qué pasó, arriba.
  events.forEach((event, index) => {
    const mm = upper.accumulatedMm[event.hour - 1] ?? 0;
    const side = index % 2 === 0 ? -1 : 1;
    const anchor = side < 0 ? "end" : "start";
    push(eventLine(event.hour, top2, base2, xb));
    if (event.highlight) {
      // Lo acumulado en ese momento, resaltado: una guía hasta el eje, un punto grande con aro y la cifra al lado.
      push(`<line x1="${left}" x2="${xb(event.hour)}" y1="${y2(mm)}" y2="${y2(mm)}" stroke="${C.upper}" stroke-width="1.6" stroke-dasharray="3 5"/>`);
      push(`<circle cx="${xb(event.hour)}" cy="${y2(mm)}" r="15" fill="${C.upper}" fill-opacity="0.18"/>`, `<circle cx="${xb(event.hour)}" cy="${y2(mm)}" r="8.5" fill="${C.upper}" stroke="${C.surface}" stroke-width="2.5"/>`);
      push(text(xb(event.hour) - 22, y2(mm) - 12, `${fmt(mm, 0)} mm`, { size: 24, fill: C.ink, weight: 700, anchor: "end", halo: true }));
      push(text(xb(event.hour) - 22, y2(mm) + 24, "acumulados al empezar", { size: 14.5, fill: C.ink, anchor: "end", halo: true }));
    } else push(`<circle cx="${xb(event.hour)}" cy="${y2(mm)}" r="5.5" fill="${C.upper}" stroke="${C.surface}" stroke-width="2"/>`);
    push(text(xb(event.hour) + side * 9, top2 + 19, event.label, { size: 14.5, fill: C.ink, anchor, halo: true }));
    push(text(xb(event.hour) + side * 9, top2 + 38, `${event.time} · con ${fmt(mm, 0)} mm acumulados`, { size: 14.5, fill: C.ink, anchor, halo: true }));
  });
  if (current) {
    const nowX = xb(hoursNow);
    const nowY = y2(total);
    push(`<polyline points="${curve(nowCurve, carried)}" fill="none" stroke="${C.now}" stroke-width="4" stroke-dasharray="14 8" stroke-linejoin="round"/>`);
    // Dónde empezó el evento: dentro de la gráfica, una marca; si venía de antes, con cuánto arranca.
    const firstTime = now[0]?.time ? Date.parse(now[0].time) : null;
    const startHour = event && firstTime !== null ? Math.round((Date.parse(event.start) - firstTime) / 3_600_000) + 1 : null;
    if (event && carried > 0) {
      push(`<circle cx="${xb(0)}" cy="${y2(carried)}" r="5.5" fill="${C.now}" stroke="${C.surface}" stroke-width="2"/>`);
      push(text(xb(0) + 12, y2(carried) - 12, `Viene de antes: ${fmt(carried)} mm${since}`, { size: 14.5, fill: C.ink, weight: 700, halo: true }));
    } else if (startHour !== null && startHour > 0 && startHour < hoursNow) {
      push(`<line x1="${xb(startHour)}" x2="${xb(startHour)}" y1="${base2 - 26}" y2="${base2}" stroke="${C.now}" stroke-width="1.6"/>`);
      push(text(xb(startHour) - 7, base2 - 12, "empieza el evento", { size: 13.5, fill: C.ink, anchor: "end", halo: true }));
    }
    // Lo pronosticado, a continuación de lo medido: gris y punteado, hasta las 24:00 de hoy.
    if (ahead.length > 1) {
      const end = ahead.at(-1)!;
      push(`<polyline points="${ahead.map((point) => `${xb(point.hour).toFixed(1)},${y2(point.mm).toFixed(1)}`).join(" ")}" fill="none" stroke="${C.ink3}" stroke-width="3.5" stroke-dasharray="3 6" stroke-linecap="round"/>`);
      push(`<circle cx="${xb(end.hour)}" cy="${y2(end.mm)}" r="5" fill="${C.surface}" stroke="${C.ink3}" stroke-width="2.5"/>`);
      // Lo medido más lo pronosticado: aproximado.
      push(text(xb(end.hour) + 10, y2(end.mm) + 5, `~${fmt(end.mm, 0)} mm`, { size: 14.5, fill: C.ink2, weight: 700, halo: true }));
    }
    push(`<circle cx="${nowX}" cy="${nowY}" r="7.5" fill="${C.now}" stroke="${C.surface}" stroke-width="2.5"/>`);
    // "Aquí estamos": arriba y a la derecha del punto mientras quepa; si no, a la izquierda.
    const side = hoursNow > span2 - 10 ? -1 : 1;
    const labelX = nowX + side * 150;
    // Si el punto queda muy arriba (un evento largo), el rótulo va debajo: arriba están los momentos del límite superior.
    // Con pronóstico, debajo: arriba a la derecha va la línea de lo esperado.
    const below = ahead.length > 1 || nowY - 78 < top2 + 60;
    const labelY = below ? nowY + 62 : nowY - 78;
    push(`<line x1="${nowX + side * 9}" y1="${nowY + (below ? 7 : -7)}" x2="${labelX - side * 62}" y2="${labelY + (below ? -18 : 30)}" stroke="${C.now}" stroke-width="1.3"/>`);
    push(text(labelX, labelY, "Aquí estamos", { size: 17, fill: C.ink, weight: 700, anchor: "middle", halo: true }), text(labelX, labelY + 22, eventSummary(fmt(total), event), { size: 17, fill: C.ink, weight: 700, anchor: "middle", halo: true }));
  }
  push(ticks(base2, xb, span2), ...(span2 > 48 ? [text(xb(60), base2 + 62, "mañana (pronóstico)", { size: 15, fill: C.ink3, anchor: "middle" })] : []), text(xb(12), base2 + 62, "ayer", { size: 15, fill: C.ink3, anchor: "middle" }), text(xb(36), base2 + 62, "hoy", { size: 15, fill: C.ink3, anchor: "middle" }));
  push(`<text transform="translate(${left - 58} ${(top2 + base2) / 2}) rotate(-90)" font-size="15" fill="${C.ink2}" text-anchor="middle">mm acumulados</text>`);

  // ── Lectura y fuente ──
  const position = total >= upperSameHour ? "va por encima del límite superior" : total >= lowerSameHour ? "va entre sus dos límites" : "va por debajo del límite inferior";
  const reason = input.reason ? ` (${input.reason})` : "";
  const reading = `Qué dice: la lluvia ${position}. ${event ? `El evento${since}` : "Desde ayer"} acumula ${fmt(total)} mm, frente a ${fmt(lowerSameHour)} mm del límite inferior y ${fmt(upperSameHour)} mm del límite superior a esa misma hora. En el sistema la estación está ${LEVEL_TEXT[input.level] ?? LEVEL_TEXT.normal}${reason}.`;
  const sea = input.sea
    ? ` El mar está ${input.sea.high ? "alto" : "bajo"} (${formatSeaLevel(input.sea.levelM)} respecto de su nivel medio, mareógrafo de ${input.sea.place})${input.scenario ? `: en la matriz lluvia × mar, ${SCENARIO_LABELS[input.scenario].toUpperCase()}` : ""}.`
    : "";
  wrap(reading + sea, 148).forEach((line, index) => push(text(left, 1050 + index * 25, line, { size: 16 })));
  const sourceText = other ? `Fuente: ${input.network}, lluvia horaria de la estación; límites de la estación ${other.limits} del INAMHI. Sistema SATI` : "Fuente: INAMHI, lluvia horaria de la estación tomada del sistema SATI";
  push(text(left, 1128, `${sourceText} (dato en vivo, aún sin validar). Horas del registro (hora del continente; en Galápagos es una hora menos).`, { size: 12.5, fill: C.ink3 }));
  push(text(left, 1146, "Cada barra es la lluvia de la hora que termina en esa marca. Los límites empiezan a las 00:00 de su primer día; el acumulado de ahora, donde empezó el evento.", { size: 12.5, fill: C.ink3 }));

  // ── Próximas 24 horas: pronóstico de los modelos globales, solo como tendencia ──
  const forecast = input.forecast && input.forecast.hours.length > 0 ? input.forecast : null;
  const height = forecast ? H + FORECAST_PANEL : H;
  if (forecast) {
    const top3 = H + 70;
    const base3 = H + 200;
    const hours = forecastHours(forecast);
    const xf = (index: number) => left + (index / hours.length) * (right - left);
    const slotF = (right - left) / hours.length;
    const scale3 = axis(Math.max(1, ...hours.map((hour) => hour.highMm)));
    const y3 = (mm: number) => base3 - (mm / scale3.top) * (base3 - top3);
    push(`<line x1="${left}" x2="${right}" y1="${H + 6}" y2="${H + 6}" stroke="${C.grid}" stroke-width="2"/>`);
    push(text(left, H + 42, "Próximas 24 horas · pronóstico", { size: 18, fill: C.ink, weight: 700 }));
    const summary = forecast.expected
      ? `Esperado: ${fmt(forecast.expected.mm, 0)} mm (de ${fmt(forecast.expected.lowMm, 0)} a ${fmt(forecast.expected.highMm, 0)}) · modelos ${fmt(forecast.totalMm)} mm, ajustados ${Math.round((1 - (forecast.expected.modelWeight ?? 0.8)) * 100)} % con lo medido en ${forecast.expected.cases} casos parecidos`
      : `${fmt(forecast.totalMm)} mm (de ${fmt(forecast.lowMm)} a ${fmt(forecast.highMm)} según el modelo) · modelos globales sin corregir: solo tendencia`;
    push(text(left + 290, H + 42, summary, { size: 15.5 }));
    for (let mm = 0; mm <= scale3.top; mm += scale3.step) {
      push(`<line x1="${left}" x2="${right}" y1="${y3(mm)}" y2="${y3(mm)}" stroke="${C.grid}"/>`, text(left - 10, y3(mm) + 5, String(mm), { size: 14, anchor: "end" }));
    }
    hours.forEach((hour, index) => {
      const center = xf(index + 0.5);
      if (hour.highMm > hour.mm) push(`<line x1="${center}" x2="${center}" y1="${y3(hour.highMm)}" y2="${y3(hour.mm)}" stroke="${C.ink3}" stroke-width="1.5" stroke-dasharray="3 3"/>`);
      if (hour.mm > 0) push(`<rect x="${(center - slotF * 0.3).toFixed(1)}" y="${y3(hour.mm).toFixed(1)}" width="${(slotF * 0.6).toFixed(1)}" height="${(base3 - y3(hour.mm)).toFixed(1)}" fill="${C.ink3}" fill-opacity="0.6"/>`);
      const end = new Date(Date.parse(hour.time) - RECORD_OFFSET_MS);
      if (end.getUTCHours() % 3 === 0) push(text(xf(index + 1), base3 + 24, `${pad(end.getUTCHours())}:00`, { size: 13.5, anchor: "middle" }));
    });
    push(`<line x1="${left}" x2="${right}" y1="${base3}" y2="${base3}" stroke="${C.ink3}"/>`);
    push(`<text transform="translate(${left - 50} ${(top3 + base3) / 2}) rotate(-90)" font-size="15" fill="${C.ink2}" text-anchor="middle">mm por hora</text>`);
    const note = forecast.expected
      ? "Barras: pronóstico de Open-Meteo (ECMWF, GFS e ICON) ajustado con lo que midió la estación cuando los modelos daban algo parecido. Solos, en Galápagos se quedan cortos."
      : `Barras: mediana de los modelos ${forecast.source ? `de ${forecast.source}` : "ECMWF, GFS e ICON"}; línea punteada: hasta dónde llega el más lluvioso. Malla de ~25 km: no ve bien la lluvia sobre el relieve de la isla.`;
    push(text(left, base3 + 52, note, { size: 12.5, fill: C.ink3 }));
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}" font-family="${FONT}"><rect width="${W}" height="${height}" fill="${C.surface}"/>${parts.join("")}</svg>`;
}

/** Alto del reporte de Santa Cruz (sin límites de M0191: la lluvia en 3 horas y el evento). */
const SC_H = 1000;
/** Los cortes de la lluvia en 3 horas que deciden el nivel (como en el backend). */
const SC_LINES: Record<"low" | "high", { mm: number; label: string; color: string }[]> = {
  high: [
    { mm: 25, label: "amarilla", color: "#ca8a04" },
    { mm: 45, label: "naranja", color: "#ea580c" },
    { mm: 90, label: "roja", color: "#dc2626" },
  ],
  low: [{ mm: 70, label: "roja", color: "#dc2626" }],
};
const SC_LEVELS = {
  normal: { label: "Verde", color: "#2e7d32" },
  notice: { label: "Alerta amarilla", color: "#ca8a04" },
  alarm: { label: "Alerta naranja", color: "#ea580c" },
  extreme: { label: "Alerta roja", color: "#dc2626" },
} as const;
/** Parte alta: suelo mojado desde esta lluvia en las 24 horas previas (mm). */
const SC_WET_MM = 80;

/** La hora del continente de un instante ISO: "14:00". */
function hourOf(time: string): string {
  const date = new Date(Date.parse(time) - RECORD_OFFSET_MS);
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

function dayOf(time: string): string {
  const date = new Date(Date.parse(time) - RECORD_OFFSET_MS);
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}`;
}

/**
 * El reporte de una estación de Santa Cruz, como su popup: el nivel y la lluvia en 3 horas
 * que lo decide, las 24 horas previas, la lluvia de cada hora con la de 3 horas y sus cortes,
 * y el evento de lluvia en curso.
 */
export function santaCruzReportSvg(input: GalapagosReportInput): string {
  const zone = input.zone ?? "low";
  const points = input.now.filter((point): point is { hour: number; accumulatedMm: number; mm: number; time: string } => point.mm != null && Boolean(point.time));
  const sums = points.map((_, index) => points.slice(Math.max(0, index - 2), index + 1).reduce((total, point) => total + point.mm, 0));
  const shown = points.slice(-36);
  const shownSums = sums.slice(-36);
  const level = SC_LEVELS[input.level] ?? SC_LEVELS.normal;
  const mm3h = input.mm3h ?? shownSums.at(-1) ?? 0;
  const prev = input.prev24hMm;
  const wet = zone === "high" && (prev ?? 0) > SC_WET_MM;
  const last = shown.at(-1);
  const parts: string[] = [];
  const push = (part: string) => parts.push(part);
  const left = 70;
  const right = W - 150;

  // Cabecera
  push(`<rect x="0" y="0" width="${W}" height="12" fill="${level.color}"/>`);
  push(text(left, 62, `${input.island.toUpperCase()} · ${(input.name ?? input.code).toUpperCase()}`, { size: 17, fill: C.ink3, weight: 700 }));
  push(text(left, 122, `${level.label} · ${fmt(mm3h)} mm en 3 horas`, { size: 46, fill: level.color, weight: 800 }));
  const downloaded = input.downloadedAt ? ` · descargado a las ${pad(new Date(input.downloadedAt.getTime() - RECORD_OFFSET_MS).getUTCHours())}:${pad(new Date(input.downloadedAt.getTime() - RECORD_OFFSET_MS).getUTCMinutes())}` : "";
  push(text(left, 160, last ? `Dato de las ${hourOf(last.time)} del ${dayOf(last.time)} (hora del continente)${downloaded}` : "Sin dato", { size: 17, fill: C.ink2 }));

  // Cifras
  const box = (x: number, label: string, value: string, note: string | null, noteColor: string) => {
    push(`<rect x="${x}" y="195" width="400" height="120" rx="14" fill="#f1f0ec"/>`);
    push(text(x + 24, 232, label, { size: 16, fill: C.ink3, weight: 700 }));
    push(text(x + 24, 285, value, { size: 40, fill: C.ink, weight: 800 }));
    if (note) push(text(x + 24, 306, note, { size: 15, fill: noteColor, weight: 700 }));
  };
  box(left, "ÚLTIMAS 3 HORAS", `${fmt(mm3h)} mm`, null, C.ink2);
  box(left + 430, "24 HORAS PREVIAS", prev != null ? `${fmt(prev)} mm` : "–", wet ? "suelo mojado" : null, "#dc2626");
  const event = input.event;
  box(left + 860, "ESTE EVENTO", event ? `${fmt(event.totalMm)} mm` : "sin lluvia", null, C.ink2);
  if (event) push(text(left + 884, 306, `desde ${hourOf(event.start)} del ${dayOf(event.start)} · ${event.ended ? "terminó" : "sigue"}`, { size: 14, fill: C.ink2 }));

  // Lluvia de cada hora y en 3 horas
  const top = 400;
  const base = 760;
  push(text(left, 370, "Lluvia de cada hora (barras) y en 3 horas (línea)", { size: 22, fill: C.ink, weight: 700 }));
  const lines = SC_LINES[zone];
  const max = Math.max(lines[0].mm, ...shownSums, ...shown.map((point) => point.mm)) * 1.12;
  const y = (mm: number) => base - (Math.min(mm, max) / max) * (base - top);
  const slot = (right - left) / Math.max(1, shown.length);
  const { step } = axis(max / 1.12);
  for (let mm = 0; mm <= max; mm += step) {
    push(`<line x1="${left}" x2="${right}" y1="${y(mm)}" y2="${y(mm)}" stroke="${C.grid}"/>`);
    push(text(left - 10, y(mm) + 5, fmt(mm, 0), { size: 13, fill: C.ink3, anchor: "end" }));
  }
  for (const line of lines.filter((item) => item.mm <= max)) {
    push(`<line x1="${left}" x2="${right}" y1="${y(line.mm)}" y2="${y(line.mm)}" stroke="${line.color}" stroke-width="2" stroke-dasharray="9 6"/>`);
    push(text(right + 10, y(line.mm) + 6, `${line.mm} mm ${line.label}`, { size: 15, fill: line.color, weight: 700 }));
  }
  shown.forEach((point, index) => {
    if (point.mm > 0) push(`<rect x="${(left + index * slot + 2).toFixed(1)}" y="${y(point.mm).toFixed(1)}" width="${(slot - 4).toFixed(1)}" height="${(base - y(point.mm)).toFixed(1)}" rx="2" fill="#93c5fd"/>`);
    const date = new Date(Date.parse(point.time) - RECORD_OFFSET_MS);
    if (date.getUTCHours() % 3 === 0) {
      push(text(left + (index + 0.5) * slot, base + 24, hourOf(point.time), { size: 13.5, fill: C.ink2, anchor: "middle" }));
      if (date.getUTCHours() === 0 || index < 3) push(text(left + (index + 0.5) * slot, base + 44, dayOf(point.time), { size: 13, fill: C.ink3, anchor: "middle", weight: 700 }));
    }
  });
  const path = shownSums.map((mm, index) => `${index === 0 ? "M" : "L"}${(left + (index + 0.5) * slot).toFixed(1)},${y(mm).toFixed(1)}`).join(" ");
  push(`<path d="${path}" fill="none" stroke="${C.now}" stroke-width="4" stroke-linejoin="round"/>`);
  push(`<line x1="${left}" x2="${right}" y1="${base}" y2="${base}" stroke="#bdbcb6"/>`);
  if (last) {
    const lx = left + (shown.length - 0.5) * slot;
    push(`<circle cx="${lx}" cy="${y(mm3h)}" r="7" fill="${C.now}" stroke="${C.surface}" stroke-width="2.5"/>`);
    push(text(lx, y(mm3h) + 30, `${fmt(mm3h)} mm`, { size: 16, fill: C.ink, weight: 800, anchor: "middle", halo: true }));
  }

  // Pie
  const foot: string[] = [];
  if (input.sea) foot.push(`Mar: ${formatSeaLevel(input.sea.levelM)} respecto de su nivel medio (dato; no cambia la alerta).`);
  if (input.forecast?.hours.length) foot.push(`Pronóstico próximas 24 h: ${fmt(input.forecast.expected?.mm ?? input.forecast.totalMm)} mm.`);
  push(text(left, 850, foot.join("   "), { size: 16, fill: C.ink2 }));
  push(text(left, 900, `Fuente: ${input.network ?? "INAMHI"} · SATI. Horas de Ecuador continental (en Galápagos, una hora menos).`, { size: 13.5, fill: C.ink3 }));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${SC_H}" viewBox="0 0 ${W} ${SC_H}" font-family="${FONT}"><rect width="${W}" height="${SC_H}" fill="${C.surface}"/>${parts.join("")}</svg>`;
}

/** Nombre del archivo: reporte_santa_cruz_20261114_0900.png. */
export function galapagosReportFileName(input: GalapagosReportInput): string {
  const { date, hourLabel } = lastDatum(input.now);
  // Las estaciones de otra red llevan su nombre: en Santa Cruz hay varias.
  const island = `${input.island}${input.network ? ` ${input.name ?? input.code}` : ""}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/_$/, "");
  return `reporte_${island}_${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}_${hourLabel.replace(":", "")}.png`;
}

/** Dibuja el reporte y lo descarga como PNG (2800 × 2320; con el pronóstico, 2800 × 2880). */
export async function downloadGalapagosReport(input: GalapagosReportInput): Promise<void> {
  const svg = input.zone ? santaCruzReportSvg(input) : galapagosReportSvg(input);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("No se pudo dibujar el reporte"));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = W * SCALE;
    canvas.height = (input.zone ? SC_H : input.forecast?.hours.length ? H + FORECAST_PANEL : H) * SCALE;
    canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("No se pudo generar la imagen");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = galapagosReportFileName(input);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
  } finally {
    URL.revokeObjectURL(url);
  }
}
