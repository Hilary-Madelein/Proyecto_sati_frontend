"use client";

import { useEffect, useState } from "react";
import { GeoJSON, Pane } from "react-leaflet";
import { MAP_PANES, WATERSHED_SLOPES } from "../../constants";
import { loadWatersheds, type WatershedCollection } from "../../watersheds";

/**
 * Cuencas hidrográficas (Pfafstetter nivel 3) pintadas por vertiente: Pacífico o
 * Atlántico. Solo informativa, sin capturar clics: el nombre de la cuenca se ve
 * en los popups de ríos y estaciones.
 */
export function WatershedsLayer() {
  const [data, setData] = useState<WatershedCollection | null>(null);

  useEffect(() => {
    let active = true;
    loadWatersheds()
      .then((collection) => {
        if (active) setData(collection);
      })
      // Sin cuencas el mapa sigue funcionando: no se avisa.
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!data) return null;
  return (
    <Pane name={MAP_PANES.watersheds.name} style={{ zIndex: MAP_PANES.watersheds.zIndex, pointerEvents: "none" }}>
      <GeoJSON
        data={data}
        interactive={false}
        style={(feature) => {
          const slope = WATERSHED_SLOPES[feature?.properties?.vertiente as keyof typeof WATERSHED_SLOPES] ?? WATERSHED_SLOPES.Pacífico;
          return { color: slope.stroke, weight: 1, opacity: 0.7, fillColor: slope.fill, fillOpacity: 0.18 };
        }}
      />
    </Pane>
  );
}
