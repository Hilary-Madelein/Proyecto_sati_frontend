import type L from "leaflet";
import type { RiskLayerStyle } from "./risk-layers";
import type { RiskFeature, RiskLayerData } from "./types";

/** Entidad tocada en el mapa, con la capa a la que pertenece (para el panel de detalle). */
export interface RiskHit {
  /** Único entre todos los resultados (capa + entidad). */
  key: string;
  style: RiskLayerStyle;
  data: RiskLayerData;
  feature: RiskFeature;
}

/** Margen del toque, en píxeles: el radio de los puntos (5) más un poco, y medio ancho de línea más un poco. */
const POINT_TOLERANCE_PX = 9;
const LINE_TOLERANCE_PX = 6;
const MAX_HITS = 30;
/** Primero lo que está dibujado encima: puntos, luego líneas y al final zonas. */
const DRAW_ORDER = { point: 0, line: 1, area: 2 } as const;

type Position = number[];
type Projected = { x: number; y: number };

/**
 * Entidades de las capas encendidas en el punto tocado: puntos y líneas a unos
 * pocos píxeles (para no tener que atinar exacto) y zonas que lo contienen.
 * Se calcula en el navegador con los datos ya descargados.
 */
export function identifyRiskFeatures(
  layers: ReadonlyArray<{ style: RiskLayerStyle; data: RiskLayerData }>,
  latlng: L.LatLng,
  map: L.Map,
): RiskHit[] {
  const click = map.latLngToLayerPoint(latlng);
  const project = ([lng, lat]: Position): Projected => map.latLngToLayerPoint([lat, lng]);
  const hits: RiskHit[] = [];
  for (const { style, data } of layers) {
    data.features.forEach((feature, index) => {
      if (feature.geometry && touches(feature.geometry, latlng, click, project)) {
        hits.push({ key: `${style.id}:${feature.id ?? index}`, style, data, feature });
      }
    });
  }
  return hits.sort((a, b) => DRAW_ORDER[a.style.geometry] - DRAW_ORDER[b.style.geometry]).slice(0, MAX_HITS);
}

function touches(geometry: GeoJSON.Geometry, latlng: L.LatLng, click: Projected, project: (position: Position) => Projected): boolean {
  switch (geometry.type) {
    case "Point":
      return distance(project(geometry.coordinates), click) <= POINT_TOLERANCE_PX;
    case "MultiPoint":
      return geometry.coordinates.some((position) => distance(project(position), click) <= POINT_TOLERANCE_PX);
    case "LineString":
      return nearLine(geometry.coordinates, click, project);
    case "MultiLineString":
      return geometry.coordinates.some((line) => nearLine(line, click, project));
    case "Polygon":
      return inPolygon(geometry.coordinates, latlng);
    case "MultiPolygon":
      return geometry.coordinates.some((polygon) => inPolygon(polygon, latlng));
    case "GeometryCollection":
      return geometry.geometries.some((part) => touches(part, latlng, click, project));
  }
}

function nearLine(line: Position[], click: Projected, project: (position: Position) => Projected): boolean {
  let previous: Projected | null = null;
  for (const position of line) {
    const current = project(position);
    if (previous && distanceToSegment(click, previous, current) <= LINE_TOLERANCE_PX) return true;
    previous = current;
  }
  return false;
}

/** Dentro del anillo exterior y fuera de los huecos. */
function inPolygon(rings: Position[][], latlng: L.LatLng): boolean {
  const [outer, ...holes] = rings;
  return !!outer && inRing(outer, latlng) && !holes.some((hole) => inRing(hole, latlng));
}

function inRing(ring: Position[], { lat, lng }: L.LatLng): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const distance = (a: Projected, b: Projected) => Math.hypot(a.x - b.x, a.y - b.y);

function distanceToSegment(point: Projected, a: Projected, b: Projected): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length));
  return distance(point, { x: a.x + t * dx, y: a.y + t * dy });
}
