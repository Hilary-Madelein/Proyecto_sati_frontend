import { toCanvas } from "html-to-image";

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
      .find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}-${part("hour")}${part("minute")}`;
}

/** El texto cortado con "…" para que quepa en `width` píxeles. */
function fit(context: CanvasRenderingContext2D, text: string, width: number): string {
  if (context.measureText(text).width <= width) return text;
  let cut = text;
  while (cut.length > 0 && context.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1);
  return `${cut}…`;
}

/**
 * Descarga una imagen PNG del mapa como se ve (capas y leyendas, sin paneles ni
 * botones) con una franja abajo: las capas visibles y la fecha y hora de la captura.
 */
export async function captureMap(area: HTMLElement, layers: readonly string[]): Promise<void> {
  const takenAt = new Date();
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const map = await toCanvas(area, {
    pixelRatio: scale,
    cacheBust: false,
    filter: (node) => !(node instanceof HTMLElement && node.matches(IGNORED)),
  });

  const footer = FOOTER_PX * scale;
  const canvas = document.createElement("canvas");
  canvas.width = map.width;
  canvas.height = map.height + footer;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("El navegador no permite crear la imagen");
  context.drawImage(map, 0, 0);
  context.fillStyle = "#0f172a";
  context.fillRect(0, map.height, canvas.width, footer);

  const pad = 16 * scale;
  context.textBaseline = "middle";
  context.fillStyle = "#ffffff";
  context.font = `600 ${13 * scale}px system-ui, sans-serif`;
  context.fillText("SATI.EC · Sistema de alerta temprana para inundaciones en el Ecuador", pad, map.height + footer * 0.32);
  context.fillStyle = "#cbd5e1";
  context.font = `${11 * scale}px system-ui, sans-serif`;
  const when = `Capturado el ${timeFormat.format(takenAt)} (hora de Ecuador)`;
  const whenWidth = context.measureText(when).width;
  context.fillText(when, canvas.width - pad - whenWidth, map.height + footer * 0.32);
  const list = layers.length > 0 ? `Capas: ${layers.join(" · ")}` : "Sin capas encendidas";
  context.fillText(fit(context, list, canvas.width - pad * 2), pad, map.height + footer * 0.72);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("No se pudo generar la imagen");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sati-mapa-${fileStamp(takenAt)}.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
