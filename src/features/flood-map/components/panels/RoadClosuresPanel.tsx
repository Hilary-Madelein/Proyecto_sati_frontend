"use client";

import { useState, type ReactNode } from "react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { AlertTriangleIcon, ClockIcon, MapPinIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatDateTime, formatTimeAgo } from "@/lib/format";
import { placeName } from "../../action-timeline";
import { normalizeName } from "../../parish-filters";
import {
  CLOSED_EVENT_STYLE,
  CLOSURE_VIEWS,
  closuresInScope,
  conditionOf,
  DEFAULT_CLOSURE_FILTERS,
  closureActionOf,
  editedAt,
  filterClosures,
  isClosed,
  openAttentionOf,
  reopeningAt,
  reportedAt,
  ROAD_CONDITIONS,
  type ClosureFilters,
  type RoadCondition,
} from "../../road-closures";
import { placeOf, textOf } from "../../risk-popup";
import type { RiskFeature, RiskLayerData } from "../../types";
import { FilterSelect } from "./CriticalEventsPanel";
import { Notice } from "./RainForecastSection";

interface RoadClosuresPanelProps {
  data: RiskLayerData | null;
  error: string | null;
  isLoading: boolean;
  filters: ClosureFilters;
  onFiltersChange: (filters: ClosureFilters) => void;
  /** Hora de referencia para "hace X días". */
  now: number;
  selectedKey: string | null;
  /** Muestra el reporte en el mapa con su ficha completa. */
  onSelect: (feature: RiskFeature) => void;
}

/** Reportes que se muestran al inicio y cuántos más con cada "Ver más". */
const PAGE = 10;

/**
 * Seguimiento de los cierres viales: los abiertos (o todos, con los ya cerrados),
 * cuántos hay en cada condición de la vía (que también filtran) y provincia, y la
 * lista del más grave y reciente al menos grave, sin importar su fecha. Lo mismo se
 * dibuja en el mapa.
 */
export function RoadClosuresPanel({ data, error, isLoading, filters, onFiltersChange, now, selectedKey, onSelect }: RoadClosuresPanelProps) {
  const [visible, setVisible] = useState(PAGE);
  const features = data?.features ?? [];
  const inScope = closuresInScope(features, filters);
  const listed = filterClosures(features, filters);
  const open = inScope.filter((feature) => !isClosed(feature));
  const closed = inScope.length - open.length;
  // Cuántos hay en cada vista, para decirlo en sus botones.
  const viewCount = (view: ClosureFilters["view"]) => closuresInScope(features, { view, province: filters.province }).length;
  const provinces = [...new Set(features.map((feature) => String(feature.properties.despro ?? "")).filter(Boolean))].sort((a, b) =>
    normalizeName(a).localeCompare(normalizeName(b)),
  );
  const countOf = (label: RoadCondition) => open.filter((feature) => conditionOf(feature)?.label === label).length;
  const isDefault =
    filters.view === DEFAULT_CLOSURE_FILTERS.view &&
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
  const total = inScope.length;
  const fullClosures = counts[0].count;
  // Abiertos sin condición (el formulario no la exige): se cuentan aparte para que las cifras sumen el total.
  const withoutCondition = open.length - counts.reduce((sum, item) => sum + item.count, 0);
  const isAll = filters.view === "all";
  // Estado de atención de los abiertos: los sin responder se dicen, porque son los que falta actualizar.
  const attentionCount = (state: string | null) => open.filter((feature) => openAttentionOf(feature) === state).length;
  const attention = [
    [attentionCount("Trabajos en ejecución"), "en ejecución"],
    [attentionCount("Habilitado parcialmente"), "parcialmente habilitados"],
    [attentionCount(null), "sin estado de atención"],
  ].flatMap(([count, label]) => (count ? [`${count} ${label}`] : []));

  return (
    <div className="space-y-4">
      {error && <Notice>{error}</Notice>}
      <p className="text-[11px] leading-relaxed text-slate-500">
        {isAll
          ? "Todos los reportes de novedad vial del MIT, también los eventos ya atendidos y cerrados."
          : "Vías con novedad reportada por el MIT."}
      </p>

      {/* Resumen: lo que más importa para el seguimiento, y cómo se reparten por condición. */}
      <section aria-label="Resumen" className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
        <dl className={cn("grid divide-x divide-slate-200 text-center", isAll ? "grid-cols-3" : "grid-cols-2")}>
          {isAll && <SummaryFigure value={total} label={total === 1 ? "reporte" : "reportes"} tone="text-slate-900" />}
          <SummaryFigure value={open.length} label={open.length === 1 ? "abierto" : "abiertos"} tone="text-slate-900" />
          {isAll ? (
            <SummaryFigure value={closed} label={closed === 1 ? "cerrado" : "cerrados"} tone={closed > 0 ? "text-teal-700" : "text-slate-900"} />
          ) : (
            <SummaryFigure value={fullClosures} label={fullClosures === 1 ? "cierre total" : "cierres totales"} tone={fullClosures > 0 ? "text-red-600" : "text-slate-900"} />
          )}
        </dl>
        <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
          {counts
            .filter((item) => item.count > 0)
            .map((item) => (
              <span key={item.label} className="h-full first:rounded-l-full last:rounded-r-full" style={{ flexGrow: item.count, backgroundColor: item.color }} />
            ))}
          {withoutCondition > 0 && <span className="h-full bg-slate-400 first:rounded-l-full last:rounded-r-full" style={{ flexGrow: withoutCondition }} />}
          {isAll && closed > 0 && <span className="h-full first:rounded-l-full last:rounded-r-full" style={{ flexGrow: closed, backgroundColor: CLOSED_EVENT_STYLE.color }} />}
        </div>
        {attention.length > 0 && <p className="mt-2 text-center text-[11px] leading-snug text-slate-500">{attention.join(" · ")}</p>}
      </section>

      <SegmentedControl
        name="closure-view"
        label="Qué reportes mostrar"
        value={filters.view}
        options={CLOSURE_VIEWS.map(({ value, label }) => ({ value, label: `${label} · ${viewCount(value)}` }))}
        onChange={(view) => update({ view })}
      />

      <div className="space-y-2">
        <h3 className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Condición de la vía{isAll && " · abiertos"}</h3>
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
          {withoutCondition > 0 && (
            <li className="flex items-center gap-2.5 px-3 py-2 text-xs">
              <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-slate-400" />
              <span className="min-w-0 flex-1 font-medium text-slate-500">Sin condición</span>
              <span className="font-semibold text-slate-900 tabular-nums">{withoutCondition}</span>
            </li>
          )}
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
              <strong className="font-semibold text-slate-700">{listed.length}</strong> de {total} {total === 1 ? "reporte" : "reportes"} ·{" "}
              {isAll ? "abiertos primero, al final los cerrados" : "más graves y recientes primero"}
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
          {total === 0 && !isAll && !filters.province ? (
            <EmptyState title="Sin cierres abiertos">Todos los reportes están atendidos: se pueden ver en «Todos».</EmptyState>
          ) : listed.length === 0 ? (
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

function ClosureItem({ feature, now, selected, onSelect }: { feature: RiskFeature; now: number; selected: boolean; onSelect: () => void }) {
  const eventClosed = isClosed(feature);
  const condition = conditionOf(feature);
  const color = eventClosed ? CLOSED_EVENT_STYLE.color : (condition?.color ?? "#64748b");
  const label = eventClosed ? CLOSED_EVENT_STYLE.label : (condition?.label ?? "Sin condición");
  const attention = openAttentionOf(feature);
  const action = closureActionOf(feature);
  const reported = reportedAt(feature);
  const edited = editedAt(feature);
  const reopening = reopeningAt(feature);
  const road = textOf(feature, "Via_RVE");
  const section = textOf(feature, "nombre_via");
  const sector = textOf(feature, "detalles_ubi");
  const cause = textOf(feature, "Causa");
  const place = placeOf(feature);
  const zonal = textOf(feature, "zonal");
  // Se titula por su tramo; sin tramo (suele pasar fuera de la RVE), por su ubicación o su causa.
  const title = section ?? sector ?? cause ?? "Novedad vial";

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
          {label}
        </span>
        {attention && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{attention}</span>}
        {cause && title !== cause && <span className="text-[11px] font-medium text-slate-600">{cause}</span>}
      </span>
      {/* La vía primero: su código en la Red Vial Estatal y su tramo. */}
      <span className="mt-1.5 flex items-start gap-1.5">
        {road && (
          <span className="mt-0.5 shrink-0 rounded border border-slate-500 bg-white px-1 text-[11px] leading-4 font-bold text-slate-800">{road}</span>
        )}
        <span className="min-w-0 text-sm leading-snug font-semibold text-slate-900 max-lg:text-[13px]">
          {title}
          {sector && title !== sector && <span className="block text-xs font-normal text-slate-600">{sector}</span>}
        </span>
      </span>
      {action && (
        <span className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-slate-600">
          <strong className="font-semibold text-slate-700">{action.label}:</strong> {action.text}
        </span>
      )}
      <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        {(place || zonal) && (
          <span className="flex items-center gap-1">
            <MapPinIcon className="size-3 shrink-0" />
            {[place, zonal && placeName(zonal)].filter(Boolean).join(" · ")}
          </span>
        )}
        {reported !== null && (
          <span className="flex items-center gap-1" title={`Reportado el ${formatDateTime(new Date(reported).toISOString())}`}>
            <ClockIcon className="size-3 shrink-0" />
            Reportado {formatTimeAgo(new Date(reported).toISOString(), now)}
          </span>
        )}
        {edited !== null && (
          <span title={`Última edición: ${formatDateTime(new Date(edited).toISOString())}`}>Actualizado {formatTimeAgo(new Date(edited).toISOString(), now)}</span>
        )}
      </span>
      {reopening !== null && !eventClosed && (
        <span className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
          <span>Habilitación estimada</span>
          <span className="font-semibold tabular-nums">{formatDateTime(new Date(reopening).toISOString())}</span>
        </span>
      )}
    </button>
  );
}
