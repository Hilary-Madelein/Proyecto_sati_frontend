import { toCanvas } from "html-to-image";
import type { CaptureLegendGroup, LegendSymbol } from "./capture-legend";
import { drawGlyph } from "./map-glyphs";

/** Lo que no va en la imagen: paneles y botones (se marcan con `data-capture-ignore`). */
// También los avisos que aparecen al pasar el cursor: no son parte del mapa (sí las etiquetas fijas, `.map-place-label`).
const IGNORED = "[data-map-overlay], [data-capture-ignore], .leaflet-tooltip:not(.map-place-label)";
const FOOTER_PX = 52;
const HEADER_PX = 40;

const timeFormat = new Intl.DateTimeFormat("es-EC", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Guayaquil",
});

/** "2026-11-05-2140", para el nombre del archivo (hora de Ecuador). */
function fileStamp(date: Date): string {
  const part = (type: string) =>
    new Intl.DateTimeFormat("en-CA", { [type]: type === "year" ? "numeric" : "2-digit", hour12: false, timeZone: "America/Guayaquil" })
      .formatToParts(date)
      .find((item) => item.type === type)
      // Algunos navegadores dan el minuto sin el cero ("2" en vez de "02") aunque se pida con dos dígitos.
      ?.value.padStart(2, "0") ?? "";
  return `${part("year")}-${part("month")}-${part("day")}-${part("hour")}${part("minute")}`;
}

/** El texto cortado con "…" para que quepa en `width` píxeles. */
function fit(context: CanvasRenderingContext2D, text: string, width: number): string {
  if (context.measureText(text).width <= width) return text;
  let cut = text;
  while (cut.length > 0 && context.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1);
  return `${cut}…`;
}

// Leyenda de la imagen (en px de pantalla; se multiplican por la escala).
const LEGEND = { column: 230, pad: 16, title: 18, row: 17, rampHeight: 30, gap: 12, header: 26 } as const;

/** Alto de un bloque de la leyenda. */
function groupHeight(group: CaptureLegendGroup): number {
  return LEGEND.title + (group.ramp ? LEGEND.rampHeight : 0) + (group.items?.length ?? 0) * LEGEND.row + LEGEND.gap;
}

/** Ubica los bloques en columnas, cada uno en la más corta (como un muro de fotos). */
function layoutLegend(groups: readonly CaptureLegendGroup[], width: number) {
  const columns = Math.max(1, Math.floor((width - LEGEND.pad * 2) / LEGEND.column));
  const heights = new Array<number>(columns).fill(0);
  const placed = groups.map((group) => {
    const column = heights.indexOf(Math.min(...heights));
    const y = heights[column];
    heights[column] += groupHeight(group);
    return { group, column, y };
  });
  return { placed, columnWidth: (width - LEGEND.pad * 2) / columns, height: groups.length ? LEGEND.header + Math.max(...heights) + LEGEND.pad : 0 };
}

/** El símbolo de un elemento, como se ve en el mapa. `x`, `y`: centro. */
function drawSymbol(context: CanvasRenderingContext2D, symbol: LegendSymbol, color: string, x: number, y: number, s: number) {
  context.save();
  context.fillStyle = color;
  context.strokeStyle = "#ffffff";
  context.lineWidth = 1.5 * s;
  context.beginPath();
  if (symbol === "circle") {
    context.arc(x, y, 5 * s, 0, Math.PI * 2);
  } else if (symbol === "square") {
    context.rect(x - 5 * s, y - 5 * s, 10 * s, 10 * s);
  } else if (symbol === "diamond") {
    context.moveTo(x, y - 6 * s);
    context.lineTo(x + 6 * s, y);
    context.lineTo(x, y + 6 * s);
    context.lineTo(x - 6 * s, y);
    context.closePath();
  } else if (symbol === "triangle") {
    context.moveTo(x, y - 6 * s);
    context.lineTo(x + 6 * s, y + 5 * s);
    context.lineTo(x - 6 * s, y + 5 * s);
    context.closePath();
    context.strokeStyle = "#1f2937";
    context.lineWidth = 1 * s;
  } else if (symbol === "line") {
    context.moveTo(x - 8 * s, y);
    context.lineTo(x + 8 * s, y);
    context.strokeStyle = color;
    context.lineWidth = 3 * s;
    context.lineCap = "round";
    context.stroke();
    context.restore();
    return;
  } else {
    context.rect(x - 8 * s, y - 5 * s, 16 * s, 10 * s);
    context.globalAlpha = 0.55;
    context.fill();
    context.globalAlpha = 1;
    context.strokeStyle = color;
    context.lineWidth = 1.5 * s;
    context.stroke();
    context.restore();
    return;
  }
  context.fill();
  context.stroke();
  context.restore();
}

/** Dibuja la leyenda en el lienzo, desde `top`. */
function drawLegend(context: CanvasRenderingContext2D, groups: readonly CaptureLegendGroup[], width: number, top: number, s: number) {
  const { placed, columnWidth, height } = layoutLegend(groups, width / s);
  context.fillStyle = "#ffffff";
  context.fillRect(0, top, width, height * s);
  context.fillStyle = "#e2e8f0";
  context.fillRect(0, top, width, 1 * s);
  context.textBaseline = "middle";
  context.fillStyle = "#0f172a";
  context.font = `700 ${12 * s}px system-ui, sans-serif`;
  context.fillText("Leyenda", LEGEND.pad * s, top + (LEGEND.header / 2 + 4) * s);

  for (const { group, column, y } of placed) {
    const left = (LEGEND.pad + column * columnWidth) * s;
    const inner = (columnWidth - 12) * s;
    let cursor = top + (LEGEND.header + y) * s;
    context.fillStyle = "#334155";
    context.font = `600 ${11 * s}px system-ui, sans-serif`;
    context.fillText(fit(context, group.title, inner), left, cursor + (LEGEND.title / 2) * s);
    cursor += LEGEND.title * s;
    if (group.ramp) {
      const bar = context.createLinearGradient(left, 0, left + inner, 0);
      group.ramp.colors.forEach((color, index) => bar.addColorStop(index / Math.max(1, group.ramp!.colors.length - 1), color));
      context.fillStyle = bar;
      context.fillRect(left, cursor + 2 * s, inner, 9 * s);
      // Los valores de la escala, repartidos a lo largo de la barra (el primero alineado a la izquierda, el último a la derecha).
      context.fillStyle = "#475569";
      context.font = `${10 * s}px system-ui, sans-serif`;
      for (const tick of group.ramp.ticks) {
        const width = context.measureText(tick.label).width;
        const x = left + inner * tick.at;
        const at = tick.at <= 0 ? x : tick.at >= 1 ? x - width : x - width / 2;
        context.fillText(tick.label, at, cursor + 20 * s);
      }
      cursor += LEGEND.rampHeight * s;
    }
    context.font = `${11 * s}px system-ui, sans-serif`;
    for (const item of group.items ?? []) {
      if (item.glyph) {
        // Como en el mapa de cerca: el dibujo, del color de su clase.
        drawGlyph(context, item.glyph, left + 8 * s, cursor + (LEGEND.row / 2) * s, 15 * s, item.color);
      } else {
        drawSymbol(context, item.symbol, item.color, left + 8 * s, cursor + (LEGEND.row / 2) * s, s);
      }
      // La cantidad a la derecha, en negrita (como en la leyenda del panel).
      let countWidth = 0;
      if (item.count !== undefined) {
        const count = item.count.toLocaleString("es-EC");
        context.font = `700 ${11 * s}px system-ui, sans-serif`;
        context.fillStyle = "#0f172a";
        countWidth = context.measureText(count).width + 8 * s;
        context.fillText(count, left + inner - countWidth + 8 * s, cursor + (LEGEND.row / 2) * s);
        context.font = `${11 * s}px system-ui, sans-serif`;
      }
      context.fillStyle = "#334155";
      context.fillText(fit(context, item.label, inner - 22 * s - countWidth), left + 22 * s, cursor + (LEGEND.row / 2) * s);
      cursor += LEGEND.row * s;
    }
  }
  return height * s;
}

/** Brújula de la imagen: círculo blanco con la aguja (roja al norte) y la "N", girada hacia el norte real. */
function drawCompass(context: CanvasRenderingContext2D, x: number, y: number, s: number, north: number) {
  const r = 24 * s;
  context.save();
  context.fillStyle = "rgba(255,255,255,0.92)";
  context.strokeStyle = "#cbd5e1";
  context.lineWidth = 1 * s;
  context.beginPath();
  context.arc(x, y, r, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.translate(x, y);
  context.rotate((north * Math.PI) / 180);
  context.fillStyle = "#dc2626";
  context.beginPath();
  context.moveTo(0, -r * 0.62);
  context.lineTo(r * 0.24, 0);
  context.lineTo(-r * 0.24, 0);
  context.closePath();
  context.fill();
  context.fillStyle = "#94a3b8";
  context.beginPath();
  context.moveTo(0, r * 0.62);
  context.lineTo(r * 0.24, 0);
  context.lineTo(-r * 0.24, 0);
  context.closePath();
  context.fill();
  context.fillStyle = "#0f172a";
  context.font = `700 ${10 * s}px system-ui, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("N", 0, -r * 0.8);
  context.restore();
}

/** Lo que lleva una imagen del mapa además del mapa mismo. */
export interface MapImageOptions {
  layers: readonly string[];
  legend?: readonly CaptureLegendGroup[];
  /** Título de la imagen: la provincia que se está viendo (o todo el Ecuador). */
  title?: string;
  /** Hacia dónde queda el norte en la imagen, en grados (0 = arriba): para la brújula. */
  north?: number;
  /** Píxeles por punto de pantalla; por defecto, los de la pantalla (máximo 2). La animación usa 1 (archivo más liviano). */
  scale?: number;
}

/**
 * Arma la imagen del mapa como se ve (capas y leyendas, sin paneles ni botones), con
 * la leyenda de todo lo dibujado (qué es cada color y símbolo) y una franja abajo: las
 * capas visibles y la fecha y hora de la captura.
 */
/** La imagen y dónde quedó el mapa dentro de ella (para fundir solo el mapa entre cuadros de una animación). */
export interface RenderedMapImage {
  canvas: HTMLCanvasElement;
  mapTop: number;
  mapHeight: number;
}

export async function renderMapImage(area: HTMLElement, options: MapImageOptions): Promise<HTMLCanvasElement> {
  return (await renderMapImageWithLayout(area, options)).canvas;
}

export async function renderMapImageWithLayout(
  area: HTMLElement,
  { layers, legend = [], title = "", north = 0, scale: wanted }: MapImageOptions,
): Promise<RenderedMapImage> {
  const takenAt = new Date();
  const scale = wanted ?? Math.min(window.devicePixelRatio || 1, 2);
  const map = await toCanvas(area, {
    pixelRatio: scale,
    cacheBust: false,
    filter: (node) => !(node instanceof HTMLElement && node.matches(IGNORED)),
  });

  // Franja de abajo: título y fecha en una línea si caben; si no (celular), la fecha en otra.
  const brand = "SATI.EC · Sistema de alerta temprana para inundaciones en el Ecuador";
  const when = `Capturado el ${timeFormat.format(takenAt)} (hora de Ecuador)`;
  const measure = document.createElement("canvas").getContext("2d");
  const textWidth = (text: string, font: string) => {
    if (!measure) return 0;
    measure.font = font;
    return measure.measureText(text).width;
  };
  const brandFont = `600 ${13 * scale}px system-ui, sans-serif`;
  const smallFont = `${11 * scale}px system-ui, sans-serif`;
  const pad = 16 * scale;
  const oneLine = textWidth(brand, brandFont) + textWidth(when, smallFont) + pad * 3 <= map.width;
  const footer = (oneLine ? FOOTER_PX : FOOTER_PX + 20) * scale;
  const legendHeight = layoutLegend(legend, map.width / scale).height * scale;
  const canvas = document.createElement("canvas");
  canvas.width = map.width;
  const header = title ? HEADER_PX * scale : 0;
  canvas.height = header + map.height + legendHeight + footer;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("El navegador no permite crear la imagen");
  if (title) {
    // Franja de título arriba: de qué provincia es la imagen.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, header);
    context.fillStyle = "#0f172a";
    context.textBaseline = "middle";
    context.font = `700 ${16 * scale}px system-ui, sans-serif`;
    context.fillText(fit(context, title, canvas.width - 32 * scale), 16 * scale, header / 2);
  }
  context.drawImage(map, 0, header);
  drawCompass(context, canvas.width - 40 * scale, header + 40 * scale, scale, north);
  if (legend.length > 0) drawLegend(context, legend, canvas.width, header + map.height, scale);
  const footerTop = header + map.height + legendHeight;
  context.fillStyle = "#0f172a";
  context.fillRect(0, footerTop, canvas.width, footer);

  context.textBaseline = "middle";
  context.fillStyle = "#ffffff";
  context.font = brandFont;
  const row = (index: number) => footerTop + (14 + index * 20) * scale;
  context.fillText(fit(context, brand, canvas.width - pad * 2), pad, row(0));
  context.fillStyle = "#cbd5e1";
  context.font = smallFont;
  if (oneLine) context.fillText(when, canvas.width - pad - context.measureText(when).width, row(0));
  else context.fillText(fit(context, when, canvas.width - pad * 2), pad, row(1));
  const list = layers.length > 0 ? `Capas: ${layers.join(" · ")}` : "Sin capas encendidas";
  context.fillText(fit(context, list, canvas.width - pad * 2), pad, row(oneLine ? 1 : 2));

  return { canvas, mapTop: header, mapHeight: map.height };
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Descarga una imagen PNG del mapa como se ve (ver renderMapImage). */
export async function captureMap(
  area: HTMLElement,
  layers: readonly string[],
  legend: readonly CaptureLegendGroup[] = [],
  title = "",
  north = 0,
): Promise<void> {
  const canvas = await renderMapImage(area, { layers, legend, title, north });
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("No se pudo generar la imagen");
  download(blob, `sati-mapa-${fileStamp(new Date())}.png`);
}

/** Tiempos de la animación GIF: cuánto se ve cada cuadro y cómo se funde con el siguiente. */
export interface GifTiming {
  holdMs: number;
  /** Cuadros intermedios del fundido entre un cuadro y el siguiente (0 = corte directo). */
  fadeFrames: number;
  fadeFrameMs: number;
}

/**
 * Descarga una animación GIF en bucle con los cuadros dados (del mismo tamaño). Entre
 * uno y el siguiente (y del último al primero) se intercalan cuadros que funden solo el
 * mapa: el título, la leyenda y la franja cambian de golpe, sin letras fantasma. Cada
 * cuadro lleva su propia paleta de 256 colores: la escala de la lluvia se ve como en el mapa.
 */
export async function downloadGif(frames: readonly RenderedMapImage[], timing: GifTiming, name: string): Promise<void> {
  if (frames.length === 0) throw new Error("No hay cuadros para la animación");
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
  const width = Math.min(...frames.map((frame) => frame.canvas.width));
  const height = Math.min(...frames.map((frame) => frame.canvas.height));
  const gif = GIFEncoder();
  let first = true;
  const write = (canvas: HTMLCanvasElement, delay: number) => {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("El navegador no permite leer la imagen");
    const { data } = context.getImageData(0, 0, width, height);
    const palette = quantize(data, 256);
    gif.writeFrame(applyPalette(data, palette), width, height, { palette, delay, repeat: first ? 0 : undefined });
    first = false;
  };
  const blend = document.createElement("canvas");
  blend.width = width;
  blend.height = height;
  const blendContext = blend.getContext("2d");
  if (!blendContext) throw new Error("El navegador no permite crear la imagen");

  frames.forEach((frame, index) => {
    write(frame.canvas, timing.holdMs);
    const next = frames[(index + 1) % frames.length];
    if (frames.length < 2 || timing.fadeFrames <= 0) return;
    for (let step = 1; step <= timing.fadeFrames; step++) {
      // Todo del siguiente cuadro, y encima el mapa del actual cada vez más transparente.
      const t = step / (timing.fadeFrames + 1);
      blendContext.globalAlpha = 1;
      blendContext.drawImage(next.canvas, 0, 0);
      blendContext.globalAlpha = 1 - t;
      blendContext.drawImage(frame.canvas, 0, frame.mapTop, width, frame.mapHeight, 0, next.mapTop, width, next.mapHeight);
      write(blend, timing.fadeFrameMs);
    }
  });
  gif.finish();
  download(new Blob([gif.bytes()], { type: "image/gif" }), name);
}

/** "2026-11-05-2140", para nombrar archivos (hora de Ecuador). */
export const captureStamp = (date = new Date()) => fileStamp(date);

/** Lo justo del mapa de Leaflet que usan `tilesLoaded` y `northOf` (sin importar Leaflet aquí). */
interface MapLike {
  eachLayer(fn: (layer: unknown) => void): unknown;
  getCenter(): { lat: number; lng: number };
  latLngToContainerPoint(latlng: [number, number]): { x: number; y: number };
}

/** Hacia dónde queda el norte en pantalla, en grados (0 = arriba): como northOnScreen, sin Leaflet. */
export function northOf(map: MapLike): number {
  const { lat, lng } = map.getCenter();
  const a = map.latLngToContainerPoint([lat, lng]);
  const b = map.latLngToContainerPoint([Math.min(lat + 0.5, 89), lng]);
  const degrees = (Math.atan2(b.x - a.x, a.y - b.y) * 180) / Math.PI;
  return Math.abs(degrees) < 0.5 ? 0 : degrees;
}
interface LoadingLayer {
  isLoading(): boolean;
  once(type: "load", fn: () => void): unknown;
}

/**
 * Espera a que las capas de teselas (mapa base, nombres, lluvia…) terminen de cargar lo
 * que se ve, y a que termine el fundido con que aparecen (~200 ms), para que la imagen no
 * salga con cuadros grises. Como máximo `maxMs`: si una capa no termina, se sigue igual.
 */
export function tilesLoaded(map: MapLike, maxMs = 8000): Promise<void> {
  const loading: LoadingLayer[] = [];
  map.eachLayer((layer) => {
    const candidate = layer as Partial<LoadingLayer>;
    if (typeof candidate.isLoading === "function" && candidate.isLoading() && typeof candidate.once === "function") loading.push(candidate as LoadingLayer);
  });
  const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 400));
  if (loading.length === 0) return settle();
  const waits = loading.map((layer) => new Promise<void>((resolve) => layer.once("load", () => resolve())));
  return Promise.race([Promise.all(waits).then(settle), new Promise<void>((resolve) => setTimeout(resolve, maxMs))]);
}
