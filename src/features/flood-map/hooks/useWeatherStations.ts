"use client";

import { useEffect, useState } from "react";
import { satiClientGet } from "@/lib/api/sati-client";
import { DATA_REFRESH_MS } from "../constants";
import type { WeatherStationsSnapshot } from "../types";

/**
 * Lluvia medida en las estaciones del INAMHI. Solo se pide con la capa
 * encendida, y mientras siga encendida se actualiza cada DATA_REFRESH_MS (la
 * fuente publica un dato por hora).
 */
export function useWeatherStations(enabled: boolean) {
  const [snapshot, setSnapshot] = useState<WeatherStationsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const load = () => {
      setIsLoading(true);
      satiClientGet<WeatherStationsSnapshot>("/weather-stations", undefined, controller.signal)
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
