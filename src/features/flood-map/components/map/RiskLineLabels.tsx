"use client";

import L from "leaflet";
import { useMemo, useState } from "react";
import { Marker, Pane, useMap, useMapEvents } from "react-leaflet";
import type { RiskLayerStyle } from "../../risk-layers";
import type { RiskLayerData } from "../../types";

const PANE = "riskLineLabels";
/** Desde este zoom se escriben los letreros (más lejos se amontonan). */
const MIN_ZOOM = 8;
/** Separación mínima en pantalla entre dos letreros cualesquiera y entre dos del mismo código (px). */
const MIN_GAP_PX = 48;
const SAME_TEXT_GAP_PX = 220;

interface Candidate {
  text: string;
  latlng: L.LatLngExpression;
  /** Vértices del tramo: los tramos largos tienen prioridad para llevar el letrero. */
  weight: number;
}

const iconCache = new Map<string, L.DivIcon>();

/** Letrero tipo señal vial con el código. */
function labelIcon(text: string): L.DivIcon {
  let icon = iconCache.get(text);
  if (!icon) {
    icon = L.divIcon({
      className: "",
      html: `<span class="block -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded border border-slate-500 bg-white px-1 text-[10px] leading-4 font-bold text-slate-800 shadow-sm">${text.replace(/[<>&"]/g, "")}</span>`,
      iconSize: [0, 0],
    });
    iconCache.set(text, icon);
  }
  return icon;
}

/** Un punto de cada tramo para el letrero: el vértice del medio de su parte más larga. */
function candidatesOf(style: RiskLayerStyle, data: RiskLayerData): Candidate[] {
  const field = style.labelField;
  if (!field) return [];
  return data.features.flatMap((feature) => {
    const text = String(feature.properties[field] ?? "").trim();
    const geometry = feature.geometry as { type: string; coordinates: unknown } | null;
    if (!text || !geometry) return [];
    const paths =
      geometry.type === "LineString"
        ? [geometry.coordinates as number[][]]
        : geometry.type === "MultiLineString"
          ? (geometry.coordinates as number[][][])
          : [];
    const path = paths.reduce<number[][]>((longest, current) => (current.length > longest.length ? current : longest), []);
    const middle = path[Math.floor(path.length / 2)];
    return middle ? [{ text, latlng: [middle[1], middle[0]] as [number, number], weight: path.length }] : [];
  });
}

/**
 * Códigos escritos sobre las líneas de las capas que los piden (p. ej. "E35" en
 * la Red Vial Estatal), al acercarse. Para que no se amontonen, se descarta el
 * letrero que caería muy cerca de otro, y el mismo código se repite solo cada
 * cierto tramo; los tramos largos tienen prioridad. No capturan clics.
 */
export function RiskLineLabels({ layers }: { layers: ReadonlyArray<{ style: RiskLayerStyle; data: RiskLayerData }> }) {
  const map = useMap();
  // Se recalcula al terminar de mover o acercar el mapa.
  const [, setView] = useState(0);
  useMapEvents({ moveend: () => setView((value) => value + 1), zoomend: () => setView((value) => value + 1) });

  const candidates = useMemo(
    () =>
      layers
        .filter(({ style }) => style.labelField && style.geometry === "line")
        .flatMap(({ style, data }) => candidatesOf(style, data))
        .sort((a, b) => b.weight - a.weight),
    [layers],
  );

  if (candidates.length === 0 || map.getZoom() < MIN_ZOOM) return null;
  const bounds = map.getBounds().pad(0.1);
  const placed: Array<{ text: string; point: L.Point; latlng: L.LatLngExpression }> = [];
  for (const candidate of candidates) {
    if (!bounds.contains(candidate.latlng)) continue;
    const point = map.latLngToContainerPoint(candidate.latlng);
    const crowded = placed.some(
      (other) => other.point.distanceTo(point) < (other.text === candidate.text ? SAME_TEXT_GAP_PX : MIN_GAP_PX),
    );
    if (!crowded) placed.push({ text: candidate.text, point, latlng: candidate.latlng });
  }

  return (
    // Encima de las capas y debajo de los marcadores y etiquetas; sin capturar clics.
    <Pane name={PANE} style={{ zIndex: 455, pointerEvents: "none" }}>
      {placed.map((label, index) => (
        <Marker key={`${label.text}:${index}`} position={label.latlng} icon={labelIcon(label.text)} interactive={false} keyboard={false} />
      ))}
    </Pane>
  );
}
