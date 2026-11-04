"use client";

import { useEffect, useEffectEvent } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import type { LatLng } from "../../types";
import { focusProvinceOf } from "./province-focus";

interface MapFocusProps {
  target: LatLng | null;
  province?: string | null;
  /** Cambia en cada solicitud, para volver a centrar aunque el objetivo sea el mismo. */
  request: number;
}

/**
 * Se acerca a la provincia del objetivo cada vez que llega una solicitud; el popup
 * del evento se abre al llegar y se reacomoda para caber completo.
 *
 * Solo vuela cuando cambia `request`: los datos se refrescan cada pocos minutos
 * y traen coordenadas nuevas (otro arreglo, mismo lugar), y eso no debe mover
 * el mapa que el usuario está mirando.
 */
export function MapFocus({ target, province, request }: MapFocusProps) {
  const map = useMap();

  const flyToTarget = useEffectEvent(() => {
    if (target) void focusProvinceOf(map, L.latLng(target), province);
  });

  useEffect(() => {
    if (request > 0) flyToTarget();
  }, [request]);

  return null;
}
