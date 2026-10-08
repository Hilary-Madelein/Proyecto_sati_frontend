"use client";

import { Polygon, Popup } from "react-leaflet";
import { HISTORICAL_FREQUENCIES } from "../../constants";
import type { HistoricalFloodZone } from "../../types";

export function HistoricalFloodLayer({ zones }: { zones: HistoricalFloodZone[] }) {
  return zones.map((zone) => {
    const style = HISTORICAL_FREQUENCIES[zone.frequency];
    return (
      <Polygon
        key={zone.id}
        positions={zone.polygon}
        pathOptions={{ color: style.color, weight: 1, fillColor: style.color, fillOpacity: 0.5 }}
        bubblingMouseEvents={false}
      >
        <Popup>
          <p className="text-[11px] font-medium text-slate-500">Inundación histórica</p>
          <p className="text-sm font-semibold text-slate-900">{zone.name}</p>
          <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: style.color }} />
            Inundada el {style.label}
          </p>
        </Popup>
      </Polygon>
    );
  });
}
