import type { Map as LeafletMap } from "leaflet";

/** Lo mínimo para que valga la pena tratar un hueco como zona libre (la hoja a pantalla completa no deja ninguno). */
const MIN_FREE_PX = 80;

/** Zona del mapa que no tapan los paneles, en píxeles desde su esquina superior izquierda. */
export interface FreeMapArea {
  left: number;
  right: number;
  bottom: number;
}

/**
 * Mide lo que tapan los paneles abiertos (ver `data-map-overlay` en ResponsivePanel).
 * Los anchos, abajo, son la hoja del celular o la tableta: el mapa libre queda sobre
 * ella. Los demás flotan a los lados: se toma el hueco más ancho que dejan.
 */
export function freeMapArea(map: LeafletMap): FreeMapArea {
  const box = map.getContainer().getBoundingClientRect();
  const overlays = [...document.querySelectorAll("[data-map-overlay]")]
    .filter((overlay) => overlay.getClientRects().length > 0)
    .map((overlay) => overlay.getBoundingClientRect());

  const sheets = overlays.filter((rect) => rect.width >= box.width / 2);
  const sheetTop = Math.min(box.height, ...sheets.map((rect) => rect.top - box.top));
  const bottom = sheetTop >= MIN_FREE_PX ? sheetTop : box.height;

  let free = { left: 0, right: 0 };
  let edge = 0;
  const sides = overlays.filter((rect) => rect.width < box.width / 2).map((rect) => [rect.left - box.left, rect.right - box.left]);
  for (const [left, right] of [...sides.sort((a, b) => a[0] - b[0]), [box.width, box.width]]) {
    if (left - edge > free.right - free.left) free = { left: edge, right: left };
    edge = Math.max(edge, right);
  }
  return { ...free, bottom };
}

/** Si la zona alcanza para acomodar algo en ella. */
export const isUsable = ({ left, right, bottom }: FreeMapArea) => right - left >= MIN_FREE_PX && bottom >= MIN_FREE_PX;

/** Si un punto del mapa cae en la zona libre, con este margen hasta sus bordes. */
export const isInFreeArea = ({ x, y }: { x: number; y: number }, { left, right, bottom }: FreeMapArea, margin: number) =>
  x >= left + margin && x <= right - margin && y >= margin && y <= bottom - margin;
