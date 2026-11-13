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
 * Lo ya pedido en esta visita, por ruta y versión: volver a una ventana o a un día
 * (p. ej. en la animación) es instantáneo, sin esperar otra vez al servidor.
 * Pocas entradas: cada una es solo la descripción de una imagen.
 */
const cache = new Map<string, Promise<unknown>>();
const MAX_CACHED = 24;

const keyOf = (path: string, version: string) => `${path}@${version}`;

function load<T>(path: string, version: string, signal?: AbortSignal): Promise<T> {
  const key = keyOf(path, version);
  let pending = cache.get(key) as Promise<T> | undefined;
  if (!pending) {
    // Sin `signal`: lo pedido queda en la memoria aunque el componente cambie de ruta.
    pending = satiClientGet<T>(path);
    cache.set(key, pending);
    pending.catch(() => cache.delete(key));
    if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
  }
  if (!signal) return pending;
  return new Promise<T>((resolve, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    pending.then(resolve, reject);
  });
}

/**
 * Pide por adelantado una imagen de lluvia (su descripción y el PNG), para que esté
 * lista cuando se muestre: la animación precarga todos sus pasos al empezar.
 */
export function prefetchRainImage(path: string, version: string) {
  load<RainImage>(path, version)
    .then((data) => {
      const image = new Image();
      image.src = `/api/sati${data.imagePath}`;
    })
    .catch(() => {});
}

/**
 * Pide al backend una imagen de lluvia (pronóstico de un día o acumulado observado) y la
 * devuelve lista para el mapa. `path` = null apaga la capa. `version` cambia
 * cuando hay datos nuevos (corrida del modelo o última hora del satélite) y
 * fuerza a pedirlo otra vez. Ignora respuestas de pedidos anteriores.
 */
export function useRainImage<T extends RainImage>(path: string | null, version: string | null) {
  const [state, setState] = useState<State<T> | null>(null);
  const key = path && version ? keyOf(path, version) : null;

  useEffect(() => {
    if (!key || !path || !version) return;
    const controller = new AbortController();
    load<T>(path, version, controller.signal)
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
