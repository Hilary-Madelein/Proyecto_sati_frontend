"use client";

import { useEffect, useEffectEvent } from "react";
import { CircleMarker, Pane, Tooltip, useMap } from "react-leaflet";
import { SEMAPHORE_STYLES } from "../../constants";
import type { ParishAlert, Semaphore } from "../../types";

const PANE = "parishAlerts";

interface ParishAlertLayerProps {
  /** Las parroquias del filtro (las mismas de la lista), de los niveles encendidos. */
  parishes: readonly ParishAlert[];
  /** La elegida en el panel: se resalta y el mapa va hacia ella. */
  selected: ParishAlert | null;
  onParishClick: (parish: ParishAlert) => void;
}

/** De abajo hacia arriba: los más graves se dibujan al final, encima. */
const DRAW_ORDER: readonly Semaphore[] = ["green", "yellow", "orange", "red"];
/** Los niveles bajos, más chicos: no tapan a los graves. */
const RADIUS: Record<Semaphore, number> = { red: 6, orange: 5, yellow: 4, green: 3.5 };

const formatMm = (mm: number | null) => (mm === null ? "—" : `${mm.toLocaleString("es-EC", { maximumFractionDigits: 1 })} mm`);

/**
 * Alerta de inundación en el mapa: un punto por parroquia con el color de su
 * nivel, donde se leyó el pronóstico. Los más graves quedan encima. Sobre las capas de gestión del riesgo.
 */
export function ParishAlertLayer({ parishes, selected, onParishClick }: ParishAlertLayerProps) {
  const map = useMap();
  const focus = useEffectEvent(() => {
    if (selected) map.flyTo(selected.point, Math.max(map.getZoom(), 10));
  });
  useEffect(() => focus(), [selected?.code]);

  // El elegido se dibuja aunque los filtros lo dejen fuera, y al final (encima de todos).
  const drawn = [
    ...DRAW_ORDER.flatMap((level) => parishes.filter((parish) => parish.semaphore === level && parish.code !== selected?.code)),
    ...(selected ? [selected] : []),
  ];

  return (
    <Pane name={PANE} style={{ zIndex: 450 }}>
      {drawn.map((parish) => {
        const isSelected = parish.code === selected?.code;
        const color = SEMAPHORE_STYLES[parish.semaphore].color;
        return (
          <CircleMarker
            key={parish.code}
            center={parish.point}
            radius={isSelected ? 9 : RADIUS[parish.semaphore]}
            pathOptions={{
              color: isSelected ? "#0f172a" : "#ffffff",
              weight: isSelected ? 2.5 : 1,
              fillColor: color,
              fillOpacity: 0.95,
            }}
            bubblingMouseEvents={false}
            eventHandlers={{ click: () => onParishClick(parish) }}
          >
            {/* En el panel de etiquetas de Leaflet: dentro del de los puntos, los que se dibujan después la taparían. */}
            <Tooltip pane="tooltipPane" direction="top" offset={[0, -6]}>
              <span className="text-xs">
                <strong>{parish.name}</strong> · {parish.canton}
                <br />
                {SEMAPHORE_STYLES[parish.semaphore].alert} · 12 h: {formatMm(parish.forecast.mm12h)} · 24 h: {formatMm(parish.forecast.mm24h)}
              </span>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </Pane>
  );
}
