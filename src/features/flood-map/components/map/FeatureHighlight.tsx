"use client";

import L from "leaflet";
import { useEffect, useEffectEvent } from "react";
import { GeoJSON, Pane, useMap } from "react-leaflet";
import type { RiskHit } from "../../risk-identify";

const HIGHLIGHT = { color: "#facc15", weight: 4, opacity: 1, fill: false } as const;
const PANE = "featureHighlight";

interface FeatureHighlightProps {
  hit: RiskHit;
  /** Se incrementa con el botón "Acercar" del panel de detalle. */
  zoomRequest: number;
}

/** Resalta en el mapa la entidad abierta en el panel de detalle y la acerca cuando se pide. */
export function FeatureHighlight({ hit, zoomRequest }: FeatureHighlightProps) {
  const map = useMap();
  const geometry = hit.feature.geometry;

  const zoomTo = useEffectEvent(() => {
    if (!geometry) return;
    const bounds = L.geoJSON(geometry).getBounds();
    if (!bounds.isValid()) return;
    if (geometry.type === "Point") map.flyTo(bounds.getCenter(), Math.max(map.getZoom(), 15));
    else map.flyToBounds(bounds, { padding: [48, 48], maxZoom: 16 });
  });
  useEffect(() => {
    if (zoomRequest > 0) zoomTo();
  }, [zoomRequest]);

  if (!geometry) return null;
  return (
    // Sin capturar clics: su lienzo cubre todo el mapa y taparía a las capas de abajo.
    <Pane name={PANE} style={{ zIndex: 630, pointerEvents: "none" }}>
      <GeoJSON
        key={hit.key}
        data={geometry}
        style={() => ({ ...HIGHLIGHT, weight: hit.style.geometry === "line" ? 7 : 4, opacity: hit.style.geometry === "line" ? 0.8 : 1 })}
        // Con su pane explícito: sin él iría al de Leaflet por defecto, y ese lienzo (que cubre
        // todo el mapa, encima de las capas de riesgo) se quedaría con todos los clics.
        pointToLayer={(_, latlng) => L.circleMarker(latlng, { ...HIGHLIGHT, pane: PANE, radius: 11, interactive: false })}
        interactive={false}
      />
    </Pane>
  );
}
