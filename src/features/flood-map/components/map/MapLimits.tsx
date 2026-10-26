"use client";

import L, { type FitBoundsOptions } from "leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { MAP_CONFIG } from "../../constants";

interface MapLimitsProps {
  /** Márgenes del encuadre inicial (los mismos del botón de inicio). */
  homeOptions: FitBoundsOptions;
}

/**
 * Limita el desplazamiento a `MAP_CONFIG.maxBounds`. Si a ese zoom la vista es
 * más grande que el límite, Leaflet la centra en el medio del límite (que con
 * Galápagos cae en el mar, al oeste): por eso el límite se agranda lo justo para
 * que siempre quepa la vista inicial, centrada en Ecuador continental.
 */
export function MapLimits({ homeOptions }: MapLimitsProps) {
  const map = useMap();

  useEffect(() => {
    const limits = L.latLngBounds(MAP_CONFIG.maxBounds);
    const initial = L.latLngBounds(MAP_CONFIG.initialBounds);
    const topLeft = L.point(homeOptions.paddingTopLeft ?? homeOptions.padding ?? [0, 0]);
    const bottomRight = L.point(homeOptions.paddingBottomRight ?? homeOptions.padding ?? [0, 0]);
    // Centro del encuadre inicial, calculado como lo hace fitBounds.
    const homeZoom = map.getBoundsZoom(initial, false, topLeft.add(bottomRight));
    const home = map.unproject(
      map
        .project(initial.getSouthWest(), homeZoom)
        .add(map.project(initial.getNorthEast(), homeZoom))
        .divideBy(2)
        .add(bottomRight.subtract(topLeft).divideBy(2)),
      homeZoom,
    );

    const update = () => {
      const zoom = map.getZoom();
      const center = map.project(home, zoom);
      const half = map.getSize().divideBy(2);
      const view = L.latLngBounds(map.unproject(center.subtract(half), zoom), map.unproject(center.add(half), zoom));
      map.setMaxBounds(L.latLngBounds(limits.getSouthWest(), limits.getNorthEast()).extend(view));
    };

    update();
    map.on("zoomend resize", update);
    return () => {
      map.off("zoomend resize", update);
    };
  }, [map, homeOptions]);

  return null;
}
