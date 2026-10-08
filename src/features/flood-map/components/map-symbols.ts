/**
 * Formas de los marcadores del mapa, compartidas por las capas y la leyenda
 * para que se vean idénticas. Cada fuente tiene su forma:
 * - círculo: evento ocurrido (SNGR);
 * - triángulo: alerta de caudal pronosticada (GEOGLOWS);
 * - cuadrado: estación de inundación fluvial (simulada).
 */

/** Triángulo de alerta (viewBox 0 0 24 24) como HTML, para íconos de Leaflet. */
export function triangleSymbolHtml(color: string, size: number, strokeWidth = 1.4): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 22.5 21h-21L12 2.5Z" fill="${color}" stroke="#1f2937" stroke-width="${strokeWidth}" stroke-linejoin="round"/><path d="M12 9v5.5" stroke="#1f2937" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.2" fill="#1f2937"/></svg>`;
}

/** Cuadrado de estación fluvial como HTML, para íconos de Leaflet. */
export function squareSymbolHtml(color: string, size: number): string {
  return `<span style="display:block;width:${size}px;height:${size}px;border-radius:3px;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px rgb(0 0 0 / 0.35)"></span>`;
}
