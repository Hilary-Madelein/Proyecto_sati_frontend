import { IconTile } from "@/components/ui/IconTile";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Toggle } from "@/components/ui/Toggle";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { PLANNED_LAYERS } from "../../constants";
import type { RiskLayerState } from "../../hooks/useRiskLayers";
import { RISK_LAYER_STYLES, RISK_PERIOD_OPTIONS, riskClassOf, riskPeriodLabel, type RiskLayerStyle, type RiskPeriodDays } from "../../risk-layers";
import type { RiskComponentId, RiskFeature } from "../../types";
import { LegendItem } from "./LegendItem";
import { PLANNED_LAYER_ICONS, PlannedLayerList } from "./PlannedLayers";
import { Notice } from "./RainForecastSection";
import { SectionHeading } from "./SectionHeading";

interface RiskLayersSectionProps {
  component: RiskComponentId;
  enabled: ReadonlySet<string>;
  onToggle: (id: string, enabled: boolean) => void;
  /** Estado de la capa con sus datos ya filtrados (su parte y su periodo). */
  stateOf: (layer: RiskLayerStyle) => RiskLayerState;
  /** Periodo de las capas con fecha (días; null = todos). */
  periodOf: (layer: RiskLayerStyle) => RiskPeriodDays;
  onPeriodChange: (id: string, days: RiskPeriodDays) => void;
}

/**
 * Capas de la pestaña (amenaza, exposición, preparación o respuesta) agrupadas
 * por sección, y al final las previstas que aún no tienen datos.
 */
export function RiskLayersSection({ component, enabled, onToggle, stateOf, periodOf, onPeriodChange }: RiskLayersSectionProps) {
  const layers = RISK_LAYER_STYLES.filter((layer) => layer.component === component);
  const sections = [...new Set(layers.map((layer) => layer.section))];
  const planned = PLANNED_LAYERS[component];

  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <section key={section}>
          <SectionHeading>{section}</SectionHeading>
          <ul className="space-y-2">
            {layers
              .filter((layer) => layer.section === section)
              .map((layer) => (
                <RiskLayerRow
                  key={layer.id}
                  layer={layer}
                  visible={enabled.has(layer.id)}
                  onVisibleChange={(value) => onToggle(layer.id, value)}
                  state={stateOf(layer)}
                  period={periodOf(layer)}
                  onPeriodChange={(days) => onPeriodChange(layer.id, days)}
                />
              ))}
          </ul>
        </section>
      ))}
      {planned.length > 0 && (
        <section>
          <SectionHeading>Próximamente</SectionHeading>
          <PlannedLayerList layers={planned} />
        </section>
      )}
    </div>
  );
}

function RiskLayerRow({
  layer,
  visible,
  onVisibleChange,
  state,
  period,
  onPeriodChange,
}: {
  layer: RiskLayerStyle;
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  state: RiskLayerState;
  period: RiskPeriodDays;
  onPeriodChange: (days: RiskPeriodDays) => void;
}) {
  const Icon = PLANNED_LAYER_ICONS[layer.icon];
  const { data, error, isLoading } = state;
  const meta =
    visible && isLoading && !data
      ? "Cargando…"
      : data
        ? `${countLabel(layer, data.features.length)}${layer.period ? ` · ${periodLabel(period)}` : ""}`
        : layer.description;

  return (
    <li className={cn("rounded-xl p-3 ring-1 transition-colors", visible ? "bg-white ring-slate-200" : "bg-slate-50/70 ring-slate-200/70")}>
      <div className="flex items-center gap-3">
        <IconTile className="bg-slate-100">
          {/* El color del ícono es el de la capa en el mapa. */}
          <span style={{ color: layer.color }}>
            <Icon className="size-5" />
          </span>
        </IconTile>
        <div className="min-w-0 flex-1">
          <h4 className={cn("text-sm font-semibold", visible ? "text-slate-900" : "text-slate-500")}>{layer.title}</h4>
          <p className="text-xs text-slate-500">{meta}</p>
        </div>
        {visible && isLoading && (
          <span aria-hidden="true" className="size-4 shrink-0 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        )}
        <Toggle checked={visible} onChange={onVisibleChange} label={`Mostrar ${layer.title.toLowerCase()}`} />
      </div>

      {visible && (error || data) && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {error && <Notice>{error}</Notice>}
          {layer.period && (
            <SegmentedControl
              name={`${layer.id}-period`}
              label="Periodo"
              value={String(period ?? "all")}
              options={RISK_PERIOD_OPTIONS.map((days) => ({
                value: String(days ?? "all"),
                label: riskPeriodLabel(days),
              }))}
              onChange={(value) => onPeriodChange(value === "all" ? null : (Number(value) as RiskPeriodDays))}
            />
          )}
          {data && layer.classify && (
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
              {legendOf(layer, data.features).map((item) => (
                <LegendItem
                  key={item.label}
                  label={item.label}
                  color={item.color}
                  borderColor={item.color}
                  shape={legendShape(layer)}
                  count={item.count}
                  dashed={item.dashed}
                />
              ))}
            </ul>
          )}
          {data && (
            <p className="text-[11px] text-slate-500">
              {layer.description} Fuente: {data.attribution}
              {data.sourceUpdatedAt && ` · actualizada el ${formatDateTime(data.sourceUpdatedAt)}`}.
              {data.omitted > 0 && ` ${data.omitted} sin ubicación válida no se muestran.`}
              {data.isStale && " El servicio no responde: se muestra la última descarga."}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function countLabel(layer: RiskLayerStyle, count: number): string {
  const unit = layer.geometry === "point" ? (count === 1 ? "punto" : "puntos") : layer.geometry === "line" ? (count === 1 ? "tramo" : "tramos") : count === 1 ? "zona" : "zonas";
  return `${count.toLocaleString("es-EC")} ${unit}`;
}

function periodLabel(days: RiskPeriodDays): string {
  return days ? `últimos ${riskPeriodLabel(days)}` : "todos";
}

function legendShape(layer: RiskLayerStyle): "circle" | "square" {
  return layer.geometry === "point" ? "circle" : "square";
}

/** Clases de la leyenda con cuántas entidades caen en cada una; "otro" solo si hay alguna. */
function legendOf(layer: RiskLayerStyle, features: readonly RiskFeature[]) {
  const counts = new Map<string, number>();
  let other = 0;
  for (const feature of features) {
    const match = riskClassOf(layer, feature);
    if (match) counts.set(match.label, (counts.get(match.label) ?? 0) + 1);
    else other++;
  }
  const items = (layer.classify?.classes ?? []).map((item) => ({
    label: item.label,
    color: item.color,
    count: counts.get(item.label) ?? 0,
    dashed: item.dashed,
  }));
  if (other > 0) items.push({ label: layer.classify?.otherLabel ?? "Otro", color: layer.color, count: other, dashed: undefined });
  return items;
}
