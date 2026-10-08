"use client";

import L, { type FitBoundsOptions } from "leaflet";
import { useEffect, useRef, type ReactNode } from "react";
import { useMap } from "react-leaflet";
import { MaximizeIcon, MinusIcon, PlusIcon } from "@/components/ui/icons";
import { MAP_CONFIG } from "../../constants";

/** Zoom y "volver a Ecuador", con el mismo estilo vidrio que los paneles. */
export function MapControls({ homeOptions }: { homeOptions: FitBoundsOptions }) {
  const map = useMap();
  const ref = useRef<HTMLDivElement>(null);

  // Evita que los clics y la rueda del ratón sobre los botones muevan el mapa.
  useEffect(() => {
    if (!ref.current) return;
    L.DomEvent.disableClickPropagation(ref.current);
    L.DomEvent.disableScrollPropagation(ref.current);
  }, []);

  return (
    <div
      ref={ref}
      className="absolute top-4 left-4 z-1000 flex flex-col divide-y divide-slate-200 overflow-hidden rounded-xl bg-white/90 shadow-lg ring-1 shadow-slate-900/10 ring-slate-900/10 backdrop-blur-md"
    >
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
  );
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-9 place-items-center text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600"
    >
      {children}
    </button>
  );
}
