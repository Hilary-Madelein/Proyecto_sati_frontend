"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { IconTile } from "@/components/ui/IconTile";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ChevronDownIcon, CloseIcon, HistoryIcon, MapPinIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatCalendarDate } from "@/lib/format";
import {
  ACTION_LAYERS,
  actionDays,
  actionStatus,
  actionSummary,
  ecuadorDay,
  placeName,
  weekOf,
  weeklyCounts,
  type ActionKind,
  type ActionStatus,
  type TimelineAction,
} from "../../action-timeline";
import { useLayerPhotos } from "../../hooks/useLayerPhotos";
import { normalizeName } from "../../parish-filters";
import type { RiskAttachment } from "../../types";
import { Notice } from "../panels/RainForecastSection";
import { WeeklyActionsChart } from "./WeeklyActionsChart";

interface ActionsTimelineDialogProps {
  open: boolean;
  onClose: () => void;
  /** Acciones de las dos capas, de la más reciente a la más antigua. */
  actions: readonly TimelineAction[];
  /** Descarga de cada capa de acciones: cuando cambia, se vuelven a pedir sus fotos. */
  layers: ReadonlyArray<{ id: string; fetchedAt: string | null }>;
  isLoading: boolean;
  error: string | null;
  /** Cierra la ventana y muestra la acción en el mapa, con su detalle. */
  onShowOnMap: (action: TimelineAction) => void;
  /** Acción que se ubica al abrir (desde su ficha en el mapa): se lleva a la vista y se resalta. */
  focusKey: string | null;
}

/**
 * Ventana con la línea de tiempo de las acciones del MIT: resumen y acciones
 * por semana arriba, y abajo cada acción en una tarjeta con su foto, a uno y
 * otro lado de una línea vertical (en celular, todas a un lado). Usa el
 * `<dialog>` nativo: el navegador se encarga del foco, de Esc y de bloquear el
 * mapa detrás. El contenido solo se monta mientras está abierta.
 */
export function ActionsTimelineDialog({ open, onClose, ...content }: ActionsTimelineDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // Clic en el fondo oscuro (fuera del contenido) = cerrar.
      onClick={(event) => event.target === ref.current && onClose()}
      aria-labelledby="timeline-title"
      className="m-auto h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-6xl flex-col overflow-hidden rounded-2xl bg-slate-50 p-0 shadow-2xl ring-1 ring-slate-900/10 backdrop:bg-slate-950/60 backdrop:backdrop-blur-[2px] open:flex"
    >
      {open && <TimelineContent onClose={onClose} {...content} />}
    </dialog>
  );
}

type KindFilter = "all" | ActionKind;

/** Tarjetas que se muestran al inicio y cuántas más con cada "Ver más". */
const PAGE = 20;
const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const COLOR = Object.fromEntries(ACTION_LAYERS.map((layer) => [layer.kind, layer.color])) as Record<ActionKind, string>;
const KIND_LABEL: Record<ActionKind, string> = { preventive: "Acción preventiva", response: "Acción de respuesta" };
/** Ancho de las miniaturas que entrega ArcGIS (`?w=`): ~25 KB en vez de ~370 KB la foto original. */
const THUMB_WIDTH = 640;

function TimelineContent({
  onClose,
  actions,
  layers,
  isLoading,
  error,
  onShowOnMap,
  focusKey,
}: Omit<ActionsTimelineDialogProps, "open">) {
  const [kind, setKind] = useState<KindFilter>("all");
  const [province, setProvince] = useState("");
  const [week, setWeek] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE);
  const [viewer, setViewer] = useState<{ action: TimelineAction; photos: RiskAttachment[]; index: number } | null>(null);
  // La hora se fija al abrir: "en curso" y la semana actual no cambian mientras se mira.
  const [now] = useState(() => Date.now());
  const photosOf = useLayerPhotos(layers, true);

  const provinces = [...new Set(actions.flatMap((action) => (action.province ? [action.province] : [])))].sort((a, b) =>
    normalizeName(a).localeCompare(normalizeName(b)),
  );
  const scoped = actions.filter((action) => (kind === "all" || action.kind === kind) && (!province || action.province === province));
  const listed = week ? scoped.filter((action) => action.day && weekOf(action.day) === week) : scoped;
  const summary = actionSummary(scoped);
  const weeks = weeklyCounts(scoped, now);
  // La acción buscada siempre entre las mostradas (aunque esté más abajo de las primeras).
  const focusIndex = focusKey ? listed.findIndex((action) => action.key === focusKey) : -1;
  const shownCount = Math.max(visible, Math.ceil((focusIndex + 1) / PAGE) * PAGE);
  const shown = listed.slice(0, shownCount);
  useScrollToAction(focusKey, focusIndex >= 0 && !isLoading);
  const photosFor = (action: TimelineAction) => (action.feature.id != null ? photosOf(action.layerId)?.[String(action.feature.id)] : undefined);
  const photosLoaded = (action: TimelineAction) => photosOf(action.layerId) !== null;

  const resetPage = () => setVisible(PAGE);


  return (
    <>
      <header className="flex items-start gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
        <IconTile className="bg-emerald-700 text-white shadow-sm shadow-emerald-700/30">
          <HistoryIcon className="size-4.5" />
        </IconTile>
        <div className="min-w-0 flex-1">
          <h2 id="timeline-title" className="text-base font-semibold text-slate-900 sm:text-lg">
            Acciones del MIT
          </h2>
          <p className="text-xs text-slate-500 sm:text-sm">Línea de tiempo de las acciones preventivas y de respuesta en las vías</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="-mr-1 grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <CloseIcon className="size-4" />
        </button>
      </header>

      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {actions.length === 0 ? (
          <div className="p-6">
            {error ? (
              <Notice>{error}</Notice>
            ) : (
              <p className="py-10 text-center text-sm text-slate-500">{isLoading ? "Cargando acciones…" : "Aún no hay acciones registradas."}</p>
            )}
          </div>
        ) : (
          <div className="space-y-6 px-4 py-5 sm:px-6">
            {error && <Notice>{error}</Notice>}

            {/* Filtros, resumen y acciones por semana: los filtros se aplican a todo lo de abajo. */}
            <section className="grid grid-cols-[minmax(0,1fr)] gap-5 rounded-2xl bg-white p-4 ring-1 ring-slate-200 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-8">
              <div className="space-y-3">
                <SegmentedControl
                  name="timeline-kind"
                  label="Tipo de acción"
                  value={kind}
                  options={[
                    { value: "all", label: "Todas" },
                    { value: "preventive", label: "Preventivas" },
                    { value: "response", label: "Respuesta" },
                  ]}
                  onChange={(value) => {
                    setKind(value);
                    setWeek(null);
                    resetPage();
                  }}
                />
                <select
                  aria-label="Provincia"
                  value={province}
                  onChange={(event) => {
                    setProvince(event.target.value);
                    setWeek(null);
                    resetPage();
                  }}
                  className="w-full rounded-lg bg-white px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200 focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  <option value="">Todas las provincias</option>
                  {provinces.map((name) => (
                    <option key={name} value={name}>
                      {placeName(name)}
                    </option>
                  ))}
                </select>
                <dl className="grid grid-cols-3 gap-2">
                  <Figure value={summary.total} label={summary.total === 1 ? "acción" : "acciones"} />
                  <Figure value={summary.provinces} label={summary.provinces === 1 ? "provincia" : "provincias"} />
                  <Figure value={summary.cantons} label={summary.cantons === 1 ? "cantón" : "cantones"} />
                </dl>
              </div>
              {weeks.length > 0 && (
                <WeeklyActionsChart
                  weeks={weeks}
                  kinds={kind === "all" ? ["preventive", "response"] : [kind]}
                  selected={week}
                  onSelect={(value) => {
                    setWeek((current) => (current === value ? null : value));
                    resetPage();
                  }}
                  undated={scoped.filter((action) => !action.day).length}
                />
              )}
            </section>

            {week && (
              <button
                type="button"
                onClick={() => setWeek(null)}
                className="mx-auto flex items-center gap-1.5 rounded-full bg-blue-50 py-1 pr-2 pl-3 text-xs font-semibold text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                Semana del {formatCalendarDate(week)} · {listed.length} {listed.length === 1 ? "acción" : "acciones"}
                <CloseIcon className="size-3.5" aria-label="Quitar" />
              </button>
            )}

            {listed.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No hay acciones con estos filtros.</p>
            ) : (
              <Timeline
                actions={shown}
                focusKey={focusKey}
                now={now}
                photosFor={photosFor}
                photosLoaded={photosLoaded}
                onOpenPhotos={(action, photos) => setViewer({ action, photos, index: 0 })}
                onShowOnMap={onShowOnMap}
              />
            )}

            {listed.length > shownCount && (
              <button
                type="button"
                onClick={() => setVisible(shownCount + PAGE)}
                className="mx-auto block rounded-full bg-white px-5 py-2 text-sm font-semibold text-blue-700 ring-1 ring-slate-200 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                Ver más acciones ({listed.length - shownCount})
              </button>
            )}
          </div>
        )}

        {viewer && <PhotoViewer {...viewer} onIndexChange={(index) => setViewer({ ...viewer, index })} onClose={() => setViewer(null)} />}
      </div>
    </>
  );
}

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-2.5 text-center ring-1 ring-slate-200/70">
      <dd className="text-2xl font-semibold text-slate-900">{value.toLocaleString("es-EC")}</dd>
      <dt className="text-[11px] leading-tight text-slate-500">{label}</dt>
    </div>
  );
}

// ── Línea de tiempo ──────────────────────────────────────────────────────────

/**
 * Una línea vertical con las acciones a uno y otro lado, por mes. Desde md, las
 * tarjetas se entrelazan: cada una ocupa dos filas de la cuadrícula y la
 * siguiente empieza una fila más abajo en la otra columna, así no queda medio
 * espacio vacío y el orden por fecha se sigue en zigzag. En celular, una
 * columna con la línea a la izquierda.
 */
function Timeline({
  actions,
  focusKey,
  now,
  photosFor,
  photosLoaded,
  onOpenPhotos,
  onShowOnMap,
}: {
  actions: readonly TimelineAction[];
  focusKey: string | null;
  now: number;
  photosFor: (action: TimelineAction) => RiskAttachment[] | undefined;
  photosLoaded: (action: TimelineAction) => boolean;
  onOpenPhotos: (action: TimelineAction, photos: RiskAttachment[]) => void;
  onShowOnMap: (action: TimelineAction) => void;
}) {
  const months: { month: string | null; actions: TimelineAction[] }[] = [];
  for (const action of actions) {
    const month = action.day?.slice(0, 7) ?? null;
    const last = months.at(-1);
    if (last && last.month === month) last.actions.push(action);
    else months.push({ month, actions: [action] });
  }

  return (
    <div className="relative">
      {/* La línea: a la izquierda en celular, al centro desde md. */}
      <span aria-hidden="true" className="absolute inset-y-0 left-4 w-0.5 -translate-x-1/2 bg-slate-200 md:left-1/2" />
      {months.map((group) => (
        <section key={group.month ?? "sin-fecha"} className="relative pb-6">
          <h3 className="relative flex py-3 pl-8 md:justify-center md:pl-0">
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-white capitalize shadow-sm">
              {group.month ? `${MONTHS[Number(group.month.slice(5, 7)) - 1]} ${group.month.slice(0, 4)}` : "Sin fecha"}
            </span>
          </h3>
          <ol className="grid gap-y-5 pl-10 md:grid-cols-2 md:gap-x-14 md:gap-y-0 md:pl-0">
            {group.actions.map((action, index) => {
              const right = index % 2 === 1;
              return (
                <li
                  key={action.key}
                  id={cardId(action.key)}
                  // Dos filas por tarjeta; cada una empieza una fila después de la anterior.
                  style={{ "--row": `${index + 1} / span 2` } as CSSProperties}
                  className={cn("relative md:[grid-row:var(--row)] md:pb-5", right ? "md:col-start-2" : "md:col-start-1")}
                >
                  {/* Punto sobre la línea, del color de la capa en el mapa. */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute top-5 -left-8 z-1 size-4 rounded-full ring-4 ring-slate-50",
                      right ? "md:-left-9" : "md:left-auto md:-right-9",
                    )}
                    style={{ backgroundColor: COLOR[action.kind] }}
                  />
                  <ActionCard
                    action={action}
                    highlighted={action.key === focusKey}
                    now={now}
                    photos={photosFor(action)}
                    photosLoaded={photosLoaded(action)}
                    onOpenPhotos={onOpenPhotos}
                    onShowOnMap={onShowOnMap}
                  />
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

function ActionCard({
  action,
  highlighted,
  now,
  photos,
  photosLoaded,
  onOpenPhotos,
  onShowOnMap,
}: {
  action: TimelineAction;
  highlighted: boolean;
  now: number;
  photos: RiskAttachment[] | undefined;
  photosLoaded: boolean;
  onOpenPhotos: (action: TimelineAction, photos: RiskAttachment[]) => void;
  onShowOnMap: (action: TimelineAction) => void;
}) {
  const status = actionStatus(action, now);
  const place = [action.canton, action.province].filter((name): name is string => !!name).map(placeName).join(", ");
  const resources = [
    action.operators > 0 && `${action.operators} ${action.operators === 1 ? "operador" : "operadores"} de maquinaria`,
    action.machines > 0 && `${action.machines} ${action.machines === 1 ? "máquina" : "máquinas"}`,
  ].filter(Boolean);
  const [cover] = photos ?? [];

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl bg-white shadow-sm",
        highlighted ? "ring-3 ring-emerald-600 ring-offset-2 ring-offset-slate-50" : "ring-1 ring-slate-200",
      )}
    >
      {highlighted && <p className="bg-emerald-700 px-4 py-1.5 text-xs font-semibold text-white">La acción que abriste en el mapa</p>}
      {cover ? (
        <button
          type="button"
          onClick={() => onOpenPhotos(action, photos ?? [])}
          aria-label={`Ver ${photos?.length === 1 ? "la foto" : `las ${photos?.length} fotos`} de ${action.title}`}
          className="group relative block w-full overflow-hidden bg-slate-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnail(cover.url)}
            alt=""
            loading="lazy"
            className="aspect-2/1 w-full object-cover transition duration-300 group-hover:scale-105"
          />
          {photos && photos.length > 1 && (
            <span className="absolute right-2 bottom-2 rounded-full bg-slate-950/70 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
              {photos.length} fotos
            </span>
          )}
        </button>
      ) : (
        // Mientras llegan las fotos, el lugar de la imagen (así la tarjeta no salta).
        !photosLoaded && <div aria-hidden="true" className="aspect-2/1 w-full animate-pulse bg-slate-100" />
      )}

      <div className="space-y-2 p-4">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-slate-600">
            <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: COLOR[action.kind] }} />
            {KIND_LABEL[action.kind]}
          </span>
          <StatusBadge status={status} />
          <span className="ml-auto font-semibold text-slate-500">{action.day ? dayLabel(action.day) : "Sin fecha"}</span>
        </p>
        <h3 className="text-base leading-snug font-semibold text-slate-900">{action.title}</h3>
        {(action.road || action.section) && (
          <p className="text-sm text-slate-600">
            {action.road && (
              <span className="mr-1.5 inline-block rounded border border-slate-500 px-1 text-[11px] leading-4 font-bold text-slate-800">{action.road}</span>
            )}
            {action.section}
          </p>
        )}
        <dl className="space-y-1 text-xs text-slate-500">
          {place && (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Lugar</dt>
              <MapPinIcon className="size-3.5 shrink-0" />
              <dd>{place}</dd>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Fechas</dt>
            <HistoryIcon className="size-3.5 shrink-0" />
            <dd>{periodLabel(action, status)}</dd>
          </div>
          {resources.length > 0 && (
            <div>
              <dt className="sr-only">Recursos</dt>
              <dd>{resources.join(" · ")}</dd>
            </div>
          )}
        </dl>
        <button
          type="button"
          onClick={() => onShowOnMap(action)}
          className="flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <MapPinIcon className="size-3.5" />
          Ver en el mapa
        </button>
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: ActionStatus }) {
  if (status === "ongoing") return <span className="rounded-full bg-blue-50 px-2 font-semibold text-blue-700 ring-1 ring-blue-200">En curso</span>;
  if (status === "planned") return <span className="rounded-full bg-slate-100 px-2 font-semibold text-slate-600">Programada</span>;
  return <span className="rounded-full bg-emerald-50 px-2 font-semibold text-emerald-700 ring-1 ring-emerald-200">Realizada</span>;
}

// ── Visor de fotos ───────────────────────────────────────────────────────────

/** Las fotos de una acción en grande, una a la vez, dentro de la ventana. */
function PhotoViewer({
  action,
  photos,
  index,
  onIndexChange,
  onClose,
}: {
  action: TimelineAction;
  photos: RiskAttachment[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const photo = photos[index];
  const go = (step: number) => onIndexChange((index + step + photos.length) % photos.length);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Fotos de ${action.title}`}
      tabIndex={-1}
      ref={(element) => element?.focus()}
      onKeyDown={(event) => {
        // Esc cierra el visor, no la ventana entera.
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
        if (event.key === "ArrowRight") go(1);
        if (event.key === "ArrowLeft") go(-1);
      }}
      onClick={(event) => event.target === event.currentTarget && onClose()}
      className="fixed inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950/90 p-4 outline-none"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar fotos"
        className="absolute top-3 right-3 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
      >
        <CloseIcon className="size-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt={`Fotografía ${index + 1} de ${photos.length}: ${action.title}`} className="max-h-[calc(100%-6rem)] max-w-full rounded-lg object-contain shadow-2xl" />
      <div className="flex items-center gap-3 text-sm text-white">
        {photos.length > 1 && (
          <button type="button" onClick={() => go(-1)} aria-label="Foto anterior" className="grid size-9 place-items-center rounded-full bg-white/10 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white">
            <ChevronDownIcon className="size-4 rotate-90" />
          </button>
        )}
        <span className="max-w-md text-center">
          <span className="font-semibold">{action.title}</span>
          {photos.length > 1 && <span className="ml-2 text-white/70 tabular-nums">{index + 1} / {photos.length}</span>}
        </span>
        {photos.length > 1 && (
          <button type="button" onClick={() => go(1)} aria-label="Foto siguiente" className="grid size-9 place-items-center rounded-full bg-white/10 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white">
            <ChevronDownIcon className="size-4 -rotate-90" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Lleva a la vista la tarjeta de la acción buscada, una sola vez, cuando ya está
 * en la lista. Al cuadro siguiente: al montarse el contenido, el `<dialog>` todavía
 * no se abrió (su efecto corre después) y no se puede desplazar.
 */
function useScrollToAction(key: string | null, ready: boolean) {
  const done = useRef(false);
  useEffect(() => {
    if (!key || !ready || done.current) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(cardId(key))?.scrollIntoView({ block: "center", behavior: "smooth" });
      done.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [key, ready]);
}

// ── Textos ───────────────────────────────────────────────────────────────────

/** Id de la tarjeta de una acción en la página ("rve-preventive-works:7" → "accion-rve-preventive-works-7"). */
function cardId(key: string): string {
  return `accion-${key.replace(/[^\w-]/g, "-")}`;
}

function thumbnail(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}w=${THUMB_WIDTH}`;
}

/** "Jueves 30 oct". */
function dayLabel(day: string): string {
  return `${WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()]} ${formatCalendarDate(day)}`;
}

/** "Del 13 al 20 oct · 8 días", "30 oct · 1 día", "Desde el 15 oct, hasta el 6 nov". */
function periodLabel(action: TimelineAction, status: ActionStatus): string {
  const days = actionDays(action);
  if (action.start === null) return "Sin fecha";
  const start = formatCalendarDate(ecuadorDay(action.start));
  if (action.end === null || days === null) return `Desde el ${start}`;
  const end = formatCalendarDate(ecuadorDay(action.end));
  if (days === 1) return `${start} · 1 día`;
  const length = `${days} días`;
  return status === "ongoing" ? `Desde el ${start}, hasta el ${end} · ${length}` : `Del ${start} al ${end} · ${length}`;
}
