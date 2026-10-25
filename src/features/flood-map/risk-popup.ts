import { formatCalendarDate, formatDayMonth } from "@/lib/format";
import type { RiskLayerStyle, RiskPopupField } from "./risk-layers";
import type { RiskFeature } from "./types";

/*
 * Textos del popup de una entidad de gestión del riesgo, en HTML (Leaflet lo
 * pinta tal cual): todo valor que viene del servicio pasa por escapeHtml.
 */

export function titleOf(style: RiskLayerStyle, feature: RiskFeature): string {
  const value = style.popup.titleField ? feature.properties[style.popup.titleField] : null;
  return value === null || value === undefined || value === "" ? style.popup.fallbackTitle : String(value);
}

/** Popup completo: capa, título, campos con valor y fuente. */
export function popupHtml(style: RiskLayerStyle, feature: RiskFeature, attribution: string): string {
  const rows = style.popup.fields
    .map((field) => [field.label, formatValue(field, feature.properties[field.field])] as const)
    .filter(([, value]) => value !== null)
    .map(
      ([label, value]) =>
        `<div class="flex gap-3 py-0.5"><dt class="w-24 shrink-0 text-slate-500">${escapeHtml(label)}</dt><dd class="min-w-0 flex-1 font-medium text-slate-800 break-words">${escapeHtml(value!)}</dd></div>`,
    )
    .join("");
  return `<div class="w-64">
    <p class="text-[11px] font-medium text-slate-500">${escapeHtml(style.title)}</p>
    <h3 class="text-sm font-semibold text-slate-900">${escapeHtml(titleOf(style, feature))}</h3>
    ${rows ? `<dl class="mt-2 text-xs">${rows}</dl>` : ""}
    <p class="mt-2 text-[11px] text-slate-400">Fuente: ${escapeHtml(attribution)}</p>
  </div>`;
}

function formatValue(field: RiskPopupField, value: string | number | boolean | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    switch (field.format) {
      case "percent":
        return `${formatNumber(value)} %`;
      case "money":
        return `$ ${formatNumber(Math.round(value))}`;
      case "hectares":
        return `${formatNumber(value)} ha`;
      case "plain":
        return String(value);
      default:
        return formatNumber(value);
    }
  }
  const text = String(value);
  // Puede traer varias fechas separadas por ";" (p. ej. una alcantarilla con varios reportes).
  if (field.format === "date") return text.split(";").map((part) => formatDate(part.trim())).join(", ");
  return text;
}

/** Fecha con hora (ISO de ArcGIS) o solo el día (AAAA-MM-DD), p. ej. "8 oct 2026". */
function formatDate(text: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${formatCalendarDate(text)} ${text.slice(0, 4)}`;
  const time = Date.parse(text);
  return Number.isNaN(time) ? text : `${formatDayMonth(text)} ${new Date(time).getUTCFullYear()}`;
}

const formatNumber = (value: number) => value.toLocaleString("es-EC", { maximumFractionDigits: 1 });

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}
