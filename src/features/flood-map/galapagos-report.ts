/*
 * Reporte descargable de una estación de Galápagos: una imagen con la lluvia de ayer
 * y hoy frente a los dos límites de la estación. Arriba, la lluvia de cada hora en
 * barras translúcidas (una dentro de otra); abajo, el acumulado, como en el popup.
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
export type GalapagosScenario = "normal" | "precaution" | "alert" | "emergency";
export const SCENARIO_LABELS: Record<GalapagosScenario, string> = { normal: "Normal", precaution: "Precaución", alert: "Alerta", emergency: "Emergencia" };

/** "+0,47 m" o "−0,31 m". */
export const formatSeaLevel = (levelM: number) => `${levelM > 0 ? "+" : levelM < 0 ? "−" : ""}${Math.abs(levelM).toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;

export interface GalapagosReportInput {
  code: string;
  island: string;
  level: "normal" | "alarm" | "extreme";
  /** Por qué está en ese nivel; null en normal. */
  reason: string | null;
  /** "Aquí estamos": acumulado desde las 00:00 de ayer; `hour` va de 1 a 48. */
  now: { hour: number; accumulatedMm: number; time?: string }[];
  upper: ReportLimit;
  lower: ReportLimit;
  sea?: SeaReading | null;
  scenario?: GalapagosScenario;
  /** Cuándo se descargó: se dice junto a la hora del último dato de la estación. */
  downloadedAt?: Date;
}

const W = 1400;
const H = 1160;
const SCALE = 2;
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
const LEVEL_TEXT ={ normal: "sin alarma", alarm: "en alarma", extreme: "en alarma extrema" } as const;

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
  const { island, code, upper, lower, now } = input;
  const current = now.at(-1);
  const hoursNow = current?.hour ?? 0;
  const total = current?.accumulatedMm ?? 0;
  const nowCurve = now.map((point) => point.accumulatedMm);
  const series = { upper: hourly(upper.accumulatedMm), lower: hourly(lower.accumulatedMm), now: hourly(nowCurve) };
  const { date, hourLabel } = lastDatum(now);
  const dayName = `${date.getUTCDate()} de ${MONTHS[date.getUTCMonth()]}`;
  // La lluvia de hoy: lo acumulado después de las 24 horas de ayer.
  const today = hoursNow > 24 ? Math.round((total - (nowCurve[23] ?? 0)) * 10) / 10 : null;
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
  push(text(left, 66, `${island} hoy, ${dayName}${updated}, frente a sus límites`, { size: 31, fill: C.ink, weight: 700 }));
  const headline =
    today === null
      ? `Desde ayer: ${fmt(total)} mm hasta las ${hourLabel}.`
      : `Hoy: ${fmt(today)} mm hasta las ${hourLabel}. Con ayer, ${fmt(total)} mm. Sus límites de dos días: ${fmt(lower.totalMm, 0)} mm (inferior) y ${fmt(upper.totalMm, 0)} mm (superior).`;
  push(text(left, 104, headline, { size: 17.5 }));
  // La estación publica cada hora con retraso: se dice cuándo se descargó y hasta qué hora hay dato.
  const asOf = downloaded ? `Último dato publicado: ${hourLabel} · ` : "";
  push(text(left, 132, `${asOf}Estación ${code}, INAMHI · cada episodio se muestra con sus dos días completos, con las horas del registro`, { size: 14.5, fill: C.ink3 }));

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
  const events = UPPER_EVENTS[code] ?? [];
  const eventLine = (hour: number, top: number, base: number) => `<line x1="${x(hour)}" x2="${x(hour)}" y1="${top}" y2="${base}" stroke="${C.upper}" stroke-width="2" stroke-dasharray="7 5"/>`;
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
  const ticks = (base: number) =>
    Array.from({ length: 49 }, (_, hour) => {
      const labelled = hour % 3 === 0;
      const mark = `<line x1="${x(hour)}" x2="${x(hour)}" y1="${base}" y2="${base + (labelled ? 8 : 4)}" stroke="${C.ink3}" stroke-width="1"/>`;
      return labelled ? mark + text(x(hour), base + 26, hour === 48 ? "24:00" : `${pad(hour % 24)}:00`, { size: 13.5, anchor: "middle" }) : mark;
    }).join("");
  push(ticks(base1), text(x(12), base1 + 54, "primer día", { size: 15, fill: C.ink3, anchor: "middle" }), text(x(36), base1 + 54, "segundo día", { size: 15, fill: C.ink3, anchor: "middle" }));
  push(`<text transform="translate(${left - 50} ${(top1 + base1) / 2}) rotate(-90)" font-size="15" fill="${C.ink2}" text-anchor="middle">mm en cada hora</text>`);

  // ── Abajo: el acumulado de ayer y hoy, como en el popup ──
  const top2 = 628;
  const base2 = 946;
  const scale2 = axis(Math.max(upper.totalMm, total));
  const y2 = (mm: number) => base2 - (mm / scale2.top) * (base2 - top2);
  const curve = (values: readonly number[]) => [`${x(0)},${y2(0)}`, ...values.map((mm, index) => `${x(index + 1).toFixed(1)},${y2(mm).toFixed(1)}`)].join(" ");
  push(text(left, 604, "Acumulado de ayer y hoy (la gráfica de la estación)", { size: 18, fill: C.ink, weight: 700 }));
  for (let mm = 0; mm <= scale2.top; mm += scale2.step) {
    push(`<line x1="${left}" x2="${right}" y1="${y2(mm)}" y2="${y2(mm)}" stroke="${C.grid}"/>`, text(left - 10, y2(mm) + 5, String(mm), { size: 14, anchor: "end" }));
  }
  const band = `${curve(upper.accumulatedMm)} ${lower.accumulatedMm.map((mm, index) => `${x(index + 1).toFixed(1)},${y2(mm).toFixed(1)}`).reverse().join(" ")} ${x(0)},${y2(0)}`;
  push(`<polygon points="${band}" fill="${C.upper}" fill-opacity="0.10"/>`);
  push(`<line x1="${x(24)}" x2="${x(24)}" y1="${top2}" y2="${base2}" stroke="${C.ink3}" stroke-width="1"/>`);
  for (const [limit, color] of [[upper, C.upper], [lower, C.lower]] as const) {
    const { name, detail } = limitParts(limit);
    const endY = y2(limit.totalMm);
    push(`<polyline points="${curve(limit.accumulatedMm)}" fill="none" stroke="${color}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/>`);
    push(`<circle cx="${right}" cy="${endY}" r="5.5" fill="${color}" stroke="${C.surface}" stroke-width="2"/>`);
    // El rótulo del límite, a la derecha de donde termina su curva.
    const labelY = limit === lower ? Math.min(endY, base2 - 28) : Math.max(endY, top2 + 18);
    push(text(right + 16, labelY - 13, name, { size: 14.5, fill: C.ink }), text(right + 16, labelY + 6, detail, { size: 14.5, fill: C.ink }), text(right + 16, labelY + 25, `${fmt(limit.totalMm, 0)} mm`, { size: 14.5, fill: C.ink }));
  }
  // Los momentos del episodio del límite superior: la línea, el punto sobre su curva y qué pasó, arriba.
  events.forEach((event, index) => {
    const mm = upper.accumulatedMm[event.hour - 1] ?? 0;
    const side = index % 2 === 0 ? -1 : 1;
    const anchor = side < 0 ? "end" : "start";
    push(eventLine(event.hour, top2, base2));
    if (event.highlight) {
      // Lo acumulado en ese momento, resaltado: una guía hasta el eje, un punto grande con aro y la cifra al lado.
      push(`<line x1="${left}" x2="${x(event.hour)}" y1="${y2(mm)}" y2="${y2(mm)}" stroke="${C.upper}" stroke-width="1.6" stroke-dasharray="3 5"/>`);
      push(`<circle cx="${x(event.hour)}" cy="${y2(mm)}" r="15" fill="${C.upper}" fill-opacity="0.18"/>`, `<circle cx="${x(event.hour)}" cy="${y2(mm)}" r="8.5" fill="${C.upper}" stroke="${C.surface}" stroke-width="2.5"/>`);
      push(text(x(event.hour) - 22, y2(mm) - 12, `${fmt(mm, 0)} mm`, { size: 24, fill: C.ink, weight: 700, anchor: "end", halo: true }));
      push(text(x(event.hour) - 22, y2(mm) + 24, "acumulados al empezar", { size: 14.5, fill: C.ink, anchor: "end", halo: true }));
    } else push(`<circle cx="${x(event.hour)}" cy="${y2(mm)}" r="5.5" fill="${C.upper}" stroke="${C.surface}" stroke-width="2"/>`);
    push(text(x(event.hour) + side * 9, top2 + 19, event.label, { size: 14.5, fill: C.ink, anchor, halo: true }));
    push(text(x(event.hour) + side * 9, top2 + 38, `${event.time} · con ${fmt(mm, 0)} mm acumulados`, { size: 14.5, fill: C.ink, anchor, halo: true }));
  });
  if (current) {
    const nowX = x(hoursNow);
    const nowY = y2(total);
    push(`<polyline points="${curve(nowCurve)}" fill="none" stroke="${C.now}" stroke-width="4" stroke-dasharray="14 8" stroke-linejoin="round"/>`);
    push(`<circle cx="${nowX}" cy="${nowY}" r="7.5" fill="${C.now}" stroke="${C.surface}" stroke-width="2.5"/>`);
    // "Aquí estamos": arriba y a la derecha del punto mientras quepa; si no, a la izquierda.
    const side = hoursNow > 38 ? -1 : 1;
    const labelX = nowX + side * 150;
    const labelY = Math.max(top2 + 40, nowY - 78);
    push(`<line x1="${nowX + side * 9}" y1="${nowY - 7}" x2="${labelX - side * 62}" y2="${labelY + 30}" stroke="${C.now}" stroke-width="1.3"/>`);
    push(text(labelX, labelY, "Aquí estamos", { size: 17, fill: C.ink, weight: 700, anchor: "middle", halo: true }), text(labelX, labelY + 22, `${fmt(total)} mm desde ayer`, { size: 17, fill: C.ink, weight: 700, anchor: "middle", halo: true }));
  }
  push(ticks(base2), text(x(12), base2 + 62, "ayer", { size: 15, fill: C.ink3, anchor: "middle" }), text(x(36), base2 + 62, "hoy", { size: 15, fill: C.ink3, anchor: "middle" }));
  push(`<text transform="translate(${left - 58} ${(top2 + base2) / 2}) rotate(-90)" font-size="15" fill="${C.ink2}" text-anchor="middle">mm acumulados</text>`);

  // ── Lectura y fuente ──
  const position = total >= upperSameHour ? "va por encima del límite superior" : total >= lowerSameHour ? "va entre sus dos límites" : "va por debajo del límite inferior";
  const reason = input.reason ? ` (${input.reason})` : "";
  const reading = `Qué dice: la lluvia ${position}. Desde ayer acumula ${fmt(total)} mm, frente a ${fmt(lowerSameHour)} mm del límite inferior y ${fmt(upperSameHour)} mm del límite superior a esa misma hora. En el sistema la estación está ${LEVEL_TEXT[input.level] ?? LEVEL_TEXT.normal}${reason}.`;
  const sea = input.sea
    ? ` El mar está ${input.sea.high ? "alto" : "bajo"} (${formatSeaLevel(input.sea.levelM)} respecto de su nivel medio, mareógrafo de ${input.sea.place})${input.scenario ? `: en la matriz lluvia × mar, ${SCENARIO_LABELS[input.scenario].toUpperCase()}` : ""}.`
    : "";
  wrap(reading + sea, 148).forEach((line, index) => push(text(left, 1050 + index * 25, line, { size: 16 })));
  push(text(left, 1128, "Fuente: INAMHI, lluvia horaria de la estación tomada del sistema SATI (dato en vivo, aún sin validar). Horas del registro (hora del continente; en Galápagos es una hora menos).", { size: 12.5, fill: C.ink3 }));
  push(text(left, 1146, "Cada barra es la lluvia de la hora que termina en esa marca. Las dos gráficas empiezan a las 00:00 del primer día de cada episodio.", { size: 12.5, fill: C.ink3 }));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}"><rect width="${W}" height="${H}" fill="${C.surface}"/>${parts.join("")}</svg>`;
}

/** Nombre del archivo: reporte_santa_cruz_20261114_0900.png. */
export function galapagosReportFileName(input: GalapagosReportInput): string {
  const { date, hourLabel } = lastDatum(input.now);
  const island = input.island.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return `reporte_${island}_${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}_${hourLabel.replace(":", "")}.png`;
}

/** Dibuja el reporte y lo descarga como PNG (2800 × 2320). */
export async function downloadGalapagosReport(input: GalapagosReportInput): Promise<void> {
  const url = URL.createObjectURL(new Blob([galapagosReportSvg(input)], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("No se pudo dibujar el reporte"));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = W * SCALE;
    canvas.height = H * SCALE;
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
