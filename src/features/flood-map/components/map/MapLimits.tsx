"use client";

import L from "leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { MAP_CONFIG } from "../../constants";
import { getHomeBoundsOptions } from "./home-bounds";

/**
 * Limita el desplazamiento a `MAP_CONFIG.maxBounds`. Si a ese zoom la vista es
 * más grande que el límite, Leaflet la centra en el medio del límite (que con
 * Galápagos cae en el mar, al oeste): por eso el límite se agranda lo justo para
 * que siempre quepa la vista inicial, centrada en Ecuador continental.
 */
export function MapLimits() {
  const map = useMap();

  useEffect(() => {
    const limits = L.latLngBounds(MAP_CONFIG.maxBounds);
    const initial = L.latLngBounds(MAP_CONFIG.initialBounds);
    const update = () => {
      // Se mide cada vez: la pantalla pudo cambiar de tamaño.
      const homeOptions = getHomeBoundsOptions();
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
  }, [map]);

  return null;
}
