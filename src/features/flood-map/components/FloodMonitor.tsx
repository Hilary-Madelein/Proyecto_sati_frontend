"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ResponsivePanel } from "@/components/shared/ResponsivePanel";
import { FloatingButton } from "@/components/ui/FloatingButton";
import { IconTile } from "@/components/ui/IconTile";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { AlertTriangleIcon, CircleDotIcon, HistoryIcon, LayersIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
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
import { ACTION_LAYER_IDS, timelineActions, type TimelineAction } from "../action-timeline";
import { closuresForMap, DEFAULT_CLOSURE_FILTERS, ROAD_CLOSURES_LAYER_ID, type ClosureFilters } from "../road-closures";
import { filterEvents } from "../utils";
import type { RiverTarget } from "../hooks/useRiverForecast";
import type {
  ActiveLayer,
  ParishAlert,
  EventFilters,
  OverlayOpacity,
  RiskComponentId,
  RiskFeature,
  FloodLayerId,
  FloodMapData,
  LayerVisibility,
  DailyRainForecast,
  ForecastDay,
  ForecastWindowHours,
  ObservedAccumulatedRain,
  ObservedRainAvailability,
  ObservedRainProduct,
  RainForecastAvailability,
  RainForecastLayer,
  RainWindowHours,
  WindowRainForecast,
  SelectedRiver,
} from "../types";
import { RainLegend } from "./map/RainLegend";
import { RiverAlertLegend } from "./map/RiverAlertLegend";
import { SeaTemperatureLegend } from "./map/SeaTemperatureLegend";
import { ParishAlertPanel } from "./panels/ParishAlertPanel";
import { RoadClosuresPanel } from "./panels/RoadClosuresPanel";
import { ActionsTimelineDialog } from "./timeline/ActionsTimelineDialog";
import { EventsPerDayWidget } from "./panels/EventsPerDayWidget";
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
  // O una ventana de las próximas horas; null = se ve el día de la corrida.
  const [forecastHours, setForecastHours] = useState<ForecastWindowHours | null>(null);
  const forecastBlock = useForecastBlock();
  const [provinceBarSlot, setProvinceBarSlot] = useState<HTMLElement | null>(null);
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
  // Línea de tiempo de las acciones preventivas y de respuesta del MIT (ventana aparte), y la
  // acción que se ubica en ella al abrirla desde su ficha en el mapa.
  const [showTimeline, setShowTimeline] = useState(false);
  const [timelineFocus, setTimelineFocus] = useState<string | null>(null);
  const openTimeline = (focusKey: string | null = null) => {
    setTimelineFocus(focusKey);
    setShowTimeline(true);
  };
  // Pestañas del panel de eventos: eventos de la SNGR, alerta de inundación por parroquia
  // (lluvia de 3, 6, 12 y 24 h) y cierres viales (reportes de novedad vial del MIT).
  const [eventsTab, setEventsTab] = useState<"events" | "analysis" | "closures">("events");
  // Varias capas pueden salir de la misma del backend (p. ej. albergues y campamentos): se pide una vez.
  // Con la línea de tiempo abierta se piden también las dos capas de acciones; con la pestaña de cierres, la de cierres.
  const riskLayerState = useRiskLayers([
    ...new Set([
      ...RISK_LAYER_STYLES.filter((style) => riskLayersOn.has(style.id)).map(riskDataId),
      ...(showTimeline ? ACTION_LAYER_IDS : []),
      ...(eventsTab === "closures" ? [ROAD_CLOSURES_LAYER_ID] : []),
    ]),
  ]);
  // Periodo elegido en las capas con fecha (si no se eligió, el de la capa).
  const [riskPeriods, setRiskPeriods] = useState<Record<string, RiskPeriodDays>>({});
  const periodOf = (style: RiskLayerStyle) => (style.id in riskPeriods ? riskPeriods[style.id] : (style.period?.defaultDays ?? null));
  /** Estado de la capa con sus datos ya filtrados (su parte y su periodo). */
  const riskViewState = (style: RiskLayerStyle) => {
    const state = riskLayerState(riskDataId(style));
    return state.data ? { ...state, data: riskLayerView(style, state.data, periodOf(style)) } : state;
  };
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
  // Índice de preparación provincial (pestaña Preparación): viene en el mismo análisis, y se pide al encenderlo.
  const [showPreparedness, setShowPreparedness] = useState(false);
  const cantonAnalysis = useCantonAnalysis(eventsTab === "analysis" || showPreparedness);
  const provinceGeometries = useProvinceGeometries(showPreparedness);
  const [selectedParish, setSelectedParish] = useState<ParishAlert | null>(null);
  // Filtros de la alerta: la lista y el mapa muestran las mismas parroquias.
  const [parishFilters, setParishFilters] = useState<ParishFilters>(DEFAULT_PARISH_FILTERS);
  const alertSnapshot = eventsTab === "analysis" ? cantonAnalysis.snapshot : null;
  const parishAlerts = useMemo(
    () => (alertSnapshot ? filterParishes(alertSnapshot.parishes ?? [], parishFilters) : null),
    [alertSnapshot, parishFilters],
  );
  const parishWindowsLabel = parishFilters.window ? `Próximas ${parishFilters.window.replace("h", " h")}` : "Próximas 3, 6, 12 y 24 h";
  // Cierres viales: los filtros del panel se aplican también a lo que se dibuja en el mapa.
  const [closureFilters, setClosureFilters] = useState<ClosureFilters>(DEFAULT_CLOSURE_FILTERS);
  const closuresState = riskLayerState(ROAD_CLOSURES_LAYER_ID);
  // Referencia de "hace X días": la hora de la descarga (no el reloj), para no leerlo en cada render.
  const closuresNow = Date.parse(closuresState.data?.fetchedAt ?? data.eventsFeed.fetchedAt);
  const actionStates = ACTION_LAYER_IDS.map((id) => riskLayerState(id));
  const timeline = showTimeline ? timelineActions(Object.fromEntries(ACTION_LAYER_IDS.map((id, i) => [id, actionStates[i].data]))) : [];

  const { events, fetchedAt, error: eventsError } = data.eventsFeed;
  // Los filtros se aplican a la lista y a los marcadores del mapa por igual.
  const filteredEvents = useMemo(() => filterEvents(events, eventFilters, fetchedAt), [events, eventFilters, fetchedAt]);
  const criticalCount = events.filter((event) => event.severity === "critical").length;
  const forecastAvailable = data.rain?.days.some((item) => item.day === forecastDay && item.available) ?? false;
  const forecastDayImage = useRainImage<DailyRainForecast>(
    showRain && !forecastHours && forecastAvailable ? `/rain-forecast/days/${forecastDay}` : null,
    data.rain?.run ?? null,
  );
  // La ventana avanza con cada bloque de 3 h, aunque la corrida sea la misma.
  const forecastWindow = useRainImage<WindowRainForecast>(
    showRain && forecastHours ? `/rain-forecast/windows/${forecastHours}` : null,
    data.rain?.run ? `${data.rain.run}:${forecastBlock}` : null,
  );
  const forecast = forecastHours ? forecastWindow : forecastDayImage;
  const forecastLabel = forecastHours ? `en las próximas ${forecastHours} h` : FORECAST_DAY_LABELS[forecastDay].range;
  const rainForecast: RainForecastLayer | null = forecast.data
    ? {
        data: forecast.data,
        attribution: data.rain?.attribution ?? "",
        label: forecastLabel,
        valuePath: forecastHours ? `/rain-forecast/windows/${forecastHours}/value` : `/rain-forecast/days/${forecastDay}/value`,
      }
    : null;

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
    rainForecast && { layerId: RAIN_FORECAST_LEGEND_LAYER, label: `Pronóstico ${forecastLabel}` },
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
    layers.flashFloods && { key: "flashFloods", label: "Crecidas repentinas", component: "amenaza" as const, turnOff: () => toggleLayer("flashFloods", false) },
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
    // Los cierres viales: solo con su pestaña abierta, y los mismos reportes que su lista.
    if (style.id === ROAD_CLOSURES_LAYER_ID) {
      const data = eventsTab === "closures" ? closuresState.data : null;
      if (!data) return [];
      const features = closuresForMap(data.features, closureFilters);
      return [{ style, data: { ...data, features, view: `closures:${JSON.stringify(closureFilters)}` } }];
    }
    const data = riskLayersOn.has(style.id) ? riskViewState(style).data : null;
    return data ? [{ style, data }] : [];
  });
  // Panel de detalle al tocar una entidad de esas capas.
  // Los cierres viales no se encienden como capa: se ven con su pestaña abierta.
  const featureDetail = useFeatureDetail([...riskLayersOn, ...(eventsTab === "closures" ? [ROAD_CLOSURES_LAYER_ID] : [])], visibleRiskLayers);
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

  /**
   * "Ver en el mapa" de una acción de la línea de tiempo: se cierra la ventana, se
   * enciende su capa y se abre su detalle (con todas sus fotos), acercando el mapa.
   */
  const showActionOnMap = (action: TimelineAction) => {
    const style = RISK_LAYER_STYLES.find((item) => item.id === action.layerId);
    const data = riskLayerState(action.layerId).data;
    if (!style || !data) return;
    setShowTimeline(false);
    toggleRiskLayer(action.layerId, true);
    setRiverTarget(null);
    setMobileSheet(null);
    featureDetail.open([{ key: action.key, style, data, feature: action.feature, pinned: true }]);
    featureDetail.zoomToSelected();
  };


  /** Un reporte de la lista de cierres: se acerca el mapa y se abre su ficha completa. */
  const selectClosure = (feature: RiskFeature) => {
    const style = RISK_LAYER_STYLES.find((item) => item.id === ROAD_CLOSURES_LAYER_ID);
    if (!style || !closuresState.data) return;
    setRiverTarget(null);
    setMobileSheet(null);
    featureDetail.open([{ key: `${ROAD_CLOSURES_LAYER_ID}:${feature.id}`, style, data: closuresState.data, feature }]);
    featureDetail.zoomToSelected();
  };

  const selectEvent = (id: string) => {
    setSelectedEventId(id);
    setFocusRequest((n) => n + 1);
    // En móvil se cierra la hoja para que se vea el mapa centrado en el evento.
    setMobileSheet(null);
  };

  return (
    <div className="flex size-full flex-col">
      <RiskComponentBar value={riskTab} onSelect={selectRiskComponent} activeCounts={activeCounts} onOpenTimeline={() => openTimeline()} />
      {/* El mapa y todo lo que flota sobre él se ubican respecto de esta área, debajo de la barra. */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <FloodMap
          data={data}
          // Con la alerta de inundación abierta, el mapa muestra solo sus parroquias (sin los eventos de la SNGR).
          visibleEvents={eventsTab === "events" ? filteredEvents : []}
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
          parishAlerts={parishAlerts?.listed ?? null}
          // Con el nivel de la ventana elegida, como en la lista.
          selectedParish={eventsTab === "analysis" ? (parishAlerts?.all.find((parish) => parish.code === selectedParish?.code) ?? selectedParish) : null}
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
          provinceBarSlot={provinceBarSlot}
          onGoHome={() => {
            featureDetail.close();
            setSelectedParish(null);
            setSelectedEventId(null);
            setRiverTarget(null);
          }}
          // Solo si sigue siendo ese: elegir otro evento también cierra el popup anterior.
          onDeselectEvent={(id) => setSelectedEventId((current) => (current === id ? null : current))}
        />
        {/* Junto a los controles, una debajo de la otra: la provincia a la que se acercó (ver ProvinceFocusBar) y las leyendas de las capas visibles. */}
        <div className="absolute top-4 left-16 z-1000 flex max-w-[calc(100%-5rem)] flex-col items-start gap-2">
          <div ref={setProvinceBarSlot} className="max-w-full empty:hidden" />
          {(rainLegends.length > 0 || (showSea && data.seaTemperature) || (layers.riverAlerts && data.riverAlerts)) && (
            <div className="flex w-56 max-w-full flex-col gap-2">
              <RainLegend legends={rainLegends} sources={rainSources.map((source) => source.label)} />
              {showSea && data.seaTemperature && <SeaTemperatureLegend legend={data.seaTemperature.legend} />}
              {layers.riverAlerts && data.riverAlerts && <RiverAlertLegend snapshot={data.riverAlerts} dayIndex={alertDayIndex} />}
            </div>
          )}
        </div>

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
                  onDayChange={(day) => {
                    setForecastDay(day);
                    setForecastHours(null);
                  }}
                  hours={forecastHours}
                  onHoursChange={setForecastHours}
                  windowPeriod={forecastWindow.data}
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
          title={eventsTab === "analysis" ? "Alerta de inundación" : eventsTab === "closures" ? "Cierres viales" : "Eventos críticos"}
          subtitle={
            eventsTab === "closures"
              ? `MIT · reportes de novedad vial${closuresState.data ? ` · ${formatDateTime(closuresState.data.fetchedAt)}` : ""}`
              : eventsTab === "analysis"
              ? cantonAnalysis.snapshot
                ? `${parishWindowsLabel} · ${formatDateTime(cantonAnalysis.snapshot.updatedAt)}`
                : parishWindowsLabel
              : eventsError
                ? "Sin conexión con el servidor de datos"
                : `SNGR · ${EVENT_PERIODS.find((period) => period.value === eventFilters.period)?.label.toLowerCase()} · ${formatDateTime(fetchedAt)}`
          }
          icon={
            eventsTab === "closures" ? (
              <IconTile className="bg-orange-600 text-white shadow-sm shadow-orange-600/30">
                <AlertTriangleIcon className="size-4.5" />
              </IconTile>
            ) : (
              <PulsingAlertIcon />
            )
          }
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
                { value: "closures", label: "Cierres viales" },
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
          ) : eventsTab === "closures" ? (
            <RoadClosuresPanel
              data={closuresState.data}
              error={closuresState.error}
              isLoading={closuresState.isLoading}
              filters={closureFilters}
              onFiltersChange={setClosureFilters}
              now={closuresNow}
              selectedKey={featureDetail.selected?.style.id === ROAD_CLOSURES_LAYER_ID ? featureDetail.selected.key : null}
              onSelect={selectClosure}
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
          onShowInTimeline={(hit) => openTimeline(hit.key)}
        />

        <RiverPanel
          target={riverTarget}
          onClose={() => setRiverTarget(null)}
        />

        <ActionsTimelineDialog
          open={showTimeline}
          onClose={() => setShowTimeline(false)}
          actions={timeline}
          layers={ACTION_LAYER_IDS.map((id, i) => ({ id, fetchedAt: actionStates[i].data?.fetchedAt ?? null }))}
          isLoading={actionStates.some((state) => state.isLoading)}
          error={actionStates.find((state) => state.error)?.error ?? null}
          onShowOnMap={showActionOnMap}
          focusKey={timelineFocus}
        />

        {/*
          Eventos por día (plegado al inicio), a todo lo ancho de su franja.
          Celular y tablet: abajo, sobre la barra de Capas · Eventos · Acciones (arriba
          taparía las leyendas del mapa); se oculta mientras hay una hoja abierta.
          Escritorio: abajo, desde el panel de eventos (o su botón) hasta el panel de
          capas (o el borde, si está cerrado: 4 + 95 + 4 = 103).
        */}
        <EventsPerDayWidget
          until={fetchedAt}
          className={cn(
            "absolute right-3 bottom-24 left-3 z-1000 lg:bottom-6",
            (mobileSheet !== null || riverTarget !== null || featureDetail.state !== null) && "max-lg:hidden",
            desktopPanels.events ? "lg:left-98" : "lg:left-60",
            desktopPanels.layers ? "lg:right-103" : "lg:right-4",
          )}
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
            className="absolute bottom-6 left-1/2 z-1000 flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 gap-0.5 rounded-2xl bg-white/90 p-1.5 shadow-xl ring-1 shadow-slate-900/15 ring-slate-900/10 backdrop-blur-md lg:hidden"
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
            <span aria-hidden="true" className="my-1.5 w-px bg-slate-200" />
            <MobileBarButton onClick={() => openTimeline()}>
              <HistoryIcon className="size-4 text-emerald-700" />
              Acciones
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
      className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-1.5 py-2.5 text-[13px] font-semibold whitespace-nowrap text-slate-800 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"
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
/** Los pasos de 3 h del WRF terminan a la 1, 4, 7… UTC. */
const BLOCK_OFFSET_MS = 60 * 60 * 1000;
const BLOCK_MS = 3 * 60 * 60 * 1000;
/** Se espera a que venza la caché de 5 min de la ventana en el backend. */
const BLOCK_DELAY_MS = 6 * 60 * 1000;
const currentBlock = () => Math.floor((Date.now() - BLOCK_OFFSET_MS - BLOCK_DELAY_MS) / BLOCK_MS);

/** Número del bloque de 3 h en curso: cambia al empezar el siguiente. */
function useForecastBlock(): number {
  const [block, setBlock] = useState(currentBlock);
  useEffect(() => {
    const timer = setInterval(() => setBlock(currentBlock()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);
  return block;
}

function initialForecastDay(rain: RainForecastAvailability | null): ForecastDay {
  const available = rain?.days.filter((item) => item.available).map((item) => item.day) ?? [];
  return available.includes(DEFAULT_FORECAST_DAY) ? DEFAULT_FORECAST_DAY : (available[0] ?? DEFAULT_FORECAST_DAY);
}

/** El primer producto satelital con datos recientes (el backend los ordena por preferencia: PERSIANN primero). */
function initialObservedProduct(observed: ObservedRainAvailability | null): ObservedRainProduct {
  const products = observed?.products ?? [];
  return (products.find((product) => !product.isStale) ?? products[0])?.key ?? "persiann";
}
