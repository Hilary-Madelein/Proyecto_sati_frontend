"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ResponsivePanel } from "@/components/shared/ResponsivePanel";
import { FloatingButton } from "@/components/ui/FloatingButton";
import { IconTile } from "@/components/ui/IconTile";
import { CircleDotIcon, LayersIcon } from "@/components/ui/icons";
import { formatDateTime } from "@/lib/format";
import {
  DATA_REFRESH_MS,
  DEFAULT_EVENT_FILTERS,
  DEFAULT_LAYER_VISIBILITY,
  DEFAULT_FORECAST_DAY,
  FORECAST_DAY_LABELS,
  EVENT_PERIODS,
  observedRainLegendLayer,
  RAIN_FORECAST_LEGEND_LAYER,
} from "../constants";
import { useRainImage } from "../hooks/useRainImage";
import { useRainLegends } from "../hooks/useRainLegends";
import { filterEvents } from "../utils";
import type { RiverTarget } from "../hooks/useRiverForecast";
import type {
  EventFilters,
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
import { SeaTemperatureLegend } from "./map/SeaTemperatureLegend";
import { CriticalEventsPanel, EventsExpandButton } from "./panels/CriticalEventsPanel";
import { FloodLayersSection } from "./panels/FloodLayersSection";
import { ObservedRainSection } from "./panels/ObservedRainSection";
import { RainForecastSection } from "./panels/RainForecastSection";
import { SeaTemperatureSection } from "./panels/SeaTemperatureSection";
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
  // Anomalía de la temperatura del mar (El Niño)
  const [showSea, setShowSea] = useState(false);
  const [seaLoading, setSeaLoading] = useState(false);
  // Caudales (GEOGLOWS)
  const [alertDayIndex, setAlertDayIndex] = useState(0);
  const [riverTarget, setRiverTarget] = useState<RiverTarget | null>(null);

  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYER_VISIBILITY);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);

  // Escritorio: ambos paneles abiertos por defecto. Móvil: una hoja a la vez, cerradas al inicio.
  const [desktopPanels, setDesktopPanels] = useState<Record<PanelId, boolean>>({
    layers: true,
    events: true,
  });
  const [mobileSheet, setMobileSheet] = useState<PanelId | null>(null);
  const [eventsExpanded, setEventsExpanded] = useState(false);
  const [eventFilters, setEventFilters] = useState<EventFilters>(DEFAULT_EVENT_FILTERS);

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

  const openDesktopPanel = (panel: PanelId) => setDesktopPanels((current) => ({ ...current, [panel]: true }));

  const closePanel = (panel: PanelId) => {
    setDesktopPanels((current) => ({ ...current, [panel]: false }));
    setMobileSheet(null);
  };

  const openMobileSheet = (panel: PanelId) => {
    // En móvil solo cabe una hoja a la vez: abrir otra cierra la del río.
    setRiverTarget(null);
    setMobileSheet(panel);
  };

  const showRiver = (target: RiverTarget) => {
    setRiverTarget(target);
    setMobileSheet(null);
  };

  const toggleLayer = (layer: FloodLayerId, enabled: boolean) =>
    setLayers((current) => ({ ...current, [layer]: enabled }));

  const selectEvent = (id: string) => {
    setSelectedEventId(id);
    setFocusRequest((n) => n + 1);
    // En móvil se cierra la hoja para que se vea el mapa centrado en el evento.
    setMobileSheet(null);
  };

  return (
    <div className="relative size-full overflow-hidden">
      <FloodMap
        data={data}
        visibleEvents={filteredEvents}
        layers={layers}
        rainForecast={rainForecast}
        observedRain={observedRain}
        seaTemperature={showSea ? data.seaTemperature : null}
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
      {(rainLegends.length > 0 || (showSea && data.seaTemperature)) && (
        <div className="absolute top-4 left-16 z-1000 flex w-56 flex-col gap-2">
          <RainLegend legends={rainLegends} sources={rainSources.map((source) => source.label)} />
          {showSea && data.seaTemperature && <SeaTemperatureLegend legend={data.seaTemperature.legend} />}
        </div>
      )}

      <ResponsivePanel
        title="Capas del mapa"
        subtitle="Lluvia e inundaciones"
        icon={
          <IconTile className="bg-blue-600 text-white shadow-sm shadow-blue-600/30">
            <LayersIcon className="size-4.5" />
          </IconTile>
        }
        mobileOpen={mobileSheet === "layers"}
        desktopOpen={desktopPanels.layers}
        onClose={() => closePanel("layers")}
        desktopClassName="lg:top-4 lg:right-4 lg:bottom-auto lg:left-auto lg:w-95 lg:max-h-[calc(100%-2rem)]"
      >
        <div className="space-y-5">
          <RainForecastSection
            rain={data.rain}
            day={forecastDay}
            onDayChange={setForecastDay}
            visible={showRain}
            onVisibleChange={setShowRain}
            error={forecast.error}
            isLoading={forecast.isLoading || rainLoading}
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
            isLoading={observed.isLoading || observedRainLoading}
          />
          <FloodLayersSection
            data={data}
            layers={layers}
            onToggleLayer={toggleLayer}
            alertDayIndex={alertDayIndex}
            onAlertDayChange={setAlertDayIndex}
          />
          <SeaTemperatureSection
            sea={data.seaTemperature}
            visible={showSea}
            onVisibleChange={setShowSea}
            isLoading={seaLoading}
          />
        </div>
      </ResponsivePanel>

      <ResponsivePanel
        title="Eventos críticos"
        subtitle={
          eventsError
            ? "Sin conexión con el servidor de datos"
            : `SNGR · ${EVENT_PERIODS.find((period) => period.value === eventFilters.period)?.label.toLowerCase()} · ${formatDateTime(fetchedAt)}`
        }
        icon={<PulsingAlertIcon />}
        mobileOpen={mobileSheet === "events"}
        desktopOpen={desktopPanels.events}
        onClose={() => closePanel("events")}
        desktopClassName="lg:bottom-6 lg:left-4 lg:right-auto lg:w-90 lg:max-h-[calc(100%-11rem)]"
        desktopFooter={
          events.length > 0 && (
            <EventsExpandButton
              expanded={eventsExpanded}
              total={filteredEvents.length}
              onToggle={() => setEventsExpanded((value) => !value)}
            />
          )
        }
      >
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
      </ResponsivePanel>

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
      {mobileSheet === null && riverTarget === null && (
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
