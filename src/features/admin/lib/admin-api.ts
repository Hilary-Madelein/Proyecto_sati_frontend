import "server-only";
import { redirect } from "next/navigation";
import { AdminApiError, backendRequest } from "./backend";
import { readSessionToken } from "./session";

export { AdminApiError };

/**
 * Llama a la API de administración del backend con el token de la sesión.
 * Si el backend ya no acepta la sesión (vencida, cerrada desde otro lado o
 * cuenta desactivada), lleva al login.
 */
export async function adminRequest<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await readSessionToken();
  if (!token) redirect("/admin/login");
  try {
    return await backendRequest<T>(path, { ...init, token });
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 401) redirect("/admin/login");
    throw error;
  }
}
