"use client";

import { useEffect, useState } from "react";
import { normalizeName } from "../parish-filters";
import { PROVINCE_BOUNDARIES_URL } from "../constants";

export type ProvinceGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;

export interface ProvinceFeature {
  /** Nombre normalizado (sin tildes ni mayúsculas). */
  key: string;
  name: string;
  geometry: ProvinceGeometry;
}

/** Una sola descarga por visita (el mismo archivo de los límites provinciales). */
let request: Promise<ProvinceFeature[]> | null = null;

export function loadProvinces(): Promise<ProvinceFeature[]> {
  request ??= fetch(PROVINCE_BOUNDARIES_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<GeoJSON.FeatureCollection<ProvinceGeometry, { provincia: string }>>;
    })
    .then((collection) =>
      collection.features.map(({ properties: { provincia }, geometry }) => ({ key: normalizeName(provincia), name: provincia, geometry })),
    )
    .catch((error: unknown) => {
      request = null; // Se reintenta la próxima vez.
      throw error;
    });
  return request;
}

/**
 * Contornos de las provincias (INEC) por nombre normalizado (sin tildes ni
 * mayúsculas), para pintar el índice de preparación. Se piden al encenderlo.
 */
export function useProvinceGeometries(enabled: boolean): Map<string, ProvinceGeometry> | null {
  const [geometries, setGeometries] = useState<Map<string, ProvinceGeometry> | null>(null);
  useEffect(() => {
    if (!enabled || geometries) return;
    let active = true;
    loadProvinces()
      .then((provinces) => {
        if (active) setGeometries(new Map(provinces.map(({ key, geometry }) => [key, geometry])));
      })
      // Sin contornos el índice sigue en la lista; solo no se pinta el mapa.
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [enabled, geometries]);
  return geometries;
}
