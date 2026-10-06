import type { ReactNode } from "react";
import { IconTile } from "@/components/ui/IconTile";
import { AlertTriangleIcon, CloudRainIcon } from "@/components/ui/icons";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Toggle } from "@/components/ui/Toggle";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { FORECAST_DAY_LABELS, FORECAST_DAYS } from "../../constants";
import type { DailyRainForecast, ForecastDay, RainForecastAvailability } from "../../types";
import { SectionHeading } from "./SectionHeading";

interface RainForecastSectionProps {
  rain: RainForecastAvailability | null;
  day: ForecastDay;
  onDayChange: (day: ForecastDay) => void;
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  /** Lluvia del día que se está mostrando (null mientras se calcula o si falló). */
  forecast: DailyRainForecast | null;
  error: string | null;
  isLoading: boolean;
}

/** Lluvia pronosticada por el modelo WRF del INAMHI, un día a la vez (no acumulada). */
export function RainForecastSection({
  rain,
  day,
  onDayChange,
  visible,
  onVisibleChange,
  forecast,
  error,
  isLoading,
}: RainForecastSectionProps) {
  const period = rain?.days.find((item) => item.day === day);
  const options = FORECAST_DAYS.map((option) => {
    const available = rain?.days.find((item) => item.day === option)?.available ?? false;
    return {
      value: String(option) as `${ForecastDay}`,
      label: FORECAST_DAY_LABELS[option].option,
      disabled: !available,
      hint: available ? undefined : "La corrida actual del modelo no llega a ese día",
    };
  });

  return (
    <section>
      <SectionHeading aside={isLoading && visible && <LoadingBadge />}>Pronóstico de lluvia</SectionHeading>

      <div className={cn("rounded-xl p-3 ring-1 transition-colors", visible ? "bg-white ring-slate-200" : "bg-slate-50/70 ring-slate-200/70")}>
        <div className="flex items-center gap-3">
          <IconTile className="bg-sky-50 text-sky-600">
            <CloudRainIcon className="size-5" />
          </IconTile>
          <div className="min-w-0 flex-1">
            <h4 className={cn("text-sm font-semibold", visible ? "text-slate-900" : "text-slate-500")}>
              Lluvia {FORECAST_DAY_LABELS[day].range}
            </h4>
            <p className="text-xs text-slate-500">
              {period?.from && period.to
                ? `Del ${formatDateTime(period.from)} al ${formatDateTime(period.to)}`
                : "Sin datos para este día"}
            </p>
          </div>
          <Toggle checked={visible} onChange={onVisibleChange} label="Mostrar lluvia pronosticada" />
        </div>

        {/* Las opciones solo aparecen con la capa encendida. */}
        {visible && (
          <div className="mt-3">
            <SegmentedControl
              name="rain-forecast-day"
              label="Tramo de 24 h del pronóstico"
              value={String(day) as `${ForecastDay}`}
              options={options}
              onChange={(value) => onDayChange(Number(value) as ForecastDay)}
            />
          </div>
        )}

        {visible && error && <Notice>{error}</Notice>}
        {visible && forecast && !error && (
          <p className="mt-2 text-[11px] text-slate-500">
            Máximo en esas 24 h: <strong className="font-semibold text-slate-700">{forecast.maxMm.toLocaleString("es-EC")} mm</strong>
          </p>
        )}
        {visible && <RainStatus rain={rain} />}
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
      Según el modelo WRF del INAMHI · corrida del {formatDateTime(rain.run)}
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
