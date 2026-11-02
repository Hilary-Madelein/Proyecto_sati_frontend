import { formatCalendarDate, formatDateTime, formatDayMonth } from "@/lib/format";
import { placeName } from "./action-timeline";
import type { RiskLayerStyle, RiskPopupField } from "./risk-layers";
import type { RiskFeature } from "./types";

/*
 * Textos de una entidad de gestión del riesgo: su título (también en el aviso
 * flotante, en HTML: pasa por escapeHtml) y sus datos para el panel de detalle.
 */

const EMPTY_VALUES = new Set(["", "NO APLICABLE", "N/A", "NA"]);

/** El texto de un campo, o null si está vacío o dice que no aplica (el formulario admite "NA"). */
export function textOf(feature: RiskFeature, field: string): string | null {
  const value = feature.properties[field];
  if (value === null || value === undefined || EMPTY_VALUES.has(String(value).trim().toUpperCase())) return null;
  return String(value).trim();
}

export function titleOf(style: RiskLayerStyle, feature: RiskFeature): string {
  const { titleField, titleFallbackFields = [], fallbackTitle } = style.popup;
  for (const field of [titleField, ...titleFallbackFields]) {
    const value = field ? textOf(feature, field) : null;
    if (value) return value;
  }
  return fallbackTitle;
}

/** Largo máximo del título en el aviso flotante: el texto completo está en el panel de detalle. */
const TOOLTIP_MAX_CHARS = 80;

/** El texto cortado en la última palabra que entra, con "…". */
function shorten(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.\-–]+$/, "")}…`;
}

/** Campos de cantón y de provincia, según cómo los llama cada capa. */
const CANTON_FIELDS = ["descanto", "CANTON", "Canton", "canton"];
const PROVINCE_FIELDS = ["despro", "PROVINCIA", "Provincia", "provincia"];

/** "Cotacachi, Imbabura", si la entidad lo trae. */
export function placeOf(feature: RiskFeature): string | null {
  const place = [CANTON_FIELDS, PROVINCE_FIELDS].flatMap((fields) => fields.map((field) => textOf(feature, field)).find(Boolean) ?? []);
  return place.length > 0 ? place.map(placeName).join(", ") : null;
}

/**
 * Texto del aviso al pasar el mouse, en líneas (ver `.risk-tooltip`): el título,
 * corto, con el código de la vía delante ("E35 · Tramo …"), y debajo el lugar. El
 * código es el de la propia línea (labelField, p. ej. la RVE, o CODIGO_DE_VIA de los
 * proyectos viales) o el de la vía más cercana que calcula el backend para los
 * puntos (Via_RVE). Una capa puede agregar líneas encima (tooltipHeader).
 */
export function tooltipOf(style: RiskLayerStyle, feature: RiskFeature): string {
  const { properties } = feature;
  const code = [style.labelField ? properties[style.labelField] : null, properties.Via_RVE, properties.CODIGO_DE_VIA].find(
    (value): value is string => typeof value === "string" && value.trim() !== "",
  );
  const title = shorten(titleOf(style, feature), TOOLTIP_MAX_CHARS);
  return [style.tooltipHeader?.(feature), code ? `${code.trim()} · ${title}` : title, placeOf(feature)].filter(Boolean).join("\n");
}

/** Datos de una entidad para el panel de detalle, ya con formato; sin los vacíos. */
export function rowsOf(style: RiskLayerStyle, feature: RiskFeature): { label: string; value: string; section?: string }[] {
  return style.popup.fields.flatMap((field) => {
    const value = formatValue(field, feature.properties[field.field]);
    return value === null ? [] : [{ label: field.label, value, section: field.section }];
  });
}

/**
 * Las filas de la ficha agrupadas por su sección (las seguidas con la misma
 * sección van juntas); las secciones sin ningún dato no aparecen. Sin secciones,
 * un solo grupo sin título.
 */
export function sectionsOf(style: RiskLayerStyle, feature: RiskFeature): { title: string | null; rows: { label: string; value: string }[] }[] {
  const groups: { title: string | null; rows: { label: string; value: string }[] }[] = [];
  for (const { section, ...row } of rowsOf(style, feature)) {
    const last = groups.at(-1);
    if (last && last.title === (section ?? null)) last.rows.push(row);
    else groups.push({ title: section ?? null, rows: [row] });
  }
  return groups;
}

/** Valores que los formularios guardan cuando no hay dato. */

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
  if (field.format === "datetime" && !Number.isNaN(Date.parse(text))) return formatDateTime(text);
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
