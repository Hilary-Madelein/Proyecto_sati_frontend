import { IconTile } from "@/components/ui/IconTile";
import { AlertTriangleIcon, WavesIcon } from "@/components/ui/icons";
import { Toggle } from "@/components/ui/Toggle";
import { cn } from "@/lib/cn";
import { formatCalendarDate, formatDateTime } from "@/lib/format";
import { FLOOD_HUB_FLAGGED_ORDER, FLOOD_HUB_SEVERITIES } from "../../constants";
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

/** Pronóstico de inundaciones del INAMHI: red de ríos y alertas por caudal (GEOGLOWS). */
export function RiversSection(props: FloodLayersSectionProps) {
  return (
    <section>
      <SectionHeading>Pronóstico de inundaciones</SectionHeading>
      <RiversCard {...props} />
    </section>
  );
}

/** Pronóstico de Google Flood Hub: nivel de inundación previsto en cada punto de los ríos. */
export function FloodHubSection({ data, layers, onToggleLayer }: Pick<FloodLayersSectionProps, "data" | "layers" | "onToggleLayer">) {
  const snapshot = data.floodHub;
  const bySeverity = countBy(snapshot?.gauges ?? [], (gauge) => gauge.severity);
  const meta = snapshot
    ? `${snapshot.flaggedCount} ${snapshot.flaggedCount === 1 ? "punto" : "puntos"} con aviso de ${snapshot.gauges.length.toLocaleString("es-EC")}`
    : "Sin conexión con Flood Hub";

  return (
    <section>
      <SectionHeading>Google Flood Hub</SectionHeading>
      <LayerCard
        title="Pronóstico de Flood Hub"
        meta={meta}
        icon={
          <IconTile className="bg-blue-50 text-blue-600">
            <WavesIcon className="size-5" />
          </IconTile>
        }
        enabled={layers.floodHub}
        onToggle={(enabled) => onToggleLayer("floodHub", enabled)}
      >
        {FLOOD_HUB_FLAGGED_ORDER.map((severity) => (
          <LegendItem
            key={severity}
            shape="square"
            label={FLOOD_HUB_SEVERITIES[severity].label}
            color={FLOOD_HUB_SEVERITIES[severity].color}
            borderColor="#ffffff"
            count={bySeverity(severity)}
          />
        ))}
        <li className="col-span-2 text-[11px] text-slate-500">
          Puntos de los ríos donde el modelo de Google prevé un nivel sobre lo normal en los próximos días; los demás no se
          muestran.
          {snapshot?.issuedAt && ` Emitido el ${formatDateTime(snapshot.issuedAt)}.`} {snapshot?.attribution}
          {snapshot?.isStale && " La fuente no responde: se muestra la última descarga."}
        </li>
      </LayerCard>
    </section>
  );
}

function RiversCard({ data, layers, onToggleLayer, alertDayIndex, onAlertDayChange }: FloodLayersSectionProps) {
  const snapshot = data.riverAlerts;
  const dayAlerts = (snapshot?.alerts ?? []).filter((alert) => alertLevelForDay(alert, alertDayIndex) > 0).length;
  const selectedDay = snapshot?.days[alertDayIndex];
  const anyVisible = layers.riverNetwork || layers.riverAlerts;
  const titleClass = (visible: boolean) => cn("text-sm font-semibold", visible ? "text-slate-900" : "text-slate-500");

  return (
    <div
      className={cn(
        "rounded-xl p-3 ring-1 transition-colors",
        anyVisible ? "bg-white ring-slate-200" : "bg-slate-50/70 ring-slate-200/70",
      )}
    >
      <div className="flex items-center gap-3">
        <IconTile className="bg-blue-50 text-blue-600">
          <WavesIcon className="size-5" />
        </IconTile>
        <div className="min-w-0 flex-1">
          <h4 className={titleClass(layers.riverNetwork)}>Red de ríos</h4>
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
          {/* Triángulo: es la misma forma con que se marcan estas alertas en el mapa. */}
          <IconTile className="bg-amber-50 text-amber-600">
            <AlertTriangleIcon className="size-5" />
          </IconTile>
          <div className="min-w-0 flex-1">
            <h4 className={titleClass(layers.riverAlerts)}>Alertas por caudal alto</h4>
            {/* Tramo = pedazo de río entre dos confluencias; GEOGLOWS calcula el caudal de cada uno. */}
            <p className="text-xs text-slate-500">
              {snapshot
                ? `${dayAlerts.toLocaleString("es-EC")} de ${snapshot.totalReaches.toLocaleString("es-EC")} tramos en alerta el ${selectedDay ? formatCalendarDate(selectedDay) : "—"}`
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
