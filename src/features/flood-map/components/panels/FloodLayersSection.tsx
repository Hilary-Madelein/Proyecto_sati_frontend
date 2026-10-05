import { IconTile } from "@/components/ui/IconTile";
import { HistoryIcon, WavesIcon, ZapIcon } from "@/components/ui/icons";
import { Toggle } from "@/components/ui/Toggle";
import { formatCalendarDate } from "@/lib/format";
import {
  FLASH_FLOOD_ORDER,
  FLASH_FLOOD_PROBABILITIES,
  FLUVIAL_LEVEL_ORDER,
  FLUVIAL_LEVELS,
  HISTORICAL_FREQUENCIES,
  HISTORICAL_FREQUENCY_ORDER,
} from "../../constants";
import type { FloodLayerId, FloodMapData, LayerVisibility } from "../../types";
import { alertLevelForDay } from "../../utils";
import { LayerCard } from "./LayerCard";
import { LegendItem } from "./LegendItem";
import { Notice } from "./RainForecastSection";
import { SectionHeading } from "./SectionHeading";

interface FloodLayersSectionProps {
  data: FloodMapData;
  layers: LayerVisibility;
  onToggleLayer: (layer: FloodLayerId, enabled: boolean) => void;
  /** Día del pronóstico de caudales (índice 0 = primer día). */
  alertDayIndex: number;
  onAlertDayChange: (dayIndex: number) => void;
}

function countBy<T, K extends string>(items: T[], key: (item: T) => K) {
  const counts = {} as Partial<Record<K, number>>;
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1;
  return (value: K) => counts[value] ?? 0;
}

export function FloodLayersSection({ data, layers, onToggleLayer, alertDayIndex, onAlertDayChange }: FloodLayersSectionProps) {
  const stationsByLevel = countBy(data.fluvialStations, (station) => station.level);
  const zonesByProbability = countBy(data.flashFloodZones, (zone) => zone.probability);
  const zonesByFrequency = countBy(data.historicalZones, (zone) => zone.frequency);

  return (
    <section className="space-y-5">
      <div>
        <SectionHeading>Caudales de ríos (GEOGLOWS)</SectionHeading>
        <RiversCard
          data={data}
          layers={layers}
          onToggleLayer={onToggleLayer}
          alertDayIndex={alertDayIndex}
          onAlertDayChange={onAlertDayChange}
        />
      </div>

      <div>
        <SectionHeading aside={<span className="text-[10px] font-medium text-amber-700">Datos simulados</span>}>
          Datos de inundaciones
        </SectionHeading>
        <div className="space-y-2">
          <LayerCard
            title="Inundaciones fluviales"
            meta={`${data.fluvialStations.length} estaciones`}
            icon={
              <IconTile className="bg-blue-50 text-blue-600">
                <WavesIcon className="size-5" />
              </IconTile>
            }
            enabled={layers.fluvial}
            onToggle={(enabled) => onToggleLayer("fluvial", enabled)}
          >
            {FLUVIAL_LEVEL_ORDER.map((level) => (
              <LegendItem
                key={level}
                label={FLUVIAL_LEVELS[level].label}
                color={FLUVIAL_LEVELS[level].color}
                count={stationsByLevel(level)}
              />
            ))}
          </LayerCard>

          <LayerCard
            title="Inundaciones repentinas"
            meta={`Próximas 24h · ${data.flashFloodZones.length} zonas`}
            icon={
              <IconTile className="bg-orange-50 text-orange-600">
                <ZapIcon className="size-5" />
              </IconTile>
            }
            enabled={layers.flash}
            onToggle={(enabled) => onToggleLayer("flash", enabled)}
          >
            {FLASH_FLOOD_ORDER.map((probability) => {
              const style = FLASH_FLOOD_PROBABILITIES[probability];
              return (
                <LegendItem
                  key={probability}
                  shape="square"
                  label={style.label}
                  color={style.fill}
                  borderColor={style.stroke}
                  count={zonesByProbability(probability)}
                />
              );
            })}
          </LayerCard>

          <LayerCard
            title="Inundaciones históricas"
            meta="Frecuencia de inundación"
            icon={
              <IconTile className="bg-purple-50 text-purple-600">
                <HistoryIcon className="size-5" />
              </IconTile>
            }
            enabled={layers.historical}
            onToggle={(enabled) => onToggleLayer("historical", enabled)}
          >
            {HISTORICAL_FREQUENCY_ORDER.map((frequency) => (
              <LegendItem
                key={frequency}
                label={HISTORICAL_FREQUENCIES[frequency].label}
                color={HISTORICAL_FREQUENCIES[frequency].color}
                count={zonesByFrequency(frequency)}
              />
            ))}
          </LayerCard>
        </div>
      </div>
    </section>
  );
}

function RiversCard({ data, layers, onToggleLayer, alertDayIndex, onAlertDayChange }: FloodLayersSectionProps) {
  const snapshot = data.riverAlerts;
  // El detalle por periodo de retorno se ve al hacer clic en un río (panel del río).
  const dayAlerts = (snapshot?.alerts ?? []).filter((alert) => alertLevelForDay(alert, alertDayIndex) > 0).length;
  const selectedDay = snapshot?.days[alertDayIndex];

  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
      <div className="flex items-center gap-3">
        <IconTile className="bg-blue-50 text-blue-600">
          <WavesIcon className="size-5" />
        </IconTile>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-slate-900">Red de ríos (GEOGLOWS)</h4>
          <p className="text-xs text-slate-500">Haz clic en un río para ver su caudal</p>
        </div>
        <Toggle
          checked={layers.riverNetwork}
          onChange={(enabled) => onToggleLayer("riverNetwork", enabled)}
          label="Mostrar red de ríos"
        />
      </div>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-slate-900">Alertas por caudal alto</h4>
            <p className="text-xs text-slate-500">
              {snapshot
                ? `${dayAlerts} tramos el ${selectedDay ? formatCalendarDate(selectedDay) : "—"} · de ${snapshot.totalReaches.toLocaleString("es-EC")}`
                : "Sin datos"}
            </p>
          </div>
          <Toggle
            checked={layers.riverAlerts}
            onChange={(enabled) => onToggleLayer("riverAlerts", enabled)}
            label="Mostrar alertas por caudal"
          />
        </div>

        {!snapshot ? (
          <Notice>No se pudieron cargar las alertas de GEOGLOWS.</Notice>
        ) : (
          layers.riverAlerts && (
            <>
              <label className="mt-3 block">
                <span className="flex items-center justify-between text-[11px] font-medium text-slate-600">
                  <span>Pronóstico para</span>
                  <span className="font-semibold text-slate-900">
                    {selectedDay ? formatCalendarDate(selectedDay) : "—"} · día {alertDayIndex + 1} de {snapshot.days.length}
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(snapshot.days.length - 1, 0)}
                  value={alertDayIndex}
                  onChange={(event) => onAlertDayChange(Number(event.target.value))}
                  aria-label="Día del pronóstico de caudales"
                  className="mt-1.5 w-full cursor-pointer accent-blue-600"
                />
              </label>
              <p className="mt-2 text-[11px] text-slate-500">
                Pronóstico del {formatCalendarDate(snapshot.forecastDate)} · {snapshot.source}
              </p>
            </>
          )
        )}
      </div>
    </div>
  );
}
