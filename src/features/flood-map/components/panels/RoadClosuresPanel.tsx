"use client";

import { useState, type ReactNode } from "react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { AlertTriangleIcon, ClockIcon, MapPinIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatDateTime, formatTimeAgo } from "@/lib/format";
import { placeName } from "../../action-timeline";
import { normalizeName } from "../../parish-filters";
import {
  CLOSURE_PERIODS,
  closuresInScope,
  conditionOf,
  DEFAULT_CLOSURE_FILTERS,
  filterClosures,
  reopeningAt,
  ROAD_CONDITIONS,
  updatedAt,
  type ClosureFilters,
  type RoadCondition,
} from "../../road-closures";
import type { RiskFeature, RiskLayerData } from "../../types";
import { FilterSelect } from "./CriticalEventsPanel";
import { Notice } from "./RainForecastSection";

interface RoadClosuresPanelProps {
  data: RiskLayerData | null;
  error: string | null;
  isLoading: boolean;
  filters: ClosureFilters;
  onFiltersChange: (filters: ClosureFilters) => void;
  /** Hora de referencia para el periodo y "hace X h". */
  now: number;
  selectedKey: string | null;
  /** Muestra el reporte en el mapa con su ficha completa. */
  onSelect: (feature: RiskFeature) => void;
}

/** Reportes que se muestran al inicio y cuántos más con cada "Ver más". */
const PAGE = 10;

/**
 * Seguimiento de los cierres viales: cuántos reportes hay en cada condición de
 * la vía (que también filtran), periodo y provincia, y la lista del más grave
 * y reciente al menos grave. Lo mismo se dibuja en el mapa.
 */
export function RoadClosuresPanel({ data, error, isLoading, filters, onFiltersChange, now, selectedKey, onSelect }: RoadClosuresPanelProps) {
  const [visible, setVisible] = useState(PAGE);
  const features = data?.features ?? [];
  const inScope = closuresInScope(features, filters, now);
  const listed = filterClosures(features, filters, now);
  const provinces = [...new Set(features.map((feature) => String(feature.properties.despro ?? "")).filter(Boolean))].sort((a, b) =>
    normalizeName(a).localeCompare(normalizeName(b)),
  );
  const countOf = (label: RoadCondition) => inScope.filter((feature) => conditionOf(feature)?.label === label).length;
  const isDefault =
    filters.period === DEFAULT_CLOSURE_FILTERS.period &&
    !filters.province &&
    filters.conditions.length === DEFAULT_CLOSURE_FILTERS.conditions.length;

  const update = (changes: Partial<ClosureFilters>) => {
    onFiltersChange({ ...filters, ...changes });
    setVisible(PAGE);
  };
  const toggleCondition = (label: RoadCondition) =>
    update({
      conditions: filters.conditions.includes(label) ? filters.conditions.filter((item) => item !== label) : [...filters.conditions, label],
    });

  if (!data) {
    if (error) return <Notice>{error}</Notice>;
    return <p className="py-6 text-center text-sm text-slate-500">{isLoading ? "Cargando reportes…" : "Sin datos."}</p>;
  }

  const counts = ROAD_CONDITIONS.map((condition) => ({ ...condition, count: countOf(condition.label) }));
  const total = counts.reduce((sum, item) => sum + item.count, 0);
  const fullClosures = counts[0].count;
  const overdue = inScope.filter((feature) => isOverdue(feature, now)).length;

  return (
    <div className="space-y-4">
      {error && <Notice>{error}</Notice>}
      <p className="text-[11px] leading-relaxed text-slate-500">
        Novedades en la red vial reportadas por las direcciones distritales del MIT: cierres y pasos restringidos, con sus acciones.
      </p>

      {/* Resumen del periodo: lo que más importa para el seguimiento, y cómo se reparten por condición. */}
      <section aria-label="Resumen" className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
        <dl className="grid grid-cols-3 divide-x divide-slate-200 text-center">
          <SummaryFigure value={fullClosures} label={fullClosures === 1 ? "cierre total" : "cierres totales"} tone={fullClosures > 0 ? "text-red-600" : "text-slate-900"} />
          <SummaryFigure value={total - fullClosures} label="con restricción" tone={total - fullClosures > 0 ? "text-orange-600" : "text-slate-900"} />
          <SummaryFigure value={overdue} label={overdue === 1 ? "plazo vencido" : "plazos vencidos"} tone={overdue > 0 ? "text-red-700" : "text-slate-900"} />
        </dl>
        <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
          {counts
            .filter((item) => item.count > 0)
            .map((item) => (
              <span key={item.label} className="h-full first:rounded-l-full last:rounded-r-full" style={{ flexGrow: item.count, backgroundColor: item.color }} />
            ))}
        </div>
      </section>

      <div className="space-y-2">
        <h3 className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Actualizados en</h3>
        <SegmentedControl
          name="closure-period"
          label="Mostrar reportes actualizados en"
          value={filters.period}
          options={CLOSURE_PERIODS}
          onChange={(period) => update({ period })}
        />
      </div>

      <div className="space-y-2">
        <h3 className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Condición de la vía</h3>
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200" aria-label="Mostrar u ocultar por condición de la vía">
          {counts.map((item) => {
            const active = filters.conditions.includes(item.label);
            return (
              <li key={item.label}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleCondition(item.label)}
                  title={`${active ? "Ocultar" : "Mostrar"}: ${item.label.toLowerCase()}`}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600"
                >
                  <span
                    aria-hidden="true"
                    className={cn("size-2.5 shrink-0 rounded-full", !active && "ring-1 ring-slate-300")}
                    style={active ? { backgroundColor: item.color } : undefined}
                  />
                  <span className={cn("min-w-0 flex-1 font-medium", active ? "text-slate-700" : "text-slate-400 line-through")}>{item.label}</span>
                  <span className={cn("font-semibold tabular-nums", active ? "text-slate-900" : "text-slate-400")}>{item.count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {provinces.length > 1 && (
        <FilterSelect label="Provincia" value={filters.province} onChange={(province) => update({ province })}>
          <option value="">Todas las provincias</option>
          {provinces.map((province) => (
            <option key={province} value={province}>
              {placeName(province)}
            </option>
          ))}
        </FilterSelect>
      )}

      {features.length === 0 ? (
        <EmptyState title="Sin novedades viales">
          Cuando una dirección distrital del MIT reporte un cierre o un paso restringido, aparecerá aquí y en el mapa.
        </EmptyState>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500" aria-live="polite">
            <span>
              <strong className="font-semibold text-slate-700">{listed.length}</strong> de {features.length}{" "}
              {features.length === 1 ? "reporte" : "reportes"} · más graves y recientes primero
            </span>
            {!isDefault && (
              <button
                type="button"
                onClick={() => update(DEFAULT_CLOSURE_FILTERS)}
                className="font-semibold text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                Restablecer
              </button>
            )}
          </div>
          {listed.length === 0 ? (
            <EmptyState title="Sin resultados">Ningún reporte coincide con los filtros.</EmptyState>
          ) : (
            <>
              <ul className="space-y-2">
                {listed.slice(0, visible).map((feature, index) => {
                  const key = `${data.id}:${feature.id ?? index}`;
                  return (
                    <li key={key}>
                      <ClosureItem feature={feature} now={now} selected={key === selectedKey} onSelect={() => onSelect(feature)} />
                    </li>
                  );
                })}
              </ul>
              {listed.length > visible && (
                <button
                  type="button"
                  onClick={() => setVisible((value) => value + PAGE)}
                  className="w-full rounded-lg py-2 text-xs font-semibold text-blue-700 ring-1 ring-slate-200 transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  Ver {Math.min(PAGE, listed.length - visible)} más · quedan {listed.length - visible}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryFigure({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className="px-1">
      <dd className={cn("text-2xl leading-none font-bold tabular-nums", tone)}>{value}</dd>
      <dt className="mt-1 text-[10px] leading-tight text-slate-500">{label}</dt>
    </div>
  );
}

function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 px-6 py-6 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-orange-50 text-orange-600 ring-1 ring-orange-100">
        <AlertTriangleIcon className="size-5" />
      </span>
      <p className="mt-2 text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{children}</p>
    </div>
  );
}

/** Plazo vencido: la hora estimada de habilitación ya pasó y el reporte no dice que esté habilitada. */
function isOverdue(feature: RiskFeature, now: number): boolean {
  const reopening = reopeningAt(feature);
  return reopening !== null && reopening < now && !conditionOf(feature)?.label.startsWith("Habilitado");
}

function ClosureItem({ feature, now, selected, onSelect }: { feature: RiskFeature; now: number; selected: boolean; onSelect: () => void }) {
  const p = feature.properties;
  const condition = conditionOf(feature);
  const color = condition?.color ?? "#64748b";
  const updated = updatedAt(feature);
  const reopening = reopeningAt(feature);
  const overdue = isOverdue(feature, now);
  const road = p.Via_RVE ? String(p.Via_RVE) : null;
  const cause = String(p.Causa ?? "").trim() || "Novedad vial";
  const place = [p.descanto, p.despro].filter(Boolean).map((name) => placeName(String(name))).join(", ");

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "relative w-full overflow-hidden rounded-xl py-2.5 pr-3 pl-4 text-left ring-1 transition focus-visible:outline-2 focus-visible:outline-blue-600",
        selected ? "bg-blue-50 ring-blue-300" : "bg-white ring-slate-200 hover:bg-slate-50 hover:shadow-sm",
      )}
    >
      {/* Franja del color de la condición, como el punto en el mapa. */}
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: color }} />
      <span className="flex flex-wrap items-center gap-1.5">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase"
          style={{ color, backgroundColor: `${color}14`, boxShadow: `inset 0 0 0 1px ${color}33` }}
        >
          {condition?.label ?? "Sin condición"}
        </span>
        {overdue && (
          <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">Plazo vencido</span>
        )}
      </span>
      <span className="mt-1.5 flex items-start gap-1.5">
        {road && (
          <span className="mt-0.5 shrink-0 rounded border border-slate-500 bg-white px-1 text-[11px] leading-4 font-bold text-slate-800">{road}</span>
        )}
        <span className="min-w-0 text-sm leading-snug font-semibold text-slate-900">
          {cause}
          {p.nombre_via ? <span className="block text-xs font-normal text-slate-600">{String(p.nombre_via)}</span> : null}
        </span>
      </span>
      <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        {place && (
          <span className="flex items-center gap-1">
            <MapPinIcon className="size-3 shrink-0" />
            {place}
          </span>
        )}
        {updated !== null && (
          <span className="flex items-center gap-1" title={`Actualizado el ${formatDateTime(new Date(updated).toISOString())}`}>
            <ClockIcon className="size-3 shrink-0" />
            Actualizado {formatTimeAgo(new Date(updated).toISOString(), now)}
          </span>
        )}
      </span>
      {reopening !== null && (
        <span
          className={cn(
            "mt-2 flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-[11px]",
            overdue ? "bg-red-50 font-semibold text-red-700" : "bg-slate-50 text-slate-600",
          )}
        >
          <span>Habilitación estimada</span>
          <span className="font-semibold tabular-nums">{formatDateTime(new Date(reopening).toISOString())}</span>
        </span>
      )}
    </button>
  );
}
