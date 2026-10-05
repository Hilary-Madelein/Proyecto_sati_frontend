"use client";

import { useEffect, useRef, useState } from "react";
import { ClockIcon, MapPinIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatDateTime, formatTimeAgo } from "@/lib/format";
import { SEVERITY_STYLES } from "../../constants";
import type { EventImpact, HazardEvent } from "../../types";
import { HAZARD_ICONS } from "../hazard-icons";

/** Descripciones más largas que esto se muestran recortadas con "Leer más". */
const DESCRIPTION_PREVIEW_CHARS = 160;

const STATUS_LABELS: Record<HazardEvent["status"], string> = {
  open: "En seguimiento",
  closed: "Cerrado",
};

/** Cifras de impacto con su texto en singular y plural; solo se muestran las que no son 0. */
const IMPACT_LABELS: readonly { key: keyof EventImpact; one: string; many: string; tone?: "danger" }[] = [
  { key: "deceased", one: "fallecido", many: "fallecidos", tone: "danger" },
  { key: "affected", one: "persona afectada", many: "personas afectadas" },
  { key: "evacuated", one: "persona evacuada", many: "personas evacuadas" },
  { key: "housesAffected", one: "vivienda afectada", many: "viviendas afectadas" },
];

interface EventPopupContentProps {
  event: HazardEvent;
  /** Avisa que el contenido cambió de tamaño, para que el popup se reacomode. */
  onResize?: () => void;
}

/** Contenido del popup de un evento de la SNGR (ya ocurrido). */
export function EventPopupContent({ event, onResize }: EventPopupContentProps) {
  const severity = SEVERITY_STYLES[event.severity];
  const HazardIcon = HAZARD_ICONS[event.hazardType];
  const place = [event.canton, event.province].filter(Boolean).join(", ");
  const impacts = IMPACT_LABELS.filter(({ key }) => event.impact[key] > 0);

  return (
    <article className="w-[17rem] sm:w-[19rem]">
      {/* Franja del color de la severidad: se reconoce de un vistazo. */}
      <div className="h-1" style={{ backgroundColor: severity.color }} aria-hidden="true" />

      <header className="flex gap-3 px-4 pt-3 pr-9">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", severity.tileClass)}>
          <HazardIcon className="size-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[15px] leading-snug font-semibold text-slate-900">{event.title}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 font-semibold" style={{ color: severity.color }}>
              <span className="size-2 rounded-full" style={{ backgroundColor: severity.color }} aria-hidden="true" />
              {severity.label}
              {event.level !== null && <span className="font-normal text-slate-500">(Nivel {event.level})</span>}
            </span>
            <span aria-hidden="true">·</span>
            <span>{STATUS_LABELS[event.status]}</span>
          </p>
        </div>
      </header>

      <dl className="mt-3 space-y-1.5 px-4 text-xs text-slate-600">
        <div className="flex gap-2">
          <dt className="sr-only">Lugar</dt>
          <MapPinIcon className="mt-px size-3.5 shrink-0 text-slate-400" />
          <dd>
            {event.sector && <span className="text-slate-800">{event.sector}</span>}
            {event.sector && place && <br />}
            {place || (!event.sector && "Ubicación sin especificar")}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="sr-only">Fecha</dt>
          <ClockIcon className="mt-px size-3.5 shrink-0 text-slate-400" />
          <dd>
            <span className="text-slate-800">{formatDateTime(event.occurredAt)}</span>
            <span className="text-slate-400"> · {formatTimeAgo(event.occurredAt)}</span>
          </dd>
        </div>
      </dl>

      <section className="mx-4 mt-3 border-t border-slate-100 pt-3">
        <h4 className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">Afectaciones</h4>
        {impacts.length > 0 ? (
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {impacts.map(({ key, one, many, tone }) => {
              const value = event.impact[key];
              return (
                <li
                  key={key}
                  className={cn(
                    "rounded-lg px-2 py-1 text-xs",
                    tone === "danger" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700",
                  )}
                >
                  <strong className="font-semibold tabular-nums">{value.toLocaleString("es-EC")}</strong>{" "}
                  {value === 1 ? one : many}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-slate-500">Sin afectaciones reportadas</p>
        )}
      </section>

      {event.description && <EventDescription text={event.description} onResize={onResize} />}

      <footer className="mt-3 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
        Evento ya ocurrido · Reporte de la SNGR
      </footer>
    </article>
  );
}

/** Relato del evento: la SNGR lo va ampliando con cada actualización, así que se abre a pedido. */
function EventDescription({ text, onResize }: { text: string; onResize?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > DESCRIPTION_PREVIEW_CHARS || text.includes("\n");

  // Tras abrir o cerrar el texto (no al montar), el popup cambia de alto.
  const toggled = useRef(false);
  useEffect(() => {
    if (toggled.current) onResize?.();
  }, [expanded, onResize]);

  return (
    <section className="mx-4 mt-3 border-t border-slate-100 pt-3">
      <h4 className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">Qué pasó</h4>
      <p
        className={cn(
          "mt-1 text-justify text-xs leading-relaxed hyphens-auto whitespace-pre-line text-slate-600",
          isLong && !expanded && "line-clamp-3",
          expanded && "max-h-48 overflow-y-auto pr-1",
        )}
      >
        {text.trim()}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => {
            toggled.current = true;
            setExpanded((value) => !value);
          }}
          className="mt-1 text-xs font-semibold text-blue-700 hover:underline"
          aria-expanded={expanded}
        >
          {expanded ? "Ver menos" : "Leer más"}
        </button>
      )}
    </section>
  );
}
