"use client";

import { Popup, Rectangle } from "react-leaflet";
import { FLASH_FLOOD_PROBABILITIES } from "../../constants";
import type { FlashFloodZone } from "../../types";

export function FlashFloodLayer({ zones }: { zones: FlashFloodZone[] }) {
  return zones.map((zone) => {
    const style = FLASH_FLOOD_PROBABILITIES[zone.probability];
    return (
      <Rectangle
        key={zone.id}
        bounds={zone.bounds}
        pathOptions={{ color: style.stroke, weight: 1.5, fillColor: style.fill, fillOpacity: 0.5 }}
        bubblingMouseEvents={false}
      >
        <Popup>
          <p className="text-[11px] font-medium text-slate-500">Inundación repentina · 24h</p>
          <p className="text-sm font-semibold text-slate-900">{zone.name}</p>
          <p className="text-xs text-slate-500">{zone.province}</p>
          <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700">
            <span
              className="size-2.5 rounded-sm border-2"
              style={{ backgroundColor: style.fill, borderColor: style.stroke }}
            />
            {style.label}
          </p>
        </Popup>
      </Rectangle>
    );
  });
}
