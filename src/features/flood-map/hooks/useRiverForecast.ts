"use client";

import { useEffect, useState } from "react";
import { satiClientGet } from "@/lib/api/sati-client";
import type { RiverForecast, SelectedRiver } from "../types";

/** Qué río mostrar: uno ya conocido (alerta) o el más cercano a un punto del mapa. */
export type RiverTarget = { kind: "river"; river: SelectedRiver } | { kind: "point"; lat: number; lng: number };

interface RiverForecastState {
  key: string;
  river: SelectedRiver | null;
  forecast: RiverForecast | null;
  error: string | null;
}

const keyOf = (target: RiverTarget) =>
  target.kind === "river" ? `river:${target.river.riverId}` : `point:${target.lat.toFixed(4)},${target.lng.toFixed(4)}`;

/**
 * Resuelve el tramo de río (si se pidió un punto) y descarga su pronóstico.
 * Ignora respuestas de pedidos anteriores si el usuario elige otro río.
 */
export function useRiverForecast(target: RiverTarget | null) {
  const [state, setState] = useState<RiverForecastState | null>(null);
  const key = target ? keyOf(target) : null;

  useEffect(() => {
    if (!target || !key) return;
    const controller = new AbortController();

    (async () => {
      let river: SelectedRiver | null = target.kind === "river" ? target.river : null;
      try {
        if (target.kind === "point") {
          river = await satiClientGet<SelectedRiver>("/rivers/at", { lat: target.lat, lng: target.lng }, controller.signal);
        }
        const forecast = await satiClientGet<RiverForecast>(`/rivers/${river!.riverId}/forecast`, undefined, controller.signal);
        setState({ key, river, forecast, error: null });
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setState({ key, river, forecast: null, error: (error as Error).message });
      }
    })();

    return () => controller.abort();
    // `key` resume el objetivo: no se repite el pedido si cambia solo la identidad del objeto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = state?.key === key ? state : null;
  return {
    isLoading: target !== null && current === null,
    river: current?.river ?? (target?.kind === "river" ? target.river : null),
    forecast: current?.forecast ?? null,
    error: current?.error ?? null,
  };
}
