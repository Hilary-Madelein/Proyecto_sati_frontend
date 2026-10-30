"use client";

import { useEffect, useState } from "react";
import { satiClientGet } from "@/lib/api/sati-client";
import type { RiskAttachment } from "../types";

/** Fotos de una capa por id de entidad (solo las que tienen). */
export type LayerPhotos = Record<string, RiskAttachment[]>;

/**
 * Fotos de todas las entidades de las capas indicadas, una consulta por capa
 * (GET /risk-layers/:id/attachments). Se vuelven a pedir cuando cambia la
 * descarga de la capa (`fetchedAt`): así aparecen las fotos que suben después.
 * Mientras no llegan, la capa no figura en el resultado.
 */
export function useLayerPhotos(layers: ReadonlyArray<{ id: string; fetchedAt: string | null }>, enabled: boolean) {
  const [photos, setPhotos] = useState<Record<string, { fetchedAt: string; photos: LayerPhotos }>>({});
  const key = enabled ? layers.map((layer) => `${layer.id}@${layer.fetchedAt ?? ""}`).join(",") : "";

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    for (const item of key.split(",")) {
      const [id, fetchedAt] = item.split("@");
      if (!fetchedAt) continue;
      satiClientGet<LayerPhotos>(`/risk-layers/${id}/attachments`, undefined, controller.signal)
        .then((result) => setPhotos((current) => ({ ...current, [id]: { fetchedAt, photos: result } })))
        // Sin fotos la línea de tiempo se ve igual, solo sin imágenes.
        .catch(() => {});
    }
    return () => controller.abort();
  }, [key]);

  return (layerId: string): LayerPhotos | null => photos[layerId]?.photos ?? null;
}
