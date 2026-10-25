"use client";

import { useEffect, useState } from "react";
import { GeoJSON, Pane, useMap, useMapEvents } from "react-leaflet";
import { MAP_PANES, PROVINCE_BOUNDARIES_URL } from "../../constants";

interface ProvinceBoundariesProps {
  /** Se dibujan hasta este zoom: más cerca, el mapa base trae sus propias divisiones. */
  maxZoom: number;
}

/**
 * Límites de las provincias (INEC) donde el mapa base no los dibuja (p. ej. el
 * gris claro con todo el Ecuador a la vista): líneas finas, encima de la lluvia
 * y debajo de los puntos, sin capturar clics.
 */
export function ProvinceBoundaries({ maxZoom }: ProvinceBoundariesProps) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(PROVINCE_BOUNDARIES_URL, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<GeoJSON.FeatureCollection>) : null))
      .then(setData)
      // Sin límites el mapa sigue funcionando: no se avisa.
      .catch(() => {});
    return () => controller.abort();
  }, []);

  if (!data || zoom > maxZoom) return null;
  return (
    // Sin capturar clics: su lienzo cubre todo el mapa y taparía a las capas de abajo.
    <Pane name={MAP_PANES.provinces.name} style={{ zIndex: MAP_PANES.provinces.zIndex, pointerEvents: "none" }}>
      <GeoJSON data={data} interactive={false} style={{ color: "#64748b", weight: 1.2, opacity: 0.7, fill: false }} />
    </Pane>
  );
}
