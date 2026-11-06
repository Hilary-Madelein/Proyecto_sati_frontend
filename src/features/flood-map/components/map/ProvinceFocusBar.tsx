"use client";

import L from "leaflet";
import { useEffect, useEffectEvent, useState } from "react";
import { createPortal } from "react-dom";
import { GeoJSON, Pane, useMap, useMapEvents } from "react-leaflet";
import { MapPinIcon, MaximizeIcon } from "@/components/ui/icons";
import { placeName } from "../../action-timeline";
import { MAP_CONFIG } from "../../constants";
import type { ProvinceFeature } from "../../hooks/useProvinceGeometries";
import { PROVINCE_NAMES } from "../../province-geometry";
import { goHome, homeZoom, PROVINCE_FOCUS_EVENT, type ProvinceFocusEvent } from "./province-focus";

const PANE = "provinceFocus";
const OUTLINE = { color: "#2563eb", weight: 2, opacity: 0.9, fill: true, fillColor: "#2563eb", fillOpacity: 0.05 } as const;
/** Ya se ve casi todo Ecuador: no hace falta ofrecer volver. */
const HOME_TOLERANCE = 0.25;

/**
 * Tras acercarse a un punto: resalta su provincia, dice cuál es y ofrece volver a
 * todo Ecuador. Desaparece al volver, con este botón o de cualquier otra forma.
 * Acercarse a una provincia es elegirla (`onProvinceChange`): así el resumen, las
 * capas y los paneles muestran lo mismo que dice la barra.
 */
export function ProvinceFocusBar({
  slot,
  onGoHome,
  onProvinceChange,
  onOpenSummary,
}: {
  slot: HTMLElement | null;
  onGoHome: () => void;
  /** La provincia a la que se acercó el mapa, o null al volver a todo Ecuador. */
  onProvinceChange: (province: ProvinceFeature | null) => void;
  /** Solo en el celular (menos de 768 px): ahí el resumen no se abre solo (taparía el mapa), se abre con este botón. */
  onOpenSummary: () => void;
}) {
  const map = useMap();
  // undefined = sin acercamiento; null = se acercó, pero no se reconoció la provincia.
  const [province, setProvince] = useState<ProvinceFeature | null | undefined>(undefined);

  const notify = useEffectEvent((focused: ProvinceFeature | null) => onProvinceChange(focused));
  useEffect(() => {
    const onFocus = (event: L.LeafletEvent) => {
      const focused = (event as ProvinceFocusEvent).province;
      setProvince(focused);
      if (focused) notify(focused);
    };
    map.on(PROVINCE_FOCUS_EVENT, onFocus);
    return () => {
      map.off(PROVINCE_FOCUS_EVENT, onFocus);
    };
  }, [map]);

  useMapEvents({
    moveend: () => {
      // De vuelta en la vista general: con el zoom de todo Ecuador y el continente a la vista
      // (encuadrar Galápagos en una pantalla angosta también aleja, pero mira a otro lado).
      const continent = L.latLngBounds(MAP_CONFIG.initialBounds).getCenter();
      if (province === undefined) return;
      if (map.getZoom() <= homeZoom(map) + HOME_TOLERANCE && map.getBounds().contains(continent)) {
        setProvince(undefined);
        onProvinceChange(null);
      }
    },
  });

  if (province === undefined) return null;
  return (
    <>
      {province && (
        // Sin capturar clics: su lienzo cubre todo el mapa y taparía a las capas de abajo.
        <Pane name={PANE} style={{ zIndex: 395, pointerEvents: "none" }}>
          <GeoJSON key={province.key} data={province.geometry} style={OUTLINE} interactive={false} />
        </Pane>
      )}
      {slot &&
        createPortal(
          // Si el nombre no cabe junto a los botones (celular), los botones bajan a otra línea: el nombre no se corta.
          <div data-capture-ignore className="flex flex-wrap items-center gap-x-1 rounded-xl bg-white/95 py-1 pr-1 pl-2.5 text-xs shadow-lg ring-1 shadow-slate-900/10 ring-slate-900/10 backdrop-blur-md">
            {province && (
              <span className="flex max-w-full min-w-0 items-center gap-1.5 py-1 font-semibold text-slate-800">
                <MapPinIcon className="size-3.5 shrink-0 text-blue-600" />
                <span className="truncate">{PROVINCE_NAMES[province.key] ?? placeName(province.name)}</span>
              </span>
            )}
            {province && (
              <button
                type="button"
                onClick={onOpenSummary}
                className="flex shrink-0 items-center gap-1.5 rounded-lg px-1.5 py-1.5 font-semibold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600 md:hidden"
              >
                Resumen
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                goHome(map);
                onGoHome();
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-1.5 py-1.5 font-semibold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600 lg:ml-1 lg:px-2"
            >
              <MaximizeIcon className="size-3.5" />
              {/* En móvil, más corto: con el botón "Resumen" no cabía el nombre de la provincia. */}
              <span className="max-lg:hidden">Ver todo Ecuador</span>
              <span className="lg:hidden">Todo Ecuador</span>
            </button>
          </div>,
          slot,
        )}
    </>
  );
}
