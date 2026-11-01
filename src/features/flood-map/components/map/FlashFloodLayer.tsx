"use client";

import type { ReactNode } from "react";
import { GeoJSON, Popup, Tooltip } from "react-leaflet";
import { formatDateTime } from "@/lib/format";
import { FLASH_FLOOD_LIKELIHOODS, FLASH_FLOOD_MODEL } from "../../constants";
import type { FlashFloodArea } from "../../types";

/**
 * Zonas urbanas con riesgo de crecida repentina según Google, con las muy
 * probables encima. Es un riesgo por celdas de ~20 km, no una mancha de inundación.
 */
export function FlashFloodLayer({ areas, attribution }: { areas: FlashFloodArea[]; attribution: string }) {
  const ordered = [...areas].sort((a, b) => Number(a.likelihood === "highly_likely") - Number(b.likelihood === "highly_likely"));
  return ordered.map((area) => {
    const { color, label } = FLASH_FLOOD_LIKELIHOODS[area.likelihood];
    return (
      <GeoJSON
        key={area.id}
        data={area.geometry}
        style={{ color, weight: 1.5, opacity: 0.9, fillColor: color, fillOpacity: 0.28 }}
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
      <h3 className="flex items-center gap-1.5 text-[15px] font-semibold text-slate-900">
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
