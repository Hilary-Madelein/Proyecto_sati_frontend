import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { AdminUser } from "../types";
import { AdminApiError, backendRequest } from "./backend";

/**
 * Sesión del panel de administración. Cada persona entra con su correo y su
 * contraseña; el backend devuelve un token de sesión al azar que se guarda en
 * una cookie httpOnly (el navegador no puede leerla) y que el servidor de Next
 * reenvía al backend en cada llamada. El backend guarda solo el hash del
 * token, así que puede cerrar la sesión en cualquier momento.
 */
const COOKIE = "sati_admin";
const COOKIE_PATH = "/admin";

export async function readSessionToken(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

/** Solo desde Server Actions (las páginas no pueden escribir cookies). */
export async function saveSessionToken(token: string, expiresAt: string): Promise<void> {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: COOKIE_PATH,
    expires: new Date(expiresAt),
  });
}

export async function clearSessionToken(): Promise<void> {
  (await cookies()).delete({ name: COOKIE, path: COOKIE_PATH });
}

/**
 * Cuenta de la sesión actual, o null si no hay sesión o el backend la rechaza
 * (vencida, cerrada o cuenta desactivada). Se pide una vez por petición.
 */
export const getCurrentAdmin = cache(async (): Promise<AdminUser | null> => {
  const token = await readSessionToken();
  if (!token) return null;
  try {
    return await backendRequest<AdminUser>("/admin/auth/me", { token });
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 401) return null;
    throw error;
  }
});

/**
 * Exige una sesión vigente; si no la hay, lleva al login. Con una contraseña
 * temporal, lleva a «Mi cuenta» para cambiarla (salvo `allowPendingPassword`).
 * Se llama en cada página y en cada Server Action del panel, no en el layout:
 * los layouts no se vuelven a ejecutar al navegar entre páginas.
 */
export async function requireAdmin(options: { allowPendingPassword?: boolean } = {}): Promise<AdminUser> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  if (admin.mustChangePassword && !options.allowPendingPassword) redirect("/admin/cuenta");
  return admin;
}
