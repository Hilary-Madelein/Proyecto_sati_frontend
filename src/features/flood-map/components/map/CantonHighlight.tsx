"use client";

import L from "leaflet";
import { useEffect, useEffectEvent } from "react";
import { GeoJSON, Pane, useMap } from "react-leaflet";
import { SEMAPHORE_STYLES } from "../../constants";
import type { CantonGeometry } from "../../hooks/useCantonGeometries";
import type { CantonAnalysis } from "../../types";

const PANE = "cantonHighlight";

/** Contorno del cantón elegido en el análisis, con el color de su semáforo; el mapa lo encuadra al elegirlo. */
export function CantonHighlight({ canton, geometry }: { canton: CantonAnalysis; geometry: CantonGeometry | null }) {
  const map = useMap();

  const focus = useEffectEvent(() => {
    const bounds = geometry ? L.geoJSON(geometry).getBounds() : null;
    if (bounds?.isValid()) map.flyToBounds(bounds, { padding: [48, 48], maxZoom: 11 });
    else map.flyTo(canton.center, Math.max(map.getZoom(), 9));
  });
  useEffect(() => focus(), [canton.code]);

  if (!geometry) return null;
  return (
    // Sobre las capas y debajo de los marcadores; sin capturar clics.
    <Pane name={PANE} style={{ zIndex: 450, pointerEvents: "none" }}>
      <GeoJSON
        key={canton.code}
        data={geometry}
        interactive={false}
        style={() => ({
          color: SEMAPHORE_STYLES[canton.semaphore].color,
          weight: 3,
          dashArray: "6 4",
          fillColor: SEMAPHORE_STYLES[canton.semaphore].color,
          fillOpacity: 0.08,
        })}
      />
    </Pane>
  );
}
