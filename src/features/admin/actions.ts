"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { PASSWORD_MIN_LENGTH } from "./constants";
import { AdminApiError, adminRequest } from "./lib/admin-api";
import { backendRequest } from "./lib/backend";
import { clearSessionToken, readSessionToken, requireAdmin, saveSessionToken } from "./lib/session";
import type { ActionState, LoginResponse, MinSeverity } from "./types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_SEVERITIES: readonly MinSeverity[] = ["high", "critical"];

/**
 * Mensaje de un error de la API para mostrar en el formulario. Cualquier otro
 * error (incluida la redirección al login, que Next implementa como excepción)
 * se vuelve a lanzar para que Next lo maneje.
 */
function errorMessage(error: unknown): string {
  if (error instanceof AdminApiError) return error.message;
  throw error;
}

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();
const email = (formData: FormData) => text(formData, "email").toLowerCase();
/** Las contraseñas no se recortan: los espacios cuentan. */
const password = (formData: FormData, name: string) => String(formData.get(name) ?? "");

function newPasswordError(value: string): string | null {
  return value.length < PASSWORD_MIN_LENGTH ? `Usa al menos ${PASSWORD_MIN_LENGTH} caracteres.` : null;
}

function invalid(errors: Record<string, string>, values?: Record<string, string | boolean>): ActionState {
  return { ok: false, message: "Revisa los campos marcados.", errors, values };
}

// ── Sesión ──────────────────────────────────────────────────────────────

export async function login(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const values = { email: email(formData) };
  const secret = password(formData, "password");
  if (!EMAIL_PATTERN.test(values.email) || !secret) {
    return { ok: false, message: "Escribe tu correo y tu contraseña.", values };
  }

  let result: LoginResponse;
  try {
    result = await backendRequest<LoginResponse>("/admin/auth/login", {
      method: "POST",
      body: { email: values.email, password: secret },
    });
  } catch (error) {
    return { ok: false, message: errorMessage(error), values };
  }
  await saveSessionToken(result.token, result.expiresAt);
  redirect(result.admin.mustChangePassword ? "/admin/cuenta" : "/admin");
}

export async function logout(): Promise<void> {
  const token = await readSessionToken();
  // Cierra la sesión también en el backend; si no responde, igual se borra la cookie.
  if (token) await backendRequest("/admin/auth/logout", { method: "POST", token }).catch(() => undefined);
  await clearSessionToken();
  redirect("/admin/login");
}

export async function changePassword(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin({ allowPendingPassword: true });
  const current = password(formData, "currentPassword");
  const next = password(formData, "newPassword");

  const errors: Record<string, string> = {};
  if (!current) errors.currentPassword = "Escribe tu contraseña actual.";
  const problem = newPasswordError(next);
  if (problem) errors.newPassword = problem;
  else if (next !== password(formData, "confirmPassword")) errors.confirmPassword = "No coincide con la nueva contraseña.";
  if (Object.keys(errors).length > 0) return invalid(errors);

  try {
    await adminRequest("/admin/auth/password", { method: "POST", body: { currentPassword: current, newPassword: next } });
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
  if (admin.mustChangePassword) redirect("/admin");
  return { ok: true, message: "Contraseña actualizada. Se cerraron tus sesiones en otros dispositivos." };
}

// ── Suscriptores ────────────────────────────────────────────────────────

/** Crea (sin `id`) o edita (con `id`) un suscriptor desde el formulario. */
export async function saveSubscriber(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const id = text(formData, "id") || null;
  const name = text(formData, "name");
  const address = email(formData);
  const minSeverity = text(formData, "minSeverity") as MinSeverity;
  const provinces = formData.getAll("provinces").map(String);
  const active = formData.get("active") === "on";
  const values = { name, email: address, minSeverity, active };

  const errors: Record<string, string> = {};
  if (name.length < 2 || name.length > 120) errors.name = "Escribe un nombre de 2 a 120 caracteres.";
  if (!EMAIL_PATTERN.test(address) || address.length > 254) errors.email = "Escribe un correo válido.";
  if (!MIN_SEVERITIES.includes(minSeverity)) errors.minSeverity = "Elige una severidad.";
  if (Object.keys(errors).length > 0) return invalid(errors, values);

  try {
    const body = { name, email: address, provinces, minSeverity, active };
    if (id) await adminRequest(`/notifications/subscribers/${id}`, { method: "PATCH", body });
    else await adminRequest("/notifications/subscribers", { method: "POST", body });
  } catch (error) {
    return { ok: false, message: errorMessage(error), values };
  }
  refresh();
  return { ok: true, message: id ? "Cambios guardados." : `${name} quedó registrado.` };
}

export async function setSubscriberActive(id: string, active: boolean): Promise<ActionState> {
  await requireAdmin();
  try {
    await adminRequest(`/notifications/subscribers/${id}`, { method: "PATCH", body: { active } });
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
  refresh();
  return { ok: true, message: active ? "Alertas activadas." : "Alertas pausadas." };
}

export async function deleteSubscriber(id: string): Promise<ActionState> {
  await requireAdmin();
  try {
    await adminRequest(`/notifications/subscribers/${id}`, { method: "DELETE" });
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
  refresh();
  return { ok: true, message: "Suscriptor eliminado." };
}

// ── Correo de prueba ────────────────────────────────────────────────────

export async function sendTestEmail(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const address = email(formData);
  if (!EMAIL_PATTERN.test(address)) {
    return { ok: false, message: "Escribe un correo válido.", errors: { email: "Correo no válido." }, values: { email: address } };
  }

  try {
    const result = await adminRequest<{ status: "sent" | "failed"; delivered: boolean; error: string | null }>(
      "/notifications/test",
      { method: "POST", body: { email: address } },
    );
    refresh();
    if (result.status === "failed") {
      return { ok: false, message: `No se pudo enviar: ${result.error ?? "error desconocido"}`, values: { email: address } };
    }
    return result.delivered
      ? { ok: true, message: `Correo de prueba enviado a ${address}. Revisa la bandeja (y el spam).` }
      : { ok: true, message: "El backend no tiene servidor de correo (SMTP): el correo se escribió en su log." };
  } catch (error) {
    return { ok: false, message: errorMessage(error), values: { email: address } };
  }
}

// ── Cuentas de administración ───────────────────────────────────────────

export async function createAdminUser(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const name = text(formData, "name");
  const address = email(formData);
  const temporary = password(formData, "password");
  const values = { name, email: address };

  const errors: Record<string, string> = {};
  if (name.length < 2 || name.length > 120) errors.name = "Escribe un nombre de 2 a 120 caracteres.";
  if (!EMAIL_PATTERN.test(address) || address.length > 254) errors.email = "Escribe un correo válido.";
  const problem = newPasswordError(temporary);
  if (problem) errors.password = problem;
  if (Object.keys(errors).length > 0) return invalid(errors, values);

  try {
    await adminRequest("/admin/users", { method: "POST", body: { name, email: address, password: temporary } });
  } catch (error) {
    return { ok: false, message: errorMessage(error), values };
  }
  refresh();
  return { ok: true, message: `Cuenta creada. Comparte la contraseña temporal con ${name}: deberá cambiarla al entrar.` };
}

export async function resetAdminPassword(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = text(formData, "id");
  const temporary = password(formData, "password");
  const problem = newPasswordError(temporary);
  if (problem) return invalid({ password: problem });

  try {
    await adminRequest(`/admin/users/${id}/password`, { method: "POST", body: { password: temporary } });
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
  refresh();
  return { ok: true, message: "Contraseña temporal asignada. Sus sesiones abiertas se cerraron." };
}

export async function setAdminUserActive(id: string, active: boolean): Promise<ActionState> {
  await requireAdmin();
  try {
    await adminRequest(`/admin/users/${id}`, { method: "PATCH", body: { active } });
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
  refresh();
  return { ok: true, message: active ? "Cuenta activada." : "Cuenta desactivada: ya no puede entrar." };
}

export async function deleteAdminUser(id: string): Promise<ActionState> {
  await requireAdmin();
  try {
    await adminRequest(`/admin/users/${id}`, { method: "DELETE" });
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
  refresh();
  return { ok: true, message: "Cuenta eliminada." };
}
