"use client";

import { useEffect, useState } from "react";
import { CANTON_BOUNDARIES_URL } from "../constants";

export type CantonGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;

/** Una sola descarga por visita: los contornos no cambian. */
let request: Promise<Map<string, CantonGeometry>> | null = null;

function loadGeometries(): Promise<Map<string, CantonGeometry>> {
  request ??= fetch(CANTON_BOUNDARIES_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<GeoJSON.FeatureCollection<CantonGeometry, { codigo: string }>>;
    })
    .then((collection) => new Map(collection.features.map((feature) => [feature.properties.codigo, feature.geometry])))
    .catch((error: unknown) => {
      request = null; // Se reintenta la próxima vez.
      throw error;
    });
  return request;
}

/**
 * Contornos de los 224 cantones (INEC), por código DPA, para pintar el semáforo
 * de todos los cantones (también los verdes). Se piden al abrir el análisis.
 */
export function useCantonGeometries(enabled: boolean): Map<string, CantonGeometry> | null {
  const [geometries, setGeometries] = useState<Map<string, CantonGeometry> | null>(null);
  useEffect(() => {
    if (!enabled || geometries) return;
    let active = true;
    loadGeometries()
      .then((map) => {
        if (active) setGeometries(map);
      })
      // Sin contornos el análisis sigue en la lista; solo no se pinta el mapa.
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [enabled, geometries]);
  return geometries;
}
