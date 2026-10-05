"use client";

import { useState, type ReactNode } from "react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { AlertTriangleIcon, ChevronDownIcon, ClockIcon, MapPinIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import {
  DEFAULT_EVENT_FILTERS,
  EVENT_PERIODS,
  EVENTS_PAGE_SIZE,
  SEVERITY_ORDER,
  SEVERITY_STYLES,
} from "../../constants";
import type { EventFilters, EventSeverity, HazardEvent, HazardType } from "../../types";
import { filterEvents, sortEventsBySeverity } from "../../utils";
import { HAZARD_ICONS } from "../hazard-icons";
import { SeverityPill } from "../SeverityPill";

interface CriticalEventsPanelProps {
  /** Todos los eventos recibidos (sin filtrar). */
  events: HazardEvent[];
  /** Eventos que pasan los filtros (los mismos que se ven en el mapa). */
  filteredEvents: HazardEvent[];
  filters: EventFilters;
  onFiltersChange: (filters: EventFilters) => void;
  /** Hora de la consulta al backend: referencia para el periodo (24 h, 48 h…). */
  fetchedAt: string;
  /** Mensaje si no se pudieron cargar los eventos del backend. */
  error: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /**
   * Solo afecta a escritorio: plegado muestra el resumen y el evento más grave,
   * para no tapar el mapa. En móvil la lista y los filtros siempre se muestran.
   */
  expanded: boolean;
}

const sameFilters = (a: EventFilters, b: EventFilters) =>
  a.period === b.period &&
  a.province === b.province &&
  a.hazardType === b.hazardType &&
  a.severities.length === b.severities.length &&
  a.severities.every((severity) => b.severities.includes(severity));

export function CriticalEventsPanel({
  events,
  filteredEvents,
  filters,
  onFiltersChange,
  fetchedAt,
  error,
  selectedId,
  onSelect,
  expanded,
}: CriticalEventsPanelProps) {
  const sorted = sortEventsBySeverity(filteredEvents);
  const [topEvent] = sorted;
  const isDefault = sameFilters(filters, DEFAULT_EVENT_FILTERS);

  // Cuántos hay de cada severidad dentro del periodo, provincia y tipo elegidos.
  const inScope = filterEvents(events, filters, fetchedAt, { ignoreSeverity: true });
  const countBySeverity = (severity: EventSeverity) => inScope.filter((event) => event.severity === severity).length;

  // "Ver más": vuelve a 10 cada vez que cambian los filtros.
  const filtersKey = JSON.stringify(filters);
  const [page, setPage] = useState({ key: filtersKey, count: EVENTS_PAGE_SIZE });
  const visibleCount = page.key === filtersKey ? page.count : EVENTS_PAGE_SIZE;

  const update = (changes: Partial<EventFilters>) => onFiltersChange({ ...filters, ...changes });
  const toggleSeverity = (severity: EventSeverity) =>
    update({
      severities: filters.severities.includes(severity)
        ? filters.severities.filter((item) => item !== severity)
        : SEVERITY_ORDER.filter((item) => item === severity || filters.severities.includes(item)),
    });

  const provinces = [...new Set(events.map((event) => event.province).filter((province): province is string => Boolean(province)))].sort(
    (a, b) => a.localeCompare(b, "es"),
  );
  const hazardTypes = [...new Map(events.map((event) => [event.hazardType, event.hazardTypeLabel])).entries()].sort(
    ([, a], [, b]) => a.localeCompare(b, "es"),
  );

  if (error) {
    return (
      <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-600/20">
        <AlertTriangleIcon className="mt-px size-4 shrink-0" />
        <span>
          <strong className="font-semibold">{error}.</strong> Los eventos se mostrarán en cuanto el servidor responda.
        </span>
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-3 gap-2" aria-label="Mostrar u ocultar por severidad">
        {SEVERITY_ORDER.map((severity) => {
          const style = SEVERITY_STYLES[severity];
          const active = filters.severities.includes(severity);
          return (
            <li key={severity}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => toggleSeverity(severity)}
                title={active ? `Ocultar eventos de nivel ${style.label.toLowerCase()}` : `Mostrar eventos de nivel ${style.label.toLowerCase()}`}
                className={cn(
                  "w-full rounded-xl px-3 py-2 text-left ring-1 transition",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
                  active ? "bg-white shadow-sm ring-slate-300" : "bg-slate-50 ring-slate-200/70 hover:bg-slate-100",
                )}
              >
                <span
                  className={cn("block text-xl leading-none font-bold tabular-nums", !active && "opacity-40")}
                  style={{ color: style.color }}
                >
                  {countBySeverity(severity)}
                </span>
                <span className="mt-1 flex items-center justify-between gap-1 text-[11px] font-medium text-slate-500">
                  {style.label}
                  <span aria-hidden="true" className={cn("size-2 rounded-full", active ? "" : "ring-1 ring-slate-300")} style={active ? { backgroundColor: style.color } : undefined} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Filtros: siempre en móvil; en escritorio solo con el panel expandido. */}
      <div className={cn("space-y-2", !expanded && "lg:hidden")}>
        <p className="text-[11px] text-slate-500">
          Eventos <strong className="font-semibold text-slate-700">ya ocurridos</strong>, reportados por la SNGR. Mostrar los
          ocurridos en:
        </p>
        <SegmentedControl
          name="event-period"
          label="Mostrar eventos ocurridos en"
          value={filters.period}
          options={EVENT_PERIODS}
          onChange={(period) => update({ period })}
        />
        <div className="grid grid-cols-2 gap-2">
          <FilterSelect
            label="Provincia"
            value={filters.province ?? ""}
            onChange={(value) => update({ province: value || null })}
          >
            <option value="">Todas las provincias</option>
            {provinces.map((province) => (
              <option key={province} value={province}>
                {province}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Tipo de evento"
            value={filters.hazardType ?? ""}
            onChange={(value) => update({ hazardType: (value || null) as HazardType | null })}
          >
            <option value="">Todos los tipos</option>
            {hazardTypes.map(([type, label]) => (
              <option key={type} value={type}>
                {label}
              </option>
            ))}
          </FilterSelect>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500" aria-live="polite">
        <span>
          Mostrando <strong className="font-semibold text-slate-700">{sorted.length}</strong> de {events.length} eventos
        </span>
        {!isDefault && (
          <button
            type="button"
            onClick={() => onFiltersChange(DEFAULT_EVENT_FILTERS)}
            className="font-semibold text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            Restablecer filtros
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">
          {events.length === 0 ? "No hay eventos abiertos en los últimos días." : "Ningún evento coincide con los filtros."}
        </p>
      ) : (
        <>
          {/* Lista: siempre en móvil; en escritorio solo si está expandido. */}
          <div className={cn(!expanded && "lg:hidden")}>
            <ul className="space-y-1.5">
              {sorted.slice(0, visibleCount).map((event) => (
                <li key={event.id}>
                  <EventItem event={event} selected={event.id === selectedId} onSelect={onSelect} />
                </li>
              ))}
            </ul>
            {sorted.length > visibleCount && (
              <button
                type="button"
                onClick={() => setPage({ key: filtersKey, count: visibleCount + EVENTS_PAGE_SIZE })}
                className="mt-2 w-full rounded-lg py-2 text-xs font-semibold text-blue-700 ring-1 ring-slate-200 transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                Ver {Math.min(EVENTS_PAGE_SIZE, sorted.length - visibleCount)} más · quedan {sorted.length - visibleCount}
              </button>
            )}
          </div>

          {/* Escritorio plegado: solo el evento más grave de los filtrados. */}
          {!expanded && (
            <div className="hidden lg:block">
              <EventItem event={topEvent} selected={topEvent.id === selectedId} onSelect={onSelect} compact />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "w-full cursor-pointer appearance-none truncate rounded-lg bg-slate-100 py-2 pr-7 pl-2.5 text-xs font-medium ring-1 ring-slate-900/5 ring-inset",
          "focus-visible:outline-2 focus-visible:outline-blue-600",
          value ? "text-blue-700" : "text-slate-600",
        )}
      >
        {children}
      </select>
      <ChevronDownIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-slate-400" />
    </label>
  );
}

export function EventsExpandButton({
  expanded,
  total,
  onToggle,
}: {
  expanded: boolean;
  total: number;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600"
    >
      {expanded ? "Mostrar menos" : total === 1 ? "Ver el evento y los filtros" : `Ver los ${total} eventos y los filtros`}
      <ChevronDownIcon className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
    </button>
  );
}

function EventItem({
  event,
  selected,
  onSelect,
  compact = false,
}: {
  event: HazardEvent;
  selected: boolean;
  onSelect: (id: string) => void;
  /** Oculta la descripción para ocupar menos espacio. */
  compact?: boolean;
}) {
  const severity = SEVERITY_STYLES[event.severity];
  const HazardIcon = HAZARD_ICONS[event.hazardType];
  const place = [event.canton, event.province].filter(Boolean).join(", ") || "Ubicación sin especificar";

  return (
    <button
      type="button"
      onClick={() => onSelect(event.id)}
      aria-pressed={selected}
      className={cn(
        "flex w-full gap-3 rounded-xl p-2.5 text-left ring-1 transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
        selected ? "bg-blue-50/70 ring-blue-300" : "ring-transparent hover:bg-slate-50 hover:ring-slate-200",
      )}
    >
      <span aria-hidden="true" className={cn("grid size-9 shrink-0 place-items-center rounded-xl", severity.tileClass)}>
        <HazardIcon className="size-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="text-sm leading-snug font-semibold text-slate-900">
            {event.title}
            <span className="sr-only"> ({event.hazardTypeLabel})</span>
          </span>
          <SeverityPill severity={event.severity} />
        </span>
        {!compact && event.description && (
          <span className="mt-0.5 line-clamp-2 text-xs text-slate-500">{event.description}</span>
        )}
        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <MapPinIcon className="size-3" />
            {place}
          </span>
          <span className="flex items-center gap-1">
            <ClockIcon className="size-3" />
            <time dateTime={event.occurredAt}>{formatDateTime(event.occurredAt)}</time>
          </span>
          {event.level !== null && <span className="font-medium text-slate-600">Nivel {event.level}</span>}
          {event.impact.affected > 0 && (
            <span className="tabular-nums">{event.impact.affected.toLocaleString("es-EC")} afectados</span>
          )}
        </span>
      </span>
    </button>
  );
}
