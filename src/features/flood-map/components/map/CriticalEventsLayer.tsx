"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";
import { Marker, Popup, useMap } from "react-leaflet";
import { formatDateTime } from "@/lib/format";
import { SEVERITY_STYLES } from "../../constants";
import type { EventSeverity, HazardEvent } from "../../types";
import { SeverityPill } from "../SeverityPill";

const iconCache = new Map<string, L.DivIcon>();

/**
 * Marcador del evento (estilos en globals.css → .critical-marker). Solo los
 * críticos y altos llevan pulso: con decenas de eventos, que todo parpadee
 * distraería de lo importante.
 */
function getEventIcon(severity: EventSeverity, selected: boolean) {
  const key = `${severity}-${selected}`;
  let icon = iconCache.get(key);
  if (!icon) {
    const classes = ["critical-marker__wrap", selected && "is-selected", severity === "moderate" && "is-quiet"]
      .filter(Boolean)
      .join(" ");
    const pulse = severity === "moderate" ? "" : '<span class="critical-marker__pulse"></span>';
    icon = L.divIcon({
      className: "critical-marker",
      html: `<span class="${classes}" style="--marker-color:${SEVERITY_STYLES[severity].color}">${pulse}<span class="critical-marker__dot"></span></span>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -14],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

interface CriticalEventsLayerProps {
  events: HazardEvent[];
  selectedId: string | null;
  focusRequest: number;
  onSelect: (id: string) => void;
}

export function CriticalEventsLayer({ events, selectedId, focusRequest, onSelect }: CriticalEventsLayerProps) {
  return events.map((event) => (
    <EventMarker
      key={event.id}
      event={event}
      selected={event.id === selectedId}
      focusRequest={focusRequest}
      onSelect={onSelect}
    />
  ));
}

function EventMarker({
  event,
  selected,
  focusRequest,
  onSelect,
}: {
  event: HazardEvent;
  selected: boolean;
  focusRequest: number;
  onSelect: (id: string) => void;
}) {
  const map = useMap();
  const markerRef = useRef<L.Marker>(null);
  const place = [event.canton, event.province].filter(Boolean).join(", ") || "Ubicación sin especificar";
  const impact = [
    [event.impact.affected, "afectados"],
    [event.impact.housesAffected, "viviendas"],
    [event.impact.evacuated, "evacuados"],
    [event.impact.deceased, "fallecidos"],
  ] as const;

  // Al seleccionarlo desde la lista, abre el popup cuando el mapa termina de volar.
  useEffect(() => {
    if (!selected) return;
    const openPopup = () => markerRef.current?.openPopup();
    map.once("moveend", openPopup);
    return () => {
      map.off("moveend", openPopup);
    };
  }, [map, selected, focusRequest]);

  return (
    <Marker
      ref={markerRef}
      position={event.position}
      icon={getEventIcon(event.severity, selected)}
      zIndexOffset={selected ? 1000 : SEVERITY_STYLES[event.severity].rank * -100}
      keyboard
      title={event.title}
      eventHandlers={{ click: () => onSelect(event.id) }}
    >
      <Popup maxWidth={300}>
        <div className="flex items-center justify-between gap-3 pr-5">
          <p className="text-[11px] font-medium text-slate-500">
            {event.hazardTypeLabel}
            {event.level !== null && ` · Nivel ${event.level}`}
          </p>
          <SeverityPill severity={event.severity} />
        </div>
        <p className="mt-1 text-sm font-semibold text-slate-900">{event.title}</p>
        {event.sector && <p className="text-xs text-slate-500">{event.sector}</p>}
        {event.description && <p className="mt-1 line-clamp-4 text-xs text-slate-600">{event.description}</p>}
        <div className="mt-2 grid grid-cols-4 gap-1 text-center">
          {impact.map(([value, label]) => (
            <div key={label} className="rounded-md bg-slate-50 px-1 py-1">
              <p className="text-xs font-semibold text-slate-900 tabular-nums">{value.toLocaleString("es-EC")}</p>
              <p className="text-[10px] text-slate-500">{label}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-500">
          {place} · {formatDateTime(event.occurredAt)}
          {event.code && ` · ${event.code}`}
        </p>
      </Popup>
    </Marker>
  );
}
