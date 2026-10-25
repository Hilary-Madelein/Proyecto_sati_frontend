"use client";

import L from "leaflet";
import { useRef } from "react";
import { GeoJSON, useMap, useMapEvents } from "react-leaflet";
import { MAP_PANES } from "../../constants";
import { riskColorOf, riskPointRadius, type RiskLayerStyle } from "../../risk-layers";
import { escapeHtml, popupHtml, titleOf } from "../../risk-popup";
import type { RiskFeature, RiskLayerData } from "../../types";
import { ClusteredRiskPoints } from "./ClusteredRiskPoints";

const PANE_BY_GEOMETRY = {
  area: MAP_PANES.riskAreas.name,
  line: MAP_PANES.riskLines.name,
  point: MAP_PANES.riskPoints.name,
} as const;

/**
 * Una capa de gestión del riesgo (puntos, líneas o polígonos), coloreada según
 * su clase. Las de puntos marcadas con `cluster` se agrupan (ver
 * ClusteredRiskPoints). Al tocar una entidad se abre un popup con sus datos; el
 * clic no llega al mapa (así no dispara la búsqueda del río más cercano).
 */
export function RiskFeatureLayer({ style, data }: { style: RiskLayerStyle; data: RiskLayerData }) {
  if (style.cluster && style.geometry === "point") return <ClusteredRiskPoints style={style} data={data} />;
  return <PlainRiskLayer style={style} data={data} />;
}

function PlainRiskLayer({ style, data }: { style: RiskLayerStyle; data: RiskLayerData }) {
  const pane = PANE_BY_GEOMETRY[style.geometry];
  const map = useMap();
  const layerRef = useRef<L.GeoJSON>(null);

  // Puntos más chicos con el mapa alejado: si no, a escala nacional se vuelven una mancha.
  useMapEvents({
    zoomend: () => {
      const radius = riskPointRadius(map.getZoom());
      layerRef.current?.eachLayer((layer) => {
        if (layer instanceof L.CircleMarker) layer.setRadius(radius);
      });
    },
  });

  return (
    <GeoJSON
      ref={layerRef}
      // Se vuelve a crear cuando llega una descarga nueva (GeoJSON de react-leaflet no se actualiza solo).
      key={`${style.id}:${data.fetchedAt}`}
      data={data as unknown as GeoJSON.FeatureCollection}
      pane={pane}
      style={(feature) => pathStyle(style, feature as unknown as RiskFeature)}
      pointToLayer={(feature, latlng) =>
        L.circleMarker(latlng, {
          pane,
          radius: riskPointRadius(map.getZoom()),
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
