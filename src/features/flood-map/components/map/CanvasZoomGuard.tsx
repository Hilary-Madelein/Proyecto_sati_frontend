"use client";

import { useRef } from "react";
import { useMapEvents } from "react-leaflet";

/** Niveles de zoom que se tolera estirar el lienzo: hasta aquí un punto solo se ve el doble de grande. */
const MAX_STRETCH_ZOOMS = 1;
const HIDDEN_CLASS = "is-canvas-stretched";

/**
 * Leaflet no redibuja sus lienzos durante un zoom: los estira y los redibuja al
 * terminar. En un vuelo largo (de país a una calle) un punto llega a cubrir la
 * pantalla, así que mientras el lienzo está muy estirado se oculta.
 */
export function CanvasZoomGuard() {
  const settledZoom = useRef<number | null>(null);
  const hideIfStretched = (zoom: number) => {
    const settled = settledZoom.current ?? zoom;
    if (Math.abs(zoom - settled) > MAX_STRETCH_ZOOMS) map.getContainer().classList.add(HIDDEN_CLASS);
  };
  const map = useMapEvents({
    zoomanim: ({ zoom }) => hideIfStretched(zoom),
    zoom: () => hideIfStretched(map.getZoom()),
    moveend: () => {
      settledZoom.current = map.getZoom();
      // Dos cuadros: los lienzos se redibujan en el siguiente, y antes aún traen el dibujo viejo.
      requestAnimationFrame(() => requestAnimationFrame(() => map.getContainer().classList.remove(HIDDEN_CLASS)));
    },
  });
  // Antes del primer movimiento, el zoom con que abrió el mapa.
  settledZoom.current ??= map.getZoom();
  return null;
}
