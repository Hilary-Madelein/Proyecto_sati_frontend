"use client";

import { ImageOverlay } from "react-leaflet";
import { RAIN_FORECAST_OPACITY } from "../../constants";
import type { AccumulatedRain } from "../../types";

interface AccumulatedRainLayerProps {
  rain: AccumulatedRain;
  attribution: string;
  onLoadingChange: (loading: boolean) => void;
}

/**
 * Lluvia pronosticada acumulada: una sola imagen calculada por el backend
 * (suma de días del WRF, ya proyectada a Web Mercator) sobre el Ecuador.
 */
export function AccumulatedRainLayer({ rain, attribution, onLoadingChange }: AccumulatedRainLayerProps) {
  return (
    <ImageOverlay
      key={rain.imagePath}
      url={`/api/sati${rain.imagePath}`}
      bounds={rain.bounds}
      opacity={RAIN_FORECAST_OPACITY}
      attribution={attribution}
      eventHandlers={{
        add: () => onLoadingChange(true),
        load: () => onLoadingChange(false),
        error: () => onLoadingChange(false),
      }}
    />
  );
}
