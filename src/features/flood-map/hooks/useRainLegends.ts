"use client";

import { useEffect, useState } from "react";
import { satiClientGet } from "@/lib/api/sati-client";
import type { RainLegend } from "../types";

/** Las escalas no cambian durante la sesión: se piden una vez por capa. */
const cache = new Map<string, Promise<RainLegend>>();

function fetchLegend(layerId: string): Promise<RainLegend> {
  let request = cache.get(layerId);
  if (!request) {
    request = satiClientGet<RainLegend>(`/layers/${encodeURIComponent(layerId)}/legend`);
    // Si falla, se permite reintentar la próxima vez.
    request.catch(() => cache.delete(layerId));
    cache.set(layerId, request);
  }
  return request;
}

/**
 * Escalas de colores (paleta oficial del INAMHI) de las capas de lluvia
 * visibles. Si varias capas comparten la misma escala, se devuelve una sola.
 */
export function useRainLegends(layerIds: string[]): RainLegend[] {
  const [legends, setLegends] = useState<{ key: string; items: RainLegend[] } | null>(null);
  const key = layerIds.join("|");

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    Promise.allSettled(key.split("|").map(fetchLegend)).then((results) => {
      if (cancelled) return;
      const items = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
      const unique = items.filter(
        (legend, index) =>
          items.findIndex((other) => JSON.stringify(other.entries) === JSON.stringify(legend.entries)) === index,
      );
      setLegends({ key, items: unique });
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return key && legends?.key === key ? legends.items : [];
}
