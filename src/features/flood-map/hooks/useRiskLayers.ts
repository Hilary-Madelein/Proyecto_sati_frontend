"use client";

import { useEffect, useRef, useState } from "react";
import { satiClientGet } from "@/lib/api/sati-client";
import { DATA_REFRESH_MS } from "../constants";
import type { RiskLayerData } from "../types";

export interface RiskLayerState {
  data: RiskLayerData | null;
  error: string | null;
  isLoading: boolean;
}

const EMPTY: RiskLayerState = { data: null, error: null, isLoading: false };

/**
 * Datos de las capas de gestión del riesgo encendidas. Cada capa se pide al
 * encenderla y, mientras siga encendida, se vuelve a pedir cada DATA_REFRESH_MS
 * (el backend la guarda en caché y consulta el servicio de origen solo cuando vence).
 * Al apagarla se conservan sus datos: volver a encenderla es inmediato.
 */
export function useRiskLayers(enabledIds: readonly string[]) {
  const [states, setStates] = useState<Record<string, RiskLayerState>>({});
  /** Cuándo llegó la última respuesta de cada capa, para no volver a pedirla en cada cambio. */
  const loadedAt = useRef(new Map<string, number>());
  const key = [...enabledIds].sort().join(",");

  useEffect(() => {
    if (!key) return;
    const ids = key.split(",");
    const controller = new AbortController();
    const update = (id: string, patch: Partial<RiskLayerState>) =>
      setStates((current) => ({ ...current, [id]: { ...EMPTY, ...current[id], ...patch } }));

    const load = (id: string) => {
      update(id, { isLoading: true });
      satiClientGet<RiskLayerData>(`/risk-layers/${id}`, undefined, controller.signal)
        .then((data) => {
          loadedAt.current.set(id, Date.now());
          update(id, { data, error: null, isLoading: false });
        })
        .catch((reason: Error) => {
          update(id, { error: reason.name === "AbortError" ? null : reason.message, isLoading: false });
        });
    };
    const loadDue = () => {
      for (const id of ids) {
        if (Date.now() - (loadedAt.current.get(id) ?? 0) >= DATA_REFRESH_MS) load(id);
      }
    };
    loadDue();
    const interval = setInterval(loadDue, DATA_REFRESH_MS / 5);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [key]);

  return (id: string): RiskLayerState => states[id] ?? EMPTY;
}
