"use client";

import type L from "leaflet";
import { useEffect, useRef } from "react";
import { useMapEvents } from "react-leaflet";
import { offsetToClear } from "./map-obstacles";

/** Lo que Leaflet usa al abrir un globo para correr el mapa hasta que quepa (privado, pero estable en 1.x). */
type PannablePopup = L.Popup & { _adjustPan?: () => void };

/**
 * Dos ajustes para todos los globos de información del mapa (lluvia en un punto,
 * eventos, estaciones…):
 * - Mientras hay uno abierto, marca el área del mapa: en pantallas chicas se aparta
 *   el recuadro de Galápagos (`.map-float`, ver globals.css). Lo demás que flota
 *   (controles, barra de la provincia, leyendas, barras de abajo) queda, y el globo se
 *   corre para no quedar debajo (ver map-obstacles.ts).
 * - Nunca más alto que el mapa: si no cabe, su contenido se desplaza adentro.
 * - Si el globo crece después de abrirse (llegan los datos o el gráfico), vuelve a
 *   correr el mapa para que se vea entero: Leaflet solo lo hace al abrirlo, y el
 *   globo crece hacia arriba, así que quedaba cortado arriba.
 */
/** Alto máximo de un globo: más alto, se desplaza adentro con su barra. */
const POPUP_MAX_HEIGHT_PX = 520;
/** Aire entre el globo y los bordes del mapa (controles y barras de arriba). */
const POPUP_MAP_MARGIN_PX = 120;
const POPUP_MIN_HEIGHT_PX = 180;

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
      // Nunca más alto que el mapa, dejando aire para las barras de arriba: si no cabe, su
      // contenido se desplaza adentro con una barra.
      const maxHeight = Math.max(POPUP_MIN_HEIGHT_PX, Math.min(map.getSize().y - POPUP_MAP_MARGIN_PX, POPUP_MAX_HEIGHT_PX));
      if (popup.options.maxHeight !== maxHeight) {
        popup.options.maxHeight = maxHeight;
        popup.update();
      }
      const element = popup.getElement();
      observer.current?.disconnect();
      if (!element) return;
      const content = element.querySelector<HTMLElement>(".leaflet-popup-content");
      /**
       * Leaflet mide el alto (y pone la barra) solo al abrirlo; el contenido puede crecer
       * después (datos que llegan, una parte que se despliega) o achicarse: se vuelve a
       * medir cuando cambia de lado del alto máximo.
       */
      const fitHeight = () => {
        if (!content) return;
        const scrolled = content.classList.contains("leaflet-popup-scrolled");
        const tall = content.scrollHeight > maxHeight;
        if (tall !== scrolled) popup.update();
      };
      observer.current = new ResizeObserver(() => {
        cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => {
          if (!map.hasLayer(popup)) return;
          fitHeight();
          popup._adjustPan?.();
          // Además, que no quede debajo de los controles ni de la barra de la provincia (siempre a la vista).
          const [dx, dy] = offsetToClear(map, element);
          if (dx || dy) map.panBy([dx, dy]);
        });
      });
      observer.current.observe(element);
      // Lo de adentro también: con la barra puesta, el globo ya no cambia de alto aunque el contenido sí.
      if (content?.firstElementChild) observer.current.observe(content.firstElementChild);
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
