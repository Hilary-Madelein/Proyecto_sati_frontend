"use client";

import L from "leaflet";
import { useEffect, useEffectEvent, useRef } from "react";
import { GeoJSON, Pane, useMap } from "react-leaflet";
import type { RiskHit } from "../../risk-identify";
import { escapeHtml, placeOf, provinceOf, titleOf } from "../../risk-popup";
import { focusProvinceOf, freePadding } from "./province-focus";

const HIGHLIGHT = { color: "#facc15", weight: 4, opacity: 1, fill: false } as const;
const PANE = "featureHighlight";

interface FeatureHighlightProps {
  hit: RiskHit;
  /** Se incrementa al elegirla en una lista: pide acercarse también si no es un punto. */
  zoomRequest: number;
}

/** Resalta en el mapa la entidad abierta en el panel de detalle, dice dónde está y la acerca. */
export function FeatureHighlight({ hit, zoomRequest }: FeatureHighlightProps) {
  const map = useMap();
  const geometry = hit.feature.geometry;

  // Lo último que se atendió: un cambio de selección y un pedido de acercar llegan por separado.
  const last = useRef<{ request: number; key: string | null }>({ request: 0, key: null });

  const boundsOfGeometry = () => {
    const bounds = geometry ? L.geoJSON(geometry).getBounds() : null;
    return bounds?.isValid() ? bounds : null;
  };

  // Un punto, se elija en el mapa o en una lista, siempre lleva a su provincia. Lo demás
  // (líneas y zonas) solo se acerca si se pide, porque se puede tocar en cualquier parte.
  const focus = useEffectEvent((requested: boolean) => {
    const bounds = boundsOfGeometry();
    if (!bounds) return;
    if (geometry?.type === "Point") {
      void focusProvinceOf(map, bounds.getCenter(), provinceOf(hit.feature));
    } else if (requested) {
      const { paddingTopLeft, paddingBottomRight } = freePadding(map);
      map.flyToBounds(bounds, { paddingTopLeft, paddingBottomRight, maxZoom: 16 });
    }
  });

  useEffect(() => {
    const { request, key } = last.current;
    last.current = { request: zoomRequest, key: hit.key };
    if (zoomRequest !== request || hit.key !== key) focus(zoomRequest !== request);
  }, [zoomRequest, hit.key]);

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
        pointToLayer={(_, latlng) =>
          // Con dibujo (puente, cierre…) el aro lo rodea entero, sin cortarlo.
          L.circleMarker(latlng, { ...HIGHLIGHT, pane: PANE, radius: hit.style.pointGlyph ? 17 : 11, interactive: false }).bindTooltip(
            escapeHtml(placeOf(hit.feature) ?? titleOf(hit.style, hit.feature)),
            { permanent: true, direction: "top", offset: [0, -10], className: "map-place-label" },
          )
        }
        interactive={false}
      />
    </Pane>
  );
}
