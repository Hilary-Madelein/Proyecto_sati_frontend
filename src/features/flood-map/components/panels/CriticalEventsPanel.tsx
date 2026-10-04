import { AlertTriangleIcon, ChevronDownIcon, ClockIcon, MapPinIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { EVENTS_WINDOW_DAYS, SEVERITY_ORDER, SEVERITY_STYLES } from "../../constants";
import type { HazardEvent } from "../../types";
import { sortEventsBySeverity } from "../../utils";
import { HAZARD_ICONS } from "../hazard-icons";
import { SeverityPill } from "../SeverityPill";

interface CriticalEventsPanelProps {
  events: HazardEvent[];
  /** Mensaje si no se pudieron cargar los eventos del backend. */
  error: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /**
   * Solo afecta a escritorio: plegado muestra el resumen y el evento más grave,
   * para no tapar el mapa. En móvil la lista siempre se muestra completa.
   */
  expanded: boolean;
}

export function CriticalEventsPanel({ events, error, selectedId, onSelect, expanded }: CriticalEventsPanelProps) {
  const sorted = sortEventsBySeverity(events);
  const [topEvent] = sorted;

  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-3 gap-2" aria-label="Resumen por severidad">
        {SEVERITY_ORDER.map((severity) => {
          const style = SEVERITY_STYLES[severity];
          const count = events.filter((event) => event.severity === severity).length;
          return (
            <li key={severity} className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70">
              <p className="text-xl leading-none font-bold tabular-nums" style={{ color: style.color }}>
                {count}
              </p>
              <p className="mt-1 text-[11px] font-medium text-slate-500">{style.label}</p>
            </li>
          );
        })}
      </ul>

      {error ? (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-600/20">
          <AlertTriangleIcon className="mt-px size-4 shrink-0" />
          <span>
            <strong className="font-semibold">{error}.</strong> Los eventos se mostrarán en cuanto el servidor responda.
          </span>
        </p>
      ) : sorted.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">
          No hay eventos abiertos en los últimos {EVENTS_WINDOW_DAYS} días.
        </p>
      ) : (
        <>
          {/* Lista completa: siempre en móvil; en escritorio solo si está expandido. */}
          <ul className={cn("space-y-1.5", !expanded && "lg:hidden")}>
            {sorted.map((event) => (
              <li key={event.id}>
                <EventItem event={event} selected={event.id === selectedId} onSelect={onSelect} />
              </li>
            ))}
          </ul>

          {/* Escritorio plegado: solo el evento más grave. */}
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
      {expanded ? "Mostrar menos" : `Ver los ${total} eventos`}
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
