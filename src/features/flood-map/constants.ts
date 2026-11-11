import type {
  AlertLevel,
  EventFilters,
  EventPeriod,
  EventSeverity,
  FlashFloodLikelihood,
  LatLngBounds,
  LayerVisibility,
  ObservedRainProduct,
  ForecastDay,
  ForecastWindowHours,
  RainWindow,
  RainWindowHours,
  PreparednessIndicator,
  PreparednessLevel,
  RiskComponentId,
  Semaphore,
  StationRainLevel,
  WatershedSlope,
  WeatherStationCategory,
} from "./types";

// ── Mapa ────────────────────────────────────────────────────────────────
export const MAP_CONFIG = {
  /** Ecuador continental; el mapa se ajusta a este recuadro en cualquier pantalla. */
  initialBounds: [
    [-5.1, -81.1],
    [1.5, -75.2],
  ] as LatLngBounds,
  /** Ecuador con Galápagos (hasta ~92° O) y mar al oeste, para poder centrar las islas; al este no pasa mucho de la frontera. */
  maxBounds: [
    [-6.5, -97],
    [3, -74],
  ] as LatLngBounds,
  minZoom: 5,
  maxZoom: 18,
  focusZoom: 10,
} as const;

const ESRI_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services";

/**
 * Mapas base que se pueden elegir. El gris claro deja resaltar las capas de
 * colores encima; sus nombres (ciudades, provincias) van en una capa aparte.
 * `provinceLinesMaxZoom`: hasta qué zoom se dibujan los límites provinciales
 * propios (ver ProvinceBoundaries); null = nunca, porque el mapa ya los trae.
 */
export const BASEMAPS: Record<
  "light" | "streets" | "satellite",
  {
    label: string;
    url: string;
    attribution: string;
    maxNativeZoom?: number;
    labelsUrl?: string;
    provinceLinesMaxZoom: number | null;
  }
> = {
  light: {
    label: "Gris claro",
    url: `${ESRI_TILES}/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    labelsUrl: `${ESRI_TILES}/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
    // Más cerca no hay teselas: Leaflet amplía las del zoom 16.
    maxNativeZoom: 16,
    attribution: "Esri, HERE, Garmin, &copy; colaboradores de OpenStreetMap",
    // Desde el zoom 8 el mapa gris dibuja sus propias provincias: se dejan las suyas, sin repetirlas.
    provinceLinesMaxZoom: 7,
  },
  streets: {
    label: "Calles",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    provinceLinesMaxZoom: null,
  },
  // Imágenes satelitales: se aprecia si el lugar es montaña, ciudad, río o cultivo. Los nombres van en una capa aparte.
  satellite: {
    label: "Satélite",
    url: `${ESRI_TILES}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
    labelsUrl: `${ESRI_TILES}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`,
    maxNativeZoom: 18,
    attribution: "Esri, Maxar, Earthstar Geographics",
    provinceLinesMaxZoom: 7,
  },
};
export type BasemapId = keyof typeof BASEMAPS;

/**
 * Límites de las provincias del INEC (capa "Provincias del Ecuador" de ArcGIS),
 * simplificados a ~200 m: 25 polígonos, ~300 KB (~90 KB comprimido). Archivo fijo.
 */
export const PROVINCE_BOUNDARIES_URL = "/data/provincias-ecuador.geojson";

/**
 * Contorno de la provincia (al pasar el mouse y la elegida). Azul, salvo sobre capas
 * de color (lluvia, mar, ríos, caudales): ahí blanco con borde oscuro (`casing`). Ninguna
 * capa usa líneas blancas, resalta sobre la lluvia y el borde lo deja ver sobre el mapa claro.
 */
export const PROVINCE_OUTLINE_COLORS = { normal: "#2563eb", contrast: "#ffffff", casing: "#0f172a" } as const;

/**
 * Cuencas hidrográficas: unidades Pfafstetter de nivel 3 del MAE (nivel 5 agrupado,
 * Galápagos aparte, topología corregida), simplificadas a ~100 m: 12 polígonos,
 * ~630 KB (~200 KB comprimido). Campos `nombre` y `vertiente`. Archivo fijo.
 */
export const WATERSHEDS_URL = "/data/cuencas-ecuador.geojson";

/** Hacia dónde drena cada cuenca: color del relleno en el mapa y texto en los popups. */
export const WATERSHED_SLOPES: Record<WatershedSlope, { label: string; short: string; fill: string; stroke: string }> = {
  Pacífico: { label: "Vertiente del Pacífico", short: "Pacífico", fill: "#38bdf8", stroke: "#0284c7" },
  Atlántico: { label: "Vertiente del Atlántico (Amazonas)", short: "Atlántico (Amazonas)", fill: "#4ade80", stroke: "#16a34a" },
};
export const DEFAULT_BASEMAP: BasemapId = "light";

/** Panes de Leaflet: definen qué capa se dibuja encima de cuál. */
export const MAP_PANES = {
  // Cuencas: relleno suave debajo de todo (la lluvia y el mar se ven encima).
  watersheds: { name: "watersheds", zIndex: 330 },
  seaTemperature: { name: "seaTemperature", zIndex: 340 },
  observedRain: { name: "observedRain", zIndex: 345 },
  rain: { name: "rain", zIndex: 350 },
  // Gestión del riesgo: polígonos debajo de los ríos; líneas y puntos encima.
  // Un solo lienzo para todas las capas de gestión del riesgo: con uno por capa (o por
  // geometría), el de arriba se queda con los clics y las de abajo no se pueden tocar.
  risk: { name: "risk", zIndex: 395 },
  // Límites de provincias y nombres del mapa base gris: encima de la lluvia, debajo de las capas de riesgo.
  provinces: { name: "provinces", zIndex: 386 },
  basemapLabels: { name: "basemapLabels", zIndex: 390 },
  rivers: { name: "rivers", zIndex: 380 },
  /** Debajo de la máscara de provincia (385): no se puede filtrar por provincia, así que fuera de ella se atenúa. */
  provincialRoads: { name: "provincialRoads", zIndex: 384 },
} as const;

// ── Lluvia pronosticada (WRF), día por día ──────────────────────────────
/** Días que se pueden elegir; cada uno muestra solo su lluvia (no la suma con los anteriores). */
export const FORECAST_DAYS: readonly ForecastDay[] = [1, 2, 3];

/**
 * Cómo se nombra cada día: la opción dice hasta qué hora llega ("48h") y el
 * título aclara que es solo ese tramo de 24 h, no el acumulado.
 */
export const FORECAST_DAY_LABELS: Record<ForecastDay, { option: string; range: string }> = {
  1: { option: "0–24 h", range: "en las primeras 24 h" },
  2: { option: "24–48 h", range: "entre las 24 y 48 h" },
  3: { option: "48–72 h", range: "entre las 48 y 72 h" },
};

export const FORECAST_WINDOW_HOURS: readonly ForecastWindowHours[] = [3, 6, 12, 24];
export const DEFAULT_FORECAST_DAY: ForecastDay = 1;

/** Capa del backend cuya paleta usa la imagen de lluvia acumulada (para la leyenda). */
export const RAIN_FORECAST_LEGEND_LAYER = "wrf-precipitation-daily";

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

/** Opacidad inicial de cada capa de imagen (después se ajusta con su deslizador). */
export const DEFAULT_OVERLAY_OPACITY = { forecast: 0.85, observed: 0.85, imerg: 0.85, sea: 0.85 } as const;

/** IMERG (NASA): tasa de lluvia de 30 min, la más reciente ("default"), en teselas de NASA GIBS. */
export const IMERG_TILE_URL =
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate_30min/default/default/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png";
export const IMERG_LEGEND_URL = "https://gibs.earthdata.nasa.gov/legends/GPM_Precipitation_Rate_H.svg";
/** GIBS publica IMERG hasta el zoom 6; más cerca, Leaflet amplía esas teselas. */
export const IMERG_MAX_NATIVE_ZOOM = 6;

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
/** Vista inicial: solo las crecidas repentinas de Google. El resto se activa desde el panel de capas. */
export const DEFAULT_LAYER_VISIBILITY: LayerVisibility = {
  riverNetwork: false,
  riverAlerts: false,
  flashFloods: true,
  watersheds: false,
};

// ── Google Flood Hub ────────────────────────────────────────────────────
/** Niveles de probabilidad de las crecidas repentinas urbanas (de mayor a menor). */
export const FLASH_FLOOD_LIKELIHOODS: Record<FlashFloodLikelihood, { label: string; color: string }> = {
  highly_likely: { label: "Muy probable", color: "#dc2626" },
  likely: { label: "Probable", color: "#f59e0b" },
};

/** Ficha del modelo según la documentación de Google: la API no da estos datos por evento, son iguales para todas las zonas. */
export const FLASH_FLOOD_MODEL = {
  type: "Crecida repentina",
  cause: "Eventos meteorológicos",
  model: "IA de Google",
  inputs: "ECMWF, IMERG, NOAA CPC y Google DeepMind",
};

// ── Alerta de inundación por parroquia (lluvia pronosticada de 3, 6, 12 y 24 h) ──

/** Ventanas del pronóstico de la alerta, de la más corta a la más larga. */
export const RAIN_WINDOWS: readonly { id: RainWindow; label: string }[] = [
  { id: "3h", label: "3 h" },
  { id: "6h", label: "6 h" },
  { id: "12h", label: "12 h" },
  { id: "24h", label: "24 h" },
];
/** Semáforo del documento de la SNGR, en tres colores (el naranja pasa a rojo). */
/**
 * Semáforo del índice de preparación provincial (documento "Semaforización para
 * componente Preparación"): cinco niveles; los intervalos son propuestos, no oficiales.
 */
export const PREPAREDNESS_LEVEL_STYLES: Record<PreparednessLevel, { label: string; range: string; color: string }> = {
  "very-high": { label: "Muy alta", range: "más de 80", color: "#047857" },
  high: { label: "Alta", range: "60 a 80", color: "#22c55e" },
  medium: { label: "Media", range: "40 a 60", color: "#facc15" },
  low: { label: "Baja", range: "20 a 40", color: "#f97316" },
  "very-low": { label: "Muy baja", range: "0 a 20", color: "#dc2626" },
};

/** Lo que cuenta cada indicador del índice de preparación. */
export const PREPAREDNESS_INDICATOR_LABELS: Record<PreparednessIndicator, string> = {
  shelters: "Alojamientos calificados",
  camps: "Campamentos del MIT",
  preventiveActions: "Acciones preventivas realizadas",
  roadProjects: "Proyectos viales en ejecución o terminados",
};

/** Con qué se divide cada conteo del índice de preparación: el área de la provincia o sus km de Red Vial Estatal. */
export const PREPAREDNESS_RATES: Record<PreparednessIndicator, { by: "area" | "rve"; unit: string }> = {
  shelters: { by: "area", unit: "km²" },
  camps: { by: "rve", unit: "km de vía" },
  preventiveActions: { by: "rve", unit: "km de vía" },
  roadProjects: { by: "rve", unit: "km de vía" },
};

export const SEMAPHORE_STYLES: Record<Semaphore, { label: string; alert: string; color: string; panelClass: string }> = {
  // Se nombra por el nivel de alerta, no por el color (rojo = muy alta, naranja = alta, amarillo = moderada, verde = baja).
  red: { label: "Muy alta", alert: "Alerta muy alta", color: "#dc2626", panelClass: "bg-red-50 text-red-900 ring-1 ring-red-600/20" },
  orange: { label: "Alta", alert: "Alerta alta", color: "#f97316", panelClass: "bg-orange-50 text-orange-900 ring-1 ring-orange-600/20" },
  yellow: { label: "Moderada", alert: "Alerta moderada", color: "#eab308", panelClass: "bg-yellow-50 text-yellow-900 ring-1 ring-yellow-600/20" },
  green: { label: "Baja", alert: "Alerta baja", color: "#16a34a", panelClass: "bg-green-50 text-green-900 ring-1 ring-green-600/20" },
};

// ── Caudales (GEOGLOWS) ─────────────────────────────────────────────────
/** Capa vectorial de la red de ríos en el backend. */
export const RIVER_NETWORK_LAYER = {
  id: "rivers-ecuador",
  sourceLayer: "geoglows_drainage_ecuador",
  attribution: "Ríos: INAMHI · GEOGLOWS",
  color: "#3b82c4",
} as const;

/** Red vial provincial (teselas vectoriales del SNGR vía el proxy del backend): solo el trazado, sin atributos. */
export const PROVINCIAL_ROADS_LAYER = {
  id: "provincial-roads",
  sourceLayer: "Red_Vial_Provincial",
  attribution: "Red vial provincial: SNGR",
  // Gris pizarra y más delgada que la RVE (café): se lee como vía secundaria.
  color: "#475569",
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

/**
 * Cada cuánto se vuelven a pedir las capas de gestión del riesgo encendidas. El
 * backend las vuelve a descargar apenas cambian en ArcGIS; si no cambiaron
 * responde 304 y no se transfieren de nuevo.
 */
export const RISK_LAYERS_REFRESH_MS = 60 * 1000;

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

export type PlannedLayerIcon = "waves" | "mountain" | "alert" | "map" | "pin" | "shield" | "users" | "refresh" | "zap";

/** Una capa prevista que aún no tiene fuente de datos: se muestra como "Próximamente". */
export interface PlannedLayer {
  id: string;
  title: string;
  description: string;
  icon: PlannedLayerIcon;
}

/**
 * Capas previstas de cada componente que aún no tienen datos que se puedan leer.
 * Las que ya tienen fuente están en RISK_LAYER_STYLES (risk-layers.ts).
 */
export const PLANNED_LAYERS: Record<RiskComponentId, readonly PlannedLayer[]> = {
  amenaza: [],
  exposicion: [],
  preparacion: [],
  respuesta: [],
};

