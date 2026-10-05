"use client";

import { useEffect, useState } from "react";
import { satiClientGet } from "@/lib/api/sati-client";
import type { AccumulatedRain, RainForecastHours } from "../types";

interface State {
  key: string;
  data: AccumulatedRain | null;
  error: string | null;
}

/**
 * Pide al backend la lluvia pronosticada acumulada de `hours` horas de la
 * corrida `run` (null = capa apagada o sin datos). Ignora respuestas viejas.
 */
export function useAccumulatedRain(hours: RainForecastHours | null, run: string | null) {
  const [state, setState] = useState<State | null>(null);
  const key = hours && run ? `${run}:${hours}` : null;

  useEffect(() => {
    if (!key || !hours) return;
    const controller = new AbortController();
    satiClientGet<AccumulatedRain>(`/rain-forecast/accumulated/${hours}`, undefined, controller.signal)
      .then((data) => setState({ key, data, error: null }))
      .catch((error: Error) => {
        if (error.name !== "AbortError") setState({ key, data: null, error: error.message });
      });
    return () => controller.abort();
    // `key` resume horas y corrida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = state?.key === key ? state : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    isLoading: key !== null && current === null,
  };
}
