"use client";

import { useState } from "react";
import type { RiskHit } from "../risk-identify";
import type { RiskLayerStyle } from "../risk-layers";
import type { RiskLayerData } from "../types";

/** Lo que se está dibujando de una capa, ya con sus filtros. */
export interface VisibleRiskLayer {
  style: RiskLayerStyle;
  data: RiskLayerData;
}

export interface FeatureDetailState {
  hits: RiskHit[];
  index: number;
}

/**
 * Panel de detalle de las capas de gestión del riesgo: al tocar una entidad se
 * muestran todas las de las capas encendidas en ese punto, y se puede pasar de
 * una a otra ("1 de N").
 */
export function useFeatureDetail(activeLayerIds: readonly string[], visibleLayers: readonly VisibleRiskLayer[]) {
  const [state, setState] = useState<FeatureDetailState | null>(null);
  const [zoomRequest, setZoomRequest] = useState(0);
  // Un pedido de acercar vale para esa selección: cerrado el detalle, el siguiente toque en el mapa no debe repetirlo.
  if (!state && zoomRequest !== 0) setZoomRequest(0);

  // Al apagar una capa, o si un filtro o una descarga nueva deja fuera una entidad, se
  // quita del detalle: su punto ya no está en el mapa. Si no queda ninguna, se cierra.
  const shown = [
    [...activeLayerIds].sort().join(","),
    ...visibleLayers.map(({ style, data }) => `${style.id}:${data.fetchedAt}:${data.view ?? ""}`),
  ].join("|");
  const [previousShown, setPreviousShown] = useState(shown);
  if (shown !== previousShown) {
    setPreviousShown(shown);
    if (state) setState(keepShown(state, activeLayerIds, visibleLayers));
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

/** Si sigue en el mapa. Una capa que aún no llega al mapa o una entidad sin id no permiten saberlo: se mantiene. */
function isStillDrawn(hit: RiskHit, visibleLayers: readonly VisibleRiskLayer[]): boolean {
  if (hit.pinned || hit.feature.id === undefined) return true;
  const layer = visibleLayers.find(({ style }) => style.id === hit.style.id);
  return !layer || layer.data.features.some((feature) => feature.id === hit.feature.id);
}

/** El detalle sin lo que salió del mapa, manteniendo la entidad que se estaba viendo si sigue. */
function keepShown(state: FeatureDetailState, activeLayerIds: readonly string[], visibleLayers: readonly VisibleRiskLayer[]): FeatureDetailState | null {
  const hits = state.hits.filter((hit) => activeLayerIds.includes(hit.style.id) && isStillDrawn(hit, visibleLayers));
  if (hits.length === 0) return null;
  const selectedKey = state.hits[state.index]?.key;
  return { hits, index: Math.max(0, hits.findIndex((hit) => hit.key === selectedKey)) };
}
