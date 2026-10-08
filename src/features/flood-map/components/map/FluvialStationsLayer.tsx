"use client";

import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { FLUVIAL_LEVELS } from "../../constants";
import type { FluvialLevel, FluvialStation } from "../../types";
import { squareSymbolHtml } from "../map-symbols";

const iconCache = new Map<FluvialLevel, L.DivIcon>();

/** Cuadrado del color del nivel: se distingue de los eventos (círculos) y las alertas (triángulos). */
function stationIcon(level: FluvialLevel): L.DivIcon {
  let icon = iconCache.get(level);
  if (!icon) {
    icon = L.divIcon({
      className: "map-symbol-marker",
      html: squareSymbolHtml(FLUVIAL_LEVELS[level].color, 12),
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      popupAnchor: [0, -8],
    });
    iconCache.set(level, icon);
  }
  return icon;
}

/** Estaciones de inundación fluvial (datos simulados hasta conectar su fuente). */
export function FluvialStationsLayer({ stations }: { stations: FluvialStation[] }) {
  return stations.map((station) => {
    const level = FLUVIAL_LEVELS[station.level];
    return (
      <Marker key={station.id} position={station.position} icon={stationIcon(station.level)} title={`Estación ${station.name}`}>
        <Popup>
          <p className="text-[11px] font-medium text-slate-500">
            Estación {station.name} · {station.province} · <span className="text-amber-700">simulado</span>
          </p>
          <p className="text-sm font-semibold text-slate-900">{station.river}</p>
          <div className="mt-2 flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-slate-700">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: level.color }} />
              {level.label}
            </span>
            <span className="font-semibold text-slate-900 tabular-nums">
              {station.flowM3s === null ? "Sin datos" : `${station.flowM3s} m³/s`}
            </span>
          </div>
        </Popup>
      </Marker>
    );
  });
}
