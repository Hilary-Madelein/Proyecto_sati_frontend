"use client";

import { GeoJSON, Pane } from "react-leaflet";
import type { ProvinceFeature } from "../../hooks/useProvinceGeometries";

/** Encima de las capas de imagen (lluvia, mar: 340–350) y debajo de los ríos (380). */
const PANE = { name: "provinceShading", zIndex: 360 } as const;

/**
 * De menos a más: cuatro tonos de índigo; las provincias sin nada quedan sin pintar.
 * No rojo: solo compara cantidades entre provincias, no es un nivel de alerta.
 */
export const SHADING_COLORS = ["#e0e7ff", "#a5b4fc", "#6366f1", "#3730a3"] as const;

/** Tono de un valor: cuartos del máximo, para que la provincia con más resalte siempre. */
export function shadingColor(value: number, max: number): string | null {
  if (value <= 0 || max <= 0) return null;
  const index = Math.min(SHADING_COLORS.length - 1, Math.floor((value / max) * SHADING_COLORS.length - 1e-9));
  return SHADING_COLORS[Math.max(0, index)];
}

/**
 * Provincias pintadas según el indicador del ranking del resumen (alertas, eventos
 * o cierres), para ver de un vistazo dónde está el problema. Solo para ver: el
 * contorno y el clic los sigue manejando la selección de provincia.
 */
export function ProvinceShadingLayer({ provinces, values }: { provinces: readonly ProvinceFeature[]; values: ReadonlyMap<string, number> }) {
  const max = Math.max(0, ...values.values());
  const collection: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: provinces.map((province) => ({ type: "Feature", properties: { key: province.key }, geometry: province.geometry })),
  };
  const key = provinces.map((province) => `${province.key}:${values.get(province.key) ?? 0}`).join("|");
  return (
    <Pane name={PANE.name} style={{ zIndex: PANE.zIndex, pointerEvents: "none" }}>
      <GeoJSON
        key={key}
        interactive={false}
        data={collection}
        style={(feature) => {
          const color = shadingColor(values.get(String(feature?.properties?.key)) ?? 0, max);
          return color
            ? { color: "#312e81", weight: 0.6, opacity: 0.5, fillColor: color, fillOpacity: 0.55 }
            : { stroke: false, fill: false };
        }}
      />
    </Pane>
  );
}
