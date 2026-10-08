"use client";

import { ResponsivePanel } from "@/components/shared/ResponsivePanel";
import { IconTile } from "@/components/ui/IconTile";
import { WavesIcon } from "@/components/ui/icons";
import { formatCalendarDate, formatDateTime } from "@/lib/format";
import type { RiverTarget } from "../../hooks/useRiverForecast";
import { useRiverForecast } from "../../hooks/useRiverForecast";
import { LoadingBadge, Notice } from "../panels/RainForecastSection";
import { Hydrograph } from "./Hydrograph";

interface RiverPanelProps {
  target: RiverTarget | null;
  onClose: () => void;
}

/** Caudal pronosticado del tramo elegido: hidrograma por ensambles. */
export function RiverPanel({ target, onClose }: RiverPanelProps) {
  const { isLoading, river, forecast, error, returnPeriods, returnPeriodsFailed } = useRiverForecast(target);
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
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Pronóstico de caudal por ensambles</h3>
            {isLoading && <LoadingBadge />}
          </div>

          {error ? (
            <Notice>{error}</Notice>
          ) : forecast ? (
            <>
              {forecast.fallbackRun && (
                <div className="mb-3">
                  <Notice>
                    GEOGLOWS aún no tiene lista la corrida de hoy: se muestra la del {formatCalendarDate(runToIsoDate(forecast.fallbackRun))}.
                  </Notice>
                </div>
              )}
              <Hydrograph forecast={forecast} returnPeriods={returnPeriods} returnPeriodsLoading={!returnPeriods && !returnPeriodsFailed} />
              <p className="mt-2 text-[11px] text-slate-500">
                {forecast.source}
                {forecast.generatedAt && ` · generado el ${formatDateTime(forecast.generatedAt)}`} · 51 miembros del ensamble, 15 días cada 3 h
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

/** "20261007" → "2026-10-07". */
const runToIsoDate = (run: string) => `${run.slice(0, 4)}-${run.slice(4, 6)}-${run.slice(6, 8)}`;
