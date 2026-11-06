"use client";

import { leafletLayer, LineSymbolizer } from "protomaps-leaflet";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pane, useMap, useMapEvents } from "react-leaflet";
import { MAP_PANES, PROVINCIAL_ROADS_LAYER } from "../../constants";

/**
 * Desde qué zoom se dibuja. El estilo oficial del servicio la muestra desde el
 * zoom 10,17 de MapLibre (teselas de 512 px), ~11 en Leaflet; más lejos, el
 * servicio casi no tiene teselas y se vería a retazos.
 */
const MIN_ZOOM = 11;

/** Más delgada que la RVE; engrosa al acercarse. */
function lineWidth(zoom: number): number {
  return zoom <= 8 ? 0.7 : zoom >= 13 ? 2 : 0.7 + (zoom - 8) * 0.26;
}

/**
 * Red vial provincial: teselas vectoriales del SNGR (ArcGIS, de 512 px, hasta
 * el nivel 12), por el proxy del backend. Solo traen el trazado: no hay nombre
 * ni estado que mostrar al tocarla.
 */
export function ProvincialRoadsLayer({
  opacity = 1,
  hint = true,
}: {
  opacity?: number;
  hint?: boolean;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  if (zoom < MIN_ZOOM) return hint ? <ZoomHint /> : null;
  return (
    <Pane
      name={MAP_PANES.provincialRoads.name}
      style={{
        zIndex: MAP_PANES.provincialRoads.zIndex,
        pointerEvents: "none",
      }}
    >
      <ProvincialRoadsTiles opacity={opacity} />
    </Pane>
  );
}

/** Aviso sobre el mapa mientras está encendida pero lejos: si no, parece que no cargó. */
function ZoomHint() {
  const map = useMap();
  return createPortal(
    <div
      data-map-overlay
      data-capture-ignore
      className="absolute top-3 left-1/2 z-1000 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/95 py-1 pr-1 pl-3 text-xs text-slate-700 shadow-md ring-1 ring-slate-900/10"
    >
      <span className="whitespace-nowrap">
        Red vial provincial: se ve al acercar el mapa
      </span>
      <button
        type="button"
        onClick={() => map.flyTo(map.getCenter(), MIN_ZOOM)}
        className="rounded-full bg-blue-600 px-2.5 py-1 font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        Acercar
      </button>
    </div>,
    map.getContainer(),
  );
}

function ProvincialRoadsTiles({ opacity }: { opacity: number }) {
  const map = useMap();
  const ref = useRef<ReturnType<typeof leafletLayer> | null>(null);

  useEffect(() => {
    const layer = leafletLayer({
      url: `/api/sati/layers/${PROVINCIAL_ROADS_LAYER.id}/tiles/{z}/{x}/{y}`,
      maxDataZoom: 12,
      pane: MAP_PANES.provincialRoads.name,
      attribution: PROVINCIAL_ROADS_LAYER.attribution,
      paintRules: [
        {
          dataLayer: PROVINCIAL_ROADS_LAYER.sourceLayer,
          symbolizer: new LineSymbolizer({
            color: PROVINCIAL_ROADS_LAYER.color,
            width: lineWidth,
            opacity: 0.9,
          }),
        },
      ],
      labelRules: [],
    });
    layer.addTo(map);
    ref.current = layer;
    return () => {
      layer.remove();
      ref.current = null;
    };
  }, [map]);

  useEffect(() => {
    ref.current?.setOpacity(opacity);
  }, [opacity]);

  return null;
}
