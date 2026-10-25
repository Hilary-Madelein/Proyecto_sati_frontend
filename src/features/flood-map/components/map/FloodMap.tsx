"use client";

import "leaflet/dist/leaflet.css";
import L, { type FitBoundsOptions } from "leaflet";
import { useState } from "react";
import { MapContainer, Pane, TileLayer } from "react-leaflet";
import { IMERG_MAX_NATIVE_ZOOM, IMERG_TILE_URL, MAP_CONFIG, MAP_PANES } from "../../constants";
import type { RiskHit } from "../../risk-identify";
import type { RiskLayerStyle } from "../../risk-layers";
import type {
  CantonAnalysis,
  DailyRainForecast,
  FloodMapData,
  HazardEvent,
  LayerVisibility,
  ObservedAccumulatedRain,
  OverlayOpacity,
  RiskLayerData,
  SeaTemperatureAnomaly,
  SelectedRiver,
  WeatherStationsSnapshot,
} from "../../types";
import { AccumulatedRainLayer } from "./AccumulatedRainLayer";
import { CriticalEventsLayer } from "./CriticalEventsLayer";
import { CantonHighlight } from "./CantonHighlight";
import { FeatureHighlight } from "./FeatureHighlight";
import { FloodHubLayer } from "./FloodHubLayer";
import { MapClickHandler } from "./MapClickHandler";
import { MapControls } from "./MapControls";
import { MapFocus } from "./MapFocus";
import { RainPointPopup } from "./RainPointPopup";
import { RiverAlertsLayer } from "./RiverAlertsLayer";
import { RiskFeatureLayers } from "./RiskFeatureLayer";
import { RiverNetworkLayer } from "./RiverNetworkLayer";
import { WeatherStationsLayer } from "./WeatherStationsLayer";

export interface FloodMapProps {
  data: FloodMapData;
  /** Eventos que pasan los filtros del panel (los que se dibujan). */
  visibleEvents: HazardEvent[];
  layers: LayerVisibility;
  /** Lluvia pronosticada del día elegido (imagen del backend); null = sin capa. */
  rainForecast: { data: DailyRainForecast; attribution: string } | null;
  /** Lluvia observada acumulada hasta la última hora (imagen del backend); null = sin capa. */
  observedRain: { data: ObservedAccumulatedRain; attribution: string } | null;
  /** Anomalía de la temperatura del mar (imagen del backend); null = sin capa. */
  seaTemperature: SeaTemperatureAnomaly | null;
  /** Lluvia medida en las estaciones del INAMHI; null = sin capa. */
  weatherStations: WeatherStationsSnapshot | null;
  /** Capas de gestión del riesgo encendidas y con datos, en el orden en que se dibujan. */
  riskLayers: Array<{ style: RiskLayerStyle; data: RiskLayerData }>;
  /** Se tocó una entidad de una capa de gestión del riesgo: todas las que hay en ese punto. */
  onRiskFeaturesSelect: (hits: RiskHit[]) => void;
  /** Entidad abierta en el panel de detalle (se resalta) y pedidos de acercarla. */
  selectedRiskFeature: RiskHit | null;
  riskFeatureZoomRequest: number;
  /** Tasa de lluvia IMERG (NASA) de la última media hora. */
  showImerg: boolean;
  /** Cantón elegido en el análisis por cantón: se resalta y se encuadra. */
  selectedCanton: CantonAnalysis | null;
  /** Opacidad de cada capa de imagen (deslizadores del panel). */
  opacity: OverlayOpacity;
  onRainLoadingChange: (loading: boolean) => void;
  onObservedRainLoadingChange: (loading: boolean) => void;
  onSeaLoadingChange: (loading: boolean) => void;
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
  observedRain,
  seaTemperature,
  weatherStations,
  riskLayers,
  onRiskFeaturesSelect,
  selectedRiskFeature,
  riskFeatureZoomRequest,
  showImerg,
  selectedCanton,
  opacity,
  onRainLoadingChange,
  onObservedRainLoadingChange,
  onSeaLoadingChange,
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
  // Un solo lienzo para todas las capas de gestión del riesgo (ver MAP_PANES.risk).
  const [riskRenderer] = useState(() => L.canvas({ pane: MAP_PANES.risk.name }));

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
      <RainPointPopup forecast={rainForecast} observed={observedRain} sea={seaTemperature} />

      {seaTemperature && (
        <Pane name={MAP_PANES.seaTemperature.name} style={{ zIndex: MAP_PANES.seaTemperature.zIndex }}>
          <AccumulatedRainLayer
            rain={seaTemperature}
            opacity={opacity.sea}
            attribution={seaTemperature.attribution}
            onLoadingChange={onSeaLoadingChange}
          />
        </Pane>
      )}
      {showImerg && (
        <Pane name="imerg" style={{ zIndex: 346 }}>
          <TileLayer url={IMERG_TILE_URL} maxNativeZoom={IMERG_MAX_NATIVE_ZOOM} opacity={opacity.imerg} attribution="Lluvia IMERG: NASA GIBS" />
        </Pane>
      )}
      {observedRain && (
        <Pane name={MAP_PANES.observedRain.name} style={{ zIndex: MAP_PANES.observedRain.zIndex }}>
          <AccumulatedRainLayer
            rain={observedRain.data}
            opacity={opacity.observed}
            attribution={observedRain.attribution}
            onLoadingChange={onObservedRainLoadingChange}
          />
        </Pane>
      )}
      {rainForecast && (
        <Pane name={MAP_PANES.rain.name} style={{ zIndex: MAP_PANES.rain.zIndex }}>
          <AccumulatedRainLayer
            rain={rainForecast.data}
            opacity={opacity.forecast}
            attribution={rainForecast.attribution}
            onLoadingChange={onRainLoadingChange}
          />
        </Pane>
      )}
      {/* Pane fijo (vacío si no hay capas) con el lienzo compartido de las capas de gestión del riesgo. */}
      <Pane name={MAP_PANES.risk.name} style={{ zIndex: MAP_PANES.risk.zIndex }} />
      <RiskFeatureLayers layers={riskLayers} renderer={riskRenderer} onSelect={onRiskFeaturesSelect} />
      {selectedRiskFeature && <FeatureHighlight hit={selectedRiskFeature} zoomRequest={riskFeatureZoomRequest} />}
      {selectedCanton && <CantonHighlight canton={selectedCanton} />}
      {/* Marcadores en el panel de Leaflet: su popup queda encima de todo. */}
      {layers.floodHub && data.floodHub && <FloodHubLayer snapshot={data.floodHub} />}
      {/* En el panel de marcadores de Leaflet (sin Pane propio): así su popup queda encima de todo. */}
      {weatherStations && <WeatherStationsLayer snapshot={weatherStations} rain={data.rain} />}
      {layers.riverNetwork && (
        <>
          <Pane name={MAP_PANES.rivers.name} style={{ zIndex: MAP_PANES.rivers.zIndex }}>
            <RiverNetworkLayer pane={MAP_PANES.rivers.name} />
          </Pane>
          {/* Con una capa de lluvia o de mar activa, el clic muestra sus valores (ver RainPointPopup) y no el río. */}
          {!rainForecast && !observedRain && !seaTemperature && <MapClickHandler onClick={onRiverLookup} />}
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
