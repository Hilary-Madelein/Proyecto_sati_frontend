"use client";

import L from "leaflet";
import { useEffect, useState } from "react";
import { Marker, Popup, Tooltip } from "react-leaflet";
import { satiClientGet } from "@/lib/api/sati-client";
import { formatDateTime, formatHour } from "@/lib/format";
import {
  STATION_CATEGORY_LABELS,
  STATION_FORECAST_LABELS,
  STATION_HOURLY_BAR_COLOR,
  STATION_RAIN_LEVELS,
} from "../../constants";
import type {
  ForecastDay,
  RainForecastAvailability,
  RainPointValue,
  StationRainLevel,
  WeatherStation,
  WeatherStationHour,
  WeatherStationsSnapshot,
} from "../../types";
import { stationRainLevel, stationsWithRain, type MeasuredStation } from "../../utils";
import { diamondSymbolHtml } from "../map-symbols";

const iconCache = new Map<StationRainLevel, L.DivIcon>();

/**
 * Rombo de la lluvia medida (hueco si es 0 mm; más grande y oscuro con más
 * lluvia): se distingue de los eventos (círculos) y las alertas (triángulos).
 */
function stationIcon(level: StationRainLevel): L.DivIcon {
  let icon = iconCache.get(level);
  if (!icon) {
    const { color, sizePx, hollow } = STATION_RAIN_LEVELS[level];
    // Zona de clic más grande que el rombo (girado ocupa ~1,4 veces su lado).
    const hit = Math.max(18, Math.ceil(sizePx * 1.4) + 6);
    icon = L.divIcon({
      className: "map-symbol-marker",
      html: diamondSymbolHtml(color, sizePx, hollow),
      iconSize: [hit, hit],
      iconAnchor: [hit / 2, hit / 2],
      popupAnchor: [0, -hit / 2],
    });
    iconCache.set(level, icon);
  }
  return icon;
}

const formatMm = (mm: number) => `${mm.toFixed(1).replace(".", ",")} mm`;

interface WeatherStationsLayerProps {
  snapshot: WeatherStationsSnapshot;
  /** Días del pronóstico WRF disponibles, para mostrarlos en cada estación. */
  rain: RainForecastAvailability | null;
}

/**
 * Estaciones del INAMHI con datos recientes, coloreadas por la lluvia que
 * midieron en las últimas horas. Las que no informan no se dibujan.
 */
export function WeatherStationsLayer({ snapshot, rain }: WeatherStationsLayerProps) {
  // Las de más lluvia, encima: no quedan tapadas por las secas.
  const stations = stationsWithRain(snapshot.stations).sort((a, b) => a.totalMm - b.totalMm);
  return stations.map((station, index) => (
    <Marker
      key={station.id}
      position={[station.lat, station.lng]}
      icon={stationIcon(stationRainLevel(station.totalMm))}
      zIndexOffset={index}
      keyboard
      title={`Estación ${station.name}`}
    >
      {/* Al pasar el cursor: qué es y que se puede tocar. */}
      <Tooltip direction="top" offset={[0, -7]}>
        <span className="text-xs">
          <strong>{station.name}</strong> · {formatMm(station.totalMm)} en {snapshot.windowHours} h
          <br />
          <span className="text-slate-500">Clic para ver cada hora y el pronóstico</span>
        </span>
      </Tooltip>
      <Popup minWidth={248} autoPanPadding={[16, 16]}>
        <StationPopupContent station={station} windowHours={snapshot.windowHours} rain={rain} />
      </Popup>
    </Marker>
  ));
}

function StationPopupContent({
  station,
  windowHours,
  rain,
}: {
  station: MeasuredStation;
  windowHours: number;
  rain: RainForecastAvailability | null;
}) {
  return (
    <div className="w-62">
      <p className="text-[11px] font-medium text-slate-500">
        Estación {STATION_CATEGORY_LABELS[station.category].toLowerCase()} {station.code}
        {station.altitude !== null && ` · ${Math.round(station.altitude).toLocaleString("es-EC")} m`}
      </p>
      <h3 className="text-[15px] font-semibold text-slate-900">{station.name}</h3>

      <p className="mt-2 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Lluvia medida · últimas {windowHours} h</p>
      <p className="text-xl font-semibold text-slate-900 tabular-nums">{formatMm(station.totalMm)}</p>
      <p className="text-[11px] text-slate-500">
        {station.hoursWithData} de {station.hours.length} h con dato
        {station.lastTime && ` · hasta las ${formatHour(station.lastTime)}`}
      </p>
      <HourlyRainBars hours={station.hours} />

      <StationForecast station={station} rain={rain} />
    </div>
  );
}

const CHART = { width: 248, height: 64, top: 12, bottom: 16, gap: 2 } as const;

/** Barras de la lluvia de cada hora (una sola serie: sin leyenda). Pasar el cursor muestra el valor. */
function HourlyRainBars({ hours }: { hours: WeatherStationHour[] }) {
  if (hours.length === 0) return null;
  const max = Math.max(1, ...hours.map((hour) => hour.mm ?? 0));
  const plotHeight = CHART.height - CHART.top - CHART.bottom;
  const slot = CHART.width / hours.length;
  const barWidth = Math.max(2, slot - CHART.gap);
  const baseline = CHART.top + plotHeight;
  const labelled = new Set([0, Math.floor((hours.length - 1) / 2), hours.length - 1]);

  return (
    <svg
      viewBox={`0 0 ${CHART.width} ${CHART.height}`}
      className="mt-2 w-full"
      role="img"
      aria-label={`Lluvia de cada hora: ${hours.map((hour) => `${formatHour(hour.time)} ${hour.mm === null ? "sin dato" : formatMm(hour.mm)}`).join(", ")}`}
    >
      <text x={0} y={8} className="fill-slate-400 text-[9px]">
        {max > 1 ? formatMm(max) : "1 mm"}
      </text>
      <line x1={0} x2={CHART.width} y1={CHART.top} y2={CHART.top} className="stroke-slate-100" strokeDasharray="2 3" />
      {hours.map((hour, index) => {
        const x = index * slot + CHART.gap / 2;
        const start = new Date(Date.parse(hour.time) - 60 * 60 * 1000).toISOString();
        const label = `De ${formatHour(start)} a ${formatHour(hour.time)}: ${hour.mm === null ? "sin dato" : formatMm(hour.mm)}`;
        const height = hour.mm === null ? 0 : (hour.mm / max) * plotHeight;
        return (
          <g key={hour.time}>
            <title>{label}</title>
            {/* Zona sensible a toda la altura: más grande que la barra. */}
            <rect x={x} y={CHART.top} width={barWidth} height={plotHeight} fill="transparent" />
            {hour.mm === null ? (
              <text x={x + barWidth / 2} y={baseline - 2} textAnchor="middle" className="fill-slate-400 text-[8px]">
                –
              </text>
            ) : (
              height > 0 && (
                <rect x={x} y={baseline - height} width={barWidth} height={height} rx={Math.min(2, barWidth / 2)} fill={STATION_HOURLY_BAR_COLOR} />
              )
            )}
            {labelled.has(index) && (
              <text
                x={x + barWidth / 2}
                y={CHART.height - 3}
                textAnchor={index === 0 ? "start" : index === hours.length - 1 ? "end" : "middle"}
                className="fill-slate-500 text-[9px] tabular-nums"
              >
                {formatHour(hour.time)}
              </text>
            )}
          </g>
        );
      })}
      <line x1={0} x2={CHART.width} y1={baseline} y2={baseline} className="stroke-slate-300" />
    </svg>
  );
}

type ForecastReading = { status: "loading" } | { status: "error" } | { status: "ready"; mm: number | null };

/** Pronóstico WRF en el punto de la estación, por día. Se consulta al abrir el popup. */
function StationForecast({ station, rain }: { station: WeatherStation; rain: RainForecastAvailability | null }) {
  const days = rain?.days.filter((item) => item.available).map((item) => item.day) ?? [];
  const [readings, setReadings] = useState<Partial<Record<ForecastDay, ForecastReading>>>({});

  useEffect(() => {
    const controller = new AbortController();
    for (const day of days) {
      satiClientGet<RainPointValue>(
        `/rain-forecast/days/${day}/value`,
        { lat: station.lat.toFixed(5), lng: station.lng.toFixed(5) },
        controller.signal,
      )
        .then((value) => setReadings((current) => ({ ...current, [day]: { status: "ready", mm: value.mm } })))
        .catch((error: Error) => {
          if (error.name !== "AbortError") setReadings((current) => ({ ...current, [day]: { status: "error" } }));
        });
    }
    return () => controller.abort();
    // Se consulta una vez por popup abierto: la corrida no cambia mientras se mira.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mt-3 border-t border-slate-100 pt-2">
      <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Pronóstico WRF en la estación</p>
      {days.length === 0 ? (
        <p className="text-xs text-slate-500">No hay pronóstico disponible.</p>
      ) : (
        <dl className="mt-1 space-y-0.5 text-xs">
          {days.map((day) => {
            const reading = readings[day] ?? { status: "loading" };
            return (
              <div key={day} className="flex items-baseline justify-between gap-3">
                <dt className="text-slate-600">{STATION_FORECAST_LABELS[day]}</dt>
                <dd className="font-semibold text-slate-900 tabular-nums">
                  {reading.status === "loading" && <span className="font-normal text-slate-400">…</span>}
                  {reading.status === "error" && <span className="font-normal text-red-600">sin conexión</span>}
                  {reading.status === "ready" && (reading.mm === null ? <span className="font-normal text-slate-500">sin dato</span> : formatMm(reading.mm))}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
      {rain?.run && <p className="mt-1 text-[11px] text-slate-400">Corrida del {formatDateTime(rain.run)}</p>}
    </div>
  );
}
