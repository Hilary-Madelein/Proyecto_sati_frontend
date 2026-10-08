"use client";

import { ImageOverlay } from "react-leaflet";
import type { RainImage } from "../../types";

interface AccumulatedRainLayerProps {
  rain: RainImage;
  opacity: number;
  attribution: string;
  onLoadingChange: (loading: boolean) => void;
}

/**
 * Lluvia acumulada (pronosticada u observada): una sola imagen calculada por
 * el backend (suma de días del WRF o de horas del satélite, ya proyectada a
 * Web Mercator) sobre el Ecuador.
 */
export function AccumulatedRainLayer({ rain, opacity, attribution, onLoadingChange }: AccumulatedRainLayerProps) {
  return (
    <ImageOverlay
      key={rain.imagePath}
      url={`/api/sati${rain.imagePath}`}
      bounds={rain.bounds}
      opacity={opacity}
      attribution={attribution}
      eventHandlers={{
        add: () => onLoadingChange(true),
        load: () => onLoadingChange(false),
        error: () => onLoadingChange(false),
      }}
    />
  );
}
