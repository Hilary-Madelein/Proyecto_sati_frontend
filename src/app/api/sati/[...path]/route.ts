import type { NextRequest } from "next/server";

/**
 * Puente del navegador al backend SATI.EC: `/api/sati/<ruta>` → `${SATI_API_URL}/<ruta>`.
 *
 * Se lee SATI_API_URL en cada petición (a diferencia de `rewrites`, que se fija al
 * arrancar Next), así que cambiar el puerto del backend no deja el frontend
 * apuntando a una dirección vieja. Si el backend no responde, devuelve un 502 con
 * un mensaje claro en vez de un error de conexión.
 */
const TIMEOUT_MS = 60_000;

/** Cabeceras de la respuesta del backend que se reenvían al navegador. */
const PASSTHROUGH_HEADERS = ["content-type", "cache-control", "content-encoding"];

/** Estados HTTP que no llevan cuerpo. */
const NO_BODY_STATUS = new Set([204, 304]);

export async function GET(request: NextRequest, { params }: RouteContext<"/api/sati/[...path]">) {
  const baseUrl = process.env.SATI_API_URL?.replace(/\/+$/, "");
  if (!baseUrl) {
    return Response.json({ message: "Falta la variable SATI_API_URL (URL del backend)" }, { status: 500 });
  }

  const { path } = await params;
  const target = `${baseUrl}/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers: { accept: request.headers.get("accept") ?? "*/*" },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    return Response.json({ message: connectionErrorMessage(error, baseUrl) }, { status: 502 });
  }

  const headers = new Headers();
  for (const name of PASSTHROUGH_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(NO_BODY_STATUS.has(upstream.status) ? null : upstream.body, { status: upstream.status, headers });
}

function connectionErrorMessage(error: unknown, baseUrl: string): string {
  const cause = (error as { cause?: { message?: string } }).cause?.message;
  if (cause === "bad port") {
    return `El puerto de ${baseUrl} está bloqueado por fetch ("bad port", p. ej. 6000). Usa otro puerto para el backend, como 4000.`;
  }
  return `No se pudo conectar con el servidor de datos (${baseUrl}). ¿Está el backend en ejecución?`;
}
