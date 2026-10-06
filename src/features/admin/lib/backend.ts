import "server-only";
import { satiApiBaseUrl } from "@/lib/api/sati-api";

const TIMEOUT_MS = 20_000;

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Llamada al backend desde el servidor de Next, con el token de sesión del
 * administrador si lo hay. Lanza `AdminApiError` con el mensaje del backend.
 */
export async function backendRequest<T>(
  path: string,
  init: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${satiApiBaseUrl()}${path}`, {
      method: init.method ?? "GET",
      headers: {
        ...(init.token && { authorization: `Bearer ${init.token}` }),
        ...(init.body !== undefined && { "content-type": "application/json" }),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new AdminApiError("No se pudo conectar con el servidor de datos. ¿Está el backend en ejecución?", 502);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
    const message = Array.isArray(body?.message) ? body.message.join(" · ") : typeof body?.message === "string" ? body.message : null;
    throw new AdminApiError(message ?? `El servidor de datos respondió HTTP ${response.status}`, response.status);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}
