"use client";

import L from "leaflet";
import { useMemo, useState } from "react";
import { CircleMarker, Marker, Tooltip, useMap, useMapEvents } from "react-leaflet";
import Supercluster, { type ClusterFeature, type PointFeature } from "supercluster";
import { MAP_PANES } from "../../constants";
import { riskClassOf, riskColorOf, riskPointRadius, type RiskLayerStyle } from "../../risk-layers";
import { titleOf } from "../../risk-popup";
import type { RiskFeature, RiskLayerData } from "../../types";

/** Hasta este zoom se agrupa; desde el siguiente (escala de ciudad) se ven todos los puntos sueltos. */
const CLUSTER_MAX_ZOOM = 10;
/** Distancia en píxeles dentro de la que los puntos se juntan en un grupo. */
const CLUSTER_RADIUS_PX = 60;
/**
 * Con el zoom de ciudad, los puntos a menos de esta distancia se tapan entre sí
 * (p. ej. 68 máquinas a ~20 m en la base de Portoviejo): se juntan en una pila.
 */
const STACK_RADIUS_PX = 14;
/** Más allá del zoom máximo del mapa: los que coinciden siguen juntos a cualquier zoom. */
const STACK_MAX_ZOOM = 20;

interface PointProps {
  /** Posición de la entidad en data.features. */
  index: number;
  /** Clase de la leyenda (posición en classify.classes); la última posición es "otro". */
  classIndex: number;
}

interface ClusterProps {
  /** Cuántos puntos de cada clase tiene el grupo (mismo orden que las clases, "otro" al final). */
  counts: number[];
}

interface ClusteredRiskPointsProps {
  style: RiskLayerStyle;
  data: RiskLayerData;
  /** Lienzo compartido por las capas de gestión del riesgo. */
  renderer: L.Canvas;
  /** Se tocó un punto suelto (abre su detalle con lo que haya en ese punto). */
  onFeatureClick: (feature: RiskFeature, latlng: L.LatLng) => void;
  /** Se tocó una pila de puntos en el mismo sitio (abre el detalle con todos, "1 de N"). */
  onStackClick: (features: RiskFeature[]) => void;
}

interface View {
  bbox: [number, number, number, number];
  zoom: number;
}

/**
 * Puntos agrupados: a escala nacional o regional cada grupo es un círculo con
 * el total y un anillo con la proporción de cada clase de la leyenda (así el
 * número no esconde, p. ej., cuánta maquinaria está parada). Al tocarlo, el
 * mapa se acerca hasta separarlo. Desde el zoom de ciudad se ven los puntos
 * sueltos; los que quedan uno encima de otro (p. ej. la maquinaria de una
 * base) se muestran como una pila: al tocarla, el panel de detalle los recorre uno a uno.
 */
export function ClusteredRiskPoints({ style, data, renderer, onFeatureClick, onStackClick }: ClusteredRiskPointsProps) {
  const map = useMap();
  const [view, setView] = useState(() => viewOf(map));
  useMapEvents({ moveend: () => setView(viewOf(map)) });

  const colors = useMemo(() => [...(style.classify?.classes ?? []).map((item) => item.color), style.color], [style]);

  // Dos índices: grupos regionales hasta CLUSTER_MAX_ZOOM y, después, pilas de puntos que se tapan.
  const { groups, piles } = useMemo(() => {
    const classes = style.classify?.classes ?? [];
    const otherIndex = classes.length;
    const points = data.features.flatMap((feature, featureIndex) => {
      if (feature.geometry?.type !== "Point") return [];
      const match = riskClassOf(style, feature);
      const classIndex = match ? classes.indexOf(match) : otherIndex;
      return [{ type: "Feature" as const, geometry: feature.geometry, properties: { index: featureIndex, classIndex } }];
    });
    const build = (radius: number, maxZoom: number) =>
      new Supercluster<PointProps, ClusterProps>({
        radius,
        maxZoom,
        map: (props) => ({ counts: Array.from({ length: otherIndex + 1 }, (_, i) => (i === props.classIndex ? 1 : 0)) }),
        // Se crea una lista nueva: supercluster copia las propiedades del grupo de forma superficial,
        // así que sumar sobre la misma lista inflaría los conteos de los grupos de otros zooms.
        reduce: (accumulated, props) => {
          accumulated.counts = accumulated.counts.map((count, i) => count + props.counts[i]);
        },
      }).load(points);
    return { groups: build(CLUSTER_RADIUS_PX, CLUSTER_MAX_ZOOM), piles: build(STACK_RADIUS_PX, STACK_MAX_ZOOM) };
  }, [data, style]);

  const stacking = view.zoom > CLUSTER_MAX_ZOOM;
  const index = stacking ? piles : groups;
  const items = index.getClusters(view.bbox, view.zoom);
  const clusters = items.filter((item) => "cluster" in item.properties && item.properties.cluster) as ClusterFeature<ClusterProps>[];
  const singles = items.filter((item) => !("cluster" in item.properties)) as PointFeature<PointProps>[];

  return (
    <>
      {clusters.map((cluster) => {
        const [lng, lat] = cluster.geometry.coordinates;
        const { cluster_id: clusterId, point_count: count, counts } = cluster.properties;
        if (stacking) {
          const features = index.getLeaves(clusterId, Infinity).map((leaf) => data.features[leaf.properties.index]);
          return (
            <Marker
              key={`s${clusterId}`}
              position={[lat, lng]}
              icon={clusterIcon(counts, colors, count)}
              eventHandlers={{ click: () => onStackClick(features) }}
            >
              <Tooltip direction="top" offset={[0, -12]}>
                <span className="text-xs">
                  <strong>{count}</strong> en el mismo sitio · clic para ver cada uno
                </span>
              </Tooltip>
            </Marker>
          );
        }
        return (
          <Marker
            key={`c${clusterId}`}
            position={[lat, lng]}
            icon={clusterIcon(counts, colors, count)}
            eventHandlers={{
              click: () => map.flyTo([lat, lng], Math.min(index.getClusterExpansionZoom(clusterId), CLUSTER_MAX_ZOOM + 1)),
            }}
          >
            <Tooltip direction="top" offset={[0, -12]}>
              <span className="text-xs">
                <strong>{count.toLocaleString("es-EC")}</strong> · {style.title.toLowerCase()}
                <br />
                <span className="text-slate-500">Clic para acercar</span>
              </span>
            </Tooltip>
          </Marker>
        );
      })}
      {singles.map((point) => {
        const [lng, lat] = point.geometry.coordinates;
        const feature = data.features[point.properties.index];
        return (
          <CircleMarker
            key={`p${point.properties.index}`}
            center={[lat, lng]}
            pane={MAP_PANES.risk.name}
            renderer={renderer}
            radius={riskPointRadius(view.zoom)}
            pathOptions={{ color: "#ffffff", weight: 1, fillColor: riskColorOf(style, feature), fillOpacity: 0.95 }}
            bubblingMouseEvents={false}
            eventHandlers={{ click: (event) => onFeatureClick(feature, event.latlng) }}
          >
            <Tooltip direction="top">{titleOf(style, feature)}</Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}

function viewOf(map: L.Map): View {
  const bounds = map.getBounds().pad(0.25);
  return {
    bbox: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
    zoom: Math.round(map.getZoom()),
  };
}

const iconCache = new Map<string, L.DivIcon>();

/** Círculo blanco con el total y un anillo con la proporción de cada clase. */
function clusterIcon(counts: readonly number[], colors: readonly string[], total: number): L.DivIcon {
  const key = `${counts.join(",")}|${colors.join(",")}`;
  let icon = iconCache.get(key);
  if (!icon) {
    const size = total < 10 ? 30 : total < 100 ? 36 : total < 1000 ? 42 : 48;
    icon = L.divIcon({
      className: "map-symbol-marker",
      html: clusterSvg(counts, colors, total, size),
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

function clusterSvg(counts: readonly number[], colors: readonly string[], total: number, size: number): string {
  const ring = 5;
  const radius = size / 2 - ring / 2 - 1;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  let offset = 0;
  const arcs = counts
    .map((count, i) => {
      if (count === 0) return "";
      const length = (count / total) * circumference;
      const arc = `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${colors[i]}" stroke-width="${ring}" stroke-dasharray="${length} ${circumference - length}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${center} ${center})"/>`;
      offset += length;
      return arc;
    })
    .join("");
  const label = total >= 1000 ? `${(total / 1000).toFixed(1).replace(".", ",")}k` : String(total);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true" style="filter:drop-shadow(0 1px 2px rgb(0 0 0 / 0.35))"><circle cx="${center}" cy="${center}" r="${radius + ring / 2}" fill="#ffffff"/>${arcs}<text x="${center}" y="${center}" dy="0.35em" text-anchor="middle" font-size="${size < 36 ? 11 : 12}" font-weight="700" fill="#0f172a" font-family="system-ui, sans-serif">${label}</text></svg>`;
}
