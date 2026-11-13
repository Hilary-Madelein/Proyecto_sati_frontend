"use client";

import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { Marker, Pane, useMap, useMapEvents } from "react-leaflet";

/** Cabeceras cantonales (public/data/ciudades-ecuador.json, de las parroquias del INEC). */
interface City {
  name: string;
  canton: string;
  province: string;
  lat: number;
  lng: number;
  /** Capital de provincia. */
  capital: boolean;
  /** Parroquias urbanas: 2 o más = ciudad grande. */
  urban: number;
}

const CITIES_URL = "/data/ciudades-ecuador.json";
let request: Promise<City[]> | null = null;
function loadCities(): Promise<City[]> {
  request ??= fetch(CITIES_URL)
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
    .then((data: { cities: City[] }) => data.cities)
    .catch((error) => {
      request = null;
      throw error;
    });
  return request;
}

/** Encima de la lluvia, el mar, los ríos y las capas de riesgo (395); debajo de los eventos y alertas (400) para no taparlos. */
const PANE = { name: "cityLabels", zIndex: 398 } as const;

/** Desde qué zoom se ve cada tipo de ciudad: así a escala país no se amontonan. */
const MIN_ZOOM = { capital: 0, large: 7.5, seat: 8.75 } as const;

type Side = "right" | "left";

const iconCache = new Map<string, L.DivIcon>();
function labelIcon(city: City, side: Side): L.DivIcon {
  const key = `${city.name}|${city.capital}|${side}`;
  let icon = iconCache.get(key);
  if (!icon) {
    const classes = ["city-label", city.capital && "is-capital", side === "left" && "is-left"].filter(Boolean).join(" ");
    icon = L.divIcon({
      className: "city-label-icon",
      html: `<span class="${classes}"><i></i>${city.name}</span>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

/** Primero las capitales, después las ciudades más grandes: si dos chocan, queda la más importante. */
const byImportance = (a: City, b: City) => Number(b.capital) - Number(a.capital) || b.urban - a.urban;

/** Ancho aproximado del nombre en píxeles (punto + texto), para ver si choca con otro. */
const labelWidth = (city: City) => 10 + city.name.length * (city.capital ? 7.4 : 6.4);
const LABEL_HEIGHT = 15;

type Box = [left: number, top: number, right: number, bottom: number];
const overlaps = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

/**
 * Qué nombres caben a este zoom y de qué lado de su punto: a la derecha, si no a la
 * izquierda; si no cabe de ningún lado, se omite (aparece al acercarse).
 */
function placeLabels(cities: City[], map: L.Map, zoom: number): { city: City; side: Side }[] {
  const taken: Box[] = [];
  const placed: { city: City; side: Side }[] = [];
  for (const city of cities) {
    if (zoom < (city.capital ? MIN_ZOOM.capital : city.urban >= 2 ? MIN_ZOOM.large : MIN_ZOOM.seat)) continue;
    const { x, y } = map.project([city.lat, city.lng], zoom);
    const width = labelWidth(city);
    const top = y - LABEL_HEIGHT / 2;
    const bottom = y + LABEL_HEIGHT / 2;
    const options: [Side, Box][] = [
      ["right", [x - 4, top, x - 4 + width, bottom]],
      ["left", [x + 4 - width, top, x + 4, bottom]],
    ];
    const free = options.find(([, box]) => !taken.some((other) => overlaps(box, other)));
    if (!free) continue;
    taken.push(free[1]);
    placed.push({ city, side: free[0] });
  }
  return placed;
}

/**
 * Nombres de las ciudades (cabeceras cantonales) bien legibles sobre las capas de
 * colores: los del mapa base son grises y finos, y sobre la lluvia se perdían. Va en
 * lugar de esos (FloodMap oculta los del mapa base mientras se ve esta). Las
 * capitales de provincia siempre; las ciudades grandes desde el zoom de provincia y
 * todas las cabeceras más cerca. Solo para ver: no capturan clics.
 */
export function CityLabels() {
  const map = useMap();
  const [cities, setCities] = useState<City[] | null>(null);
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  useEffect(() => {
    let active = true;
    loadCities()
      .then((list) => {
        if (active) setCities([...list].sort(byImportance));
      })
      // Sin la lista el mapa sigue funcionando (quedan los nombres del mapa base).
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const shown = useMemo(() => (cities ? placeLabels(cities, map, zoom) : []), [cities, map, zoom]);

  return (
    <Pane name={PANE.name} style={{ zIndex: PANE.zIndex, pointerEvents: "none" }}>
      {shown.map(({ city, side }) => (
        <Marker key={`${city.province}|${city.canton}`} position={[city.lat, city.lng]} icon={labelIcon(city, side)} interactive={false} keyboard={false} pane={PANE.name} />
      ))}
    </Pane>
  );
}
