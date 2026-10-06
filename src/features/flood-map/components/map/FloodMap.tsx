"use client";

import "leaflet/dist/leaflet.css";
import type { FitBoundsOptions } from "leaflet";
import { useState } from "react";
import { MapContainer, Pane, TileLayer } from "react-leaflet";
import { MAP_CONFIG, MAP_PANES, RAIN_FORECAST_OPACITY } from "../../constants";
import type { DailyRainForecast, FloodMapData, HazardEvent, LayerVisibility, SelectedRiver } from "../../types";
import { AccumulatedRainLayer } from "./AccumulatedRainLayer";
import { CriticalEventsLayer } from "./CriticalEventsLayer";
import { FlashFloodLayer } from "./FlashFloodLayer";
import { FluvialStationsLayer } from "./FluvialStationsLayer";
import { HistoricalFloodLayer } from "./HistoricalFloodLayer";
import { MapClickHandler } from "./MapClickHandler";
import { MapControls } from "./MapControls";
import { MapFocus } from "./MapFocus";
import { RiverAlertsLayer } from "./RiverAlertsLayer";
import { RiverNetworkLayer } from "./RiverNetworkLayer";

export interface FloodMapProps {
  data: FloodMapData;
  /** Eventos que pasan los filtros del panel (los que se dibujan). */
  visibleEvents: HazardEvent[];
  layers: LayerVisibility;
  /** Lluvia pronosticada del día elegido (imagen del backend); null = sin capa. */
  rainForecast: { data: DailyRainForecast; attribution: string } | null;
  onRainLoadingChange: (loading: boolean) => void;
  /** Día del pronóstico de caudales que muestran las alertas. */
  alertDayIndex: number;
  selectedRiverId: number | null;
  onSelectRiver: (river: SelectedRiver) => void;
  /** Clic en el mapa con la red de ríos visible: buscar el río más cercano. */
  onRiverLookup: (lat: number, lng: number) => void;
  selectedEventId: string | null;
  /** Se incrementa cada vez que se pide centrar el mapa en el evento seleccionado. */
  focusRequest: number;
  onSelectEvent: (id: string) => void;
}

/**
 * Mapa Leaflet. Depende de `window`, por eso se carga solo en el navegador
 * (ver `dynamic(..., { ssr: false })` en FloodMonitor).
 */
export default function FloodMap({
  data,
  visibleEvents,
  layers,
  rainForecast,
  onRainLoadingChange,
  alertDayIndex,
  selectedRiverId,
  onSelectRiver,
  onRiverLookup,
  selectedEventId,
  focusRequest,
  onSelectEvent,
}: FloodMapProps) {
  const selectedEvent = data.eventsFeed.events.find((event) => event.id === selectedEventId);
  const [boundsOptions] = useState(getInitialBoundsOptions);

  return (
    <MapContainer
      bounds={MAP_CONFIG.initialBounds}
      boundsOptions={boundsOptions}
      maxBounds={MAP_CONFIG.maxBounds}
      minZoom={MAP_CONFIG.minZoom}
      maxZoom={MAP_CONFIG.maxZoom}
      zoomControl={false}
      preferCanvas
      className="size-full bg-slate-100"
    >
      <TileLayer url={MAP_CONFIG.tiles.url} attribution={MAP_CONFIG.tiles.attribution} />
      <MapControls homeOptions={boundsOptions} />

      {rainForecast && (
        <Pane name={MAP_PANES.rain.name} style={{ zIndex: MAP_PANES.rain.zIndex }}>
          <AccumulatedRainLayer
            rain={rainForecast.data}
            opacity={RAIN_FORECAST_OPACITY}
            attribution={rainForecast.attribution}
            onLoadingChange={onRainLoadingChange}
          />
        </Pane>
      )}
      {layers.historical && (
        <Pane name={MAP_PANES.historical.name} style={{ zIndex: MAP_PANES.historical.zIndex }}>
          <HistoricalFloodLayer zones={data.historicalZones} />
        </Pane>
      )}
      {layers.flash && (
        <Pane name={MAP_PANES.flash.name} style={{ zIndex: MAP_PANES.flash.zIndex }}>
          <FlashFloodLayer zones={data.flashFloodZones} />
        </Pane>
      )}
      {layers.fluvial && (
        <Pane name={MAP_PANES.fluvial.name} style={{ zIndex: MAP_PANES.fluvial.zIndex }}>
          <FluvialStationsLayer stations={data.fluvialStations} />
        </Pane>
      )}
      {layers.riverNetwork && (
        <>
          <Pane name={MAP_PANES.rivers.name} style={{ zIndex: MAP_PANES.rivers.zIndex }}>
            <RiverNetworkLayer pane={MAP_PANES.rivers.name} />
          </Pane>
          <MapClickHandler onClick={onRiverLookup} />
        </>
      )}

      {layers.riverAlerts && data.riverAlerts && (
        <RiverAlertsLayer
          snapshot={data.riverAlerts}
          dayIndex={alertDayIndex}
          selectedRiverId={selectedRiverId}
          onSelect={onSelectRiver}
        />
      )}
      <CriticalEventsLayer
        events={visibleEvents}
        selectedId={selectedEventId}
        focusRequest={focusRequest}
        onSelect={onSelectEvent}
      />
      <MapFocus target={selectedEvent?.position ?? null} request={focusRequest} />
    </MapContainer>
  );
}

/** En escritorio el panel de capas tapa la derecha: se reserva ese espacio al encuadrar. */
function getInitialBoundsOptions(): FitBoundsOptions {
  const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
  return isDesktop
    ? { paddingTopLeft: [64, 16], paddingBottomRight: [410, 16] }
    : { padding: [16, 16] };
}
