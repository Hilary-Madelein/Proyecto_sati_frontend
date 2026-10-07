"use client";

import type { Popup as LeafletPopup } from "leaflet";
import { useCallback, useEffect, useRef, useState } from "react";
import { Popup, useMapEvents } from "react-leaflet";
import { CloudRainIcon } from "@/components/ui/icons";
import { satiClientGet } from "@/lib/api/sati-client";
import { formatDateTime, formatSigned } from "@/lib/format";
import { FORECAST_DAY_LABELS } from "../../constants";
import type { DailyRainForecast, ObservedAccumulatedRain, RainPointValue, SeaPointValue, SeaTemperatureAnomaly } from "../../types";

interface PointSource {
  key: string;
  kind: "rain" | "sea";
  title: string;
  /** Ruta del backend que devuelve el valor de la capa en un punto. */
  path: string;
}

interface RainPointPopupProps {
  forecast: { data: DailyRainForecast; attribution: string } | null;
  observed: { data: ObservedAccumulatedRain; attribution: string } | null;
  sea: SeaTemperatureAnomaly | null;
}

type Reading =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; kind: "rain"; value: RainPointValue }
  | { status: "ready"; kind: "sea"; value: SeaPointValue };

/**
 * Al hacer clic en el mapa, muestra el valor de cada capa activa en ese punto:
 * lluvia (pronóstico y/o observada) y temperatura del mar. Sin capas activas, no hace nada.
 */
export function RainPointPopup({ forecast, observed, sea }: RainPointPopupProps) {
  const [click, setClick] = useState<{ id: number; lat: number; lng: number } | null>(null);
  const hasLayers = forecast !== null || observed !== null || sea !== null;

  useMapEvents({
    click: (event) => {
      if (layers) setClick((previous) => ({ id: (previous?.id ?? 0) + 1, lat: event.latlng.lat, lng: event.latlng.lng, layers }));
    },
  });

  if (click && click.layers !== layers) setClick(null);
  if (!click || click.layers !== layers) return null;

  const sources: PointSource[] = [];
  if (forecast) {
    sources.push({
      key: "forecast",
      kind: "rain",
      title: `Lluvia pronosticada ${FORECAST_DAY_LABELS[forecast.data.day].range}`,
      path: `/rain-forecast/days/${forecast.data.day}/value`,
    });
  }
  if (observed) {
    sources.push({
      key: "observed",
      kind: "rain",
      title: `Lluvia observada, últimas ${observed.data.hours} h`,
      path: `/observed-rain/${observed.data.product}/accumulated/${observed.data.hours}/value`,
    });
  }
  if (sea) {
    sources.push({ key: "sea", kind: "sea", title: "Temperatura del mar", path: "/sea-temperature/value" });
  }

  // `key` reabre el popup (y vuelve a consultar) en cada clic nuevo.
  return <PointPopupContent key={click.id} lat={click.lat} lng={click.lng} sources={sources} onClose={() => close(click.id)} />;
}

interface PointPopupContentProps {
  lat: number;
  lng: number;
  sources: PointSource[];
  /** Se cerró (con la × o al hacer clic en otro lado). */
  onClose: () => void;
}

function PointPopupContent({ lat, lng, sources, onClose }: PointPopupContentProps) {
  const popupRef = useRef<LeafletPopup>(null);
  const [readings, setReadings] = useState<Record<string, Reading>>({});
  const refreshPopup = useCallback(() => popupRef.current?.update(), []);

  useEffect(() => {
    const controller = new AbortController();
    for (const source of sources) {
      const query = { lat: lat.toFixed(5), lng: lng.toFixed(5) };
      const ready = (value: RainPointValue | SeaPointValue): Reading =>
        source.kind === "sea"
          ? { status: "ready", kind: "sea", value: value as SeaPointValue }
          : { status: "ready", kind: "rain", value: value as RainPointValue };
      satiClientGet<RainPointValue | SeaPointValue>(source.path, query, controller.signal)
        .then((value) => setReadings((current) => ({ ...current, [source.key]: ready(value) })))
        .catch((error: Error) => {
          if (error.name !== "AbortError") setReadings((current) => ({ ...current, [source.key]: { status: "error" } }));
        });
    }
    return () => controller.abort();
    // Los datos de las capas no cambian durante la vida de este popup (se remonta en cada clic).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al llegar los valores cambia el tamaño: se reacomoda para que el popup se vea completo.
  useEffect(refreshPopup, [readings, refreshPopup]);

  return (
    <Popup ref={popupRef} position={[lat, lng]} minWidth={220} autoPanPadding={[16, 16]} eventHandlers={{ remove: onClose }}>
      <div className="w-56">
        <h3 className="flex items-center gap-1.5 text-[15px] font-semibold text-slate-900">
          <CloudRainIcon className="size-4 text-sky-600" />
          En este punto
        </h3>
        <ul className="mt-2 space-y-2">
          {sources.map((source) => (
            <li key={source.key} className="border-t border-slate-100 pt-2 first:border-0 first:pt-0">
              <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{source.title}</p>
              <ReadingValue reading={readings[source.key] ?? { status: "loading" }} />
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-slate-400 tabular-nums">
          {lat.toFixed(4)}, {lng.toFixed(4)}
        </p>
      </div>
    </Popup>
  );
}

function ReadingValue({ reading }: { reading: Reading }) {
  if (reading.status === "loading") return <p className="text-xs text-slate-500">Consultando…</p>;
  if (reading.status === "error") return <p className="text-xs text-red-600">No se pudo consultar el valor.</p>;

  if (reading.kind === "sea") {
    const { sst, anomaly, time } = reading.value;
    if (sst === null || anomaly === null) {
      return <p className="text-sm text-slate-500">Sin dato: tierra o fuera de la zona del mar cubierta</p>;
    }
    return (
      <>
        <p className="text-xl font-semibold text-slate-900 tabular-nums">{sst.toFixed(1).replace(".", ",")} °C</p>
        <p className="text-xs text-slate-700 tabular-nums">
          <strong className="font-semibold">{formatSigned(anomaly)} °C</strong> sobre lo normal
        </p>
        <p className="text-[11px] text-slate-500">Dato del {formatDateTime(time)}</p>
      </>
    );
  }

  const { mm, from, to } = reading.value;
  return (
    <>
      <p className="text-xl font-semibold text-slate-900 tabular-nums">
        {mm === null ? <span className="text-sm font-normal text-slate-500">Sin dato en este punto</span> : `${mm.toFixed(1)} mm`}
      </p>
      <p className="text-[11px] text-slate-500">
        {formatDateTime(from)} – {formatDateTime(to)}
      </p>
    </>
  );
}
