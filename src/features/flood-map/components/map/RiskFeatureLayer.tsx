"use client";

import L from "leaflet";
import { GeoJSON } from "react-leaflet";
import { formatCalendarDate, formatDayMonth } from "@/lib/format";
import { MAP_PANES } from "../../constants";
import { riskColorOf, type RiskLayerStyle, type RiskPopupField } from "../../risk-layers";
import type { RiskFeature, RiskLayerData } from "../../types";

const PANE_BY_GEOMETRY = {
  area: MAP_PANES.riskAreas.name,
  line: MAP_PANES.riskLines.name,
  point: MAP_PANES.riskPoints.name,
} as const;

/**
 * Una capa de gestión del riesgo (puntos, líneas o polígonos), coloreada según
 * su clase. Al tocar una entidad se abre un popup con sus datos; el clic no
 * llega al mapa (así no dispara la búsqueda del río más cercano).
 */
export function RiskFeatureLayer({ style, data }: { style: RiskLayerStyle; data: RiskLayerData }) {
  const pane = PANE_BY_GEOMETRY[style.geometry];
  return (
    <GeoJSON
      // Se vuelve a crear cuando llega una descarga nueva (GeoJSON de react-leaflet no se actualiza solo).
      key={`${style.id}:${data.fetchedAt}`}
      data={data as unknown as GeoJSON.FeatureCollection}
      pane={pane}
      style={(feature) => pathStyle(style, feature as unknown as RiskFeature)}
      pointToLayer={(feature, latlng) =>
        L.circleMarker(latlng, {
          pane,
          radius: 5,
          color: "#ffffff",
          weight: 1,
          fillColor: riskColorOf(style, feature as unknown as RiskFeature),
          fillOpacity: 0.95,
          bubblingMouseEvents: false,
        })
      }
      onEachFeature={(feature, layer) => {
        const item = feature as unknown as RiskFeature;
        layer.bindTooltip(escapeHtml(titleOf(style, item)), { direction: "top", sticky: style.geometry !== "point" });
        layer.bindPopup(() => popupHtml(style, item, data.attribution), { maxWidth: 280, autoPanPadding: [16, 16] });
      }}
    />
  );
}

function pathStyle(style: RiskLayerStyle, feature: RiskFeature): L.PathOptions {
  const color = riskColorOf(style, feature);
  if (style.geometry === "line") return { color, weight: 3, opacity: 0.9, bubblingMouseEvents: false };
  return { color, weight: 1, opacity: 0.8, fillColor: color, fillOpacity: 0.35, bubblingMouseEvents: false };
}

function titleOf(style: RiskLayerStyle, feature: RiskFeature): string {
  const value = style.popup.titleField ? feature.properties[style.popup.titleField] : null;
  return value === null || value === undefined || value === "" ? style.popup.fallbackTitle : String(value);
}

function popupHtml(style: RiskLayerStyle, feature: RiskFeature, attribution: string): string {
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

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}
