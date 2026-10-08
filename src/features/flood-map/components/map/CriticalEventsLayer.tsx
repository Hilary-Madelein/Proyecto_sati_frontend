"use client";

import L from "leaflet";
import { useCallback, useEffect, useRef } from "react";
import { Marker, Popup, useMap } from "react-leaflet";
import { SEVERITY_STYLES } from "../../constants";
import type { EventSeverity, HazardEvent } from "../../types";
import { EventPopupContent } from "./EventPopupContent";

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
  const popupRef = useRef<L.Popup>(null);
  // Recalcula tamaño y posición, y mueve el mapa si el popup ya no cabe.
  const refreshPopup = useCallback(() => popupRef.current?.update(), []);
  // Al seleccionarlo (en la lista o en el mapa), MapFocus vuela hacia el evento:
  // al terminar se abre el popup y se reacomoda para que se vea completo.
  // Se espera el "moveend" que sigue al inicio del vuelo: al empezar, Leaflet
  // detiene cualquier desplazamiento en curso y lanza un "moveend" anticipado.
  useEffect(() => {
    if (!selected) return;
    const openPopup = () => {
      markerRef.current?.openPopup();
      refreshPopup();
    };
    const waitForArrival = () => map.once("moveend", openPopup);
    map.once("movestart", waitForArrival);
    return () => {
      map.off("movestart", waitForArrival);
      map.off("moveend", openPopup);
    };
  }, [map, selected, focusRequest, refreshPopup]);

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
      <Popup ref={popupRef} className="event-popup" maxWidth={320} minWidth={240} autoPanPadding={[16, 16]}>
        <EventPopupContent event={event} onResize={refreshPopup} />
      </Popup>
    </Marker>
  );
}
