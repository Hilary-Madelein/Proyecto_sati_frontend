"use client";

import { useEffect, useEffectEvent } from "react";
import { useMap } from "react-leaflet";
import { MAP_CONFIG } from "../../constants";
import type { LatLng } from "../../types";

interface MapFocusProps {
  target: LatLng | null;
  /** Cambia en cada solicitud, para volver a centrar aunque el objetivo sea el mismo. */
  request: number;
}

/** Píxeles máximos que el objetivo queda bajo el centro del mapa. */
const MAX_OFFSET_PX = 200;

/**
 * Vuela con animación hacia el objetivo cada vez que llega una solicitud. El
 * popup del evento se abre hacia arriba, así que el objetivo queda un poco bajo
 * el centro para que el popup quepa completo (también en celulares).
 *
 * Solo vuela cuando cambia `request`: los datos se refrescan cada pocos minutos
 * y traen coordenadas nuevas (otro arreglo, mismo lugar), y eso no debe mover
 * el mapa que el usuario está mirando.
 */
export function MapFocus({ target, request }: MapFocusProps) {
  const map = useMap();

  const flyToTarget = useEffectEvent(() => {
    if (!target) return;
    const zoom = Math.max(map.getZoom(), MAP_CONFIG.focusZoom);
    const offsetY = Math.min(map.getSize().y * 0.25, MAX_OFFSET_PX);
    const center = map.unproject(map.project(target, zoom).subtract([0, offsetY]), zoom);
    map.flyTo(center, zoom, { duration: 1.2 });
  });

  useEffect(() => {
    if (request > 0) flyToTarget();
  }, [request]);

  return null;
}
