import L, { type Map as LeafletMap } from "leaflet";
import { MAP_CONFIG } from "../../constants";
import { loadProvinces, type ProvinceFeature } from "../../hooks/useProvinceGeometries";
import { normalizeName } from "../../parish-filters";
import { freeMapArea, isUsable } from "./free-map-area";
import { getHomeBoundsOptions } from "./home-bounds";

/** Evento del mapa al acercarse a un punto: `province` es null si no se reconoce su provincia. */
export const PROVINCE_FOCUS_EVENT = "provincefocus";
export interface ProvinceFocusEvent extends L.LeafletEvent {
  province: ProvinceFeature | null;
}

/** Margen entre lo que se acerca y el borde de la zona libre, en píxeles. */
const FREE_AREA_MARGIN_PX = 48;
/** Sin paneles que esquivar, o si no dejan hueco. */
const PLAIN_MARGIN_PX = 16;
/** Una provincia no sirve de encuadre si, por el poco hueco que dejan los paneles, se acerca menos que esto sobre todo Ecuador. */
const MIN_ZOOM_GAIN = 1;
/** Las más alejadas de la vista general que esto ya son un acercamiento hecho a mano: no se deshace. */
const KEEP_DEEPER_THAN = 0.5;
const NOT_A_PROVINCE = normalizeName("Zona no delimitada");

/** Los márgenes que dejan algo en la zona del mapa que no tapan los paneles. */
export function freePadding(map: LeafletMap) {
  const free = freeMapArea(map);
  const size = map.getSize();
  return {
    free,
    paddingTopLeft: L.point(free.left + FREE_AREA_MARGIN_PX, FREE_AREA_MARGIN_PX),
    paddingBottomRight: L.point(size.x - free.right + FREE_AREA_MARGIN_PX, size.y - free.bottom + FREE_AREA_MARGIN_PX),
  };
}

/** Vuela hasta dejar el punto en el centro de la zona libre, no en el del mapa. */
function flyIntoFreeArea(map: LeafletMap, point: L.LatLng, zoom: number) {
  const { free } = freePadding(map);
  const size = map.getSize();
  const offset = L.point((free.left + free.right - size.x) / 2, (free.bottom - size.y) / 2);
  map.flyTo(map.unproject(map.project(point, zoom).subtract(offset), zoom), zoom);
}

/** Vuelve a todo Ecuador y cierra los popups abiertos. */
export function goHome(map: LeafletMap) {
  map.closePopup();
  map.flyToBounds(MAP_CONFIG.initialBounds, { ...getHomeBoundsOptions(), duration: 1 });
}

/** Zoom que muestra todo Ecuador en esta pantalla. */
export function homeZoom(map: LeafletMap): number {
  const options = getHomeBoundsOptions();
  const padding = L.point(options.paddingTopLeft ?? options.padding ?? [0, 0]).add(L.point(options.paddingBottomRight ?? options.padding ?? [0, 0]));
  return map.getBoundsZoom(MAP_CONFIG.initialBounds, false, padding);
}

function isInRing(ring: number[][], lng: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function isInProvince({ geometry }: ProvinceFeature, { lat, lng }: L.LatLng): boolean {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(([outer, ...holes]) => isInRing(outer, lng, lat) && !holes.some((hole) => isInRing(hole, lng, lat)));
}

/**
 * Primero la provincia que trae el dato: los contornos están simplificados y cerca
 * de un límite el punto puede caer en la vecina. Sin ese dato, la que lo contiene.
 */
async function findProvince(point: L.LatLng, declared: string | null | undefined): Promise<ProvinceFeature | null> {
  const provinces = (await loadProvinces()).filter(({ key }) => key !== NOT_A_PROVINCE);
  const name = declared ? normalizeName(declared) : null;
  return provinces.find(({ key }) => key === name) ?? provinces.find((province) => isInProvince(province, point)) ?? null;
}

/** Zoom con el que terminó el último encuadre, para distinguirlo de un acercamiento hecho a mano. */
const lastFocusZoom = new WeakMap<LeafletMap, number>();

/**
 * Acerca el mapa a la provincia del punto y lo avisa (ver ProvinceFocusBar), dejando
 * la provincia en la zona libre. Si los paneles dejan muy poco hueco para que se note
 * el acercamiento, se acerca lo mínimo con el punto en ese hueco: así se ve casi toda
 * la provincia. Si la persona ya se había acercado más, conserva ese zoom y solo lleva
 * el punto a la vista.
 */
export async function focusProvinceOf(map: LeafletMap, point: L.LatLng, declaredProvince?: string | null): Promise<void> {
  const province = await findProvince(point, declaredProvince).catch(() => null);
  const current = map.getZoom();
  if (!province) {
    flyIntoFreeArea(map, point, Math.max(current, MAP_CONFIG.focusZoom));
  } else {
    const bounds = L.geoJSON(province.geometry).getBounds();
    const { free, paddingTopLeft, paddingBottomRight } = freePadding(map);
    const usable = isUsable(free);
    const topLeft = usable ? paddingTopLeft : L.point(PLAIN_MARGIN_PX, PLAIN_MARGIN_PX);
    const bottomRight = usable ? paddingBottomRight : L.point(PLAIN_MARGIN_PX, PLAIN_MARGIN_PX);
    const inFreeArea = map.getBoundsZoom(bounds, false, topLeft.add(bottomRight));
    const minimum = homeZoom(map) + MIN_ZOOM_GAIN;
    const fits = inFreeArea >= minimum;
    const zoom = fits ? inFreeArea : minimum;
    if (current > zoom + KEEP_DEEPER_THAN && current !== lastFocusZoom.get(map)) {
      flyIntoFreeArea(map, point, current);
    } else {
      lastFocusZoom.set(map, zoom);
      if (fits) map.flyToBounds(bounds, { paddingTopLeft: topLeft, paddingBottomRight: bottomRight });
      else flyIntoFreeArea(map, point, zoom);
    }
  }
  map.fire(PROVINCE_FOCUS_EVENT, { province });
}
