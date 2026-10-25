import type {
  AlertLevel,
  EventFilters,
  EventPeriod,
  EventSeverity,
  FlashFloodProbability,
  FluvialLevel,
  HistoricalFrequency,
  LatLngBounds,
  LayerVisibility,
  ObservedRainProduct,
  ForecastDay,
  RainWindowHours,
  RiskComponentId,
  StationRainLevel,
  WeatherStationCategory,
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
  seaTemperature: { name: "seaTemperature", zIndex: 340 },
  observedRain: { name: "observedRain", zIndex: 345 },
  rain: { name: "rain", zIndex: 350 },
  historical: { name: "historical", zIndex: 360 },
  flash: { name: "flash", zIndex: 370 },
  rivers: { name: "rivers", zIndex: 380 },
  fluvial: { name: "fluvial", zIndex: 390 },
} as const;

// ── Lluvia pronosticada (WRF), día por día ──────────────────────────────
/** Días que se pueden elegir; cada uno muestra solo su lluvia (no la suma con los anteriores). */
export const FORECAST_DAYS: readonly ForecastDay[] = [1, 2, 3];

/**
 * Cómo se nombra cada día: la opción dice hasta qué hora llega ("48h") y el
 * título aclara que es solo ese tramo de 24 h, no el acumulado.
 */
export const FORECAST_DAY_LABELS: Record<ForecastDay, { option: string; range: string }> = {
  1: { option: "24h", range: "en las primeras 24 h" },
  2: { option: "48h", range: "entre las 24 y 48 h" },
  3: { option: "72h", range: "entre las 48 y 72 h" },
};
export const DEFAULT_FORECAST_DAY: ForecastDay = 1;

/** Capa del backend cuya paleta usa la imagen de lluvia acumulada (para la leyenda). */
export const RAIN_FORECAST_LEGEND_LAYER = "wrf-precipitation-daily";
export const RAIN_FORECAST_OPACITY = 0.7;

// ── Lluvia observada por satélite ───────────────────────────────────────
// Productos, nombres y disponibilidad llegan del backend (GET /observed-rain).

/** Capa del backend cuya paleta usa la imagen de lluvia observada (para la leyenda). */
/** Ventanas de lluvia observada: lo que cayó en las últimas 24, 48 o 72 h (acumulado). */
export const OBSERVED_RAIN_WINDOWS: readonly { value: `${RainWindowHours}`; label: string }[] = [
  { value: "24", label: "24h" },
  { value: "48", label: "48h" },
  { value: "72", label: "72h" },
];

export const observedRainLegendLayer = (product: ObservedRainProduct) => `${product}-24h`;
export const OBSERVED_RAIN_OPACITY = 0.7;

// ── Temperatura del mar ─────────────────────────────────────────────────
export const SEA_TEMPERATURE_OPACITY = 0.7;

// ── Estaciones del INAMHI ───────────────────────────────────────────────
/**
 * Lluvia medida en las últimas horas, de menos a más, con la escala habitual de
 * los mapas de lluvia (azul → verde → amarillo → rojo). Cada color es el que la
 * paleta oficial de PERSIANN (capa "Lluvia registrada") da a esos milímetros:
 * la misma lluvia se ve igual en el satélite y en el pluviómetro. Además cambian
 * el relleno (0 mm es hueco) y el tamaño (crece con la lluvia); el borde oscuro
 * del rombo lo separa de la capa del satélite. Las estaciones sin datos
 * recientes no se muestran.
 */
export const STATION_RAIN_LEVELS: Record<
  StationRainLevel,
  { label: string; color: string; minMm: number; sizePx: number; hollow?: boolean }
> = {
  none: { label: "0 mm", color: "#475569", minMm: 0, sizePx: 8, hollow: true },
  light: { label: "Hasta 4 mm", color: "#75BAFF", minMm: 0.05, sizePx: 9 },
  moderate: { label: "4 a 15 mm", color: "#0087FF", minMm: 4, sizePx: 10 },
  heavy: { label: "15 a 30 mm", color: "#1ACF05", minMm: 15, sizePx: 12 },
  veryHeavy: { label: "30 a 45 mm", color: "#FFF42B", minMm: 30, sizePx: 13 },
  intense: { label: "45 a 60 mm", color: "#F96D73", minMm: 45, sizePx: 14 },
  extreme: { label: "60 mm o más", color: "#BF0000", minMm: 60, sizePx: 16 },
};
export const STATION_RAIN_LEVEL_ORDER: readonly StationRainLevel[] = [
  "none",
  "light",
  "moderate",
  "heavy",
  "veryHeavy",
  "intense",
  "extreme",
];

export const STATION_CATEGORY_LABELS: Record<WeatherStationCategory, string> = {
  meteorological: "Meteorológica",
  hydrological: "Hidrológica",
  hydrometeorological: "Hidrometeorológica",
};

/** Barras de la lluvia de cada hora en el popup de una estación (una sola serie). */
export const STATION_HOURLY_BAR_COLOR = "#0087FF";

/** Cada día del pronóstico en el popup de una estación (las mismas 24 h que la capa del mapa). */
export const STATION_FORECAST_LABELS: Record<ForecastDay, string> = {
  1: "Primeras 24 h",
  2: "De 24 a 48 h",
  3: "De 48 a 72 h",
};

// ── Inundaciones ────────────────────────────────────────────────────────
/** Vista inicial: solo las alertas por caudal. El resto (incluida la red de ríos) se activa desde el panel de capas. */
export const DEFAULT_LAYER_VISIBILITY: LayerVisibility = {
  riverNetwork: false,
  riverAlerts: true,
  fluvial: false,
  flash: false,
  historical: false,
};

// ── Inundaciones fluviales (simuladas) ──────────────────────────────────
export const FLUVIAL_LEVELS: Record<FluvialLevel, { label: string; color: string }> = {
  extremo: { label: "Extremo", color: "#7a0a0a" },
  peligro: { label: "Peligro", color: "#ee1c1c" },
  advertencia: { label: "Advertencia", color: "#f5a00b" },
  normal: { label: "Normal", color: "#2fbf2f" },
  "sin-datos": { label: "Sin datos", color: "#8c8c8c" },
};

export const FLUVIAL_LEVEL_ORDER: FluvialLevel[] = ["extremo", "peligro", "advertencia", "normal", "sin-datos"];

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
  antecedent: "#1baf7a",
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
/**
 * Orden de la lista de eventos: lo más reciente primero, pero la gravedad
 * cuenta como antigüedad a favor. Un crítico se ordena como si fuera 48 h más
 * reciente y uno alto, 24 h. Así un moderado de hace 2 h pasa delante de un
 * crítico de hace 3 días, pero no de uno de ayer.
 */
export const SEVERITY_PRIORITY_HOURS: Record<EventSeverity, number> = { critical: 48, high: 24, moderate: 0 };

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

/** Hacia atrás desde ahora: los eventos de la SNGR ya ocurrieron (no son pronóstico). */
export const EVENT_PERIODS: readonly { value: EventPeriod; label: string; hours: number }[] = [
  { value: "24h", label: "Últimas 24 h", hours: 24 },
  { value: "3d", label: "Últimos 3 días", hours: 3 * 24 },
  { value: "7d", label: "Últimos 7 días", hours: EVENTS_WINDOW_DAYS * 24 },
];

/**
 * Por defecto todas las severidades: el orden por prioridad (SEVERITY_PRIORITY_HOURS)
 * ya pone arriba lo reciente y grave. Cada severidad se oculta desde su recuadro.
 */
export const DEFAULT_EVENT_FILTERS: EventFilters = {
  severities: ["critical", "high", "moderate"],
  period: "24h",
  province: null,
  hazardType: null,
  showUnverified: false,
};

/** Eventos que se muestran antes de "Ver más". */
export const EVENTS_PAGE_SIZE = 10;

/** Cada cuánto se vuelven a pedir los datos con la página abierta. */
export const DATA_REFRESH_MS = 5 * 60 * 1000;

// ── Componentes de la gestión del riesgo ────────────────────────────────
/**
 * Pestañas del panel de capas. Solo organizan el panel: cada capa se enciende
 * por su cuenta, así que capas de pestañas distintas se superponen en el mapa
 * (p. ej. el pronóstico de lluvia de Amenaza con las vías de Exposición).
 */
export const RISK_COMPONENTS: readonly { id: RiskComponentId; label: string; description: string }[] = [
  {
    id: "amenaza",
    label: "Amenaza",
    description: "Lluvia, ríos e inundaciones: lo que está pasando y lo que se pronostica.",
  },
  {
    id: "exposicion",
    label: "Exposición",
    description: "Vías, puentes, escuelas y centros de salud que pueden verse afectados.",
  },
  {
    id: "preparacion",
    label: "Preparación",
    description: "Recursos y trabajos preventivos para estar listos antes del evento.",
  },
  {
    id: "respuesta",
    label: "Respuesta",
    description: "Acciones para atender y recuperar lo afectado después del evento.",
  },
];
export const DEFAULT_RISK_COMPONENT: RiskComponentId = "amenaza";

export type PlannedLayerIcon = "waves" | "mountain" | "alert" | "map" | "pin" | "shield" | "users" | "refresh";

/** Una capa prevista que aún no tiene fuente de datos: se muestra como "Próximamente". */
export interface PlannedLayer {
  id: string;
  title: string;
  description: string;
  icon: PlannedLayerIcon;
}

/** Capas previstas de cada componente, en el orden en que se muestran (aún sin fuente de datos). */
export const PLANNED_LAYERS: Record<RiskComponentId, readonly PlannedLayer[]> = {
  amenaza: [
    {
      id: "mass-movements",
      title: "Movimientos de masa",
      description: "Deslizamientos y zonas susceptibles.",
      icon: "mountain",
    },
    {
      id: "rve-critical-points",
      title: "Puntos críticos en la Red Vial Estatal",
      description: "Tramos de la RVE con problemas recurrentes.",
      icon: "alert",
    },
  ],
  exposicion: [
    { id: "rve", title: "Red Vial Estatal (RVE)", description: "Vías del Estado que pueden quedar afectadas.", icon: "map" },
    { id: "bridges", title: "Puentes", description: "Puentes de la red vial.", icon: "map" },
    { id: "schools", title: "Centros de educación", description: "Escuelas y colegios.", icon: "pin" },
    { id: "health-centers", title: "Centros médicos", description: "Hospitales y centros de salud.", icon: "pin" },
  ],
  preparacion: [
    { id: "machinery", title: "Maquinaria distribuida a nivel nacional", description: "Dónde está la maquinaria disponible.", icon: "pin" },
    { id: "shelters", title: "Albergues destinados a atención", description: "Albergues habilitados para la emergencia.", icon: "users" },
    { id: "rve-preventive-works", title: "Trabajos preventivos en la RVE", description: "Obras preventivas en la Red Vial Estatal.", icon: "shield" },
    {
      id: "microenterprises",
      title: "Microempresas distribuidas a nivel nacional",
      description: "Microempresas de mantenimiento vial y su ubicación.",
      icon: "users",
    },
    {
      id: "microenterprises-loja",
      title: "Seguimiento de microempresas en Loja",
      description: "Avance de las microempresas de la provincia de Loja.",
      icon: "users",
    },
    {
      id: "el-nino-road-projects",
      title: "Proyectos viales asociados al fenómeno de El Niño",
      description: "Proyectos para reducir el impacto de El Niño en las vías.",
      icon: "shield",
    },
  ],
  respuesta: [
    {
      id: "rve-recovery",
      title: "Trabajos para recuperar la transitabilidad en la RVE",
      description: "Intervenciones para reabrir las vías afectadas.",
      icon: "refresh",
    },
  ],
};

