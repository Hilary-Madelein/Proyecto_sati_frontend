import "server-only";

/**
 * Cliente del backend SATI.EC para componentes de servidor. En el navegador se
 * usa la ruta relativa `/api/sati/...`, que Next reenvía al backend (ver
 * src/app/api/sati/[...path]/route.ts), así el cliente nunca necesita la URL interna.
 */
const DEFAULT_TIMEOUT_MS = 8_000;

export class SatiApiError extends Error {}

/** URL del backend (SATI_API_URL), sin "/" final. */
export function satiApiBaseUrl(): string {
  const url = process.env.SATI_API_URL;
  if (!url) throw new SatiApiError("Falta la variable SATI_API_URL (URL del backend)");
  return url.replace(/\/+$/, "");
}

/** GET al backend con tiempo límite. Lanza `SatiApiError` con un mensaje legible. */
export async function satiGet<T>(
  path: string,
  query?: Record<string, string | number>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const url = new URL(`${satiApiBaseUrl()}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, String(value));

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  } catch {
    throw new SatiApiError("No se pudo conectar con el servidor de datos");
  }
  if (!response.ok) throw new SatiApiError(`El servidor de datos respondió HTTP ${response.status}`);
  return (await response.json()) as T;
}
