"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ResponsivePanel } from "@/components/shared/ResponsivePanel";
import { FloatingButton } from "@/components/ui/FloatingButton";
import { IconTile } from "@/components/ui/IconTile";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { AlertTriangleIcon, CircleDotIcon, HistoryIcon, LayersIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import {
  SEVERITY_ORDER,
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
import { captureMap } from "../map-capture";
import { useProvinces, type ProvinceFeature } from "../hooks/useProvinceGeometries";
import { isSameProvince, layerInProvince } from "../province-filter";
import { ProvinceSummaryPanel, type ProvinceSummary, type SummaryTarget } from "./panels/ProvinceSummaryPanel";
import { SummarySidebar } from "./panels/SummarySidebar";
import { isInProvince, PROVINCE_NAMES } from "../province-geometry";
import { useFeatureDetail, type VisibleRiskLayer } from "../hooks/useFeatureDetail";
import { useRiskLayers } from "../hooks/useRiskLayers";
import { useWeatherStations } from "../hooks/useWeatherStations";
import { BRIDGES_LAYER_ID, RISK_LAYER_STYLES, riskClassOf, riskDataId, riskLayerView, riskPeriodLabel, styleForMap, type RiskLayerStyle, type RiskPeriodDays } from "../risk-layers";
import { placeName, ACTION_LAYER_IDS, timelineActions, type TimelineAction } from "../action-timeline";
import { closuresForMap, conditionOf, DEFAULT_CLOSURE_FILTERS, isClosed, ROAD_CLOSURES_LAYER_ID, type ClosureFilters } from "../road-closures";
import { alertLevelForDay, filterEvents } from "../utils";
import { cantonTotals, headlineFigures, provinceValues, rankProvinces, type RankIndicator } from "../province-summary";
import type { RiverTarget } from "../hooks/useRiverForecast";
import type { EventSeverity, Semaphore,
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
import { ProvincialRoadsRow } from "./panels/ProvincialRoadsRow";
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

const POWER_PLANTS_LAYER_ID = "power-plants";

/** La capa que enciende cada cuadro del resumen que abre una capa. */
const SUMMARY_LAYERS: Record<Exclude<SummaryTarget, "events" | "closures" | "analysis" | "rivers">, string> = {
  preventive: ACTION_LAYER_IDS[0],
  response: ACTION_LAYER_IDS[1],
  bridges: BRIDGES_LAYER_ID,
  schools: "schools-floods",
  health: "health-centers-floods",
  "power-plants": POWER_PLANTS_LAYER_ID,
  shelters: "shelters",
  machinery: "machinery-by-province",
  "road-events": "road-adverse-events",
};

export function FloodMonitor({ data }: { data: FloodMapData }) {
  const router = useRouter();
  // Lluvia pronosticada (WRF), un día a la vez
  const [forecastDay, setForecastDay] = useState<ForecastDay>(() => initialForecastDay(data.rain));
  // O una ventana de las próximas horas; null = se ve el día de la corrida.
  const [forecastHours, setForecastHours] = useState<ForecastWindowHours | null>(null);
  const forecastBlock = useForecastBlock();
  const [provinceBarSlot, setProvinceBarSlot] = useState<HTMLElement | null>(null);
  const [galapagosSlot, setGalapagosSlot] = useState<HTMLElement | null>(null);
  const mapAreaRef = useRef<HTMLDivElement>(null);
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
  // Provincia elegida (en el mapa o en el resumen): filtra las capas y los paneles.
  const provinces = useProvinces();
  const [province, setProvince] = useState<ProvinceFeature | null>(null);
  // Varias capas pueden salir de la misma del backend (p. ej. albergues y campamentos): se pide una vez.
  // Con la línea de tiempo abierta se piden también las dos capas de acciones; con la pestaña de cierres, la de cierres.
  const [desktopPanels, setDesktopPanels] = useState<Record<PanelId, boolean>>(() => ({
    // Cerrados al inicio: el mapa a la vista; se abren con sus botones.
    layers: false,
    events: false,
  }));
  const [mobileSheet, setMobileSheet] = useState<PanelId | null>(null);
  // El resumen pide sus datos solo mientras está abierto.
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  // Ranking de provincias del resumen: por qué se ordenan y si se pintan en el mapa.
  const [rankIndicator, setRankIndicator] = useState<RankIndicator>("events");
  const [shadeProvinces, setShadeProvinces] = useState(false);
  const summaryOpen = summaryExpanded;
  const riskLayerState = useRiskLayers([
    ...new Set([
      ...RISK_LAYER_STYLES.filter((style) => riskLayersOn.has(style.id)).map(riskDataId),
      ...(showTimeline || summaryOpen ? ACTION_LAYER_IDS : []),
      ...(eventsTab === "closures" || summaryOpen ? [ROAD_CLOSURES_LAYER_ID] : []),
      // Para el resumen: los puentes y las centrales eléctricas, aunque su capa esté apagada.
      ...(summaryOpen ? RISK_LAYER_STYLES.filter((style) => style.id === BRIDGES_LAYER_ID || style.id === POWER_PLANTS_LAYER_ID).map(riskDataId) : []),
    ]),
  ]);
  // Periodo elegido en las capas con fecha (si no se eligió, el de la capa).
  const [riskPeriods, setRiskPeriods] = useState<Record<string, RiskPeriodDays>>({});
  // Capas de un solo color que se pidió colorear por su clase (la red vial por estado), y la opacidad de cada capa.
  const [coloredLayers, setColoredLayers] = useState<ReadonlySet<string>>(new Set());
  const isColored = (style: RiskLayerStyle) => coloredLayers.has(style.id);
  const setColored = (id: string, colored: boolean) =>
    setColoredLayers((current) => {
      const next = new Set(current);
      if (colored) next.add(id);
      else next.delete(id);
      return next;
    });
  const [layerOpacity, setLayerOpacity] = useState<Record<string, number>>({});
  const opacityOfLayer = (id: string) => layerOpacity[id] ?? 1;
  const setOpacityOfLayer = (id: string, value: number) => setLayerOpacity((current) => ({ ...current, [id]: value }));
  // Los cierres viales se dibujan con su pestaña abierta, salvo que se apaguen.
  const [showClosuresOnMap, setShowClosuresOnMap] = useState(true);
  // Igual para los eventos críticos y las parroquias en alerta: se quitan del mapa sin cerrar su panel.
  const [showEventsOnMap, setShowEventsOnMap] = useState(true);
  const [showParishesOnMap, setShowParishesOnMap] = useState(true);
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
  const [eventsExpanded, setEventsExpanded] = useState(false);
  const [eventFilters, setEventFilters] = useState<EventFilters>(DEFAULT_EVENT_FILTERS);
  // Índice de preparación provincial (pestaña Preparación): viene en el mismo análisis, y se pide al encenderlo.
  const [showPreparedness, setShowPreparedness] = useState(false);
  const [showProvincialRoads, setShowProvincialRoads] = useState(false);
  const cantonAnalysis = useCantonAnalysis(eventsTab === "analysis" || summaryOpen || showPreparedness);
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
    layers.watersheds && { key: "watersheds", label: "Cuencas hidrográficas", component: "amenaza" as const, turnOff: () => toggleLayer("watersheds", false) },
    showSea && { key: "sea", label: "Temperatura del mar", component: "amenaza" as const, turnOff: () => setShowSea(false) },
    showImerg && { key: "imerg", label: "Lluvia IMERG", component: "amenaza" as const, turnOff: () => setShowImerg(false) },
    showProvincialRoads && {
      key: "provincialRoads",
      label: "Red vial provincial",
      component: "exposicion" as const,
      turnOff: () => setShowProvincialRoads(false),
    },
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
  const visibleRiskLayers = RISK_LAYER_STYLES.flatMap((style): (VisibleRiskLayer & { opacity?: number })[] => {
    // Los cierres viales: solo con su pestaña abierta, y los mismos reportes que su lista.
    if (style.id === ROAD_CLOSURES_LAYER_ID) {
      const data = eventsTab === "closures" && showClosuresOnMap ? closuresState.data : null;
      if (!data) return [];
      const features = closuresForMap(layerInProvince(data, province).features, closureFilters);
      return [{ style, data: { ...data, features, view: `closures:${JSON.stringify(closureFilters)}` } }];
    }
    const data = riskLayersOn.has(style.id) ? riskViewState(style).data : null;
    return data ? [{ style: styleForMap(style, isColored(style)), data: layerInProvince(data, province), opacity: opacityOfLayer(style.id) }] : [];
  });
  // Panel de detalle al tocar una entidad de esas capas.
  // Los cierres viales no se encienden como capa: se ven con su pestaña abierta.
  const featureDetail = useFeatureDetail([...riskLayersOn, ...(eventsTab === "closures" && showClosuresOnMap ? [ROAD_CLOSURES_LAYER_ID] : [])], visibleRiskLayers);
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

  /** Elegir (o quitar) la provincia: también la toman los filtros de cada panel. */
  const selectProvince = (picked: ProvinceFeature | null) => {
    setProvince(picked);
    const name = picked ? placeName(picked.name) : null;
    setEventFilters((current) => ({ ...current, province: name }));
    setClosureFilters((current) => ({ ...current, province: name ?? "" }));
    setParishFilters((current) => ({ ...current, province: name ?? "" }));
  };
  // Las alertas por caudal de la provincia elegida (las demás capas se filtran en visibleRiskLayers).
  const mapData = province
    ? {
        ...data,
        riverAlerts: data.riverAlerts && { ...data.riverAlerts, alerts: data.riverAlerts.alerts.filter((alert) => isSameProvince(alert.province, province.name)) },
        // Una zona de crecidas cuenta si algún vértice cae en la provincia.
        floodHub: data.floodHub && {
          ...data.floodHub,
          flashFloods:
            data.floodHub.flashFloods?.filter((area) =>
              (area.geometry.coordinates as unknown as number[][][][]).some((polygon) => polygon[0].some(([lng, lat]) => isInProvince(province, { lat, lng }))),
            ) ?? null,
        },
      }
    : data;
  // Cifras del resumen, de la provincia elegida o de todo el país.
  const layerCount = (id: string) => {
    const style = RISK_LAYER_STYLES.find((item) => item.id === id);
    const layerData = style ? riskViewState(style).data : null;
    return style && layerData ? { style, features: layerInProvince(layerData, province).features } : null;
  };
  const periodNote = (id: string) => {
    const style = RISK_LAYER_STYLES.find((item) => item.id === id);
    const days = style ? periodOf(style) : null;
    return days ? `últimos ${riskPeriodLabel(days)}` : "todas";
  };
  const preventive = layerCount(ACTION_LAYER_IDS[0]);
  const response = layerCount(ACTION_LAYER_IDS[1]);
  const bridges = layerCount(BRIDGES_LAYER_ID);
  const closureFeatures = closuresState.data ? layerInProvince(closuresState.data, province).features : null;
  const forecastParishes = cantonAnalysis.snapshot?.parishes?.filter((parish) => !province || isSameProvince(parish.province, province.name)) ?? null;
  const strongest = forecastParishes?.reduce<ParishAlert | null>((best, parish) => ((parish.forecast.mm24h ?? -1) > (best?.forecast.mm24h ?? -1) ? parish : best), null);
  // Para el ranking de provincias (solo se ve con todo el país: los eventos ya son los de todas).
  const countryClosures = closuresState.data?.features ?? null;
  const isFullClosure = (feature: RiskFeature) => conditionOf(feature)?.label === "Cierre total";
  const riverReaches = mapData.riverAlerts?.alerts.filter((alert) => !alert.persistent && alertLevelForDay(alert, alertDayIndex) > 0) ?? null;
  const scopeCantons = cantonAnalysis.snapshot?.cantons.filter((canton) => !province || isSameProvince(canton.province, province.name)) ?? null;
  const rankValues =
    rankIndicator === "closures" && !countryClosures
      ? null
      : provinceValues(rankIndicator, { events: filteredEvents, openClosures: countryClosures?.filter((feature) => !isClosed(feature)) ?? null });
  const realProvinces = provinces?.filter((item) => item.key !== "zona no delimitada") ?? null;
  const powerPlants = layerCount(POWER_PLANTS_LAYER_ID);
  const summary: ProvinceSummary = {
    headline: {
      here: headlineFigures(filteredEvents, closureFeatures, isClosed, isFullClosure, forecastParishes),
      eventsPeriod: EVENT_PERIODS.find((period) => period.value === eventFilters.period)?.label.toLowerCase() ?? "",
    },
    events: {
      total: filteredEvents.length,
      bySeverity: Object.fromEntries(SEVERITY_ORDER.map((severity) => [severity, filteredEvents.filter((event) => event.severity === severity).length])) as Record<EventSeverity, number>,
      period: EVENT_PERIODS.find((period) => period.value === eventFilters.period)?.label.toLowerCase() ?? "",
    },
    forecast: forecastParishes && {
      counts: Object.fromEntries((["red", "orange", "yellow", "green"] as const).map((level) => [level, forecastParishes.filter((parish) => parish.semaphore === level).length])) as Record<Semaphore, number>,
      max: strongest && strongest.forecast.mm24h !== null ? { mm: strongest.forecast.mm24h, parish: strongest.name } : null,
    },
    // Tramos del modelo (no ríos: un río tiene muchos), sin los que tienen alerta casi todos los días (el modelo los sobrestima).
    rivers: riverReaches && { count: riverReaches.length, major: riverReaches.filter((alert) => alertLevelForDay(alert, alertDayIndex) >= 5).length },
    totals: scopeCantons && cantonTotals(scopeCantons),
    bridges: bridges && { count: bridges.features.length, good: bridges.features.filter((feature) => riskClassOf(bridges.style, feature)?.label === "Bueno").length },
    powerPlants: powerPlants?.features.length ?? null,
    preventive: preventive && { count: preventive.features.length, period: periodNote(ACTION_LAYER_IDS[0]) },
    response: response && { count: response.features.length, period: periodNote(ACTION_LAYER_IDS[1]) },
    closures: closureFeatures && {
      open: closureFeatures.filter((feature) => !isClosed(feature)).length,
      full: closureFeatures.filter((feature) => !isClosed(feature) && isFullClosure(feature)).length,
      closed: closureFeatures.filter(isClosed).length,
    },
  };
  /** Si lo de un cuadro del resumen ya está a la vista: su pestaña abierta o su capa encendida. */
  const isSummaryTargetActive = (target: SummaryTarget) => {
    if (target === "events" || target === "closures" || target === "analysis") return eventsTab === target && (desktopPanels.events || mobileSheet === "events");
    if (target === "rivers") return layers.riverAlerts;
    return riskLayersOn.has(SUMMARY_LAYERS[target]);
  };
  /** Cada cuadro del resumen es un interruptor: abre su pestaña o enciende su capa, y si ya estaba, lo quita. */
  const openSummaryTarget = (target: SummaryTarget) => {
    const active = isSummaryTargetActive(target);
    if (target === "events" || target === "closures" || target === "analysis") {
      if (active) {
        closePanel("events");
        return;
      }
      // Sin cierres abiertos pero con ya habilitados: la lista va a "Todos", donde están.
      if (target === "closures" && summary.closures && summary.closures.open === 0 && summary.closures.closed > 0) {
        setClosureFilters((current) => ({ ...current, view: "all", showClosed: true }));
      }
      setEventsTab(target);
      if (window.matchMedia("(min-width: 1024px)").matches) openDesktopPanel("events");
      else openMobileSheet("events");
    } else if (target === "rivers") toggleLayer("riverAlerts", !active);
    else toggleRiskLayer(SUMMARY_LAYERS[target], !active);
  };
  return (
    <div className="flex size-full flex-col">
      <RiskComponentBar value={riskTab} onSelect={selectRiskComponent} activeCounts={activeCounts} onOpenTimeline={() => openTimeline()} />
      {/* El mapa y todo lo que flota sobre él se ubican respecto de esta área, debajo de la barra. */}
      {/* El resumen, a un lado del mapa: desplegado, en pantallas grandes corre el mapa (no lo tapa). */}
      <div className="flex min-h-0 flex-1">
        <SummarySidebar
          expanded={summaryExpanded}
          onExpandedChange={setSummaryExpanded}
          title="Resumen"
          subtitle={province ? `Provincia de ${PROVINCE_NAMES[province.key] ?? placeName(province.name)}` : "Todo el país"}
        >
            <ProvinceSummaryPanel
              provinces={provinces}
              selected={province}
              onSelect={selectProvince}
              summary={summary}
              onOpen={openSummaryTarget}
              isActive={isSummaryTargetActive}
              ranking={{
                indicator: rankIndicator,
                onIndicatorChange: setRankIndicator,
                rows: rankValues && realProvinces ? rankProvinces(rankValues, realProvinces) : null,
                shadeMap: shadeProvinces,
                onShadeMapChange: setShadeProvinces,
              }}
            />
        </SummarySidebar>
      <div ref={mapAreaRef} className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <FloodMap
          data={mapData}
          provinces={provinces}
          selectedProvince={province}
          onPickProvince={(picked) => {
            selectProvince(picked);
            // En pantallas grandes el resumen corre el mapa; en móvil lo taparía: ahí se abre con "Resumen" en la barra de la provincia.
            if (window.matchMedia("(min-width: 1024px)").matches) setSummaryExpanded(true);
          }}
          onOpenSummary={() => setSummaryExpanded(true)}
          // Con la alerta de inundación abierta, el mapa muestra solo sus parroquias (sin los eventos de la SNGR).
          visibleEvents={eventsTab === "events" && showEventsOnMap ? filteredEvents : []}
          layers={layers}
          rainForecast={rainForecast}
          observedRain={observedRain}
          seaTemperature={showSea ? data.seaTemperature : null}
          weatherStations={
            showStations && stations.snapshot
              ? province
                ? { ...stations.snapshot, stations: stations.snapshot.stations.filter((station) => isInProvince(province, station)) }
                : stations.snapshot
              : null
          }
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
          parishAlerts={showParishesOnMap ? (parishAlerts?.listed ?? null) : null}
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
          layerOpacity={opacityOfLayer}
          provincialRoads={showProvincialRoads}
          galapagosSlot={galapagosSlot}
          onCapture={async () => {
            if (!mapAreaRef.current) return;
            try {
              await captureMap(mapAreaRef.current, [
                ...activeLayers.map((layer) => layer.label),
                ...(eventsTab === "events" && showEventsOnMap ? ["Eventos críticos (SNGR)"] : []),
                ...(eventsTab === "analysis" && showParishesOnMap ? ["Alerta de inundación por parroquia"] : []),
                ...(eventsTab === "closures" && showClosuresOnMap ? ["Cierres viales (MIT)"] : []),
              ]);
            } catch (error) {
              window.alert(`No se pudo capturar la imagen: ${(error as Error).message}`);
            }
          }}
          provinceShading={shadeProvinces && !province ? rankValues : null}
          // Acercarse a la provincia de un punto (o del panel) la elige: la barra, el resumen y las capas dicen lo mismo.
          // Volver a todo Ecuador (alejando el mapa) la quita y cierra el resumen, como el botón.
          onProvinceFocus={(focused) => {
            if (focused) {
              if (focused.key !== province?.key) selectProvince(focused);
            } else if (province) {
              setSummaryExpanded(false);
              selectProvince(null);
            }
          }}
          onGoHome={() => {
            // De una provincia a todo Ecuador: el resumen se cierra (se vuelve a abrir con su botón).
            if (province) setSummaryExpanded(false);
            selectProvince(null);
            featureDetail.close();
            setSelectedParish(null);
            setSelectedEventId(null);
            setRiverTarget(null);
          }}
          // Solo si sigue siendo ese: elegir otro evento también cierra el popup anterior.
          onDeselectEvent={(id) => setSelectedEventId((current) => (current === id ? null : current))}
        />
        {/* Junto a los controles, una debajo de la otra: la provincia a la que se acercó (ver ProvinceFocusBar) y las leyendas de las capas visibles. */}
        {/* Un nivel por debajo de los controles del mapa: el menú del mapa base se abre encima de esta columna. */}
        <div className="absolute top-4 left-16 z-999 flex max-w-[calc(100%-5rem)] flex-col items-start gap-2">
          <div ref={setProvinceBarSlot} className="max-w-full empty:hidden" />
          <div ref={setGalapagosSlot} className="empty:hidden" />
          {(rainLegends.length > 0 || (showSea && data.seaTemperature) || (layers.riverAlerts && data.riverAlerts)) && (
            <div className="flex w-56 max-w-full flex-col gap-2">
              <RainLegend legends={rainLegends} sources={rainSources.map((source) => source.label)} />
              {showSea && data.seaTemperature && <SeaTemperatureLegend legend={data.seaTemperature.legend} />}
              {layers.riverAlerts && mapData.riverAlerts && <RiverAlertLegend snapshot={mapData.riverAlerts} dayIndex={alertDayIndex} />}
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
                  opacityOf={opacityOfLayer}
                  onOpacityChange={setOpacityOfLayer}
                />
                <FloodHubSection
                  data={data}
                  layers={layers}
                  onToggleLayer={toggleLayer}
                  opacity={opacityOfLayer("flash-floods")}
                  onOpacityChange={(value) => setOpacityOfLayer("flash-floods", value)}
                />
                <RiskLayersSection
                  component="amenaza"
                  enabled={riskLayersOn}
                  onToggle={toggleRiskLayer}
                  stateOf={riskViewState}
                  periodOf={periodOf}
                  isColored={isColored}
                  onColoredChange={setColored}
                  opacityOf={(layer) => opacityOfLayer(layer.id)}
                  onOpacityChange={setOpacityOfLayer}
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
                  rowsAfter={{
                    // La red vial provincial no es una capa de datos (solo teselas): va después de la RVE, en Exposición.
                    rve: (
                      <ProvincialRoadsRow
                        visible={showProvincialRoads}
                        onVisibleChange={setShowProvincialRoads}
                        opacity={opacityOfLayer("provincial-roads")}
                        onOpacityChange={(value) => setOpacityOfLayer("provincial-roads", value)}
                      />
                    ),
                  }}
                  enabled={riskLayersOn}
                  onToggle={toggleRiskLayer}
                  stateOf={riskViewState}
                  periodOf={periodOf}
                  isColored={isColored}
                  onColoredChange={setColored}
                  opacityOf={(layer) => opacityOfLayer(layer.id)}
                  onOpacityChange={setOpacityOfLayer}
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
                    opacity={opacityOfLayer("preparedness")}
                    onOpacityChange={(value) => setOpacityOfLayer("preparedness", value)}
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
              showOnMap={showEventsOnMap}
              onShowOnMapChange={(show) => {
                setShowEventsOnMap(show);
                if (!show) setSelectedEventId(null);
              }}
            />
          ) : eventsTab === "closures" ? (
            <RoadClosuresPanel
              data={closuresState.data}
              error={closuresState.error}
              isLoading={closuresState.isLoading}
              filters={closureFilters}
              showOnMap={showClosuresOnMap}
              onShowOnMapChange={setShowClosuresOnMap}
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
              showOnMap={showParishesOnMap}
              onShowOnMapChange={(show) => {
                setShowParishesOnMap(show);
                if (!show) setSelectedParish(null);
              }}
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
          <FloatingButton data-capture-ignore className="absolute top-4 right-4 hidden lg:flex" onClick={() => openDesktopPanel("layers")}>
            <LayersIcon className="size-4 text-blue-600" />
            Capas
          </FloatingButton>
        )}
        {!desktopPanels.events && (
          <FloatingButton data-capture-ignore className="absolute bottom-6 left-4 hidden lg:flex" onClick={() => openDesktopPanel("events")}>
            <CircleDotIcon className="size-4 text-red-600" />
            Eventos críticos
            <CountBadge count={criticalCount} />
          </FloatingButton>
        )}

        {/* Móvil y tablet: barra inferior para abrir las hojas. */}
        {mobileSheet === null && riverTarget === null && featureDetail.state === null && (
          <nav
            data-capture-ignore
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
