"use client";

import type L from "leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";

/** Entrega la instancia del mapa a quien la necesite fuera de él (p. ej. la animación de la lluvia). */
export function MapReady({ onReady }: { onReady?: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    onReady?.(map);
  }, [map, onReady]);
  return null;
}
