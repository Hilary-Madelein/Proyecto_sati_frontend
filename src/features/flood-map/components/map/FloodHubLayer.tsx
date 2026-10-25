"use client";

import L from "leaflet";
import type { ReactNode } from "react";
import { Marker, Popup, Tooltip } from "react-leaflet";
import { formatCalendarDate, formatDateTime } from "@/lib/format";
import { FLOOD_HUB_SEVERITIES, FLOOD_HUB_TRENDS } from "../../constants";
import type { FloodHubGauge, FloodHubSeverity, FloodHubSnapshot } from "../../types";
import { squareSymbolHtml } from "../map-symbols";

const iconCache = new Map<FloodHubSeverity, L.DivIcon>();

/** Cuadrado del color del nivel: se distingue de los eventos (círculos), las alertas (triángulos) y las estaciones (rombos). */
function gaugeIcon(severity: FloodHubSeverity): L.DivIcon {
  let icon = iconCache.get(severity);
  if (!icon) {
    const { color, sizePx } = FLOOD_HUB_SEVERITIES[severity];
    const hit = Math.max(16, sizePx + 6);
    icon = L.divIcon({
      className: "map-symbol-marker",
      html: squareSymbolHtml(color, sizePx),
      iconSize: [hit, hit],
      iconAnchor: [hit / 2, hit / 2],
      popupAnchor: [0, -hit / 2],
    });
    iconCache.set(severity, icon);
  }
  return icon;
}

/**
 * Puntos de pronóstico de Google Flood Hub con aviso (sobre lo normal, severo
 * o extremo); los de mayor severidad quedan encima. Los sin inundación (casi
 * todos, ~1000) no se dibujan: no aportan y tapan el mapa.
 */
export function FloodHubLayer({ snapshot }: { snapshot: FloodHubSnapshot }) {
  // Llegan de mayor a menor severidad: se dibujan al revés para que los avisos queden arriba.
  const gauges = snapshot.gauges.filter((gauge) => isFlagged(gauge.severity)).reverse();
  return gauges.map((gauge, index) => (
    <Marker
      key={gauge.id}
      position={[gauge.lat, gauge.lng]}
      icon={gaugeIcon(gauge.severity)}
      zIndexOffset={index}
      title={`Flood Hub: ${FLOOD_HUB_SEVERITIES[gauge.severity].label}`}
    >
      <Tooltip direction="top" offset={[0, -6]}>
        <span className="text-xs">
          <strong>{FLOOD_HUB_SEVERITIES[gauge.severity].label}</strong> · {forecastWindow(gauge)}
        </span>
      </Tooltip>
      <Popup minWidth={240} autoPanPadding={[16, 16]}>
        <GaugePopupContent gauge={gauge} attribution={snapshot.attribution} />
      </Popup>
    </Marker>
  ));
}

function GaugePopupContent({ gauge, attribution }: { gauge: FloodHubGauge; attribution: string }) {
  const level = FLOOD_HUB_SEVERITIES[gauge.severity];
  return (
    <div className="w-60">
      <p className="text-[11px] font-medium text-slate-500">Punto de pronóstico de Google Flood Hub</p>
      <h3 className="flex items-center gap-1.5 text-[15px] font-semibold text-slate-900">
        <span aria-hidden="true" className="size-3 rounded-sm" style={{ backgroundColor: level.color }} />
        {level.label}
      </h3>
      <dl className="mt-2 space-y-0.5 text-xs">
        <Row label="Pronóstico para">{forecastWindow(gauge)}</Row>
        <Row label="Tendencia">{FLOOD_HUB_TRENDS[gauge.trend]}</Row>
        <Row label="Modelo">{gauge.verified ? "Verificado por Google" : "Sin verificar en este punto"}</Row>
        {gauge.issuedAt && <Row label="Emitido">{formatDateTime(gauge.issuedAt)}</Row>}
      </dl>
      <p className="mt-2 text-[11px] text-slate-400">{attribution}</p>
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

export function isFlagged(severity: FloodHubSeverity): boolean {
  return severity === "above_normal" || severity === "severe" || severity === "extreme";
}

/**
 * Ventana del pronóstico, p. ej. "28 oct" o "28 – 30 oct". Flood Hub la da en
 * días UTC completos (de 00:00 a 00:00): se nombra el día UTC, no la hora local,
 * y el fin es exclusivo (se resta 1 ms para obtener el último día incluido).
 */
function forecastWindow(gauge: FloodHubGauge): string {
  if (!gauge.forecastFrom) return "sin fecha";
  const utcDay = (time: number) => formatCalendarDate(new Date(time).toISOString().slice(0, 10));
  const from = utcDay(Date.parse(gauge.forecastFrom));
  const to = gauge.forecastTo ? utcDay(Date.parse(gauge.forecastTo) - 1) : from;
  return from === to ? from : `${from} – ${to}`;
}
