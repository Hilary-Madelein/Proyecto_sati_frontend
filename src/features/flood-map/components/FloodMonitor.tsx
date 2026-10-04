"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ResponsivePanel } from "@/components/shared/ResponsivePanel";
import { FloatingButton } from "@/components/ui/FloatingButton";
import { IconTile } from "@/components/ui/IconTile";
import { AlertTriangleIcon, LayersIcon } from "@/components/ui/icons";
import { formatDateTime } from "@/lib/format";
import {
  DATA_REFRESH_MS,
  DEFAULT_FORECAST_DAY,
  DEFAULT_LAYER_VISIBILITY,
  EVENTS_WINDOW_DAYS,
  FORECAST_DAYS,
  OBSERVED_RAIN_PRODUCTS,
} from "../constants";
import type { RiverTarget } from "../hooks/useRiverForecast";
import type {
  FloodLayerId,
  FloodMapData,
  ForecastDay,
  LayerVisibility,
  ObservedRainProduct,
  ObservedRainWindow,
  RainAvailability,
  SelectedRiver,
} from "../types";
import { rainTimeForDay } from "../utils";
import { CriticalEventsPanel, EventsExpandButton } from "./panels/CriticalEventsPanel";
import { FloodLayersSection } from "./panels/FloodLayersSection";
import { ObservedRainSection } from "./panels/ObservedRainSection";
import { RainForecastSection } from "./panels/RainForecastSection";
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
  // Lluvia pronosticada (WRF)
  const [forecastDay, setForecastDay] = useState<ForecastDay>(() => initialForecastDay(data.rain));
  const [showRain, setShowRain] = useState(true);
  const [rainLoading, setRainLoading] = useState(false);
  // Lluvia observada (satélite)
  const [showObservedRain, setShowObservedRain] = useState(false);
  const [observedProduct, setObservedProduct] = useState<ObservedRainProduct>("imerg");
  const [observedWindow, setObservedWindow] = useState<ObservedRainWindow>("24h");
  const [observedRainLoading, setObservedRainLoading] = useState(false);
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

  const { events, fetchedAt, error: eventsError } = data.eventsFeed;
  const criticalCount = events.filter((event) => event.severity === "critical").length;
  const rainTime = showRain ? rainTimeForDay(data.rain, forecastDay) : null;
  const rainForecast = rainTime && data.rain?.run ? { time: rainTime, run: data.rain.run } : null;
  const observedRain = showObservedRain
    ? {
        layerId: `${observedProduct}-${observedWindow}`,
        attribution: OBSERVED_RAIN_PRODUCTS.find((option) => option.value === observedProduct)?.attribution ?? "",
      }
    : null;
  const selectedRiverId = riverTarget?.kind === "river" ? riverTarget.river.riverId : null;

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
        layers={layers}
        rainForecast={rainForecast}
        observedRain={observedRain}
        onRainLoadingChange={setRainLoading}
        onObservedRainLoadingChange={setObservedRainLoading}
        alertDayIndex={alertDayIndex}
        selectedRiverId={selectedRiverId}
        onSelectRiver={(river: SelectedRiver) => showRiver({ kind: "river", river })}
        onRiverLookup={(lat, lng) => showRiver({ kind: "point", lat, lng })}
        selectedEventId={selectedEventId}
        focusRequest={focusRequest}
        onSelectEvent={selectEvent}
      />

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
            isLoading={rainLoading}
          />
          <ObservedRainSection
            visible={showObservedRain}
            onVisibleChange={setShowObservedRain}
            product={observedProduct}
            onProductChange={setObservedProduct}
            timeWindow={observedWindow}
            onTimeWindowChange={setObservedWindow}
            isLoading={observedRainLoading}
          />
          <FloodLayersSection
            data={data}
            layers={layers}
            onToggleLayer={toggleLayer}
            alertDayIndex={alertDayIndex}
            onAlertDayChange={setAlertDayIndex}
          />
        </div>
      </ResponsivePanel>

      <ResponsivePanel
        title="Eventos críticos"
        subtitle={
          eventsError
            ? "Sin conexión con el servidor de datos"
            : `SNGR · últimos ${EVENTS_WINDOW_DAYS} días · ${formatDateTime(fetchedAt)}`
        }
        icon={<PulsingAlertIcon />}
        mobileOpen={mobileSheet === "events"}
        desktopOpen={desktopPanels.events}
        onClose={() => closePanel("events")}
        desktopClassName="lg:bottom-6 lg:left-4 lg:right-auto lg:w-90 lg:max-h-[calc(100%-11rem)]"
        desktopFooter={
          events.length > 1 && (
            <EventsExpandButton
              expanded={eventsExpanded}
              total={events.length}
              onToggle={() => setEventsExpanded((value) => !value)}
            />
          )
        }
      >
        <CriticalEventsPanel
          events={events}
          error={eventsError}
          selectedId={selectedEventId}
          onSelect={selectEvent}
          expanded={eventsExpanded}
        />
      </ResponsivePanel>

      <RiverPanel
        target={riverTarget}
        alertDays={data.riverAlerts?.days ?? []}
        alertDayIndex={alertDayIndex}
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
          <AlertTriangleIcon className="size-4 text-red-600" />
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
            <AlertTriangleIcon className="size-4 text-red-600" />
            Alertas
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
      <AlertTriangleIcon className="size-4.5" />
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

/** El día 1 si tiene datos; si no, el primero que sí los tenga. */
function initialForecastDay(rain: RainAvailability | null): ForecastDay {
  if (rainTimeForDay(rain, DEFAULT_FORECAST_DAY)) return DEFAULT_FORECAST_DAY;
  return FORECAST_DAYS.find((day) => rainTimeForDay(rain, day)) ?? DEFAULT_FORECAST_DAY;
}
