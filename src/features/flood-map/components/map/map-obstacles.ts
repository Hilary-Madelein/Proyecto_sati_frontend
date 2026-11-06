import type L from "leaflet";

/** Margen entre un globo o ficha y los bordes del mapa o lo que flota encima. */
const MARGIN = 10;

/**
 * Cuánto correr el mapa (en px, como `map.panBy`) para que `element` (un globo o la
 * ficha de una parroquia) quede dentro del mapa y sin quedar debajo de lo que siempre
 * está a la vista (`data-map-obstacle`): los controles del mapa, la barra de la provincia,
 * las leyendas y la barra de paneles de abajo (Capas · Eventos · Acciones).
 */
export function offsetToClear(map: L.Map, element: HTMLElement): [number, number] {
  const area = map.getContainer().getBoundingClientRect();
  const box = element.getBoundingClientRect();
  let top = area.top + MARGIN;
  let left = area.left + MARGIN;
  let bottom = area.bottom - MARGIN;
  const middle = (area.top + area.bottom) / 2;
  for (const obstacle of document.querySelectorAll<HTMLElement>("[data-map-obstacle]")) {
    const rect = obstacle.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const overlapsX = box.left < rect.right + MARGIN && box.right > rect.left - MARGIN;
    const overlapsY = box.top < rect.bottom + MARGIN && box.bottom > rect.top - MARGIN;
    if (!overlapsX || !overlapsY) continue;
    // La columna de controles (a la izquierda) se esquiva hacia la derecha; lo de arriba
    // (barra de la provincia, leyendas), hacia abajo; lo de abajo (barra de paneles), hacia arriba.
    if (obstacle.dataset.mapObstacle === "column") left = Math.max(left, rect.right + MARGIN);
    else if (rect.top + rect.height / 2 > middle) bottom = Math.min(bottom, rect.top - MARGIN);
    else top = Math.max(top, rect.bottom + MARGIN);
  }
  const right = area.right - MARGIN;
  // Si no cabe entero, manda que se vea su parte de arriba (el título y el botón de cerrar).
  const dy = box.top < top ? box.top - top : box.bottom > bottom ? Math.min(box.bottom - bottom, box.top - top) : 0;
  const dx = box.left < left ? box.left - left : box.right > right ? Math.min(box.right - right, box.left - left) : 0;
  return [dx, dy];
}
