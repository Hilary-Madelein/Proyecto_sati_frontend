"use client";

import { useEffect, useState } from "react";
import { satiClientGet } from "@/lib/api/sati-client";
import type { RainImage } from "../types";

interface State<T> {
  key: string;
  data: T | null;
  error: string | null;
}

/**
 * Pide al backend la imagen de lluvia pronosticada de un día y la
 * devuelve lista para el mapa. `path` = null apaga la capa. `version` cambia
 * cuando hay una corrida nueva del modelo y
 * fuerza a pedirlo otra vez. Ignora respuestas de pedidos anteriores.
 */
export function useRainImage<T extends RainImage>(path: string | null, version: string | null) {
  const [state, setState] = useState<State<T> | null>(null);
  const key = path && version ? `${path}@${version}` : null;

  useEffect(() => {
    if (!key || !path) return;
    const controller = new AbortController();
    satiClientGet<T>(path, undefined, controller.signal)
      .then((data) => setState({ key, data, error: null }))
      .catch((error: Error) => {
        if (error.name !== "AbortError") setState({ key, data: null, error: error.message });
      });
    return () => controller.abort();
    // `key` resume ruta y versión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = state?.key === key ? state : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    isLoading: key !== null && current === null,
  };
}
