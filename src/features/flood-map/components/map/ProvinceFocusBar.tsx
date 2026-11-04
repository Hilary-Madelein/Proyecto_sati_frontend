"use client";

import type L from "leaflet";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { GeoJSON, Pane, useMap, useMapEvents } from "react-leaflet";
import { MapPinIcon, MaximizeIcon } from "@/components/ui/icons";
import { placeName } from "../../action-timeline";
import type { ProvinceFeature } from "../../hooks/useProvinceGeometries";
import { goHome, homeZoom, PROVINCE_FOCUS_EVENT, type ProvinceFocusEvent } from "./province-focus";

const PANE = "provinceFocus";
const OUTLINE = { color: "#2563eb", weight: 2, opacity: 0.9, fill: true, fillColor: "#2563eb", fillOpacity: 0.05 } as const;
/** Ya se ve casi todo Ecuador: no hace falta ofrecer volver. */
const HOME_TOLERANCE = 0.25;
/** El archivo de contornos trae los nombres en mayúsculas y sin tildes. */
const NAMES_WITH_ACCENT: Record<string, string> = {
  bolivar: "Bolívar",
  galapagos: "Galápagos",
  "los rios": "Los Ríos",
  manabi: "Manabí",
  "santo domingo de los tsachilas": "Santo Domingo de los Tsáchilas",
  sucumbios: "Sucumbíos",
};

/**
 * Tras acercarse a un punto: resalta su provincia, dice cuál es y ofrece volver a
 * todo Ecuador. Desaparece al volver, con este botón o de cualquier otra forma.
 */
export function ProvinceFocusBar({ slot, onGoHome }: { slot: HTMLElement | null; onGoHome: () => void }) {
  const map = useMap();
  // undefined = sin acercamiento; null = se acercó, pero no se reconoció la provincia.
  const [province, setProvince] = useState<ProvinceFeature | null | undefined>(undefined);

  useEffect(() => {
    const onFocus = (event: L.LeafletEvent) => setProvince((event as ProvinceFocusEvent).province);
    map.on(PROVINCE_FOCUS_EVENT, onFocus);
    return () => {
      map.off(PROVINCE_FOCUS_EVENT, onFocus);
    };
  }, [map]);

  useMapEvents({
    moveend: () => {
      if (map.getZoom() <= homeZoom(map) + HOME_TOLERANCE) setProvince(undefined);
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
          <div className="flex items-center gap-1 rounded-xl bg-white/95 py-1 pr-1 pl-2.5 text-xs shadow-lg ring-1 shadow-slate-900/10 ring-slate-900/10 backdrop-blur-md">
            {province && (
              <span className="flex min-w-0 items-center gap-1.5 font-semibold text-slate-800">
                <MapPinIcon className="size-3.5 shrink-0 text-blue-600" />
                <span className="truncate">{NAMES_WITH_ACCENT[province.key] ?? placeName(province.name)}</span>
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                goHome(map);
                onGoHome();
              }}
              className="ml-1 flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 font-semibold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              <MaximizeIcon className="size-3.5" />
              Ver todo Ecuador
            </button>
          </div>,
          slot,
        )}
    </>
  );
}
