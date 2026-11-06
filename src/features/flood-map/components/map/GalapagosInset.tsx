"use client";

import L from "leaflet";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { focusProvinceOf } from "./province-focus";

/** Las islas, con un poco de mar alrededor. */
const GALAPAGOS_BOUNDS: [[number, number], [number, number]] = [
  [-1.5, -91.75],
  [0.7, -89.15],
];

/**
 * Recuadro con Galápagos a la izquierda, como en los mapas oficiales: la vista
 * general deja las islas fuera. Muestra las mismas capas que el mapa (`children`),
 * con sus filtros, para ver lo que pasa en las islas sin ir hasta allá. Va junto a los controles (ver `slot`), fuera del
 * mapa principal, así sus clics no lo mueven. Al tocarlo, el mapa va a la provincia
 * de Galápagos; de ahí se vuelve con "Ver todo Ecuador".
 */
export function GalapagosInset({ tileUrl, slot, children }: { tileUrl: string; slot: HTMLElement | null; children?: ReactNode }) {
  const map = useMap();
  if (!slot) return null;

  return createPortal(
    <button
      type="button"
      onClick={() => void focusProvinceOf(map, L.latLngBounds(GALAPAGOS_BOUNDS[0], GALAPAGOS_BOUNDS[1]).getCenter(), "Galápagos")}
      title="Ir a Galápagos"
      className="relative block h-20 w-28 overflow-hidden rounded-xl bg-white shadow-lg ring-1 shadow-slate-900/10 ring-slate-900/10 transition hover:ring-blue-400 focus-visible:outline-2 focus-visible:outline-blue-600 lg:h-32 lg:w-44"
    >
      {/* Sin interacción propia: es una vista fija, todo el recuadro es el botón (ver .galapagos-inset en globals.css). */}
      <MapContainer
        bounds={GALAPAGOS_BOUNDS}
        zoomControl={false}
        attributionControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
        zoomSnap={0.25}
        className="galapagos-inset pointer-events-none size-full bg-slate-100"
      >
        <TileLayer url={tileUrl} />
        {children}
      </MapContainer>
      <span className="absolute top-1 left-1.5 z-1000 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-800 shadow-sm lg:text-[11px]">
        Galápagos
      </span>
    </button>,
    slot,
  );
}
