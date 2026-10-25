"use client";

import { useEffect, useState } from "react";
import { satiClientGet } from "@/lib/api/sati-client";
import { DATA_REFRESH_MS } from "../constants";
import type { CantonAnalysisSnapshot } from "../types";

/**
 * Alerta de inundación por cantón (lluvia pronosticada de 12 y 24 h). Se pide al abrir la pestaña
 * y, mientras siga abierta, cada DATA_REFRESH_MS (el backend lo recalcula cada hora).
 */
export function useCantonAnalysis(enabled: boolean) {
  const [snapshot, setSnapshot] = useState<CantonAnalysisSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const load = () => {
      setIsLoading(true);
      satiClientGet<CantonAnalysisSnapshot>("/canton-analysis", undefined, controller.signal)
        .then((data) => {
          setSnapshot(data);
          setError(null);
        })
        .catch((reason: Error) => {
          if (reason.name !== "AbortError") setError(reason.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    };
    load();
    const interval = setInterval(load, DATA_REFRESH_MS);
    return () => {
      controller.abort();
      clearInterval(interval);
      setIsLoading(false);
    };
  }, [enabled]);

  return { snapshot, error, isLoading: enabled && isLoading };
}
