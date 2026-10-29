"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ResponsivePanel } from "@/components/shared/ResponsivePanel";
import { FloatingButton } from "@/components/ui/FloatingButton";
import { IconTile } from "@/components/ui/IconTile";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { CircleDotIcon, LayersIcon } from "@/components/ui/icons";
import { formatDateTime } from "@/lib/format";
import {
  DATA_REFRESH_MS,
  DEFAULT_EVENT_FILTERS,
  DEFAULT_LAYER_VISIBILITY,
  DEFAULT_OVERLAY_OPACITY,
  DEFAULT_RISK_COMPONENT,
  RISK_COMPONENTS,
  DEFAULT_FORECAST_DAY,
  FORECAST_DAY_LABELS,
  EVENT_PERIODS,
  observedRainLegendLayer,
  RAIN_FORECAST_LEGEND_LAYER,
} from "../constants";
import { useRainImage } from "../hooks/useRainImage";
import { useRainLegends } from "../hooks/useRainLegends";
import { DEFAULT_PARISH_FILTERS, filterParishes, type ParishFilters } from "../parish-filters";
import { useCantonAnalysis } from "../hooks/useCantonAnalysis";
import { useProvinceGeometries } from "../hooks/useProvinceGeometries";
import { useFeatureDetail } from "../hooks/useFeatureDetail";
import { useRiskLayers } from "../hooks/useRiskLayers";
import { useWeatherStations } from "../hooks/useWeatherStations";
import { RISK_LAYER_STYLES, riskDataId, riskLayerView, type RiskLayerStyle, type RiskPeriodDays } from "../risk-layers";
import { filterEvents } from "../utils";
import type { RiverTarget } from "../hooks/useRiverForecast";
import type {
  ActiveLayer,
  ParishAlert,
  EventFilters,
  OverlayOpacity,
  RiskComponentId,
  FloodLayerId,
  FloodMapData,
  LayerVisibility,
  DailyRainForecast,
  ForecastDay,
  ObservedAccumulatedRain,
  ObservedRainAvailability,
  ObservedRainProduct,
  RainForecastAvailability,
  RainWindowHours,
  SelectedRiver,
} from "../types";
import { RainLegend } from "./map/RainLegend";
import { RiverAlertLegend } from "./map/RiverAlertLegend";
import { SeaTemperatureLegend } from "./map/SeaTemperatureLegend";
import { ParishAlertPanel } from "./panels/ParishAlertPanel";
import { CriticalEventsPanel, EventsExpandButton } from "./panels/CriticalEventsPanel";
import { RISK_COMPONENT_ICONS, RiskComponentBar } from "./navigation/RiskComponentBar";
import { ActiveLayersBar } from "./panels/ActiveLayersBar";
import { FloodHubSection, RiversSection } from "./panels/FloodLayersSection";
import { PreparednessSection } from "./panels/PreparednessSection";
import { RiskLayersSection } from "./panels/RiskLayersSection";
import { ObservedRainSection } from "./panels/ObservedRainSection";
import { RainForecastSection } from "./panels/RainForecastSection";
import { SeaTemperatureSection } from "./panels/SeaTemperatureSection";
import { WeatherStationsRow } from "./panels/WeatherStationsRow";
import { FeatureDetailPanel } from "./panels/FeatureDetailPanel";
import { ImergRow } from "./panels/ImergRow";
import { RiverPanel } from "./river/RiverPanel";

// Leaflet usa `window`: el mapa se renderiza solo en el navegador.
const FloodMap = dynamic(() => import("./map/FloodMap"), {
  ssr: false,
  loading: () => (
    <div className="grid size-full place-items-center bg-slate-100">
      <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">
        <span className="size-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        Cargando mapa…
      </div>
    </div>
  ),
});

type PanelId = "layers" | "events";

export function FloodMonitor({ data }: { data: FloodMapData }) {
  const router = useRouter();
  // Lluvia pronosticada (WRF), un día a la vez
  const [forecastDay, setForecastDay] = useState<ForecastDay>(() => initialForecastDay(data.rain));
  // Apagada al inicio para que la vista inicial muestre solo la red de ríos.
  const [showRain, setShowRain] = useState(false);
  const [rainLoading, setRainLoading] = useState(false);
  // Lluvia observada (satélite). Apagada al inicio, como la pronosticada.
  const [showObservedRain, setShowObservedRain] = useState(false);
  const [observedProduct, setObservedProduct] = useState<ObservedRainProduct>(() => initialObservedProduct(data.observedRain));
  const [observedHours, setObservedHours] = useState<RainWindowHours>(24);
  const [observedRainLoading, setObservedRainLoading] = useState(false);
  // Lluvia medida en las estaciones del INAMHI. Apagada al inicio; se pide al encenderla.
  const [showStations, setShowStations] = useState(false);
  const stations = useWeatherStations(showStations);
  // Lluvia IMERG (NASA) de la última media hora. Apagada al inicio.
  const [showImerg, setShowImerg] = useState(false);
  // Opacidad de las capas de imagen, para que se distingan al superponerlas.
  const [opacity, setOpacity] = useState<OverlayOpacity>({ ...DEFAULT_OVERLAY_OPACITY });
  const opacityHandler = (key: keyof OverlayOpacity) => (value: number) => setOpacity((current) => ({ ...current, [key]: value }));
  // Anomalía de la temperatura del mar (El Niño)
  const [showSea, setShowSea] = useState(false);
  const [seaLoading, setSeaLoading] = useState(false);
  // Caudales (GEOGLOWS)
  const [alertDayIndex, setAlertDayIndex] = useState(0);
  const [riverTarget, setRiverTarget] = useState<RiverTarget | null>(null);

  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYER_VISIBILITY);
  // Capas de gestión del riesgo (servicios de ArcGIS y GeoJSON propios): apagadas al inicio, se piden al encenderlas.
  const [riskLayersOn, setRiskLayersOn] = useState<ReadonlySet<string>>(() => new Set());
  // Varias capas pueden salir de la misma del backend (p. ej. albergues y campamentos): se pide una vez.
  const riskLayerState = useRiskLayers([
    ...new Set(RISK_LAYER_STYLES.filter((style) => riskLayersOn.has(style.id)).map(riskDataId)),
  ]);
  // Periodo elegido en las capas con fecha (si no se eligió, el de la capa).
  const [riskPeriods, setRiskPeriods] = useState<Record<string, RiskPeriodDays>>({});
  const periodOf = (style: RiskLayerStyle) => (style.id in riskPeriods ? riskPeriods[style.id] : (style.period?.defaultDays ?? null));
  /** Estado de la capa con sus datos ya filtrados (su parte y su periodo). */
  const riskViewState = (style: RiskLayerStyle) => {
    const state = riskLayerState(riskDataId(style));
    return state.data ? { ...state, data: riskLayerView(style, state.data, periodOf(style)) } : state;
  };
  // Panel de detalle al tocar una entidad de esas capas.
  const featureDetail = useFeatureDetail([...riskLayersOn]);
  // Componente elegido en la barra superior: el panel de capas muestra solo sus capas,
  // pero las encendidas de los demás siguen en el mapa (así se cruza la información).
  const [riskTab, setRiskTab] = useState<RiskComponentId>(DEFAULT_RISK_COMPONENT);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);

  // Escritorio: capas abierto; eventos abierto solo si hay alguno en el periodo
  // inicial (últimas 24 h), si no queda minimizado en su botón. Móvil: una hoja
  // a la vez, cerradas al inicio.
  const [desktopPanels, setDesktopPanels] = useState<Record<PanelId, boolean>>(() => ({
    layers: true,
    events: filterEvents(data.eventsFeed.events, DEFAULT_EVENT_FILTERS, data.eventsFeed.fetchedAt).length > 0,
  }));
  const [mobileSheet, setMobileSheet] = useState<PanelId | null>(null);
  const [eventsExpanded, setEventsExpanded] = useState(false);
  const [eventFilters, setEventFilters] = useState<EventFilters>(DEFAULT_EVENT_FILTERS);
  // Segunda pestaña del panel de eventos: alerta de inundación por parroquia (lluvia de 12 y 24 h).
  const [eventsTab, setEventsTab] = useState<"events" | "analysis">("events");
  // Índice de preparación provincial (pestaña Preparación): viene en el mismo análisis, y se pide al encenderlo.
  const [showPreparedness, setShowPreparedness] = useState(false);
  const cantonAnalysis = useCantonAnalysis(eventsTab === "analysis" || showPreparedness);
  const provinceGeometries = useProvinceGeometries(showPreparedness);
  const [selectedParish, setSelectedParish] = useState<ParishAlert | null>(null);
  // Filtros de la alerta: la lista y el mapa muestran las mismas parroquias.
  const [parishFilters, setParishFilters] = useState<ParishFilters>(DEFAULT_PARISH_FILTERS);
  const alertSnapshot = eventsTab === "analysis" ? cantonAnalysis.snapshot : null;

  const { events, fetchedAt, error: eventsError } = data.eventsFeed;
  // Los filtros se aplican a la lista y a los marcadores del mapa por igual.
  const filteredEvents = useMemo(() => filterEvents(events, eventFilters, fetchedAt), [events, eventFilters, fetchedAt]);
  const criticalCount = events.filter((event) => event.severity === "critical").length;
  const forecastAvailable = data.rain?.days.some((item) => item.day === forecastDay && item.available) ?? false;
  const forecast = useRainImage<DailyRainForecast>(
    showRain && forecastAvailable ? `/rain-forecast/days/${forecastDay}` : null,
    data.rain?.run ?? null,
  );
  const rainForecast = forecast.data ? { data: forecast.data, attribution: data.rain?.attribution ?? "" } : null;

  // Lluvia observada: el backend suma las horas del satélite hasta la última disponible.
  const observedStatus = data.observedRain?.products.find((product) => product.key === observedProduct);
  const observedAvailable = observedStatus?.windows.some((item) => item.hours === observedHours && item.available) ?? false;
  const observed = useRainImage<ObservedAccumulatedRain>(
    showObservedRain && observedAvailable ? `/observed-rain/${observedProduct}/accumulated/${observedHours}` : null,
    // La última hora con datos: cuando llega una nueva, se vuelve a pedir el acumulado.
    observedStatus?.latest ?? null,
  );
  const observedRain = observed.data ? { data: observed.data, attribution: observedStatus?.attribution ?? "" } : null;
  const selectedRiverId = riverTarget?.kind === "river" ? riverTarget.river.riverId : null;

  // Leyenda de lluvia: aparece cuando hay alguna capa de lluvia visible en el mapa.
  const rainSources = [
    rainForecast && { layerId: RAIN_FORECAST_LEGEND_LAYER, label: `Pronóstico ${FORECAST_DAY_LABELS[forecastDay].range}` },
    observedRain && {
      layerId: observedRainLegendLayer(observedProduct),
      label: `Satélite ${observedStatus?.name ?? ""} ${observedHours} h`,
    },
  ].filter((source) => source !== null);
  const rainLegends = useRainLegends(rainSources.map((source) => source.layerId));

  // Vuelve a pedir los datos al servidor cada cierto tiempo, sin recargar la página.
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), DATA_REFRESH_MS);
    return () => clearInterval(interval);
  }, [router]);

  // Capas encendidas de todos los componentes: se superponen en el mapa y se listan en "En el mapa".
  const activeLayers: ActiveLayer[] = [
    showRain && { key: "rain", label: "Pronóstico de lluvia", component: "amenaza" as const, turnOff: () => setShowRain(false) },
    showObservedRain && { key: "observed", label: "Lluvia observada", component: "amenaza" as const, turnOff: () => setShowObservedRain(false) },
    showStations && { key: "stations", label: "Lluvia en estaciones", component: "amenaza" as const, turnOff: () => setShowStations(false) },
    layers.riverNetwork && { key: "riverNetwork", label: "Red de ríos", component: "amenaza" as const, turnOff: () => toggleLayer("riverNetwork", false) },
    layers.riverAlerts && { key: "riverAlerts", label: "Alertas por caudal", component: "amenaza" as const, turnOff: () => toggleLayer("riverAlerts", false) },
    layers.floodHub && { key: "floodHub", label: "Flood Hub", component: "amenaza" as const, turnOff: () => toggleLayer("floodHub", false) },
    showSea && { key: "sea", label: "Temperatura del mar", component: "amenaza" as const, turnOff: () => setShowSea(false) },
    showImerg && { key: "imerg", label: "Lluvia IMERG", component: "amenaza" as const, turnOff: () => setShowImerg(false) },
    showPreparedness && {
      key: "preparedness",
      label: "Índice de preparación",
      component: "preparacion" as const,
      turnOff: () => setShowPreparedness(false),
    },
    ...RISK_LAYER_STYLES.filter((layer) => riskLayersOn.has(layer.id)).map((layer) => ({
      key: `risk:${layer.id}`,
      label: layer.title,
      component: layer.component,
      turnOff: () => toggleRiskLayer(layer.id, false),
    })),
  ].filter((layer) => layer !== false);
  // Se dibujan en el orden del catálogo, con los datos ya recibidos.
  const visibleRiskLayers = RISK_LAYER_STYLES.flatMap((style) => {
    const data = riskLayersOn.has(style.id) ? riskViewState(style).data : null;
    return data ? [{ style, data }] : [];
  });
  const activeCounts = Object.fromEntries(
    RISK_COMPONENTS.map((item) => [item.id, activeLayers.filter((layer) => layer.component === item.id).length]),
  ) as Record<RiskComponentId, number>;

  const openDesktopPanel = (panel: PanelId) => setDesktopPanels((current) => ({ ...current, [panel]: true }));

  const closePanel = (panel: PanelId) => {
    setDesktopPanels((current) => ({ ...current, [panel]: false }));
    setMobileSheet(null);
  };

  const openMobileSheet = (panel: PanelId) => {
    // En móvil solo cabe una hoja a la vez: abrir otra cierra la del río y la del detalle.
    setRiverTarget(null);
    featureDetail.close();
    setMobileSheet(panel);
  };

  /** Elegir un componente en la barra superior abre el panel de capas con sus capas. */
  const selectRiskComponent = (component: RiskComponentId) => {
    setRiskTab(component);
    if (window.matchMedia("(min-width: 1024px)").matches) openDesktopPanel("layers");
    else openMobileSheet("layers");
  };
  const riskComponent = RISK_COMPONENTS.find((item) => item.id === riskTab) ?? RISK_COMPONENTS[0];
  const RiskIcon = RISK_COMPONENT_ICONS[riskComponent.id];

  const showRiver = (target: RiverTarget) => {
    featureDetail.close();
    setRiverTarget(target);
    setMobileSheet(null);
  };

  const toggleLayer = (layer: FloodLayerId, enabled: boolean) =>
    setLayers((current) => ({ ...current, [layer]: enabled }));

  const toggleRiskLayer = (id: string, enabled: boolean) =>
    setRiskLayersOn((current) => {
      const next = new Set(current);
      if (enabled) next.add(id);
      else next.delete(id);
      return next;
    });

  const selectEvent = (id: string) => {
    setSelectedEventId(id);
    setFocusRequest((n) => n + 1);
    // En móvil se cierra la hoja para que se vea el mapa centrado en el evento.
    setMobileSheet(null);
  };

  return (
    <div className="flex size-full flex-col">
      <RiskComponentBar value={riskTab} onSelect={selectRiskComponent} activeCounts={activeCounts} />
      {/* El mapa y todo lo que flota sobre él se ubican respecto de esta área, debajo de la barra. */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <FloodMap
          data={data}
          // Con la alerta de inundación abierta, el mapa muestra solo sus parroquias (sin los eventos de la SNGR).
          visibleEvents={eventsTab === "analysis" ? [] : filteredEvents}
          layers={layers}
          rainForecast={rainForecast}
          observedRain={observedRain}
          seaTemperature={showSea ? data.seaTemperature : null}
          weatherStations={showStations ? stations.snapshot : null}
          riskLayers={visibleRiskLayers}
          onRiskFeaturesSelect={(hits) => {
            // Un solo detalle a la vez: se cierran el del río y la hoja móvil.
            setRiverTarget(null);
            setMobileSheet(null);
            featureDetail.open(hits);
          }}
          selectedRiskFeature={featureDetail.selected}
          riskFeatureZoomRequest={featureDetail.zoomRequest}
          showImerg={showImerg}
          parishAlerts={alertSnapshot ? filterParishes(alertSnapshot.parishes ?? [], parishFilters).listed : null}
          selectedParish={eventsTab === "analysis" ? selectedParish : null}
          provincePreparedness={
            showPreparedness && cantonAnalysis.snapshot?.provinces && provinceGeometries
              ? { provinces: cantonAnalysis.snapshot.provinces, geometries: provinceGeometries }
              : null
          }
          onParishClick={(parish) => {
            // La ficha está en el panel de la alerta: se abre si estaba cerrado.
            setSelectedParish(parish);
            if (window.matchMedia("(min-width: 1024px)").matches) openDesktopPanel("events");
            else openMobileSheet("events");
          }}
          opacity={opacity}
          onRainLoadingChange={setRainLoading}
          onObservedRainLoadingChange={setObservedRainLoading}
          onSeaLoadingChange={setSeaLoading}
          alertDayIndex={alertDayIndex}
          selectedRiverId={selectedRiverId}
          onSelectRiver={(river: SelectedRiver) => showRiver({ kind: "river", river })}
          onRiverLookup={(lat, lng) => showRiver({ kind: "point", lat, lng })}
          selectedEventId={selectedEventId}
          focusRequest={focusRequest}
          onSelectEvent={selectEvent}
        />
        {/* Leyendas de las capas visibles, una debajo de la otra. */}
        {(rainLegends.length > 0 || (showSea && data.seaTemperature) || (layers.riverAlerts && data.riverAlerts)) && (
          <div className="absolute top-4 left-16 z-1000 flex w-56 flex-col gap-2">
            <RainLegend legends={rainLegends} sources={rainSources.map((source) => source.label)} />
            {showSea && data.seaTemperature && <SeaTemperatureLegend legend={data.seaTemperature.legend} />}
            {layers.riverAlerts && data.riverAlerts && <RiverAlertLegend snapshot={data.riverAlerts} dayIndex={alertDayIndex} />}
          </div>
        )}

        <ResponsivePanel
          title={riskComponent.label}
          subtitle={riskComponent.description}
          icon={
            <IconTile className="bg-blue-600 text-white shadow-sm shadow-blue-600/30">
              <RiskIcon className="size-4.5" />
            </IconTile>
          }
          mobileOpen={mobileSheet === "layers"}
          desktopOpen={desktopPanels.layers}
          onClose={() => closePanel("layers")}
          desktopClassName="lg:top-4 lg:right-4 lg:bottom-auto lg:left-auto lg:w-95 lg:max-h-[calc(100%-2rem)]"
        >
          <div className="space-y-4">
            <ActiveLayersBar layers={activeLayers} />

            {riskTab === "amenaza" ? (
              <div className="space-y-5">
                <RainForecastSection
                  rain={data.rain}
                  day={forecastDay}
                  onDayChange={setForecastDay}
                  visible={showRain}
                  onVisibleChange={setShowRain}
                  error={forecast.error}
                  isLoading={forecast.isLoading || rainLoading}
                  opacity={opacity.forecast}
                  onOpacityChange={opacityHandler("forecast")}
                />
                <ObservedRainSection
                  availability={data.observedRain}
                  visible={showObservedRain}
                  onVisibleChange={setShowObservedRain}
                  product={observedProduct}
                  onProductChange={setObservedProduct}
                  hours={observedHours}
                  onHoursChange={setObservedHours}
                  accumulated={observed.data}
                  error={observed.error}
                  isLoading={(showObservedRain && (observed.isLoading || observedRainLoading)) || stations.isLoading}
                  active={showObservedRain || showStations || showImerg}
                  opacity={opacity.observed}
                  onOpacityChange={opacityHandler("observed")}
                >
                  <WeatherStationsRow
                    snapshot={stations.snapshot}
                    visible={showStations}
                    onVisibleChange={setShowStations}
                    error={stations.error}
                  />
                  <ImergRow
                    visible={showImerg}
                    onVisibleChange={setShowImerg}
                    opacity={opacity.imerg}
                    onOpacityChange={opacityHandler("imerg")}
                  />
                </ObservedRainSection>
                <RiversSection
                  data={data}
                  layers={layers}
                  onToggleLayer={toggleLayer}
                  alertDayIndex={alertDayIndex}
                  onAlertDayChange={setAlertDayIndex}
                />
                <FloodHubSection data={data} layers={layers} onToggleLayer={toggleLayer} />
                <RiskLayersSection
                  component="amenaza"
                  enabled={riskLayersOn}
                  onToggle={toggleRiskLayer}
                  stateOf={riskViewState}
                  periodOf={periodOf}
                  onPeriodChange={(id, days) => setRiskPeriods((current) => ({ ...current, [id]: days }))}
                />
                <SeaTemperatureSection
                  sea={data.seaTemperature}
                  visible={showSea}
                  onVisibleChange={setShowSea}
                  isLoading={seaLoading}
                  opacity={opacity.sea}
                  onOpacityChange={opacityHandler("sea")}
                />
              </div>
            ) : (
              <div className="space-y-5">
                <RiskLayersSection
                  component={riskTab}
                  enabled={riskLayersOn}
                  onToggle={toggleRiskLayer}
                  stateOf={riskViewState}
                  periodOf={periodOf}
                  onPeriodChange={(id, days) => setRiskPeriods((current) => ({ ...current, [id]: days }))}
                />
                {/* Al final de Preparación, después de sus capas. */}
                {riskTab === "preparacion" && (
                  <PreparednessSection
                    provinces={cantonAnalysis.snapshot?.provinces ?? null}
                    weights={cantonAnalysis.snapshot?.preparednessWeights ?? null}
                    error={cantonAnalysis.error}
                    isLoading={cantonAnalysis.isLoading}
                    visible={showPreparedness}
                    onVisibleChange={setShowPreparedness}
                  />
                )}
                <p className="text-[11px] text-slate-500">
                  Lo que enciendas en cualquier componente se ve junto en el mapa, para cruzar la información.
                </p>
              </div>
            )}
          </div>
        </ResponsivePanel>

        <ResponsivePanel
          title={eventsTab === "analysis" ? "Alerta de inundación" : "Eventos críticos"}
          subtitle={
            eventsTab === "analysis"
              ? cantonAnalysis.snapshot
                ? `Próximas 12 y 24 h · ${formatDateTime(cantonAnalysis.snapshot.updatedAt)}`
                : "Próximas 12 y 24 h"
              : eventsError
                ? "Sin conexión con el servidor de datos"
                : `SNGR · ${EVENT_PERIODS.find((period) => period.value === eventFilters.period)?.label.toLowerCase()} · ${formatDateTime(fetchedAt)}`
          }
          icon={<PulsingAlertIcon />}
          mobileOpen={mobileSheet === "events"}
          desktopOpen={desktopPanels.events}
          onClose={() => closePanel("events")}
          desktopClassName="lg:bottom-6 lg:left-4 lg:right-auto lg:w-90 lg:max-h-[calc(100%-11rem)]"
          desktopFooter={
            eventsTab === "events" &&
            events.length > 0 && (
              <EventsExpandButton
                expanded={eventsExpanded}
                total={filteredEvents.length}
                onToggle={() => setEventsExpanded((value) => !value)}
              />
            )
          }
        >
          <div className="mb-3">
            <SegmentedControl
              name="events-tab"
              label="Contenido del panel"
              value={eventsTab}
              options={[
                { value: "events", label: "Eventos" },
                { value: "analysis", label: "Alerta de inundación" },
              ]}
              onChange={setEventsTab}
            />
          </div>
          {eventsTab === "events" ? (
            <CriticalEventsPanel
              events={events}
              filteredEvents={filteredEvents}
              filters={eventFilters}
              onFiltersChange={setEventFilters}
              fetchedAt={fetchedAt}
              error={eventsError}
              selectedId={selectedEventId}
              onSelect={selectEvent}
              expanded={eventsExpanded}
            />
          ) : (
            <ParishAlertPanel
              snapshot={cantonAnalysis.snapshot}
              error={cantonAnalysis.error}
              isLoading={cantonAnalysis.isLoading}
              selectedCode={selectedParish?.code ?? null}
              onSelect={setSelectedParish}
              filters={parishFilters}
              onFiltersChange={setParishFilters}
            />
          )}
        </ResponsivePanel>

        <FeatureDetailPanel
          state={featureDetail.state}
          onClose={featureDetail.close}
          onNext={featureDetail.next}
          onPrevious={featureDetail.previous}
          onZoom={featureDetail.zoomToSelected}
        />

        <RiverPanel
          target={riverTarget}
          onClose={() => setRiverTarget(null)}
        />

        {/* Escritorio: botones para reabrir los paneles cerrados. */}
        {!desktopPanels.layers && (
          <FloatingButton className="absolute top-4 right-4 hidden lg:flex" onClick={() => openDesktopPanel("layers")}>
            <LayersIcon className="size-4 text-blue-600" />
            Capas
          </FloatingButton>
        )}
        {!desktopPanels.events && (
          <FloatingButton className="absolute bottom-6 left-4 hidden lg:flex" onClick={() => openDesktopPanel("events")}>
            <CircleDotIcon className="size-4 text-red-600" />
            Eventos críticos
            <CountBadge count={criticalCount} />
          </FloatingButton>
        )}

        {/* Móvil y tablet: barra inferior para abrir las hojas. */}
        {mobileSheet === null && riverTarget === null && featureDetail.state === null && (
          <nav
            aria-label="Paneles del mapa"
            className="absolute bottom-6 left-1/2 z-1000 flex -translate-x-1/2 gap-1 rounded-2xl bg-white/90 p-1.5 shadow-xl ring-1 shadow-slate-900/15 ring-slate-900/10 backdrop-blur-md lg:hidden"
          >
            <MobileBarButton onClick={() => openMobileSheet("layers")}>
              <LayersIcon className="size-4 text-blue-600" />
              Capas
            </MobileBarButton>
            <span aria-hidden="true" className="my-1.5 w-px bg-slate-200" />
            <MobileBarButton onClick={() => openMobileSheet("events")}>
              <CircleDotIcon className="size-4 text-red-600" />
              Eventos
              <CountBadge count={criticalCount} />
            </MobileBarButton>
          </nav>
        )}
      </div>
    </div>
  );
}

function MobileBarButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"
    >
      {children}
    </button>
  );
}

function PulsingAlertIcon() {
  return (
    <span
      aria-hidden="true"
      className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-red-600 text-white shadow-sm shadow-red-600/30"
    >
      <CircleDotIcon className="size-4.5" />
      <span className="absolute -top-1 -right-1 flex size-3">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75 motion-reduce:animate-none" />
        <span className="relative inline-flex size-3 rounded-full border-2 border-white bg-red-500" />
      </span>
    </span>
  );
}

function CountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white tabular-nums">
      {count}
      <span className="sr-only"> eventos críticos</span>
    </span>
  );
}

/** El día 1 si está disponible; si no, el primer día que lo esté. */
function initialForecastDay(rain: RainForecastAvailability | null): ForecastDay {
  const available = rain?.days.filter((item) => item.available).map((item) => item.day) ?? [];
  return available.includes(DEFAULT_FORECAST_DAY) ? DEFAULT_FORECAST_DAY : (available[0] ?? DEFAULT_FORECAST_DAY);
}

/** El primer producto satelital con datos recientes (el backend los ordena por preferencia: PERSIANN primero). */
function initialObservedProduct(observed: ObservedRainAvailability | null): ObservedRainProduct {
  const products = observed?.products ?? [];
  return (products.find((product) => !product.isStale) ?? products[0])?.key ?? "persiann";
}
