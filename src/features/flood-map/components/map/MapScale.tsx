"use client";

import L from "leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";

/**
 * Escala gráfica del mapa (en km o m), abajo a la derecha. Es un control de Leaflet
 * sin `data-capture-ignore`: también sale en la imagen descargada.
 */
export function MapScale() {
  const map = useMap();
  useEffect(() => {
    const scale = L.control.scale({ position: "bottomright", imperial: false, maxWidth: 140 }).addTo(map);
    return () => {
      scale.remove();
    };
  }, [map]);
  return null;
}
