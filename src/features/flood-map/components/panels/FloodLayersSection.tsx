import { IconTile } from "@/components/ui/IconTile";
import { AlertTriangleIcon, MountainIcon, WavesIcon } from "@/components/ui/icons";
import { Toggle } from "@/components/ui/Toggle";
import { OpacitySlider } from "./OpacitySlider";
import { cn } from "@/lib/cn";
import { formatCalendarDate, formatDateTime } from "@/lib/format";
import { FLASH_FLOOD_LIKELIHOODS, FLASH_FLOOD_MODEL, WATERSHED_SLOPES } from "../../constants";
import type { FlashFloodLikelihood, FloodLayerId, FloodMapData, LayerVisibility, WatershedSlope } from "../../types";
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
  opacityOf: (id: "river-network" | "river-alerts") => number;
  onOpacityChange: (id: "river-network" | "river-alerts", opacity: number) => void;
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
      <div className="space-y-3">
        <RiversCard {...props} />
        <WatershedsCard layers={props.layers} onToggleLayer={props.onToggleLayer} />
      </div>
    </section>
  );
}

/** Cuencas hidrográficas por vertiente: solo de referencia, apagada por defecto. */
function WatershedsCard({ layers, onToggleLayer }: Pick<FloodLayersSectionProps, "layers" | "onToggleLayer">) {
  return (
    <LayerCard
      title="Cuencas hidrográficas"
      meta="Hacia dónde drena el agua: Pacífico o Atlántico"
      icon={
        <IconTile className="bg-sky-50 text-sky-600">
          <MountainIcon className="size-5" />
        </IconTile>
      }
      enabled={layers.watersheds}
      onToggle={(enabled) => onToggleLayer("watersheds", enabled)}
    >
      {(Object.keys(WATERSHED_SLOPES) as WatershedSlope[]).map((slope) => (
        <LegendItem
          key={slope}
          shape="square"
          label={WATERSHED_SLOPES[slope].short}
          color={WATERSHED_SLOPES[slope].fill}
          borderColor={WATERSHED_SLOPES[slope].stroke}
        />
      ))}
      <li className="col-span-2 text-[11px] text-slate-500">
        Unidades hidrográficas Pfafstetter de nivel 3 (MAE). La cuenca de cada río o estación se ve en su ventana de detalle.
      </li>
    </LayerCard>
  );
}

/** Google Flood Hub: zonas donde una crecida repentina es probable o muy probable. */
export function FloodHubSection({
  data,
  layers,
  onToggleLayer,
  opacity,
  onOpacityChange,
}: Pick<FloodLayersSectionProps, "data" | "layers" | "onToggleLayer"> & { opacity: number; onOpacityChange: (opacity: number) => void }) {
  const snapshot = data.floodHub;
  const flashFloods = snapshot?.flashFloods ?? null;
  const byLikelihood = countBy(flashFloods ?? [], (area) => area.likelihood);
  const issuedAt = flashFloods?.[0]?.issuedAt;
  const meta = !flashFloods
    ? "No disponible"
    : flashFloods.length === 0
      ? "Sin zonas en riesgo"
      : `${flashFloods.length} ${flashFloods.length === 1 ? "zona" : "zonas"} en riesgo`;

  return (
    <section>
      <SectionHeading>Google Flood Hub</SectionHeading>
      <LayerCard
        title="Crecidas repentinas urbanas"
        meta={meta}
        icon={
          <IconTile className="bg-red-50 text-red-600">
            <AlertTriangleIcon className="size-5" />
          </IconTile>
        }
        enabled={layers.flashFloods}
        onToggle={(enabled) => onToggleLayer("flashFloods", enabled)}
      >
        {(Object.keys(FLASH_FLOOD_LIKELIHOODS) as FlashFloodLikelihood[]).map((likelihood) => (
          <LegendItem
            key={likelihood}
            shape="square"
            label={FLASH_FLOOD_LIKELIHOODS[likelihood].label}
            color={FLASH_FLOOD_LIKELIHOODS[likelihood].color}
            borderColor="#ffffff"
            count={byLikelihood(likelihood)}
          />
        ))}
        <li className="col-span-2 text-[11px] text-slate-500">
          Zonas urbanas donde el modelo de IA de Google estima probable una crecida repentina por eventos meteorológicos en
          las próximas 24 h, en celdas de unos 20 km. Usa datos de {FLASH_FLOOD_MODEL.inputs}.
          {issuedAt && ` Emitido el ${formatDateTime(issuedAt)}.`} {snapshot?.attribution}
          {snapshot?.isStale && " La fuente no responde: se muestra la última descarga."}
        </li>
        <li className="col-span-2">
          <OpacitySlider value={opacity} onChange={onOpacityChange} layerName="las crecidas repentinas" />
        </li>
      </LayerCard>
    </section>
  );
}

function RiversCard({ data, layers, onToggleLayer, alertDayIndex, onAlertDayChange, opacityOf, onOpacityChange }: FloodLayersSectionProps) {
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
      {layers.riverNetwork && (
        <div className="mt-2">
          <OpacitySlider value={opacityOf("river-network")} onChange={(value) => onOpacityChange("river-network", value)} layerName="la red de ríos" />
        </div>
      )}

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
        {layers.riverAlerts && snapshot && (
          <div className="mt-2">
            <OpacitySlider value={opacityOf("river-alerts")} onChange={(value) => onOpacityChange("river-alerts", value)} layerName="las alertas por caudal" />
          </div>
        )}

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
                  autoComplete="off"
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
