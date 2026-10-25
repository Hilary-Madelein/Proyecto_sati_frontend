"use client";

import { GeoJSON, Pane, useMapEvents } from "react-leaflet";
import { SEMAPHORE_STYLES } from "../../constants";
import type { CantonGeometry } from "../../hooks/useCantonGeometries";
import { geometryContains } from "../../risk-identify";
import type { CantonAnalysis } from "../../types";

const PANE = "cantonSemaphore";

interface CantonSemaphoreLayerProps {
  /** Los cantones que deja el filtro (los mismos de la lista). */
  cantons: readonly CantonAnalysis[];
  /** Contornos por código DPA (archivo fijo del visor). */
  geometries: ReadonlyMap<string, CantonGeometry>;
  updatedAt: string;
  /** Se tocó en el mapa un cantón pintado: se abre su ficha en el panel. */
  onCantonClick: (canton: CantonAnalysis) => void;
}

/**
 * Semáforo de lluvia pronosticada en el mapa: cada cantón del filtro pintado con
 * su color (verde, amarillo o rojo). Debajo de las capas de puntos y líneas.
 * Sus polígonos no capturan clics (su lienzo taparía a las capas de abajo): el
 * clic en el mapa se busca aquí.
 */
export function CantonSemaphoreLayer({ cantons, geometries, updatedAt, onCantonClick }: CantonSemaphoreLayerProps) {
  const drawn = cantons.flatMap((canton) => {
    const geometry = geometries.get(canton.code);
    return geometry ? [{ canton, geometry }] : [];
  });
  useMapEvents({
    click: (event) => {
      const hit = drawn.find((item) => geometryContains(item.geometry, event.latlng));
      if (hit) onCantonClick(hit.canton);
    },
  });

  if (drawn.length === 0) return null;
  return (
    <Pane name={PANE} style={{ zIndex: 384, pointerEvents: "none" }}>
      {drawn.map(({ canton, geometry }) => (
        <GeoJSON
          // Se vuelve a dibujar con cada cálculo nuevo (GeoJSON de react-leaflet no se actualiza solo).
          key={`${canton.code}:${updatedAt}`}
          data={geometry}
          interactive={false}
          style={{
            color: SEMAPHORE_STYLES[canton.semaphore].color,
            weight: 1,
            opacity: 0.8,
            fillColor: SEMAPHORE_STYLES[canton.semaphore].color,
            fillOpacity: 0.25,
          }}
        />
      ))}
    </Pane>
  );
}
