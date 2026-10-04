"use client";

import { ResponsivePanel } from "@/components/shared/ResponsivePanel";
import { IconTile } from "@/components/ui/IconTile";
import { WavesIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatCalendarDate, formatDateTime } from "@/lib/format";
import type { RiverTarget } from "../../hooks/useRiverForecast";
import { useRiverForecast } from "../../hooks/useRiverForecast";
import type { RiverAlert } from "../../types";
import { alertLevelForDay, alertLevelStyle } from "../../utils";
import { LoadingBadge, Notice } from "../panels/RainForecastSection";
import { Hydrograph } from "./Hydrograph";

interface RiverPanelProps {
  target: RiverTarget | null;
  /** Fechas del pronóstico de alertas (para la franja de días). */
  alertDays: string[];
  alertDayIndex: number;
  onClose: () => void;
}

/** Caudal pronosticado del tramo elegido: alerta por día e hidrograma. */
export function RiverPanel({ target, alertDays, alertDayIndex, onClose }: RiverPanelProps) {
  const { isLoading, river, forecast, error } = useRiverForecast(target);
  if (!target) return null;

  const alert = river?.alert ?? null;
  const place = [alert?.canton, alert?.province].filter(Boolean).join(", ");
  const title = alert?.river ?? (river ? "Tramo de río" : "Buscando río…");
  const subtitle = river ? [place, `ID ${river.riverId}`].filter(Boolean).join(" · ") : "Río más cercano al punto elegido";

  return (
    <ResponsivePanel
      title={title}
      subtitle={subtitle}
      icon={
        <IconTile className="bg-blue-600 text-white shadow-sm shadow-blue-600/30">
          <WavesIcon className="size-4.5" />
        </IconTile>
      }
      mobileOpen
      desktopOpen
      onClose={onClose}
      desktopClassName="lg:bottom-6 lg:left-auto lg:right-101 lg:top-auto lg:w-[min(40rem,calc(100%-27rem))] lg:max-h-[calc(100%-3rem)]"
    >
      <div className="space-y-4">
        {alert && <AlertStrip alert={alert} days={alertDays} dayIndex={alertDayIndex} />}

        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Pronóstico de caudal</h3>
            {isLoading && <LoadingBadge />}
          </div>

          {error ? (
            <Notice>{error}</Notice>
          ) : forecast ? (
            <>
              <Hydrograph forecast={forecast} />
              <p className="mt-2 text-[11px] text-slate-500">
                {forecast.source}
                {forecast.generatedAt && ` · generado el ${formatDateTime(forecast.generatedAt)}`} · 15 días, cada 3 h
              </p>
            </>
          ) : (
            <div className="grid h-55 place-items-center rounded-xl bg-slate-50 text-xs text-slate-500">
              Consultando GEOGLOWS…
            </div>
          )}
        </section>
      </div>
    </ResponsivePanel>
  );
}

/** Nivel de alerta de cada día del pronóstico, con el día elegido resaltado. */
function AlertStrip({ alert, days, dayIndex }: { alert: RiverAlert; days: string[]; dayIndex: number }) {
  const level = alertLevelForDay(alert, dayIndex);
  const style = alertLevelStyle(level);

  return (
    <section>
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="size-3 rounded-full ring-1 ring-black/20"
          style={{ backgroundColor: style.color }}
        />
        <p className="text-sm text-slate-700">
          <strong className="font-semibold text-slate-900">
            {level === 0 ? "Caudal normal" : `Supera el caudal de ${style.label}`}
          </strong>
          {days[dayIndex] && ` el ${formatCalendarDate(days[dayIndex])}`}
        </p>
      </div>
      <ol className="mt-2 grid grid-cols-7 gap-1 sm:grid-cols-14" aria-label="Nivel de alerta por día">
        {alert.dailyLevels.map((dayLevel, index) => {
          const dayStyle = alertLevelStyle(dayLevel);
          return (
            <li
              key={index}
              title={`${days[index] ? formatCalendarDate(days[index]) : `Día ${index + 1}`}: ${dayLevel === 0 ? "normal" : `supera ${dayStyle.label}`}`}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-md py-1 text-[10px] text-slate-500",
                index === dayIndex && "bg-slate-100 font-semibold text-slate-900",
              )}
            >
              <span aria-hidden="true" className="h-2 w-full max-w-6 rounded-sm" style={{ backgroundColor: dayStyle.color }} />
              {days[index] ? formatCalendarDate(days[index]).split(" ")[0] : index + 1}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
