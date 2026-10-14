import { IconTile } from "@/components/ui/IconTile";
import { CloudRainIcon } from "@/components/ui/icons";
import { Toggle } from "@/components/ui/Toggle";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { STATION_RAIN_LEVEL_ORDER, STATION_RAIN_LEVELS } from "../../constants";
import type { WeatherStationsSnapshot } from "../../types";
import { stationRainLevel, stationsWithRain } from "../../utils";
import { LegendItem } from "./LegendItem";
import { LoadingBadge, Notice } from "./RainForecastSection";
import { SectionHeading } from "./SectionHeading";

interface WeatherStationsSectionProps {
  snapshot: WeatherStationsSnapshot | null;
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  error: string | null;
  isLoading: boolean;
}

/** Lluvia medida por los pluviómetros de las estaciones del INAMHI que transmiten en tiempo real. */
export function WeatherStationsSection({ snapshot, visible, onVisibleChange, error, isLoading }: WeatherStationsSectionProps) {
  // Solo las que informaron en las últimas horas (las demás tampoco se dibujan).
  const withData = stationsWithRain(snapshot?.stations ?? []);
  const latest = withData.map((station) => station.lastTime).filter((time) => time !== null).sort().at(-1);
  const countByLevel = (level: (typeof STATION_RAIN_LEVEL_ORDER)[number]) =>
    withData.filter((station) => stationRainLevel(station.totalMm) === level).length;

  return (
    <section>
      <SectionHeading aside={isLoading && visible && <LoadingBadge />}>Estaciones del INAMHI</SectionHeading>

      <div className={cn("rounded-xl p-3 ring-1 transition-colors", visible ? "bg-white ring-slate-200" : "bg-slate-50/70 ring-slate-200/70")}>
        <div className="flex items-center gap-3">
          <IconTile className="bg-violet-50 text-violet-700">
            <CloudRainIcon className="size-5" />
          </IconTile>
          <div className="min-w-0 flex-1">
            <h4 className={cn("text-sm font-semibold", visible ? "text-slate-900" : "text-slate-500")}>Lluvia en estaciones</h4>
            <p className="text-xs text-slate-500">
              {snapshot
                ? `${withData.length} estaciones · últimas ${snapshot.windowHours} h${latest ? `, hasta el ${formatDateTime(latest)}` : ""}`
                : "Pluviómetros que transmiten en tiempo real"}
            </p>
          </div>
          <Toggle checked={visible} onChange={onVisibleChange} label="Mostrar la lluvia en las estaciones del INAMHI" />
        </div>

        {visible && (
          <div className="mt-3 space-y-2">
            {error && <Notice>{error}</Notice>}
            {snapshot && (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-3">
                {STATION_RAIN_LEVEL_ORDER.map((level) => (
                  <LegendItem
                    key={level}
                    shape="diamond"
                    label={STATION_RAIN_LEVELS[level].label}
                    color={STATION_RAIN_LEVELS[level].color}
                    sizePx={STATION_RAIN_LEVELS[level].sizePx}
                    hollow={STATION_RAIN_LEVELS[level].hollow}
                    count={countByLevel(level)}
                  />
                ))}
              </ul>
            )}
            <p className="text-[11px] text-slate-500">
              Lluvia que midió cada estación, no pronóstico. Toca una estación para ver cada hora y el pronóstico WRF en ese
              punto. {snapshot?.attribution}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
