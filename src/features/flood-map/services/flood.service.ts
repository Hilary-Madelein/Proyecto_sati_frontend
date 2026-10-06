import "server-only";
import { satiGet, SatiApiError } from "@/lib/api/sati-api";
import { EVENTS_WINDOW_DAYS } from "../constants";
import type {
  EventsFeed,
  FloodMapData,
  HazardEvent,
  RainForecastAvailability,
  RiverAlertsSnapshot,
} from "../types";
import { MOCK_FLOOD_LAYERS } from "./mock-data";

/*
 * Punto único de acceso a los datos del mapa (se ejecuta en el servidor).
 * - Eventos, lluvia y caudales: backend SATI.EC.
 * - Inundaciones repentinas e históricas: aún simuladas (sin fuente).
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
  const [eventsFeed, rain, riverAlerts] = await Promise.all([getEventsFeed(), getRainAvailability(), getRiverAlerts()]);
  return { ...MOCK_FLOOD_LAYERS, eventsFeed, rain, riverAlerts };
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

/** Alertas por caudal del pronóstico vigente. El backend las precarga, así que suele ser inmediato. */
async function getRiverAlerts(): Promise<RiverAlertsSnapshot | null> {
  try {
    return await satiGet<RiverAlertsSnapshot>("/rivers/alerts", undefined, 20_000);
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
