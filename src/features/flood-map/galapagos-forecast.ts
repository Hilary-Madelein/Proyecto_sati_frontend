import type { RainForecast } from "./galapagos-report";

/*
 * El pronóstico de 24 horas de las estaciones de Galápagos, pedido desde el navegador.
 *
 * Open-Meteo responde 429 (límite de consultas) al servidor de Render, que comparte su IP con
 * muchos otros; desde el navegador de quien abre el visor sí responde. Si el backend ya trae el
 * pronóstico, se usa ese; si no, se arma aquí igual que allá: la mediana de ECMWF, GFS e ICON y lo
 * esperado con el registro de la estación.
 *
 * Copia de proyecto_sati_backend/src/integrations/open-meteo/open-meteo-forecast.client.ts y
 * src/modules/galapagos-rain/forecast-calibration.ts: si cambian allá, cambiarlas aquí.
 */

const URL_BASE = "https://api.open-meteo.com/v1/forecast";
const MODELS = ["ecmwf_ifs025", "gfs_seamless", "icon_seamless"] as const;
const HOUR_MS = 3_600_000;
const HOURS = 24;
/** El último dato sirve de punto de partida si tiene menos de esto; si no, la hora actual. */
const FRESH_MS = 3 * HOUR_MS;
const CACHE_MS = HOUR_MS;

type Category = "seco|no" | "seco|lloviendo" | "poco|no" | "poco|lloviendo" | "algo|no" | "algo|lloviendo";
interface Expected {
  n: number;
  p25: number;
  p50: number;
  p75: number;
}
const MODEL_WEIGHT = 0.8;
const MIN_CASES = 30;
const DRY_MM = 0.5;
const SOME_MM = 3;
const RAINING_MM_H = 1;
const MICONIA: Partial<Record<Category, Expected>> = {
  "algo|lloviendo": { n: 140, p25: 43, p50: 77, p75: 157 },
  "algo|no": { n: 176, p25: 35, p50: 74, p75: 122 },
  "poco|lloviendo": { n: 62, p25: 10, p50: 34, p75: 102 },
  "poco|no": { n: 178, p25: 8, p50: 11, p75: 36 },
  "seco|lloviendo": { n: 204, p25: 6, p50: 13, p75: 26 },
  "seco|no": { n: 1309, p25: 0, p50: 3, p75: 8 },
};
const PUERTO_AYORA: Partial<Record<Category, Expected>> = {
  "algo|lloviendo": { n: 39, p25: 8, p50: 15, p75: 48 },
  "algo|no": { n: 86, p25: 15, p50: 17, p75: 29 },
  "poco|lloviendo": { n: 7, p25: 2, p50: 6, p75: 14 },
  "poco|no": { n: 93, p25: 2, p50: 3, p75: 6 },
  "seco|lloviendo": { n: 3, p25: 2, p50: 3, p75: 3 },
  "seco|no": { n: 241, p25: 0, p50: 0, p75: 1 },
};
const SAN_CRISTOBAL: Partial<Record<Category, Expected>> = {
  "algo|lloviendo": { n: 44, p25: 14, p50: 51, p75: 97 },
  "algo|no": { n: 101, p25: 4, p50: 22, p75: 25 },
  "poco|lloviendo": { n: 23, p25: 1, p50: 8, p75: 13 },
  "poco|no": { n: 128, p25: 1, p50: 2, p75: 19 },
  "seco|no": { n: 234, p25: 1, p50: 1, p75: 1 },
};
const TABLES: Readonly<Record<string, Partial<Record<Category, Expected>>>> = {
  "AW-MICONIA": MICONIA,
  "AW-MANZANILLO": MICONIA,
  M0191: PUERTO_AYORA,
  "AW-EPMAPASC": PUERTO_AYORA,
  M0221: SAN_CRISTOBAL,
};

const round1 = (value: number) => Math.round(value * 10) / 10;
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const hourParam = (time: number) => new Date(time).toISOString().slice(0, 16);

async function modelForecast(lat: number, lng: number, after: number): Promise<RainForecast | null> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    hourly: "precipitation",
    models: MODELS.join(","),
    timezone: "GMT",
    start_hour: hourParam(after + HOUR_MS),
    end_hour: hourParam(after + HOURS * HOUR_MS),
  });
  const response = await fetch(`${URL_BASE}?${params}`);
  if (!response.ok) throw new Error(`Open-Meteo respondió HTTP ${response.status}`);
  const body = (await response.json()) as { hourly?: Record<string, Array<number | null> | string[]> };
  const times = (body.hourly?.time ?? []) as string[];
  const series = MODELS.map((model) => (body.hourly?.[`precipitation_${model}`] ?? []) as Array<number | null>);
  const valid = (mm: number | null | undefined): mm is number => typeof mm === "number" && Number.isFinite(mm);
  const hours = times.flatMap((time, index) => {
    const values = series.map((values) => values[index]).filter(valid);
    return values.length ? [{ time: new Date(`${time}:00Z`).toISOString(), mm: round1(median(values)), lowMm: round1(Math.min(...values)), highMm: round1(Math.max(...values)) }] : [];
  });
  const totals = series.filter((values) => values.filter(valid).length >= times.length * 0.9).map((values) => values.filter(valid).reduce((sum, mm) => sum + mm, 0));
  if (hours.length === 0 || totals.length === 0) return null;
  return { hours, totalMm: round1(median(totals)), lowMm: round1(Math.min(...totals)), highMm: round1(Math.max(...totals)), source: "Open-Meteo (ECMWF, GFS e ICON)" };
}

/** Lo esperado: `MODEL_WEIGHT` del pronóstico y el resto de lo que midió la estación en situaciones parecidas. */
function calibrate(code: string, forecast: RainForecast, last3hMm: number): RainForecast["expected"] {
  const model = forecast.totalMm < DRY_MM ? "seco" : forecast.totalMm < SOME_MM ? "poco" : "algo";
  const raining = last3hMm / 3 >= RAINING_MM_H;
  const expected = TABLES[code]?.[`${model}|${raining ? "lloviendo" : "no"}` as Category];
  if (!expected || expected.n < MIN_CASES || forecast.hours.length === 0) return null;
  const modelSum = forecast.hours.reduce((sum, hour) => sum + hour.mm, 0);
  const weights = forecast.hours.map((hour, index) => (modelSum >= DRY_MM ? hour.mm : raining ? Math.exp(-index / 6) : 1));
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const w = MODEL_WEIGHT;
  return {
    mm: round1(w * forecast.totalMm + (1 - w) * expected.p50),
    lowMm: round1(w * forecast.lowMm + (1 - w) * expected.p25),
    highMm: round1(w * forecast.highMm + (1 - w) * expected.p75),
    cases: expected.n,
    modelWeight: w,
    hours: forecast.hours.map((hour, index) => ({ time: hour.time, mm: round1(w * hour.mm + (1 - w) * ((expected.p50 * weights[index]) / weightSum)) })),
  };
}

export interface ForecastStation {
  code: string;
  lat?: number | null;
  lng?: number | null;
  lastTime?: string | null;
  mm3h: number;
  forecast?: RainForecast | null;
}

const cache = new Map<string, { at: number; value: Promise<RainForecast | null> }>();

/** El pronóstico de la estación: el del backend si lo trae; si no, pedido desde aquí (null si no se puede). */
export async function stationForecast(station: ForecastStation): Promise<RainForecast | null> {
  if (station.forecast) return station.forecast;
  if (typeof station.lat !== "number" || typeof station.lng !== "number") return null;
  const now = Date.now();
  const last = station.lastTime ? Date.parse(station.lastTime) : NaN;
  const fresh = Number.isFinite(last) && now - last <= FRESH_MS;
  const after = fresh ? last : Math.floor(now / HOUR_MS) * HOUR_MS;
  const key = `${station.code}:${after}`;
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_MS) return hit.value;
  const value = modelForecast(station.lat, station.lng, after)
    .then((forecast) => (forecast ? { ...forecast, expected: calibrate(station.code, forecast, fresh ? station.mm3h : 0) } : null))
    .catch(() => {
      cache.delete(key);
      return null;
    });
  cache.set(key, { at: now, value });
  return value;
}
