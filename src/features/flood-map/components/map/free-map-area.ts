import type { Map as LeafletMap } from "leaflet";

/** Lo mínimo para que valga la pena tratar un hueco como zona libre (la hoja a pantalla completa no deja ninguno). */
const MIN_FREE_PX = 80;
/** Parte del ancho del mapa desde la que un panel no flota a un lado, sino abajo. */
const WIDE_PANEL_SHARE = 0.4;

/** Zona del mapa que no tapan los paneles, en píxeles desde su esquina superior izquierda. */
export interface FreeMapArea {
  left: number;
  right: number;
  bottom: number;
}

/**
 * Mide lo que tapan los paneles abiertos (ver `data-map-overlay` en ResponsivePanel).
 * Los anchos van abajo (la hoja del celular o la tableta, el panel del río): el mapa
 * libre queda sobre ellos. Los demás flotan a los lados: se toma el hueco más ancho que dejan.
 */
export function freeMapArea(map: LeafletMap): FreeMapArea {
  const box = map.getContainer().getBoundingClientRect();
  const overlays = [...document.querySelectorAll("[data-map-overlay]")]
    .filter((overlay) => overlay.getClientRects().length > 0)
    .map((overlay) => overlay.getBoundingClientRect());

  const isWide = (rect: DOMRect) => rect.width >= box.width * WIDE_PANEL_SHARE;
  const sheets = overlays.filter(isWide);
  const sheetTop = Math.min(box.height, ...sheets.map((rect) => rect.top - box.top));
  const bottom = sheetTop >= MIN_FREE_PX ? sheetTop : box.height;

  let free = { left: 0, right: 0 };
  let edge = 0;
  const sides = overlays.filter((rect) => !isWide(rect)).map((rect) => [rect.left - box.left, rect.right - box.left]);
  for (const [left, right] of [...sides.sort((a, b) => a[0] - b[0]), [box.width, box.width]]) {
    if (left - edge > free.right - free.left) free = { left: edge, right: left };
    edge = Math.max(edge, right);
  }
  return { ...free, bottom };
}

/** Si la zona alcanza para acomodar algo en ella. */
export const isUsable = ({ left, right, bottom }: FreeMapArea) => right - left >= MIN_FREE_PX && bottom >= MIN_FREE_PX;
