"use client";

import type { WMSParams } from "leaflet";
import { WMSTileLayer } from "react-leaflet";

interface ProxyWmsLayerProps {
  /** Id de la capa en el backend (GET /layers). */
  layerId: string;
  /** Dimensiones WMS extra (p. ej. TIME, DIM_INITD). Al cambiar, la capa se recrea. */
  dimensions?: Record<string, string>;
  opacity: number;
  attribution: string;
  onLoadingChange?: (loading: boolean) => void;
}

/**
 * Capa WMS servida a través del proxy del backend (`/api/sati/layers/:id/wms`):
 * el backend fija la capa real y evita el contenido mixto HTTP.
 */
export function ProxyWmsLayer({ layerId, dimensions = {}, opacity, attribution, onLoadingChange }: ProxyWmsLayerProps) {
  const params: WMSParams & Record<string, string | boolean> = {
    // El backend ignora LAYERS (la fija él), pero Leaflet exige el parámetro.
    layers: layerId,
    format: "image/png",
    transparent: true,
    version: "1.1.0",
    ...dimensions,
  };

  return (
    <WMSTileLayer
      // Cambiar de capa o de dimensiones crea una capa nueva: así no se mezclan teselas.
      key={`${layerId}-${JSON.stringify(dimensions)}`}
      url={`/api/sati/layers/${layerId}/wms`}
      params={params}
      opacity={opacity}
      attribution={attribution}
      eventHandlers={{
        loading: () => onLoadingChange?.(true),
        load: () => onLoadingChange?.(false),
      }}
    />
  );
}
