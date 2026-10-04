import type { ReactNode } from "react";
import { IconTile } from "@/components/ui/IconTile";
import { AlertTriangleIcon, CloudRainIcon } from "@/components/ui/icons";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Toggle } from "@/components/ui/Toggle";
import { formatDateTime, formatDayMonth } from "@/lib/format";
import { FORECAST_DAYS } from "../../constants";
import type { ForecastDay, RainAvailability } from "../../types";
import { rainTimeForDay } from "../../utils";
import { SectionHeading } from "./SectionHeading";

interface RainForecastSectionProps {
  rain: RainAvailability | null;
  day: ForecastDay;
  onDayChange: (day: ForecastDay) => void;
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  /** Las teselas de la capa se están descargando. */
  isLoading: boolean;
}

export function RainForecastSection({ rain, day, onDayChange, visible, onVisibleChange, isLoading }: RainForecastSectionProps) {
  const time = rainTimeForDay(rain, day);
  const options = FORECAST_DAYS.map((value) => {
    const optionTime = rainTimeForDay(rain, value);
    return {
      value: String(value) as `${ForecastDay}`,
      label: optionTime ? `Día ${value} · ${formatDayMonth(optionTime)}` : `Día ${value}`,
      disabled: !optionTime,
      hint: optionTime ? undefined : "La corrida actual del modelo no llega a ese día",
    };
  });

  return (
    <section>
      <SectionHeading aside={isLoading && visible && <LoadingBadge />}>Pronóstico de lluvia</SectionHeading>

      <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
        <div className="flex items-center gap-3">
          <IconTile className="bg-sky-50 text-sky-600">
            <CloudRainIcon className="size-5" />
          </IconTile>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-slate-900">Lluvia pronosticada (WRF)</h4>
            <p className="text-xs text-slate-500">
              {time ? `24 h hasta el ${formatDateTime(time)}` : "Sin datos para este día"}
            </p>
          </div>
          <Toggle checked={visible} onChange={onVisibleChange} label="Mostrar lluvia pronosticada" />
        </div>

        <div className="mt-3">
          <SegmentedControl
            name="rain-forecast-day"
            label="Día de pronóstico de lluvia"
            value={String(day) as `${ForecastDay}`}
            options={options}
            onChange={(value) => onDayChange(Number(value) as ForecastDay)}
          />
        </div>

        <RainStatus rain={rain} />
      </div>
    </section>
  );
}

export function LoadingBadge() {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-blue-600" role="status">
      <span className="size-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      Cargando
    </span>
  );
}

function RainStatus({ rain }: { rain: RainAvailability | null }) {
  if (!rain) return <Notice>No se pudo cargar el pronóstico del INAMHI.</Notice>;
  if (!rain.run) return <Notice>El INAMHI no publicó una corrida del modelo.</Notice>;
  if (rain.isStale) {
    return <Notice>Pronóstico desactualizado: la última corrida del modelo es del {formatDateTime(rain.run)}.</Notice>;
  }
  return (
    <p className="mt-2 text-[11px] text-slate-500">
      Cada día es la lluvia de 24 h del modelo WRF del INAMHI · corrida del {formatDateTime(rain.run)}
    </p>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800 ring-1 ring-amber-600/20">
      <AlertTriangleIcon className="mt-px size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
