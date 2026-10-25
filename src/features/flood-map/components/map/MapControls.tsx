"use client";

import L, { type FitBoundsOptions } from "leaflet";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMap } from "react-leaflet";
import { cn } from "@/lib/cn";
import { CheckIcon, MapIcon, MaximizeIcon, MinusIcon, PlusIcon } from "@/components/ui/icons";
import { BASEMAPS, MAP_CONFIG, type BasemapId } from "../../constants";

interface MapControlsProps {
  homeOptions: FitBoundsOptions;
  basemap: BasemapId;
  onBasemapChange: (basemap: BasemapId) => void;
}

/** Zoom, "volver a Ecuador" y mapa base, con el mismo estilo vidrio que los paneles. */
export function MapControls({ homeOptions, basemap, onBasemapChange }: MapControlsProps) {
  const map = useMap();
  const ref = useRef<HTMLDivElement>(null);
  const [choosing, setChoosing] = useState(false);

  // Evita que los clics y la rueda del ratón sobre los botones muevan el mapa.
  useEffect(() => {
    if (!ref.current) return;
    L.DomEvent.disableClickPropagation(ref.current);
    L.DomEvent.disableScrollPropagation(ref.current);
  }, []);

  return (
    <div ref={ref} className="absolute top-4 left-4 z-1000 flex flex-col gap-2">
      <div className="flex flex-col divide-y divide-slate-200 overflow-hidden rounded-xl bg-white/90 shadow-lg ring-1 shadow-slate-900/10 ring-slate-900/10 backdrop-blur-md">
        <ControlButton label="Acercar" onClick={() => map.zoomIn()}>
          <PlusIcon className="size-4" />
        </ControlButton>
        <ControlButton label="Alejar" onClick={() => map.zoomOut()}>
          <MinusIcon className="size-4" />
        </ControlButton>
        <ControlButton
          label="Ver todo Ecuador"
          onClick={() => map.flyToBounds(MAP_CONFIG.initialBounds, { ...homeOptions, duration: 1 })}
        >
          <MaximizeIcon className="size-4" />
        </ControlButton>
      </div>

      <div className="relative" onKeyDown={(event) => event.key === "Escape" && setChoosing(false)}>
        <div className="overflow-hidden rounded-xl bg-white/90 shadow-lg ring-1 shadow-slate-900/10 ring-slate-900/10 backdrop-blur-md">
          <ControlButton label="Mapa base" onClick={() => setChoosing((open) => !open)} expanded={choosing}>
            <MapIcon className="size-4" />
          </ControlButton>
        </div>
        {/* En fila, a la altura del botón: así no queda tapada por el panel de eventos. */}
        {choosing && (
          <ul
            aria-label="Mapa base"
            className="absolute top-0 left-full ml-2 flex gap-0.5 rounded-xl bg-white/95 p-1 shadow-lg ring-1 shadow-slate-900/10 ring-slate-900/10 backdrop-blur-md"
          >
            {(Object.keys(BASEMAPS) as BasemapId[]).map((id) => (
              <li key={id}>
                <button
                  type="button"
                  aria-pressed={id === basemap}
                  onClick={() => {
                    onBasemapChange(id);
                    setChoosing(false);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600",
                    id === basemap ? "bg-blue-50 text-blue-700" : "text-slate-700",
                  )}
                >
                  {id === basemap && <CheckIcon className="size-3.5" />}
                  {BASEMAPS[id].label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  expanded,
  children,
}: {
  label: string;
  onClick: () => void;
  /** Solo para el botón que abre una lista. */
  expanded?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={expanded}
      title={label}
      className="grid size-9 place-items-center text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600"
    >
      {children}
    </button>
  );
}
