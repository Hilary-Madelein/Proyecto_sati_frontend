/**
 * Llamadas al backend SATI.EC desde el navegador. Van a `/api/sati/...`, que
 * Next reenvía al backend (ver `rewrites` en next.config.ts).
 */
export async function satiClientGet<T>(
  path: string,
  query?: Record<string, string | number>,
  signal?: AbortSignal,
): Promise<T> {
  const params = new URLSearchParams(Object.entries(query ?? {}).map(([key, value]) => [key, String(value)]));
  const url = `/api/sati${path}${params.size ? `?${params}` : ""}`;

  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new Error("No se pudo conectar con el servidor de datos");
  }

  if (!response.ok) {
    // El backend responde { message } con un texto legible.
    const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
    throw new Error(typeof body?.message === "string" ? body.message : `Error ${response.status} del servidor de datos`);
  }
  return (await response.json()) as T;
}
