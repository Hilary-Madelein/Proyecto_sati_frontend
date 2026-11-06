"use client";

import type L from "leaflet";
import { useEffect, useRef } from "react";
import { useMapEvents } from "react-leaflet";

/** Lo que Leaflet usa al abrir un globo para correr el mapa hasta que quepa (privado, pero estable en 1.x). */
type PannablePopup = L.Popup & { _adjustPan?: () => void };

/**
 * Dos ajustes para todos los globos de información del mapa (lluvia en un punto,
 * eventos, estaciones…):
 * - Mientras hay uno abierto, marca el área del mapa: Leaflet lo dibuja dentro del
 *   mapa, así que lo que flota encima (controles, Galápagos, leyendas: `.map-float`)
 *   lo tapaba; en pantallas chicas eso se aparta (ver globals.css).
 * - Nunca más alto que el mapa: si no cabe, su contenido se desplaza adentro.
 * - Si el globo crece después de abrirse (llegan los datos o el gráfico), vuelve a
 *   correr el mapa para que se vea entero: Leaflet solo lo hace al abrirlo, y el
 *   globo crece hacia arriba, así que quedaba cortado arriba.
 */
export function MapPopupWatcher() {
  const observer = useRef<ResizeObserver | null>(null);
  const frame = useRef(0);
  // Los abiertos, por sus eventos: al cerrarse, Leaflet deja el globo un momento en
  // pantalla mientras se desvanece, así que mirar el DOM lo daba por abierto.
  const open = useRef(new Set<L.Popup>());

  const map = useMapEvents({
    popupopen: (event) => {
      open.current.add(event.popup);
      map.getContainer().parentElement?.setAttribute("data-map-popup", "");
      const popup = event.popup as PannablePopup;
      // Nunca más alto que el mapa (celular acostado): si no cabe, su contenido se desplaza adentro.
      const maxHeight = Math.max(160, map.getSize().y - 56);
      if (popup.options.maxHeight !== maxHeight) {
        popup.options.maxHeight = maxHeight;
        popup.update();
      }
      const element = popup.getElement();
      observer.current?.disconnect();
      if (!element) return;
      observer.current = new ResizeObserver(() => {
        cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => {
          if (map.hasLayer(popup)) popup._adjustPan?.();
        });
      });
      observer.current.observe(element);
    },
    popupclose: (event) => {
      open.current.delete(event.popup);
      // Al pasar de un globo a otro, Leaflet cierra el anterior después de abrir el nuevo.
      if (open.current.size > 0) return;
      map.getContainer().parentElement?.removeAttribute("data-map-popup");
      observer.current?.disconnect();
      observer.current = null;
    },
  });

  useEffect(
    () => () => {
      observer.current?.disconnect();
      cancelAnimationFrame(frame.current);
    },
    [],
  );
  return null;
}
