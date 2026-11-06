"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useState } from "react";
import { MapContainer, Pane, TileLayer } from "react-leaflet";
import {
  BASEMAPS,
  DEFAULT_BASEMAP,
  IMERG_MAX_NATIVE_ZOOM,
  IMERG_TILE_URL,
  MAP_CONFIG,
  MAP_PANES,
  type BasemapId,
} from "../../constants";
import type { RiskHit } from "../../risk-identify";
import type { RiskLayerStyle } from "../../risk-layers";
import type {
  ParishAlert,
  RainForecastLayer,
  FloodMapData,
  HazardEvent,
  LayerVisibility,
  ObservedAccumulatedRain,
  OverlayOpacity,
  ProvincePreparedness,
  RiskLayerData,
  SeaTemperatureAnomaly,
  SelectedRiver,
  WeatherStationsSnapshot,
} from "../../types";
import { AccumulatedRainLayer } from "./AccumulatedRainLayer";
import { CriticalEventsLayer } from "./CriticalEventsLayer";
import type { ProvinceGeometry } from "../../hooks/useProvinceGeometries";
import { CanvasZoomGuard } from "./CanvasZoomGuard";
import { FeatureHighlight } from "./FeatureHighlight";
import { getHomeBoundsOptions } from "./home-bounds";
import { FlashFloodLayer } from "./FlashFloodLayer";
import { ParishAlertLayer } from "./ParishAlertLayer";
import { RiskLineLabels } from "./RiskLineLabels";
import { MapClickHandler } from "./MapClickHandler";
import { MapControls } from "./MapControls";
import { MapFocus } from "./MapFocus";
import { ProvinceFocusBar } from "./ProvinceFocusBar";
import { MapLimits } from "./MapLimits";
import { ProvinceBoundaries } from "./ProvinceBoundaries";
import { ProvincePreparednessLayer } from "./ProvincePreparednessLayer";
import { RainPointPopup } from "./RainPointPopup";
import { RiverAlertsLayer } from "./RiverAlertsLayer";
import { RiskFeatureLayers, RiskPane } from "./RiskFeatureLayer";
import { WatershedsLayer } from "./WatershedsLayer";
import { RiverNetworkLayer } from "./RiverNetworkLayer";
import { WeatherStationsLayer } from "./WeatherStationsLayer";

export interface FloodMapProps {
  data: FloodMapData;
  /** Eventos que pasan los filtros del panel (los que se dibujan). */
  visibleEvents: HazardEvent[];
  layers: LayerVisibility;
  /** Lluvia pronosticada del día elegido (imagen del backend); null = sin capa. */
  rainForecast: RainForecastLayer | null;
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
  /** Parroquias en alerta del filtro (con la pestaña de la alerta abierta); null = no se dibujan. */
  parishAlerts: ParishAlert[] | null;
  /** Parroquia elegida en el panel: se resalta y el mapa va hacia ella. */
  selectedParish: ParishAlert | null;
  /** Índice de preparación provincial pintado en el mapa; null = no se dibuja. */
  provincePreparedness: { provinces: ProvincePreparedness[]; geometries: ReadonlyMap<string, ProvinceGeometry> } | null;
  /** Se tocó en el mapa el punto de una parroquia en alerta. */
  onParishClick: (parish: ParishAlert) => void;
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
  onDeselectEvent: (id: string) => void;
  /** Dónde se muestra el aviso de la provincia a la que se acercó: junto a las leyendas, sobre el mapa. */
  provinceBarSlot: HTMLElement | null;
  /** Se pidió volver a todo Ecuador: se cierra lo que estaba abierto. */
  onGoHome: () => void;
}

/**
 * Con zoom fraccionado (zoomSnap 1/4) el navegador escala las teselas y sus
 * bordes se pisan a medias; Leaflet las mezcla con `mix-blend-mode: plus-lighter`,
 * que suma los colores donde se pisan, y quedan líneas blancas en la cuadrícula.
 * En el mapa base (opaco) cada tesela se agranda 1 px y se mezcla normal: la de
 * al lado la tapa sin sumar. Solo en el mapa base: en capas semitransparentes
 * el solape se vería más oscuro.
 */
const COVER_TILE_SEAMS = {
  tileloadstart: ({ tile }: L.TileEvent) => {
    tile.style.width = `${parseFloat(tile.style.width) + 1}px`;
    tile.style.height = `${parseFloat(tile.style.height) + 1}px`;
    tile.style.mixBlendMode = "normal";
  },
};

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
  parishAlerts,
  selectedParish,
  provincePreparedness,
  onParishClick,
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
  onDeselectEvent,
  provinceBarSlot,
  onGoHome,
}: FloodMapProps) {
  const selectedEvent = data.eventsFeed.events.find((event) => event.id === selectedEventId);
  const [boundsOptions] = useState(getHomeBoundsOptions);
  // Un solo lienzo para todas las capas de gestión del riesgo (ver MAP_PANES.risk).
  const [riskRenderer] = useState(() => L.canvas({ pane: MAP_PANES.risk.name }));
  const [basemap, setBasemap] = useState<BasemapId>(DEFAULT_BASEMAP);

  return (
    <MapContainer
      bounds={MAP_CONFIG.initialBounds}
      boundsOptions={boundsOptions}
      minZoom={MAP_CONFIG.minZoom}
      // Zoom en pasos de 1/4: con enteros, Ecuador continental queda chico en el encuadre inicial.
      zoomSnap={0.25}
      maxZoom={MAP_CONFIG.maxZoom}
      zoomControl={false}
      preferCanvas
      className="size-full bg-slate-100"
    >
      <TileLayer
        key={basemap}
        url={BASEMAPS[basemap].url}
        maxNativeZoom={BASEMAPS[basemap].maxNativeZoom}
        attribution={BASEMAPS[basemap].attribution}
        eventHandlers={COVER_TILE_SEAMS}
      />
      {BASEMAPS[basemap].labelsUrl && (
        <Pane name={MAP_PANES.basemapLabels.name} style={{ zIndex: MAP_PANES.basemapLabels.zIndex, pointerEvents: "none" }}>
          <TileLayer key={basemap} url={BASEMAPS[basemap].labelsUrl} maxNativeZoom={BASEMAPS[basemap].maxNativeZoom} />
        </Pane>
      )}
      {BASEMAPS[basemap].provinceLinesMaxZoom !== null && <ProvinceBoundaries maxZoom={BASEMAPS[basemap].provinceLinesMaxZoom} />}
      {layers.watersheds && <WatershedsLayer />}
      <MapLimits />
      <CanvasZoomGuard />
      <ProvinceFocusBar slot={provinceBarSlot} onGoHome={onGoHome} />
      <MapControls basemap={basemap} onBasemapChange={setBasemap} onGoHome={onGoHome} />
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
      <RiskPane />
      <RiskFeatureLayers layers={riskLayers} renderer={riskRenderer} onSelect={onRiskFeaturesSelect} />
      <RiskLineLabels layers={riskLayers} />
      {selectedRiskFeature && <FeatureHighlight hit={selectedRiskFeature} zoomRequest={riskFeatureZoomRequest} />}
      {provincePreparedness && (
        <ProvincePreparednessLayer provinces={provincePreparedness.provinces} geometries={provincePreparedness.geometries} />
      )}
      {parishAlerts && <ParishAlertLayer parishes={parishAlerts} selected={selectedParish} onParishClick={onParishClick} />}
      {layers.flashFloods && data.floodHub?.flashFloods && (
        <FlashFloodLayer areas={data.floodHub.flashFloods} attribution={data.floodHub.attribution} renderer={riskRenderer} />
      )}
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
        onDeselect={onDeselectEvent}
      />
      <MapFocus target={selectedEvent?.position ?? null} province={selectedEvent?.province} request={focusRequest} />
    </MapContainer>
  );
}
