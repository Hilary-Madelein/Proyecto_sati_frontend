"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { MAP_CONFIG } from "../../constants";
import type { LatLng } from "../../types";

interface MapFocusProps {
  target: LatLng | null;
  /** Cambia en cada solicitud, para volver a centrar aunque el objetivo sea el mismo. */
  request: number;
}

/** Centra el mapa con animación en el objetivo cada vez que llega una solicitud. */
export function MapFocus({ target, request }: MapFocusProps) {
  const map = useMap();

  useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), MAP_CONFIG.focusZoom), { duration: 1.2 });
  }, [map, target, request]);

  return null;
}
