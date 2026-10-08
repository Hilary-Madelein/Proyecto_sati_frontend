"use client";

import { leafletLayer, LineSymbolizer, type Feature } from "protomaps-leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { RIVER_NETWORK_LAYER } from "../../constants";

/** Grosor según el orden de Strahler del tramo (ríos grandes más gruesos) y el zoom. */
function lineWidth(zoom: number, feature?: Feature): number {
  const order = Number(feature?.props.order ?? 1);
  const base = order <= 2 ? 0.5 : order === 3 ? 0.8 : order === 4 ? 1.2 : order === 5 ? 1.7 : order === 6 ? 2.3 : 3;
  const zoomFactor = zoom <= 6 ? 0.7 : zoom >= 11 ? 1.8 : 1 + (zoom - 7) * 0.2;
  return base * zoomFactor;
}

/**
 * Red de ríos del Ecuador (teselas vectoriales del Hydroviewer del INAMHI, vía
 * el proxy del backend). Se dibuja en canvas con protomaps-leaflet.
 */
export function RiverNetworkLayer({ pane }: { pane: string }) {
  const map = useMap();

  useEffect(() => {
    const layer = leafletLayer({
      url: `/api/sati/layers/${RIVER_NETWORK_LAYER.id}/tiles/{z}/{x}/{y}`,
      maxDataZoom: 14,
      pane,
      attribution: RIVER_NETWORK_LAYER.attribution,
      paintRules: [
        {
          dataLayer: RIVER_NETWORK_LAYER.sourceLayer,
          symbolizer: new LineSymbolizer({ color: RIVER_NETWORK_LAYER.color, width: lineWidth, opacity: 0.85 }),
          // Con el mapa lejano, los arroyos más pequeños solo añaden ruido.
          filter: (zoom, feature) => zoom >= 8 || Number(feature.props.order ?? 1) >= 2,
        },
      ],
      labelRules: [],
    });
    layer.addTo(map);
    return () => {
      layer.remove();
    };
  }, [map, pane]);

  return null;
}
