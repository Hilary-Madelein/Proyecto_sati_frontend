"use client";

import type L from "leaflet";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { GeoJSON, Popup, Tooltip } from "react-leaflet";
import { formatDateTime } from "@/lib/format";
import { FLASH_FLOOD_LIKELIHOODS, FLASH_FLOOD_MODEL, MAP_PANES } from "../../constants";
import type { FlashFloodArea } from "../../types";

/**
 * Zonas urbanas con riesgo de crecida repentina según Google, con las muy
 * probables encima. Es un riesgo por celdas de ~20 km, no una mancha de inundación.
 *
 * Van en el lienzo de las capas de gestión del riesgo (`renderer`) y al fondo de
 * él: en un lienzo propio encima, se quedaría con los clics de todo el mapa, y
 * encima de las otras capas, con los de sus puntos y líneas.
 */
export function FlashFloodLayer({ areas, attribution, renderer }: { areas: FlashFloodArea[]; attribution: string; renderer: L.Canvas }) {
  const groups = useRef(new Map<string, L.GeoJSON>());
  // De las muy probables a las probables: cada una pasa al fondo, así las muy probables quedan encima de las demás.
  const ordered = useMemo(
    () => [...areas].sort((a, b) => Number(b.likelihood === "highly_likely") - Number(a.likelihood === "highly_likely")),
    [areas],
  );
  // Corre después de que los hijos se agregan al mapa, y otra vez si llegan zonas nuevas.
  useEffect(() => {
    for (const area of ordered) groups.current.get(area.id)?.bringToBack();
  }, [ordered]);

  return ordered.map((area) => {
    const { color, label } = FLASH_FLOOD_LIKELIHOODS[area.likelihood];
    return (
      <GeoJSON
        key={area.id}
        ref={(group) => {
          if (group) groups.current.set(area.id, group);
          else groups.current.delete(area.id);
        }}
        data={area.geometry}
        pane={MAP_PANES.risk.name}
        // El lienzo va en el estilo: GeoJSON lo aplica a cada zona antes de agregarla al mapa.
        style={{ color, weight: 1.5, opacity: 0.9, fillColor: color, fillOpacity: 0.28, renderer } as L.PathOptions}
      >
        <Tooltip sticky>
          <span className="text-xs">
            <strong>Crecida repentina:</strong> {label.toLowerCase()}
          </span>
        </Tooltip>
        <Popup minWidth={240} autoPanPadding={[16, 16]}>
          <FlashFloodPopupContent area={area} attribution={attribution} />
        </Popup>
      </GeoJSON>
    );
  });
}

function FlashFloodPopupContent({ area, attribution }: { area: FlashFloodArea; attribution: string }) {
  const level = FLASH_FLOOD_LIKELIHOODS[area.likelihood];
  return (
    <div className="w-60">
      <p className="text-[11px] font-medium text-slate-500">Crecida repentina urbana · Google</p>
      <h3 className="flex items-center gap-1.5 text-[15px] font-semibold text-slate-900 max-lg:text-sm">
        <span aria-hidden="true" className="size-3 rounded-sm" style={{ backgroundColor: level.color }} />
        {level.label}
      </h3>
      <dl className="mt-2 space-y-0.5 text-xs">
        <Row label="Tipo">{FLASH_FLOOD_MODEL.type}</Row>
        <Row label="Causa">{FLASH_FLOOD_MODEL.cause}</Row>
        <Row label="Modelo">{FLASH_FLOOD_MODEL.model}</Row>
        <Row label="Datos">{FLASH_FLOOD_MODEL.inputs}</Row>
        <Row label="Vigente hasta">{formatDateTime(area.validUntil)}</Row>
        <Row label="Emitido">{formatDateTime(area.issuedAt)}</Row>
        {area.countries.some((country) => country !== "EC") && <Row label="También afecta">{area.countries.filter((country) => country !== "EC").join(", ")}</Row>}
      </dl>
      <p className="mt-2 text-[11px] text-slate-500">Probabilidad en celdas de unos 20 km: no marca las calles que se inundarían.</p>
      <p className="mt-1 text-[11px] text-slate-400">{attribution}</p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{children}</dd>
    </div>
  );
}
