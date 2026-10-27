"use client";

import { GeoJSON, Pane } from "react-leaflet";
import { normalizeName } from "../../parish-filters";
import { PREPAREDNESS_LEVEL_STYLES } from "../../constants";
import type { ProvinceGeometry } from "../../hooks/useProvinceGeometries";
import type { ProvincePreparedness } from "../../types";

const PANE = "provincePreparedness";

interface ProvincePreparednessLayerProps {
  provinces: readonly ProvincePreparedness[];
  geometries: ReadonlyMap<string, ProvinceGeometry>;
}

/**
 * Índice de preparación provincial en el mapa: cada provincia pintada con el
 * color de su nivel. Debajo de las capas de puntos y líneas, y sin capturar
 * clics: el detalle de cada provincia está en el panel.
 */
export function ProvincePreparednessLayer({ provinces, geometries }: ProvincePreparednessLayerProps) {
  const drawn = provinces.flatMap((province) => {
    const geometry = geometries.get(normalizeName(province.name));
    return geometry ? [{ province, geometry }] : [];
  });
  if (drawn.length === 0) return null;
  return (
    <Pane name={PANE} style={{ zIndex: 383, pointerEvents: "none" }}>
      {drawn.map(({ province, geometry }) => (
        <GeoJSON
          key={`${province.code}:${province.index}`}
          data={geometry}
          interactive={false}
          style={{
            // Colores vivos: con poca opacidad, sobre el mapa gris quedaban pastel.
            color: "#ffffff",
            weight: 1.5,
            opacity: 1,
            fillColor: PREPAREDNESS_LEVEL_STYLES[province.level].color,
            fillOpacity: 0.75,
          }}
        />
      ))}
    </Pane>
  );
}
