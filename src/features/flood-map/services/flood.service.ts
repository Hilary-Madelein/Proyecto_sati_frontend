import "server-only";
import { satiGet, SatiApiError } from "@/lib/api/sati-api";
import { EVENTS_WINDOW_DAYS } from "../constants";
import type {
  EventsFeed,
  FloodHubSnapshot,
  FloodMapData,
  HazardEvent,
  ObservedRainAvailability,
  RainForecastAvailability,
  RiverAlertsSnapshot,
  SeaTemperatureAnomaly,
} from "../types";

/*
 * Punto único de acceso a los datos del mapa (se ejecuta en el servidor):
 * eventos, lluvia, caudales y Google Flood Hub, todo del backend SATI.EC.
 */

/** Forma de un evento en la API del backend (GET /events). */
interface ApiEvent extends Omit<HazardEvent, "position"> {
  location: { lat: number; lng: number };
}

interface ApiEventsPage {
  data: ApiEvent[];
  meta: { total: number };
}

export async function getFloodMapData(): Promise<FloodMapData> {
  const [eventsFeed, rain, observedRain, seaTemperature, riverAlerts, floodHub] = await Promise.all([
    getEventsFeed(),
    getRainAvailability(),
    getObservedRainAvailability(),
    getSeaTemperature(),
    getRiverAlerts(),
    getFloodHub(),
  ]);
  return { eventsFeed, rain, observedRain, seaTemperature, riverAlerts, floodHub };
}

/** Eventos abiertos de los últimos días. Si el backend falla, devuelve el error en vez de lanzar. */
async function getEventsFeed(): Promise<EventsFeed> {
  const fetchedAt = new Date().toISOString();
  const from = new Date(Date.now() - EVENTS_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  try {
    const page = await satiGet<ApiEventsPage>("/events", { status: "open", from, limit: 1000 });
    return { events: page.data.map(toHazardEvent), fetchedAt, error: null };
  } catch (error) {
    return { events: [], fetchedAt, error: errorMessage(error) };
  }
}

/** Corrida vigente del WRF y qué acumulados (24/48/72 h) están disponibles. */
async function getRainAvailability(): Promise<RainForecastAvailability | null> {
  try {
    return await satiGet<RainForecastAvailability>("/rain-forecast", undefined, 30_000);
  } catch {
    return null;
  }
}

/** Lluvia observada por satélite: última hora con datos de cada producto y ventanas disponibles. */
async function getObservedRainAvailability(): Promise<ObservedRainAvailability | null> {
  try {
    return await satiGet<ObservedRainAvailability>("/observed-rain", undefined, 30_000);
  } catch {
    return null;
  }
}

/** Anomalía de la temperatura del mar (NOAA OISST): día del dato, Niño 1+2, leyenda e imagen. */
async function getSeaTemperature(): Promise<SeaTemperatureAnomaly | null> {
  try {
    return await satiGet<SeaTemperatureAnomaly>("/sea-temperature", undefined, 30_000);
  } catch {
    return null;
  }
}

/** Alertas por caudal del pronóstico vigente. El backend las precarga, así que suele ser inmediato. */
async function getRiverAlerts(): Promise<RiverAlertsSnapshot | null> {
  try {
    return await satiGet<RiverAlertsSnapshot>("/rivers/alerts", undefined, 20_000);
  } catch {
    return null;
  }
}

/** Último pronóstico de Google Flood Hub en los puntos del Ecuador. */
async function getFloodHub(): Promise<FloodHubSnapshot | null> {
  try {
    return await satiGet<FloodHubSnapshot>("/flood-hub", undefined, 20_000);
  } catch {
    return null;
  }
}

function toHazardEvent({ location, ...event }: ApiEvent): HazardEvent {
  return { ...event, position: [location.lat, location.lng] };
}

function errorMessage(error: unknown): string {
  return error instanceof SatiApiError ? error.message : "Error inesperado al cargar los eventos";
}
