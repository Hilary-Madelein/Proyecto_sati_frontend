"use client";

import { useEffect, useState } from "react";
import { WATERSHEDS_URL } from "./constants";
import type { WatershedSlope } from "./types";

export type WatershedGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;
export type WatershedCollection = GeoJSON.FeatureCollection<WatershedGeometry, { nombre: string; vertiente: WatershedSlope }>;

export interface Watershed {
  name: string;
  slope: WatershedSlope;
}

/** Una sola descarga por visita: la usan la capa y los popups de ríos y estaciones. */
let request: Promise<WatershedCollection> | null = null;

export function loadWatersheds(): Promise<WatershedCollection> {
  request ??= fetch(WATERSHEDS_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<WatershedCollection>;
    })
    .catch((error: unknown) => {
      request = null; // Se reintenta la próxima vez.
      throw error;
    });
  return request;
}

function isInRing(ring: GeoJSON.Position[], lng: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function contains(geometry: WatershedGeometry, lng: number, lat: number): boolean {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(([outer, ...holes]) => isInRing(outer, lng, lat) && !holes.some((hole) => isInRing(hole, lng, lat)));
}

/** La cuenca que contiene el punto, o null (en el mar o fuera del Ecuador). */
export function watershedAt(collection: WatershedCollection, lat: number, lng: number): Watershed | null {
  const feature = collection.features.find(({ geometry }) => contains(geometry, lng, lat));
  return feature ? { name: feature.properties.nombre, slope: feature.properties.vertiente } : null;
}

/** Cuenca de un punto para los popups; null mientras carga, si falla o si el punto cae fuera. */
export function useWatershedAt(lat: number | null, lng: number | null): Watershed | null {
  const [found, setFound] = useState<{ key: string; watershed: Watershed | null } | null>(null);
  const key = lat === null || lng === null ? null : `${lat},${lng}`;
  useEffect(() => {
    if (lat === null || lng === null) return;
    let active = true;
    loadWatersheds()
      .then((collection) => {
        if (active) setFound({ key: `${lat},${lng}`, watershed: watershedAt(collection, lat, lng) });
      })
      // Sin cuencas el popup sigue igual: solo no se muestra la línea.
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [lat, lng]);
  return found && found.key === key ? found.watershed : null;
}
