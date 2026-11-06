import { toCanvas } from "html-to-image";
import type { CaptureLegendGroup, LegendSymbol } from "./capture-legend";
import { drawGlyph } from "./map-glyphs";

/** Lo que no va en la imagen: paneles y botones (se marcan con `data-capture-ignore`). */
const IGNORED = "[data-map-overlay], [data-capture-ignore]";
const FOOTER_PX = 52;

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
      context.fillStyle = "#64748b";
      context.font = `${10 * s}px system-ui, sans-serif`;
      context.fillText(group.ramp.min, left, cursor + 20 * s);
      const maxWidth = context.measureText(group.ramp.max).width;
      context.fillText(group.ramp.max, left + inner - maxWidth, cursor + 20 * s);
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
      context.fillStyle = "#334155";
      context.fillText(fit(context, item.label, inner - 22 * s), left + 22 * s, cursor + (LEGEND.row / 2) * s);
      cursor += LEGEND.row * s;
    }
  }
  return height * s;
}

/**
 * Descarga una imagen PNG del mapa como se ve (capas y leyendas, sin paneles ni
 * botones), con la leyenda de todo lo dibujado (qué es cada color y símbolo) y una
 * franja abajo: las capas visibles y la fecha y hora de la captura.
 */
export async function captureMap(area: HTMLElement, layers: readonly string[], legend: readonly CaptureLegendGroup[] = []): Promise<void> {
  const takenAt = new Date();
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const map = await toCanvas(area, {
    pixelRatio: scale,
    cacheBust: false,
    filter: (node) => !(node instanceof HTMLElement && node.matches(IGNORED)),
  });

  const footer = FOOTER_PX * scale;
  const legendHeight = layoutLegend(legend, map.width / scale).height * scale;
  const canvas = document.createElement("canvas");
  canvas.width = map.width;
  canvas.height = map.height + legendHeight + footer;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("El navegador no permite crear la imagen");
  context.drawImage(map, 0, 0);
  if (legend.length > 0) drawLegend(context, legend, canvas.width, map.height, scale);
  const footerTop = map.height + legendHeight;
  context.fillStyle = "#0f172a";
  context.fillRect(0, footerTop, canvas.width, footer);

  const pad = 16 * scale;
  context.textBaseline = "middle";
  context.fillStyle = "#ffffff";
  context.font = `600 ${13 * scale}px system-ui, sans-serif`;
  context.fillText("SATI.EC · Sistema de alerta temprana para inundaciones en el Ecuador", pad, footerTop + footer * 0.32);
  context.fillStyle = "#cbd5e1";
  context.font = `${11 * scale}px system-ui, sans-serif`;
  const when = `Capturado el ${timeFormat.format(takenAt)} (hora de Ecuador)`;
  const whenWidth = context.measureText(when).width;
  context.fillText(when, canvas.width - pad - whenWidth, footerTop + footer * 0.32);
  const list = layers.length > 0 ? `Capas: ${layers.join(" · ")}` : "Sin capas encendidas";
  context.fillText(fit(context, list, canvas.width - pad * 2), pad, footerTop + footer * 0.72);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("No se pudo generar la imagen");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sati-mapa-${fileStamp(takenAt)}.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
