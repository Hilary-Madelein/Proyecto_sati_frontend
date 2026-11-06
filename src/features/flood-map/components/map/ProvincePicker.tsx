"use client";

import L from "leaflet";
import { PROVINCE_OUTLINE_COLORS } from "../../constants";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { GeoJSON, Pane, useMap, useMapEvents } from "react-leaflet";
import { placeName } from "../../action-timeline";
import type { ProvinceFeature } from "../../hooks/useProvinceGeometries";
import { isInProvince } from "../../province-geometry";
import { focusProvinceOf, goHome } from "./province-focus";

const PANE = "provinceHover";
/** Lo que tarda en desplegarse el resumen (ver SummarySidebar), con margen. */
const SIDEBAR_SETTLE_MS = 260;
/** Encima de la lluvia, el mar y los ríos (imágenes que no se pueden recortar), debajo de límites, nombres y puntos. */
const MASK_PANE = "provinceMask";
const MASK = { stroke: false, fill: true, fillColor: "#f8fafc", fillOpacity: 0.82 } as const;

/** Un rectángulo grande con la provincia como hueco: tapa todo lo demás. */
function maskOf(province: ProvinceFeature): GeoJSON.Polygon {
  const polygons = province.geometry.type === "Polygon" ? [province.geometry.coordinates] : province.geometry.coordinates;
  return {
    type: "Polygon",
    coordinates: [
      [
        [-120, -40],
        [-40, -40],
        [-40, 30],
        [-120, 30],
        [-120, -40],
      ],
      ...polygons.map(([outer]) => outer),
    ],
  };
}
const hoverStyle = (contrast: boolean) => {
  const color = contrast ? PROVINCE_OUTLINE_COLORS.contrast : PROVINCE_OUTLINE_COLORS.normal;
  return { color, weight: contrast ? 2.5 : 1.5, opacity: contrast ? 1 : 0.8, dashArray: "4 4", fill: true, fillColor: color, fillOpacity: contrast ? 0.1 : 0.06 };
};
/** Borde blanco debajo del contorno fucsia, para que se lea sobre cualquier color. */
const CASING = { color: "#ffffff", weight: 5, opacity: 0.85, fill: false } as const;

interface ProvincePickerProps {
  provinces: readonly ProvinceFeature[] | null;
  selected: ProvinceFeature | null;
  onSelect: (province: ProvinceFeature) => void;
  /** false = no se elige provincia con el mouse. */
  enabled: boolean;
  /** Segunda línea del aviso del cursor (p. ej. qué pasa después con la lluvia encendida). */
  hint: string;
  /** Hay capas azules encendidas (lluvia, mar, ríos, caudales): contorno de otro tono. */
  contrast: boolean;
}

/** Sus límites, para descartar rápido las que no están cerca del cursor. */
const boundsCache = new WeakMap<ProvinceFeature, L.LatLngBounds>();
const boundsOf = (province: ProvinceFeature) => {
  let bounds = boundsCache.get(province);
  if (!bounds) boundsCache.set(province, (bounds = L.geoJSON(province.geometry).getBounds()));
  return bounds;
};

/**
 * Elegir una provincia en el mapa: al pasar el cursor se resalta y dice su nombre,
 * y al tocar una zona sin puntos se elige (filtra las capas y abre su resumen). Al
 * elegirla, por el mapa o por el selector del resumen, el mapa va a ella y lo de
 * afuera se atenúa.
 */
export function ProvincePicker({ provinces, selected, onSelect, enabled, hint, contrast }: ProvincePickerProps) {
  const map = useMap();
  const [hovered, setHovered] = useState<ProvinceFeature | null>(null);
  // A cualquier zoom mientras no haya una elegida; con una elegida, el contorno y el aviso
  // del cursor tapaban lo que se está mirando (se cambia con "Ver todo Ecuador" o el resumen).
  const active = enabled && !selected;
  const tooltip = useRef<L.Tooltip | null>(null);
  const frame = useRef(0);

  const at = (latlng: L.LatLng) =>
    provinces?.find((province) => boundsOf(province).contains(latlng) && isInProvince(province, latlng)) ?? null;

  // Con el evento del navegador (no el de Leaflet): Leaflet no avisa al mapa mientras el
  // cursor está sobre un marcador, y el aviso de la provincia quedaba pegado encima.
  const onMove = useEffectEvent((event: MouseEvent) => {
    if (!active) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      // Sobre un punto, marcador o línea de una capa (también en lienzo: Leaflet le pone la
      // clase al pasar sobre una entidad) manda su propio aviso: el de la provincia se quita.
      const target = event.target as Element | null;
      const latlng = map.mouseEventToLatLng(event);
      const province = target?.closest?.(".leaflet-interactive, .leaflet-marker-icon, .leaflet-control, [data-map-overlay]") ? null : at(latlng);
      setHovered(province);
      if (!province) {
        tooltip.current?.close();
        return;
      }
      // Debajo del cursor: arriba van los avisos de los puntos, y así no se tapan.
      tooltip.current ??= L.tooltip({ direction: "bottom", offset: [0, 18], className: "risk-tooltip" });
      tooltip.current.setLatLng(latlng).setContent(`${placeName(province.name)}\n${hint}`);
      if (!map.hasLayer(tooltip.current)) tooltip.current.addTo(map);
    });
  });
  const onLeave = useEffectEvent(() => {
    cancelAnimationFrame(frame.current);
    setHovered(null);
    tooltip.current?.close();
  });
  useEffect(() => {
    const container = map.getContainer();
    const move = (event: MouseEvent) => onMove(event);
    const leave = () => onLeave();
    container.addEventListener("mousemove", move);
    container.addEventListener("mouseleave", leave);
    return () => {
      container.removeEventListener("mousemove", move);
      container.removeEventListener("mouseleave", leave);
    };
  }, [map]);

  useMapEvents({
    click: (event) => {
      if (!active) return;
      const province = at(event.latlng);
      if (!province) return;
      // El aviso del cursor que estaba por dibujarse ya no corresponde: se elige y el picker se apaga.
      cancelAnimationFrame(frame.current);
      tooltip.current?.close();
      onSelect(province);
    },
  });

  // Por el mapa o por el selector: el mapa va a la provincia; si se quita, vuelve a todo Ecuador.
  const previous = useRef<string | null>(null);
  const follow = useEffectEvent(() => {
    const key = selected?.key ?? null;
    if (key === previous.current) return;
    const hadOne = previous.current !== null;
    previous.current = key;
    // Después de que termine de abrirse el resumen (el mapa se angosta): si no, el vuelo
    // se calcula con el ancho anterior y el reajuste lo interrumpe.
    const timer = setTimeout(() => {
      if (selected) void focusProvinceOf(map, boundsOf(selected).getCenter(), selected.name);
      else if (hadOne) goHome(map);
    }, SIDEBAR_SETTLE_MS);
    return () => clearTimeout(timer);
  });
  useEffect(() => follow(), [selected?.key]);

  // Si deja de poder elegirse (se encendió la lluvia, se eligió una o se acercó el mapa), se quita el aviso del cursor.
  useEffect(() => {
    if (active) return;
    cancelAnimationFrame(frame.current);
    tooltip.current?.close();
  }, [active]);

  const showHover = active && hovered;
  return (
    <>
      {/* Con una provincia elegida, lo de afuera se atenúa: también las capas de imagen. */}
      {selected && (
        <Pane name={MASK_PANE} style={{ zIndex: 385, pointerEvents: "none" }}>
          <GeoJSON key={selected.key} data={maskOf(selected)} style={MASK} interactive={false} />
        </Pane>
      )}
      {showHover && (
        <Pane name={PANE} style={{ zIndex: 394, pointerEvents: "none" }}>
          {contrast && <GeoJSON key={`c${hovered.key}`} data={hovered.geometry} style={CASING} interactive={false} />}
          <GeoJSON key={`${hovered.key}${contrast ? ":c" : ""}`} data={hovered.geometry} style={hoverStyle(contrast)} interactive={false} />
        </Pane>
      )}
    </>
  );
}
