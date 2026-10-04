export type LatLng = [lat: number, lng: number];
export type LatLngBounds = [southWest: LatLng, northEast: LatLng];

// ── Pronóstico de lluvia (modelo WRF del INAMHI) ────────────────────────
/** Día de pronóstico desde el inicio de la corrida (cada uno es lluvia de 24 h). */
export type ForecastDay = 1 | 2 | 3;

// ── Lluvia observada por satélite ───────────────────────────────────────
export type ObservedRainProduct = "imerg" | "persiann";
export type ObservedRainWindow = "24h" | "48h" | "72h";

/** Disponibilidad de la capa de lluvia diaria, según el backend. */
export interface RainAvailability {
  /** Inicio de la corrida del modelo (ISO 8601). */
  run: string | null;
  /** Pasos de tiempo de esa corrida (ISO 8601), de más antiguo a más reciente. */
  runTimes: string[];
  latestTime: string | null;
  /** El último paso disponible ya pasó hace más de unas horas. */
  isStale: boolean;
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
  flashFloodZones: FlashFloodZone[];
  historicalZones: HistoricalFloodZone[];

  // Datos reales del backend.
  eventsFeed: EventsFeed;
  /** Null si el backend no pudo informar la disponibilidad de la lluvia. */
  rain: RainAvailability | null;
  /** Null si no se pudieron cargar las alertas de ríos. */
  riverAlerts: RiverAlertsSnapshot | null;
}

export type FloodLayerId = "riverNetwork" | "riverAlerts" | "flash" | "historical";
export type LayerVisibility = Record<FloodLayerId, boolean>;
