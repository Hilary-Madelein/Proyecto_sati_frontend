export type LatLng = [lat: number, lng: number];
export type LatLngBounds = [southWest: LatLng, northEast: LatLng];

// ── Lluvia pronosticada acumulada (modelo WRF del INAMHI) ───────────────
/** Horas acumuladas desde el inicio de la corrida: 24 h = día 1, 48 h = días 1-2, 72 h = días 1-3. */
export type RainForecastHours = 24 | 48 | 72;

export interface RainForecastAvailability {
  /** Inicio de la corrida del modelo (ISO 8601). */
  run: string | null;
  isStale: boolean;
  attribution: string;
  periods: Array<{ hours: RainForecastHours; available: boolean; from: string | null; to: string | null }>;
}

/** Acumulado calculado por el backend, listo para superponer en el mapa. */
export interface AccumulatedRain {
  run: string;
  hours: RainForecastHours;
  from: string;
  to: string;
  /** [[sur, oeste], [norte, este]] */
  bounds: [[number, number], [number, number]];
  maxMm: number;
  /** Ruta de la imagen PNG relativa a la API del backend. */
  imagePath: string;
}

// ── Lluvia observada por satélite ───────────────────────────────────────
export type ObservedRainProduct = "imerg" | "persiann";
export type ObservedRainWindow = "24h" | "48h" | "72h";

// ── Inundaciones fluviales (simuladas hasta conectar su fuente) ─────────
export type FluvialLevel = "extremo" | "peligro" | "advertencia" | "normal" | "sin-datos";

export interface FluvialStation {
  id: string;
  name: string;
  river: string;
  province: string;
  position: LatLng;
  level: FluvialLevel;
  /** Caudal en m³/s; null cuando la estación no reporta. */
  flowM3s: number | null;
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
}

export interface RiverAlertsSnapshot {
  source: string;
  /** Fecha de inicio del pronóstico (AAAA-MM-DD). */
  forecastDate: string;
  /** Fecha de cada día del pronóstico (AAAA-MM-DD). */
  days: string[];
  totalReaches: number;
  alerts: RiverAlert[];
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
}

/** Tramo de río elegido en el mapa (por clic en el río o en una alerta). */
export interface SelectedRiver {
  riverId: number;
  /** Alerta del tramo, si tiene. */
  alert: RiverAlert | null;
}

// ── Inundaciones repentinas (24h) ───────────────────────────────────────
export type FlashFloodProbability = "muy-probable" | "probable";

export interface FlashFloodZone {
  id: string;
  name: string;
  province: string;
  bounds: LatLngBounds;
  probability: FlashFloodProbability;
}

// ── Inundaciones históricas ─────────────────────────────────────────────
/** Porcentaje del tiempo en que la zona ha estado inundada: 5 %, 1 % o 0,5 %. */
export type HistoricalFrequency = "p5" | "p1" | "p05";

export interface HistoricalFloodZone {
  id: string;
  name: string;
  frequency: HistoricalFrequency;
  polygon: LatLng[];
}

// ── Eventos (SNGR, vía backend) ─────────────────────────────────────────
export type EventSeverity = "critical" | "high" | "moderate";
export type EventStatus = "open" | "closed";

export type HazardType =
  | "flood"
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
  position: LatLng;
  /** Fecha ISO 8601 en que ocurrió el evento. */
  occurredAt: string;
  impact: EventImpact;
}

/** Periodo de los eventos según cuándo ocurrieron. */
export type EventPeriod = "24h" | "48h" | "7d";

/** Filtros de eventos: se aplican a la lista y a los marcadores del mapa. */
export interface EventFilters {
  severities: EventSeverity[];
  period: EventPeriod;
  /** null = todas las provincias. */
  province: string | null;
  /** null = todos los tipos. */
  hazardType: HazardType | null;
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
  // Capas aún sin fuente real: datos simulados.
  fluvialStations: FluvialStation[];
  flashFloodZones: FlashFloodZone[];
  historicalZones: HistoricalFloodZone[];

  // Datos reales del backend.
  eventsFeed: EventsFeed;
  /** Null si el backend no pudo informar la lluvia pronosticada. */
  rain: RainForecastAvailability | null;
  /** Null si no se pudieron cargar las alertas de ríos. */
  riverAlerts: RiverAlertsSnapshot | null;
}

export type FloodLayerId = "riverNetwork" | "riverAlerts" | "fluvial" | "flash" | "historical";
export type LayerVisibility = Record<FloodLayerId, boolean>;
