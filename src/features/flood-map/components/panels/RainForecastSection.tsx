import type { ReactNode } from "react";
import { IconTile } from "@/components/ui/IconTile";
import { AlertTriangleIcon, CloudRainIcon } from "@/components/ui/icons";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Toggle } from "@/components/ui/Toggle";
import { formatDateTime } from "@/lib/format";
import { RAIN_FORECAST_PERIODS } from "../../constants";
import type { AccumulatedRain, RainForecastAvailability, RainForecastHours } from "../../types";
import { SectionHeading } from "./SectionHeading";

interface RainForecastSectionProps {
  rain: RainForecastAvailability | null;
  hours: RainForecastHours;
  onHoursChange: (hours: RainForecastHours) => void;
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  /** Acumulado que se está mostrando (null mientras se calcula o si falló). */
  accumulated: AccumulatedRain | null;
  error: string | null;
  isLoading: boolean;
}

export function RainForecastSection({
  rain,
  hours,
  onHoursChange,
  visible,
  onVisibleChange,
  accumulated,
  error,
  isLoading,
}: RainForecastSectionProps) {
  const period = rain?.periods.find((item) => item.hours === hours);
  const options = RAIN_FORECAST_PERIODS.map((option) => {
    const available = rain?.periods.find((item) => String(item.hours) === option.value)?.available ?? false;
    return { ...option, disabled: !available, hint: available ? undefined : "La corrida actual del modelo no llega a ese periodo" };
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
            <h4 className="text-sm font-semibold text-slate-900">Lluvia acumulada en {hours} h</h4>
            <p className="text-xs text-slate-500">
              {period?.from && period.to
                ? `Del ${formatDateTime(period.from)} al ${formatDateTime(period.to)}`
                : "Sin datos para este periodo"}
            </p>
          </div>
          <Toggle checked={visible} onChange={onVisibleChange} label="Mostrar lluvia pronosticada" />
        </div>

        <div className="mt-3">
          <SegmentedControl
            name="rain-forecast-hours"
            label="Horas de lluvia acumulada"
            value={String(hours) as `${RainForecastHours}`}
            options={options}
            onChange={(value) => onHoursChange(Number(value) as RainForecastHours)}
          />
        </div>

        {visible && error && <Notice>{error}</Notice>}
        {visible && accumulated && !error && (
          <p className="mt-2 text-[11px] text-slate-500">
            Máximo acumulado: <strong className="font-semibold text-slate-700">{accumulated.maxMm.toLocaleString("es-EC")} mm</strong>
          </p>
        )}
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

function RainStatus({ rain }: { rain: RainForecastAvailability | null }) {
  if (!rain) return <Notice>No se pudo cargar el pronóstico del INAMHI.</Notice>;
  if (!rain.run) return <Notice>El INAMHI no publicó una corrida del modelo.</Notice>;
  if (rain.isStale) {
    return <Notice>Pronóstico desactualizado: la última corrida del modelo es del {formatDateTime(rain.run)}.</Notice>;
  }
  return (
    <p className="mt-2 text-[11px] text-slate-500">
      Suma de la lluvia diaria del modelo WRF del INAMHI · corrida del {formatDateTime(rain.run)}
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
