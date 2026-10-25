"use client";

import { useState } from "react";
import type { RiskHit } from "../risk-identify";

export interface FeatureDetailState {
  hits: RiskHit[];
  index: number;
}

/**
 * Panel de detalle de las capas de gestión del riesgo: al tocar una entidad se
 * muestran todas las de las capas encendidas en ese punto, y se puede pasar de
 * una a otra ("1 de N").
 */
export function useFeatureDetail(activeLayerIds: readonly string[]) {
  const [state, setState] = useState<FeatureDetailState | null>(null);
  const [zoomRequest, setZoomRequest] = useState(0);

  // Al apagar una capa se quitan sus entidades del detalle; si no queda ninguna, se cierra.
  const layerIds = [...activeLayerIds].sort().join(",");
  const [previousLayerIds, setPreviousLayerIds] = useState(layerIds);
  if (layerIds !== previousLayerIds) {
    setPreviousLayerIds(layerIds);
    if (state) setState(keepActiveLayers(state, activeLayerIds));
  }

  const go = (step: 1 | -1) =>
    setState((current) =>
      current ? { ...current, index: (current.index + step + current.hits.length) % current.hits.length } : current,
    );

  return {
    state,
    selected: state ? (state.hits[state.index] ?? null) : null,
    open: (hits: RiskHit[]) => setState(hits.length > 0 ? { hits, index: 0 } : null),
    close: () => setState(null),
    next: () => go(1),
    previous: () => go(-1),
    zoomRequest,
    zoomToSelected: () => setZoomRequest((n) => n + 1),
  };
}

/** El detalle sin las entidades de capas apagadas, manteniendo la que se estaba viendo si sigue. */
function keepActiveLayers(state: FeatureDetailState, activeLayerIds: readonly string[]): FeatureDetailState | null {
  const hits = state.hits.filter((hit) => activeLayerIds.includes(hit.style.id));
  if (hits.length === 0) return null;
  const selectedKey = state.hits[state.index]?.key;
  return { hits, index: Math.max(0, hits.findIndex((hit) => hit.key === selectedKey)) };
}
