import type { ReactNode } from "react";
import { IconTile } from "@/components/ui/IconTile";
import { AlertTriangleIcon, CloudRainIcon } from "@/components/ui/icons";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Toggle } from "@/components/ui/Toggle";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { FORECAST_DAY_LABELS, FORECAST_DAYS, FORECAST_WINDOW_HOURS } from "../../constants";
import type { ForecastDay, ForecastWindowHours, RainForecastAvailability } from "../../types";
import { OpacitySlider } from "./OpacitySlider";
import { SectionHeading } from "./SectionHeading";

interface RainForecastSectionProps {
  rain: RainForecastAvailability | null;
  day: ForecastDay;
  onDayChange: (day: ForecastDay) => void;
  /** Ventana elegida; null = se está viendo un día del modelo. */
  hours: ForecastWindowHours | null;
  onHoursChange: (hours: ForecastWindowHours) => void;
  /** Periodo de la ventana elegida, cuando ya llegó. */
  windowPeriod: { from: string; to: string } | null;
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  error: string | null;
  isLoading: boolean;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  /** Animación en el mapa de lo elegido: las ventanas (3 → 24 h) o los días (24 → 72 h). */
  animating: boolean;
  /** Texto del botón, p. ej. "Animar 3 → 24 h". */
  animationLabel: string;
  onToggleAnimation: () => void;
  /** Descarga de la animación como GIF; `exportProgress`: cuántas ventanas van (null = no se está generando). */
  exportProgress: { done: number; total: number } | null;
  onExportAnimation: () => void;
}

/** Lluvia pronosticada por el modelo WRF del INAMHI: las próximas horas, o un día de la corrida (no acumulado). */
export function RainForecastSection({
  rain,
  day,
  onDayChange,
  hours,
  onHoursChange,
  windowPeriod,
  visible,
  onVisibleChange,
  error,
  isLoading,
  opacity,
  onOpacityChange,
  animating,
  animationLabel,
  onToggleAnimation,
  exportProgress,
  onExportAnimation,
}: RainForecastSectionProps) {
  const period = hours ? windowPeriod : rain?.days.find((item) => item.day === day);
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
              Lluvia {hours ? `en las próximas ${hours} h` : FORECAST_DAY_LABELS[day].range}
            </h4>
            <p className="text-xs text-slate-500">
              {period?.from && period.to
                ? `Del ${formatDateTime(period.from)} al ${formatDateTime(period.to)}`
                : hours
                  ? "Calculando el periodo"
                  : "Sin datos para este día"}
            </p>
          </div>
          <Toggle checked={visible} onChange={onVisibleChange} label="Mostrar lluvia pronosticada" />
        </div>

        {/* Las opciones solo aparecen con la capa encendida. */}
        {visible && (
          <div className="mt-3 space-y-3">
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-slate-500">Próximas horas</p>
              <SegmentedControl<`${ForecastWindowHours}`>
                name="rain-forecast-window"
                label="Lluvia de las próximas horas"
                value={String(hours ?? "") as `${ForecastWindowHours}`}
                options={FORECAST_WINDOW_HOURS.map((option) => ({ value: `${option}`, label: `${option} h` }))}
                onChange={(value) => onHoursChange(Number(value) as ForecastWindowHours)}
              />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-slate-500">Por día de la corrida</p>
              <SegmentedControl
                name="rain-forecast-day"
                label="Tramo de 24 h de la corrida del modelo"
                value={String(hours ? "" : day) as `${ForecastDay}`}
                options={options}
                onChange={(value) => onDayChange(Number(value) as ForecastDay)}
              />
            </div>
            {/* Animar en el mapa lo elegido (las próximas horas o los días) y descargarlo como GIF: una sola fila. */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onToggleAnimation}
                disabled={exportProgress !== null}
                aria-pressed={animating}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold whitespace-nowrap ring-1 transition focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50",
                  animating ? "bg-blue-600 text-white ring-blue-600" : "bg-white text-blue-700 ring-blue-200 hover:bg-blue-50",
                )}
              >
                <PlayPauseIcon playing={animating} />
                {/* En pantallas angostas solo "Animar": el rango lo dice la opción elegida y el texto de abajo. */}
                <span className="truncate">
                  {animating ? (
                    "Pausar"
                  ) : (
                    <>
                      <span className="sm:hidden">Animar</span>
                      <span className="max-sm:hidden">{animationLabel}</span>
                    </>
                  )}
                </span>
              </button>
              <button
                type="button"
                onClick={onExportAnimation}
                disabled={exportProgress !== null}
                title="Descargar la animación como GIF"
                className="flex items-center justify-center gap-1.5 rounded-lg bg-white px-2 py-1.5 whitespace-nowrap text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-60"
              >
                {exportProgress ? (
                  <>
                    <span aria-hidden="true" className="size-3 shrink-0 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    <span className="truncate">Generando {exportProgress.done}/{exportProgress.total}</span>
                  </>
                ) : (
                  <>
                    <DownloadIcon />
                    <span className="truncate">
                      <span className="sm:hidden">GIF</span>
                      <span className="max-sm:hidden">Descargar GIF</span>
                    </span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] leading-snug text-slate-500">
              Se anima lo que tengas elegido: una opción de <strong className="font-semibold text-slate-600">Próximas horas</strong>{" "}
              recorre 3 → 24 h; una de <strong className="font-semibold text-slate-600">Por día de la corrida</strong>, 24 → 72 h.
            </p>
            <OpacitySlider value={opacity} onChange={onOpacityChange} layerName="la lluvia pronosticada" />
          </div>
        )}

        {visible && error && <Notice>{error}</Notice>}
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

function PlayPauseIcon({ playing }: { playing: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-3.5 shrink-0">
      {playing ? <path d="M6 5h4v14H6zM14 5h4v14h-4z" /> : <path d="M7 4.5v15l12-7.5z" />}
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 shrink-0">
      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </svg>
  );
}
