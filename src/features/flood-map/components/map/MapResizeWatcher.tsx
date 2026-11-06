"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";

/** Leaflet solo mira el tamaño de la ventana: si su contenedor cambia (al desplegar el resumen), se le avisa. */
export function MapResizeWatcher() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}
