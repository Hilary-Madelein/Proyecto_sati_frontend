export type LatLng = [lat: number, lng: number];
export type LatLngBounds = [southWest: LatLng, northEast: LatLng];

// ── Lluvia pronosticada acumulada (modelo WRF del INAMHI) ───────────────
/** Horas acumuladas desde el inicio de la corrida: 24 h = día 1, 48 h = días 1-2, 72 h = días 1-3. */
/** Día del pronóstico: 1 = primeras 24 h de la corrida, 2 = las siguientes… */
export type ForecastDay = 1 | 2 | 3;
/** Ventanas de lluvia observada (acumulada hacia atrás), en horas. */
export type RainWindowHours = 24 | 48 | 72;

export interface RainForecastAvailability {
  /** Inicio de la corrida del modelo (ISO 8601). */
  run: string | null;
  isStale: boolean;
  attribution: string;
  /** Cada día con sus propias 24 h (no acumuladas). */
  days: Array<{ day: ForecastDay; available: boolean; from: string | null; to: string | null }>;
}

/** Imagen de lluvia calculada por el backend, lista para superponer en el mapa. */
export interface RainImage {
  /** [[sur, oeste], [norte, este]] */
  bounds: [[number, number], [number, number]];
  /** Ruta de la imagen PNG relativa a la API del backend. */
  imagePath: string;
}

/** Lluvia pronosticada de UN día, calculada por el backend, lista para el mapa. */
export interface DailyRainForecast extends RainImage {
  run: string;
  day: ForecastDay;
  from: string;
  to: string;
  maxMm: number;
}

/** Escala de colores de una capa de lluvia (GET /layers/:id/legend). */
export interface RainLegend {
  id: string;
  unit: string;
  entries: { value: number; color: string }[];
}

// ── Lluvia observada por satélite ───────────────────────────────────────
/** Hoy solo PERSIANN: el INAMHI dejó de publicar IMERG (marzo de 2026). */
export type ObservedRainProduct = "persiann";

export interface ObservedRainWindowStatus {
  hours: RainWindowHours;
  available: boolean;
  /** Primera y última hora con datos de la ventana (ISO 8601). */
  from: string | null;
  to: string | null;
  /** Horas sin dato dentro de la ventana. */
  missingHours: number;
}

export interface ObservedRainProductStatus {
  key: ObservedRainProduct;
  name: string;
  attribution: string;
  /** Última hora con datos (ISO 8601). */
  latest: string | null;
  /** El producto no tiene datos recientes (p. ej. el INAMHI dejó de publicarlo). */
  isStale: boolean;
  windows: ObservedRainWindowStatus[];
}

/** GET /observed-rain: productos en orden de preferencia. */
export interface ObservedRainAvailability {
  products: ObservedRainProductStatus[];
}

/** Lluvia observada acumulada hasta la última hora (suma horaria hecha por el backend). */
export interface ObservedAccumulatedRain extends RainImage {
  product: ObservedRainProduct;
  hours: RainWindowHours;
  from: string;
  to: string;
  missingHours: number;
  maxMm: number;
}

// ── Temperatura del mar (anomalía, indicador de El Niño) ────────────────
/** Anomalía de la temperatura superficial del mar frente a Ecuador (GET /sea-temperature). */
export interface SeaTemperatureAnomaly extends RainImage {
  /** Día del dato (ISO 8601). */
  time: string;
  /** El dato tiene varios días de atraso. */
  isStale: boolean;
  attribution: string;
  /** Anomalía media de la región Niño 1+2 (°C sobre lo normal); null si no hay datos. */
  nino12Anomaly: number | null;
  minAnomaly: number;
  maxAnomaly: number;
  legend: Omit<RainLegend, "id">;
}

/** Temperatura y anomalía del mar en un punto (GET /sea-temperature/value); null en tierra. */
export interface SeaPointValue {
  time: string;
  sst: number | null;
  anomaly: number | null;
}

// ── Google Flood Hub (vía backend) ──────────────────────────────────────
/** Nivel de inundación que pronostica Flood Hub en un punto. */
export type FloodHubSeverity = "unknown" | "no_flooding" | "above_normal" | "severe" | "extreme";
export type FloodHubTrend = "rise" | "fall" | "no_change" | "unknown";

/** Punto de pronóstico de Flood Hub (una cuenca) con su último estado (GET /flood-hub). */
export interface FloodHubGauge {
  id: string;
  lat: number;
  lng: number;
  severity: FloodHubSeverity;
  trend: FloodHubTrend;
  /** Google verificó la calidad del modelo en este punto. */
  verified: boolean;
  issuedAt: string | null;
  /** Ventana del pronóstico a la que se refiere el nivel. */
  forecastFrom: string | null;
  forecastTo: string | null;
}

export interface FloodHubSnapshot {
  fetchedAt: string;
  issuedAt: string | null;
  attribution: string;
  isStale: boolean;
  /** Puntos por encima de lo normal, severos o extremos. */
  flaggedCount: number;
  /** Primero los de mayor severidad. */
  gauges: FloodHubGauge[];
}

// ── Caudales (GEOGLOWS · Hydroviewer del INAMHI) ────────────────────────
/** 0 = normal; si no, el mayor periodo de retorno (años) superado. */
export type AlertLevel = 0 | 2 | 5 | 10 | 25 | 50 | 100;

export interface RiverAlert {
  riverId: number;
  latitude: number;
  longitude: number;
  streamOrder: number | null;
  province: string | null;
  canton: string | null;
  river: string | null;
  /** Nivel por día del pronóstico (índice 0 = primer día). */
  dailyLevels: AlertLevel[];
  maxLevel: AlertLevel;
  /** Parte de los pronósticos de los últimos 30 días en que el tramo tuvo alerta (0–1); null sin historia. */
  alertShare: number | null;
  /** Alerta casi todos los días: probablemente el modelo sobrestima este tramo. */
  persistent: boolean;
}

export interface RiverAlertsSnapshot {
  source: string;
  /** Fecha de inicio del pronóstico (AAAA-MM-DD). */
  forecastDate: string;
  /** Fecha de cada día del pronóstico (AAAA-MM-DD). */
  days: string[];
  totalReaches: number;
  alerts: RiverAlert[];
  /** Pronósticos con que se midió la persistencia y proporción desde la que se marca; null sin historia. */
  persistence: { forecasts: number; threshold: number } | null;
}

/** Pronóstico de caudal (m³/s) de un tramo; los faltantes son null. */
export interface RiverForecast {
  riverId: number;
  source: string;
  generatedAt: string | null;
  unit: "m3/s";
  times: string[];
  highRes: Array<number | null>;
  ensemble: {
    min: Array<number | null>;
    p25: Array<number | null>;
    median: Array<number | null>;
    mean: Array<number | null>;
    p75: Array<number | null>;
    max: Array<number | null>;
  };
  /** Caudal con que arrancó el pronóstico de cada uno de los días anteriores; null si no hay. */
  antecedent: { times: string[]; flow: Array<number | null> } | null;
  /** AAAAMMDD de la corrida anterior usada porque la más reciente de GEOGLOWS no se pudo leer; null si es la vigente. */
  fallbackRun: string | null;
}

/** Caudales de los periodos de retorno de un tramo (GET /rivers/:id/return-periods). */
export interface RiverReturnPeriods {
  riverId: number;
  method: string;
  /** De menor a mayor periodo. */
  thresholds: Array<{ years: number; flow: number }>;
}

/** Tramo de río elegido en el mapa (por clic en el río o en una alerta). */
export interface SelectedRiver {
  riverId: number;
  /** Alerta del tramo, si tiene. */
  alert: RiverAlert | null;
}

// ── Eventos (SNGR, vía backend) ─────────────────────────────────────────
export type EventSeverity = "critical" | "high" | "moderate";
export type EventStatus = "open" | "closed";

export type HazardType =
  | "flood"
  | "river_flood"
  | "rain_flood"
  | "drainage_flood"
  | "coastal_flood"
  | "landslide"
  | "mudflow"
  | "heavy_rain"
  | "subsidence"
  | "water_erosion"
  | "rockfall"
  | "soil_creep"
  | "other";

export interface EventImpact {
  affected: number;
  housesAffected: number;
  evacuated: number;
  deceased: number;
  /** Damnificados: perdieron la vivienda o no pueden habitarla. */
  homeless: number;
}

export interface HazardEvent {
  id: string;
  code: string | null;
  hazardType: HazardType;
  hazardTypeLabel: string;
  severity: EventSeverity;
  /** Nivel oficial de la SNGR (1, 2, 3…). */
  level: number | null;
  status: EventStatus;
  title: string;
  description: string | null;
  province: string | null;
  canton: string | null;
  sector: string | null;
  /** La SNGR registró daño en personas, viviendas, cultivos o servicios (no solo calles con agua). */
  hasDamage: boolean;
  position: LatLng;
  /** Fecha ISO 8601 en que ocurrió el evento. */
  occurredAt: string;
  impact: EventImpact;
}

/** Periodo de los eventos según cuándo ocurrieron. */
export type EventPeriod = "24h" | "3d" | "7d";

/** Filtros de eventos: se aplican a la lista y a los marcadores del mapa. */
export interface EventFilters {
  severities: EventSeverity[];
  period: EventPeriod;
  /** null = todas las provincias. */
  province: string | null;
  /** null = todos los tipos. */
  hazardType: HazardType | null;
  /** Mostrar también los moderados sin afectaciones registradas (ver isUnverifiedEvent). */
  showUnverified: boolean;
}

/** Resultado de pedir los eventos al backend: si falla, la interfaz lo muestra. */
export interface EventsFeed {
  events: HazardEvent[];
  /** Fecha ISO 8601 de la consulta. */
  fetchedAt: string;
  error: string | null;
}

// ── Agregados ───────────────────────────────────────────────────────────
export interface FloodMapData {
  // Datos del backend.
  eventsFeed: EventsFeed;
  /** Null si el backend no pudo informar la lluvia pronosticada. */
  rain: RainForecastAvailability | null;
  /** Null si el backend no pudo informar la lluvia observada. */
  observedRain: ObservedRainAvailability | null;
  /** Null si el backend no pudo informar la temperatura del mar. */
  seaTemperature: SeaTemperatureAnomaly | null;
  /** Null si no se pudieron cargar las alertas de ríos. */
  riverAlerts: RiverAlertsSnapshot | null;
  /** Null si no se pudo cargar el pronóstico de Google Flood Hub. */
  floodHub: FloodHubSnapshot | null;
}

export type FloodLayerId = "riverNetwork" | "riverAlerts" | "floodHub";
export type LayerVisibility = Record<FloodLayerId, boolean>;

/** Lluvia de una capa activa en un punto del mapa (GET .../value). `mm` es null fuera del Ecuador o sin dato. */
export interface RainPointValue {
  from: string;
  to: string;
  mm: number | null;
}

// ── Estaciones del INAMHI (GET /weather-stations) ───────────────────────
export type WeatherStationCategory = "meteorological" | "hydrological" | "hydrometeorological";

/** Lluvia de la hora que termina en `time`; null si la estación no registró ese dato. */
export interface WeatherStationHour {
  time: string;
  mm: number | null;
}

export interface WeatherStation {
  id: number;
  code: string;
  name: string;
  lat: number;
  lng: number;
  altitude: number | null;
  category: WeatherStationCategory;
  /** Lluvia de cada hora reciente, de la más antigua a la más reciente. */
  hours: WeatherStationHour[];
  /** Suma de las horas con dato (mm); null si ninguna tiene dato. */
  totalMm: number | null;
  hoursWithData: number;
  lastTime: string | null;
}

export interface WeatherStationsSnapshot {
  updatedAt: string;
  attribution: string;
  /** Horas que cubre `hours` (la API del INAMHI solo guarda las últimas 12). */
  windowHours: number;
  stations: WeatherStation[];
}

/** Nivel de lluvia de una estación en la ventana reciente (ver STATION_RAIN_LEVELS). */
export type StationRainLevel = "none" | "light" | "moderate" | "heavy" | "veryHeavy" | "intense" | "extreme";

// ── Componentes de la gestión del riesgo (pestañas del panel de capas) ──
export type RiskComponentId = "amenaza" | "exposicion" | "preparacion" | "respuesta";

/** Entidad GeoJSON de una capa de gestión del riesgo (puntos, líneas o polígonos en WGS84). */
export interface RiskFeature {
  type: "Feature";
  /** Identificador en el servicio de origen (ArcGIS); con él se piden sus fotos. */
  id?: number | string;
  geometry: GeoJSON.Geometry | null;
  properties: Record<string, string | number | boolean | null>;
}

/** Capa de gestión del riesgo tal como la entrega el backend (GET /risk-layers/:id). */
export interface RiskLayerData {
  id: string;
  title: string;
  attribution: string;
  fetchedAt: string;
  /** Última edición en el servicio de origen (ArcGIS), si la informa. */
  sourceUpdatedAt: string | null;
  /** True si el servicio falló y el backend entrega su última descarga buena. */
  isStale: boolean;
  /** Entidades del origen sin ubicación válida (sin coordenadas o fuera del Ecuador), que no se dibujan. */
  omitted: number;
  /** Las entidades pueden tener fotos (GET /risk-layers/:id/features/:objectId/attachments). */
  hasAttachments: boolean;
  /** Filtro aplicado en el navegador (parte de la capa, periodo); al cambiar, la capa se vuelve a dibujar. */
  view?: string;
  type: "FeatureCollection";
  features: RiskFeature[];
}

/** Foto de una entidad, servida desde el servicio de origen. */
export interface RiskAttachment {
  id: number;
  name: string;
  url: string;
}

/** Capa encendida en el mapa, de cualquier pestaña (para la franja "En el mapa"). */
export interface ActiveLayer {
  key: string;
  label: string;
  component: RiskComponentId;
  turnOff: () => void;
}

/** Opacidad (0–1) de cada capa de imagen, ajustable desde el panel. */
export interface OverlayOpacity {
  forecast: number;
  observed: number;
  imerg: number;
  sea: number;
}

// ── Análisis por cantón (lluvia pronosticada de 12 y 24 h, vía backend) ─
export type Semaphore = "green" | "yellow" | "red";
/** Ventana que decidió el color (S = máx(S12h, S24h)). */
export type RainWindow = "12h" | "24h";
/** Categoría de lluvia del documento, de menor a mayor. */
export type RainCategory = "minima" | "ligera" | "moderada" | "fuerte" | "intensa" | "torrencial" | "extrema";

/** Un cantón con su semáforo y lo que hay en él (GET /canton-analysis). */
export interface CantonAnalysis {
  code: string;
  name: string;
  province: string;
  /** Región del INEC (Costa, Sierra, Amazonía, Región Insular). */
  region: string | null;
  center: LatLng;
  semaphore: Semaphore;
  category: RainCategory;
  categoryLabel: string;
  consequences: string;
  actions: string;
  /** Lluvia pronosticada por el WRF en el cantón (percentil 90): próximas 12 h y día 1 de la corrida (24 h). */
  forecast: { mm12h: number | null; mm24h: number | null; category12h: RainCategory | null; category24h: RainCategory | null };
  /** Ventana que decidió el color; null si no hay pronóstico. */
  decidedBy: RainWindow | null;
  triggers: {
    riverAlerts: number;
    riverMaxLevel: number;
    floodHubFlagged: number;
    sngrEvents: number;
    criticalPoints: number;
  };
  exposed: {
    population: number | null;
    schools: number;
    schoolsHighFlood: number;
    students: number;
    healthCenters: number;
    healthFloodSusceptible: number;
    rveKm: number;
    rveCautionKm: number;
    bridges: number;
    bridgesBad: number;
    floodTowns: number;
  };
  preventive: { actions: number; enosWorksActive: number; culverts: number };
  response: {
    shelters: number;
    sheltersActive: number;
    machinery: number;
    machineryOperational: number;
    camps: number;
    roadEventsOpen: number;
    recoveryWorks: number;
  };
}

export interface CantonAnalysisSnapshot {
  updatedAt: string;
  forecastRun: string | null;
  /** Ventanas del pronóstico usadas (null si la corrida no las tenía). */
  forecast12h: { from: string; to: string } | null;
  forecast24h: { from: string; to: string } | null;
  /** Por color; los cantones sin pronóstico van aparte, no como verdes. */
  counts: Record<Semaphore, number> & { noData: number };
  /** Del más al menos afectado. */
  cantons: CantonAnalysis[];
  sources: { name: string; ok: boolean; detail: string }[];
}
