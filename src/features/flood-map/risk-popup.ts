import { formatCalendarDate, formatDayMonth } from "@/lib/format";
import type { RiskLayerStyle, RiskPopupField } from "./risk-layers";
import type { RiskFeature } from "./types";

/*
 * Textos de una entidad de gestión del riesgo: su título (también en el aviso
 * flotante, en HTML: pasa por escapeHtml) y sus datos para el panel de detalle.
 */

export function titleOf(style: RiskLayerStyle, feature: RiskFeature): string {
  const value = style.popup.titleField ? feature.properties[style.popup.titleField] : null;
  return value === null || value === undefined || value === "" ? style.popup.fallbackTitle : String(value);
}

/** Datos de una entidad para el panel de detalle, ya con formato; sin los vacíos. */
export function rowsOf(style: RiskLayerStyle, feature: RiskFeature): { label: string; value: string }[] {
  return style.popup.fields.flatMap((field) => {
    const value = formatValue(field, feature.properties[field.field]);
    return value === null ? [] : [{ label: field.label, value }];
  });
}

/** Valores que los formularios guardan cuando no hay dato. */
const EMPTY_VALUES = new Set(["", "NO APLICABLE", "N/A"]);

function formatValue(field: RiskPopupField, value: string | number | boolean | null | undefined): string | null {
  if (value === null || value === undefined || EMPTY_VALUES.has(String(value).trim().toUpperCase())) return null;
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
