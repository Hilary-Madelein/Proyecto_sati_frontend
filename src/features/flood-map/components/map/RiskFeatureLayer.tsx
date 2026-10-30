"use client";

import L from "leaflet";
import { useEffect, useEffectEvent, useRef } from "react";
import { GeoJSON, useMap, useMapEvents } from "react-leaflet";
import { MAP_PANES } from "../../constants";
import { identifyRiskFeatures, type RiskHit } from "../../risk-identify";
import { riskClassOf, riskColorOf, riskPointRadius, type RiskLayerStyle } from "../../risk-layers";
import { escapeHtml, tooltipOf } from "../../risk-popup";
import type { RiskFeature, RiskLayerData } from "../../types";
import { ClusteredRiskPoints } from "./ClusteredRiskPoints";

type RiskLayer = { style: RiskLayerStyle; data: RiskLayerData };

interface RiskFeatureLayersProps {
  /** Capas encendidas y con datos. */
  layers: readonly RiskLayer[];
  /** Lienzo compartido por todas las capas (así el clic llega a cualquiera, no solo a la de arriba). */
  renderer: L.Canvas;
  /** Entidades de todas las capas en el punto tocado (abre el panel de detalle). */
  onSelect: (hits: RiskHit[]) => void;
}

/**
 * Capas de gestión del riesgo en un solo lienzo: zonas al fondo, luego líneas y
 * puntos encima. Las de puntos marcadas con `cluster` se agrupan (ver
 * ClusteredRiskPoints). Al tocar una entidad se buscan todas las de las capas
 * encendidas en ese punto y se abre su detalle; el clic no llega al mapa (así no
 * dispara la búsqueda del río más cercano).
 */
export function RiskFeatureLayers({ layers, renderer, onSelect }: RiskFeatureLayersProps) {
  const map = useMap();
  const groups = useRef(new Map<string, L.GeoJSON>());

  // En un lienzo compartido manda el orden de dibujo, y cada capa nueva queda encima:
  // al cambiar las capas se vuelven a subir las líneas y luego los puntos.
  const reorder = useEffectEvent(() => {
    for (const geometry of ["line", "point"] as const) {
      for (const { style } of layers) if (style.geometry === geometry) groups.current.get(style.id)?.bringToFront();
    }
  });
  const drawn = layers.map(({ style, data }) => `${style.id}:${data.fetchedAt}:${data.view ?? ""}`).join("|");
  useEffect(() => reorder(), [drawn]);

  // Puntos más chicos con el mapa alejado: si no, a escala nacional se vuelven una mancha.
  useMapEvents({
    zoomend: () => {
      const radius = riskPointRadius(map.getZoom());
      for (const group of groups.current.values()) {
        group.eachLayer((layer) => {
          if (layer instanceof L.CircleMarker) layer.setRadius(radius);
        });
      }
    },
  });

  const keyOf = (style: RiskLayerStyle, data: RiskLayerData, feature: RiskFeature) =>
    `${style.id}:${feature.id ?? data.features.indexOf(feature)}`;

  const select = (style: RiskLayerStyle, data: RiskLayerData, feature: RiskFeature, latlng: L.LatLng) => {
    const hits = identifyRiskFeatures(layers, latlng, map);
    // Por si el margen de búsqueda no la alcanza (p. ej. el borde de una zona), la tocada siempre va.
    const key = keyOf(style, data, feature);
    onSelect(hits.some((hit) => hit.key === key) ? hits : [{ key, style, data, feature }, ...hits]);
  };

  return layers.map(({ style, data }) => {
    // Se vuelve a crear con cada descarga nueva o cambio de filtro (periodo).
    const key = `${style.id}:${data.fetchedAt}:${data.view ?? ""}`;
    if (style.cluster && style.geometry === "point") {
      return (
        <ClusteredRiskPoints
          key={key}
          style={style}
          data={data}
          renderer={renderer}
          onFeatureClick={(feature, latlng) => select(style, data, feature, latlng)}
          onStackClick={(features) => onSelect(features.map((feature) => ({ key: keyOf(style, data, feature), style, data, feature })))}
        />
      );
    }
    return (
      <GeoJSON
        // GeoJSON de react-leaflet no se actualiza solo: se recrea con la clave.
        key={key}
        ref={(group) => {
          if (group) groups.current.set(style.id, group);
          else groups.current.delete(style.id);
        }}
        data={drawOrder(style, data)}
        pane={MAP_PANES.risk.name}
        // El lienzo va en el estilo: GeoJSON lo aplica a cada línea o zona antes de agregarla al mapa.
        style={(feature) => ({ ...pathStyle(style, feature as unknown as RiskFeature), renderer })}
        pointToLayer={(feature, latlng) =>
          L.circleMarker(latlng, {
            pane: MAP_PANES.risk.name,
            renderer,
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
          layer.bindTooltip(escapeHtml(tooltipOf(style, item)), { direction: "top", sticky: style.geometry !== "point" });
        }}
        eventHandlers={{
          // El clic en una entidad llega a su capa con la entidad en `propagatedFrom`.
          click: (event) => {
            const feature = (event.propagatedFrom as { feature?: RiskFeature } | undefined)?.feature;
            if (feature) select(style, data, feature, event.latlng);
          },
        }}
      />
    );
  });
}

/** Las entidades punteadas (las que no cuentan) se dibujan primero: si una coincide con otra, queda encima la que cuenta. */
function drawOrder(style: RiskLayerStyle, data: RiskLayerData): GeoJSON.FeatureCollection {
  const dashed = (feature: RiskFeature) => riskClassOf(style, feature)?.dashed === true;
  const features = [...data.features.filter(dashed), ...data.features.filter((feature) => !dashed(feature))];
  return { ...data, features } as unknown as GeoJSON.FeatureCollection;
}

function pathStyle(style: RiskLayerStyle, feature: RiskFeature): L.PathOptions {
  const color = riskColorOf(style, feature);
  if (style.geometry === "line") {
    return riskClassOf(style, feature)?.dashed
      ? { color, weight: 2.5, opacity: 0.8, dashArray: "4 6", bubblingMouseEvents: false }
      : { color, weight: 3, opacity: 0.9, bubblingMouseEvents: false };
  }
  return { color, weight: 1, opacity: 0.8, fillColor: color, fillOpacity: 0.35, bubblingMouseEvents: false };
}
