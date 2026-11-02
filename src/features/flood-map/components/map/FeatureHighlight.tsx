"use client";

import L from "leaflet";
import { useEffect, useEffectEvent, useRef } from "react";
import { GeoJSON, Pane, useMap } from "react-leaflet";
import { MAP_CONFIG } from "../../constants";
import type { RiskHit } from "../../risk-identify";
import { freeMapArea, isInFreeArea, isUsable } from "./free-map-area";

const HIGHLIGHT = { color: "#facc15", weight: 4, opacity: 1, fill: false } as const;
const PANE = "featureHighlight";
/** Margen entre la entidad y el borde de la zona libre, en píxeles. */
const FREE_AREA_MARGIN_PX = 48;
/** Radio del resaltado de un punto: con menos margen que esto, ya no se vería completo. */
const HIGHLIGHT_RADIUS_PX = 11;

interface FeatureHighlightProps {
  hit: RiskHit;
  /** Se incrementa al pedir que se acerque (al elegirla en una lista). */
  zoomRequest: number;
}

/** Resalta en el mapa la entidad abierta en el panel de detalle y la acerca cuando se pide. */
export function FeatureHighlight({ hit, zoomRequest }: FeatureHighlightProps) {
  const map = useMap();
  const geometry = hit.feature.geometry;

  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  // Lo último que se atendió: un cambio de selección y un pedido de acercar llegan por separado.
  const last = useRef<{ request: number; key: string | null }>({ request: 0, key: null });

  /** Los márgenes que dejan a la entidad en la zona que no tapan los paneles. */
  const freePadding = () => {
    const free = freeMapArea(map);
    const size = map.getSize();
    return {
      free,
      paddingTopLeft: L.point(free.left + FREE_AREA_MARGIN_PX, FREE_AREA_MARGIN_PX),
      paddingBottomRight: L.point(size.x - free.right + FREE_AREA_MARGIN_PX, size.y - free.bottom + FREE_AREA_MARGIN_PX),
    };
  };

  const boundsOfGeometry = () => {
    const bounds = geometry ? L.geoJSON(geometry).getBounds() : null;
    return bounds?.isValid() ? bounds : null;
  };

  /** Vuela hasta dejar el punto en el centro de la zona libre, no en el del mapa. */
  const flyIntoFreeArea = (point: L.LatLng, zoom: number) => {
    const { free } = freePadding();
    const size = map.getSize();
    const offset = L.point((free.left + free.right - size.x) / 2, (free.bottom - size.y) / 2);
    map.flyTo(map.unproject(map.project(point, zoom).subtract(offset), zoom), zoom);
  };

  const zoomTo = useEffectEvent(() => {
    const bounds = boundsOfGeometry();
    if (!bounds) return;
    if (geometry?.type === "Point") {
      flyIntoFreeArea(bounds.getCenter(), Math.max(map.getZoom(), 15));
      return;
    }
    const { paddingTopLeft, paddingBottomRight } = freePadding();
    map.flyToBounds(bounds, { paddingTopLeft, paddingBottomRight, maxZoom: 16 });
  });

  // Sin acercar (se tocó en el mapa): si el panel que se abre lo fuera a tapar, se mueve lo
  // justo. Si los límites del mapa no lo dejan (a escala nacional), se acerca hasta que se vea.
  const keepInView = useEffectEvent(() => {
    const bounds = boundsOfGeometry();
    if (!bounds || geometry?.type !== "Point") return;
    const point = bounds.getCenter();
    const { free, paddingTopLeft, paddingBottomRight } = freePadding();
    if (!isUsable(free) || isInFreeArea(map.latLngToContainerPoint(point), free, FREE_AREA_MARGIN_PX)) return;
    const key = hit.key;
    map.once("moveend", () => {
      if (mounted.current && last.current.key === key && !isInFreeArea(map.latLngToContainerPoint(point), free, HIGHLIGHT_RADIUS_PX)) {
        flyIntoFreeArea(point, Math.max(map.getZoom(), MAP_CONFIG.focusZoom));
      }
    });
    map.panInside(point, { paddingTopLeft, paddingBottomRight });
  });

  useEffect(() => {
    const { request, key } = last.current;
    last.current = { request: zoomRequest, key: hit.key };
    if (zoomRequest !== request) zoomTo();
    else if (hit.key !== key) keepInView();
  }, [zoomRequest, hit.key]);

  if (!geometry) return null;
  return (
    // Sin capturar clics: su lienzo cubre todo el mapa y taparía a las capas de abajo.
    <Pane name={PANE} style={{ zIndex: 630, pointerEvents: "none" }}>
      <GeoJSON
        key={hit.key}
        data={geometry}
        style={() => ({ ...HIGHLIGHT, weight: hit.style.geometry === "line" ? 7 : 4, opacity: hit.style.geometry === "line" ? 0.8 : 1 })}
        // Con su pane explícito: sin él iría al de Leaflet por defecto, y ese lienzo (que cubre
        // todo el mapa, encima de las capas de riesgo) se quedaría con todos los clics.
        pointToLayer={(_, latlng) => L.circleMarker(latlng, { ...HIGHLIGHT, pane: PANE, radius: 11, interactive: false })}
        interactive={false}
      />
    </Pane>
  );
}
