import type { FitBoundsOptions } from "leaflet";

/**
 * Márgenes del encuadre de todo Ecuador, según el tamaño de pantalla de este
 * momento (la ventana puede cambiar de tamaño y el celular, girar). En escritorio
 * el panel de capas tapa la derecha: se reserva ese espacio.
 */
export function getHomeBoundsOptions(): FitBoundsOptions {
  const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
  return isDesktop
    ? // Corrido a la izquierda (misma suma, mismo zoom): el panel tapa la Amazonía peruana y no la costa.
      { paddingTopLeft: [284, 16], paddingBottomRight: [190, 16] }
    : { padding: [16, 16] };
}
