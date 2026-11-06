import type { ProvinceFeature } from "./hooks/useProvinceGeometries";

/*
 * Cálculos con los contornos de las provincias que no usan Leaflet: así también se
 * pueden importar desde lo que se genera en el servidor (Leaflet necesita el navegador).
 */

/** El archivo de contornos trae los nombres en mayúsculas y sin tildes. */
export const PROVINCE_NAMES: Record<string, string> = {
  bolivar: "Bolívar",
  galapagos: "Galápagos",
  "los rios": "Los Ríos",
  manabi: "Manabí",
  "santo domingo de los tsachilas": "Santo Domingo de los Tsáchilas",
  sucumbios: "Sucumbíos",
};

function isInRing(ring: number[][], lng: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function isInProvince({ geometry }: ProvinceFeature, { lat, lng }: { lat: number; lng: number }): boolean {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(([outer, ...holes]) => isInRing(outer, lng, lat) && !holes.some((hole) => isInRing(hole, lng, lat)));
}
