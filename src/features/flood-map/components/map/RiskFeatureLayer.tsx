"use client";

import L from "leaflet";
import { useEffect, useEffectEvent, useLayoutEffect, useRef } from "react";
import { GeoJSON, useMap, useMapEvents } from "react-leaflet";
import { MAP_PANES } from "../../constants";
import { identifyRiskFeatures, type RiskHit } from "../../risk-identify";
import { riskClassOf, riskColorOf, riskPointRadius, type RiskLayerStyle } from "../../risk-layers";
import { escapeHtml, tooltipOf } from "../../risk-popup";
import type { RiskFeature, RiskLayerData } from "../../types";
import { ClusteredRiskPoints } from "./ClusteredRiskPoints";

/** `opacity` (0 a 1) multiplica la de su estilo; por defecto, 1. */
type RiskLayer = { style: RiskLayerStyle; data: RiskLayerData; opacity?: number };

/** Punto cuadrado en el lienzo: se comporta como un círculo (radio, clic) pero se dibuja como cuadrado. */
const SquareMarker = L.CircleMarker.extend({
  _updatePath(this: L.CircleMarker & { _renderer: L.Canvas & Record<string, never>; _point: L.Point; _radius: number; _empty: () => boolean }) {
    const renderer = this._renderer as unknown as { _drawing: boolean; _ctx: CanvasRenderingContext2D; _fillStroke: (ctx: CanvasRenderingContext2D, layer: unknown) => void };
    if (!renderer._drawing || this._empty()) return;
    const { x, y } = this._point;
    const size = this._radius * 0.9;
    renderer._ctx.beginPath();
    renderer._ctx.rect(x - size, y - size, size * 2, size * 2);
    renderer._fillStroke(renderer._ctx, this);
  },
}) as unknown as new (latlng: L.LatLngExpression, options: L.CircleMarkerOptions) => L.CircleMarker;

/** Punto en rombo: se toca como un círculo, pero se dibuja como un cuadrado girado 45° con borde blanco. */
const DiamondMarker = L.CircleMarker.extend({
  _updatePath(this: L.CircleMarker & { _renderer: unknown; _point: L.Point; _radius: number; _empty: () => boolean }) {
    const renderer = this._renderer as unknown as { _drawing: boolean; _ctx: CanvasRenderingContext2D; _fillStroke: (ctx: CanvasRenderingContext2D, layer: unknown) => void };
    if (!renderer._drawing || this._empty()) return;
    const { x, y } = this._point;
    // Un poco más alto que el radio: el rombo ocupa menos área que un círculo del mismo ancho.
    const size = this._radius * 1.25;
    const ctx = renderer._ctx;
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x - size, y);
    ctx.closePath();
    renderer._fillStroke(ctx, this);
  },
}) as unknown as new (latlng: L.LatLngExpression, options: L.CircleMarkerOptions) => L.CircleMarker;

interface RiskFeatureLayersProps {
  /** Capas encendidas y con datos. */
  layers: readonly RiskLayer[];
  /** Lienzo compartido por todas las capas (así el clic llega a cualquiera, no solo a la de arriba). */
  renderer: L.Canvas;
  /** Entidades de todas las capas en el punto tocado (abre el panel de detalle). */
  onSelect: (hits: RiskHit[]) => void;
}

/**
 * Pane fijo (vacío si no hay capas) con el lienzo compartido de las capas de
 * gestión del riesgo. Se crea una vez y no se quita, a diferencia de <Pane>: este
 * lo borra y lo vuelve a crear con el doble montaje de StrictMode (en desarrollo),
 * y el lienzo, si ya estaba en uso, se queda en el pane borrado y con él todas las
 * capas. Se crea antes de que las capas se agreguen al mapa (en useEffect).
 */
export function RiskPane() {
  const map = useMap();
  useLayoutEffect(() => {
    if (!map.getPane(MAP_PANES.risk.name)) map.createPane(MAP_PANES.risk.name).style.zIndex = String(MAP_PANES.risk.zIndex);
  }, [map]);
  return null;
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
      for (const [id, group] of groups.current) {
        const scale = layers.find(({ style }) => style.id === id)?.style.pointScale ?? 1;
        group.eachLayer((layer) => {
          if (layer instanceof L.CircleMarker) layer.setRadius(radius * scale);
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

  return layers.map(({ style, data, opacity = 1 }) => {
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
        style={(feature) => ({ ...pathStyle(style, feature as unknown as RiskFeature, opacity), renderer })}
        pointToLayer={(feature, latlng) =>
          new (style.pointShape === "square" ? SquareMarker : style.pointShape === "diamond" ? DiamondMarker : L.CircleMarker)(latlng, {
            pane: MAP_PANES.risk.name,
            renderer,
            radius: riskPointRadius(map.getZoom()) * (style.pointScale ?? 1),
            color: "#ffffff",
            weight: style.pointScale ? 1.5 : 1,
            fillColor: riskColorOf(style, feature as unknown as RiskFeature),
            opacity,
            fillOpacity: 0.95 * opacity,
            bubblingMouseEvents: false,
          })
        }
        onEachFeature={(feature, layer) => {
          const item = feature as unknown as RiskFeature;
          layer.bindTooltip(escapeHtml(tooltipOf(style, item)), { className: "risk-tooltip", direction: "top", sticky: style.geometry !== "point" });
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

function pathStyle(style: RiskLayerStyle, feature: RiskFeature, opacity = 1): L.PathOptions {
  const color = riskColorOf(style, feature);
  if (style.geometry === "line") {
    return riskClassOf(style, feature)?.dashed
      ? { color, weight: 2.5, opacity: 0.9 * opacity, dashArray: "4 6", bubblingMouseEvents: false }
      : { color, weight: 3, opacity, bubblingMouseEvents: false };
  }
  // Puntos: relleno sólido con borde blanco, como se crean en pointToLayer (GeoJSON aplica este estilo también a ellos,
  // y con el de las zonas se veían pálidos).
  if (style.geometry === "point") {
    return { color: "#ffffff", weight: style.pointScale ? 1.5 : 1, opacity, fillColor: color, fillOpacity: 0.95 * opacity, bubblingMouseEvents: false };
  }
  return { color, weight: 1, opacity: 0.9 * opacity, fillColor: color, fillOpacity: 0.5 * opacity, bubblingMouseEvents: false };
}
