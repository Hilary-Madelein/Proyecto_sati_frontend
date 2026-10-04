import type {
  AlertLevel,
  EventSeverity,
  FlashFloodProbability,
  ForecastDay,
  HistoricalFrequency,
  LatLngBounds,
  LayerVisibility,
  ObservedRainProduct,
  ObservedRainWindow,
} from "./types";

// ── Mapa ────────────────────────────────────────────────────────────────
export const MAP_CONFIG = {
  /** Ecuador continental; el mapa se ajusta a este recuadro en cualquier pantalla. */
  initialBounds: [
    [-5.1, -81.1],
    [1.5, -75.2],
  ] as LatLngBounds,
  maxBounds: [
    [-9, -88],
    [5, -68],
  ] as LatLngBounds,
  minZoom: 5,
  maxZoom: 18,
  focusZoom: 10,
  tiles: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
} as const;

/** Panes de Leaflet: definen qué capa se dibuja encima de cuál. */
export const MAP_PANES = {
  observedRain: { name: "observedRain", zIndex: 345 },
  rain: { name: "rain", zIndex: 350 },
  historical: { name: "historical", zIndex: 360 },
  flash: { name: "flash", zIndex: 370 },
  rivers: { name: "rivers", zIndex: 380 },
} as const;

// ── Lluvia pronosticada (WRF) ───────────────────────────────────────────
/** Capa del backend con la lluvia acumulada por día del modelo WRF del INAMHI. */
export const RAIN_LAYER = {
  id: "wrf-precipitation-daily",
  attribution: "Lluvia: INAMHI · modelo WRF",
  opacity: 0.7,
} as const;

export const FORECAST_DAYS: readonly ForecastDay[] = [1, 2, 3];
export const DEFAULT_FORECAST_DAY: ForecastDay = 1;

// ── Lluvia observada por satélite ───────────────────────────────────────
export const OBSERVED_RAIN_PRODUCTS: readonly { value: ObservedRainProduct; label: string; attribution: string }[] = [
  { value: "imerg", label: "IMERG", attribution: "Lluvia observada: NASA GPM IMERG · INAMHI" },
  { value: "persiann", label: "PERSIANN", attribution: "Lluvia observada: CHRS PERSIANN-PDIR-Now · INAMHI" },
];

export const OBSERVED_RAIN_WINDOWS: readonly { value: ObservedRainWindow; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "48h", label: "48h" },
  { value: "72h", label: "72h" },
];

export const OBSERVED_RAIN_OPACITY = 0.7;

// ── Inundaciones ────────────────────────────────────────────────────────
export const DEFAULT_LAYER_VISIBILITY: LayerVisibility = {
  riverNetwork: true,
  riverAlerts: true,
  flash: true,
  historical: false,
};

// ── Caudales (GEOGLOWS) ─────────────────────────────────────────────────
/** Capa vectorial de la red de ríos en el backend. */
export const RIVER_NETWORK_LAYER = {
  id: "rivers-ecuador",
  sourceLayer: "geoglows_drainage_ecuador",
  attribution: "Ríos: INAMHI · GEOGLOWS",
  color: "#3b82c4",
} as const;

/**
 * Niveles de alerta por caudal: supera el caudal de N años de periodo de
 * retorno. Colores oficiales del Hydroviewer del INAMHI.
 */
export const RIVER_ALERT_LEVELS: readonly { level: Exclude<AlertLevel, 0>; label: string; color: string }[] = [
  { level: 2, label: "2 años", color: "#fef001" },
  { level: 5, label: "5 años", color: "#fd9a01" },
  { level: 10, label: "10 años", color: "#ff3805" },
  { level: 25, label: "25 años", color: "#ff0000" },
  { level: 50, label: "50 años", color: "#80006a" },
  { level: 100, label: "100 años", color: "#8000f6" },
];

export const RIVER_NORMAL_COLOR = "#2aad27";

/** Colores del hidrograma (validados con la guía de visualización: ver /dataviz). */
export const HYDROGRAPH_COLORS = {
  ensemble: "#2a78d6",
  highRes: "#eb6834",
} as const;

export const FLASH_FLOOD_PROBABILITIES: Record<
  FlashFloodProbability,
  { label: string; fill: string; stroke: string }
> = {
  "muy-probable": { label: "Muy probable", fill: "#f8a3a3", stroke: "#e23b3b" },
  probable: { label: "Probable", fill: "#fdc98a", stroke: "#f39a2b" },
};

export const FLASH_FLOOD_ORDER: FlashFloodProbability[] = ["muy-probable", "probable"];

export const HISTORICAL_FREQUENCIES: Record<HistoricalFrequency, { label: string; color: string }> = {
  p5: { label: "5% del tiempo", color: "#8e14c4" },
  p1: { label: "1% del tiempo", color: "#d665f0" },
  p05: { label: "0,5% del tiempo", color: "#ebc3f5" },
};

export const HISTORICAL_FREQUENCY_ORDER: HistoricalFrequency[] = ["p5", "p1", "p05"];

// ── Eventos críticos ────────────────────────────────────────────────────
export const SEVERITY_STYLES: Record<
  EventSeverity,
  {
    label: string;
    /** Color sólido (marcadores del mapa e íconos). */
    color: string;
    rank: number;
    /** Píldora con fondo suave. */
    pillClass: string;
    /** Fondo + texto del ícono del evento. */
    tileClass: string;
  }
> = {
  critical: {
    label: "Crítico",
    color: "#dc2626",
    rank: 0,
    pillClass: "bg-red-50 text-red-700 ring-red-600/20",
    tileClass: "bg-red-50 text-red-600",
  },
  high: {
    label: "Alto",
    color: "#ea580c",
    rank: 1,
    pillClass: "bg-orange-50 text-orange-700 ring-orange-600/20",
    tileClass: "bg-orange-50 text-orange-600",
  },
  moderate: {
    label: "Moderado",
    color: "#ca8a04",
    rank: 2,
    pillClass: "bg-amber-50 text-amber-800 ring-amber-600/25",
    tileClass: "bg-amber-50 text-amber-600",
  },
};

export const SEVERITY_ORDER: EventSeverity[] = ["critical", "high", "moderate"];

/** Eventos que se piden al backend: abiertos y ocurridos en los últimos N días. */
export const EVENTS_WINDOW_DAYS = 7;

/** Cada cuánto se vuelven a pedir los datos con la página abierta. */
export const DATA_REFRESH_MS = 5 * 60 * 1000;
