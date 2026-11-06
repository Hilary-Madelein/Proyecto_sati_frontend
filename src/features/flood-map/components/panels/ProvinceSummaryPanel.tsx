"use client";

import type { ReactNode } from "react";
import { CloseIcon } from "@/components/ui/icons";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Toggle } from "@/components/ui/Toggle";
import { cn } from "@/lib/cn";
import { placeName } from "../../action-timeline";
import { SEMAPHORE_STYLES, SEVERITY_ORDER, SEVERITY_STYLES } from "../../constants";
import type { ProvinceFeature } from "../../hooks/useProvinceGeometries";
import { PROVINCE_NAMES } from "../../province-geometry";
import { RANK_INDICATORS, type CantonTotals, type HeadlineFigures, type RankIndicator } from "../../province-summary";
import type { EventSeverity, Semaphore } from "../../types";
import { FilterSelect } from "./CriticalEventsPanel";

/** Cifras del resumen; null = aún cargando (o sin datos). */
export interface ProvinceSummary {
  /** La frase de arriba: las cifras del ámbito (el país o la provincia elegida), sin comparar. */
  headline: { here: HeadlineFigures; eventsPeriod: string };
  events: { total: number; bySeverity: Record<EventSeverity, number>; period: string };
  forecast: { counts: Record<Semaphore, number>; max: { mm: number; parish: string } | null } | null;
  /** Tramos de río del modelo en alerta por caudal el día elegido, y cuántos llegan al caudal de 5 años o más. */
  rivers: { count: number; major: number } | null;
  /** Expuestos, alojamientos, maquinaria y vías afectadas, del análisis por cantón. */
  totals: CantonTotals | null;
  bridges: { count: number; good: number } | null;
  powerPlants: number | null;
  preventive: { count: number; period: string } | null;
  response: { count: number; period: string } | null;
  closures: { open: number; full: number; closed: number } | null;
}

/** Lo que abre cada cuadro: una pestaña del panel de eventos, una capa o el índice de preparación. */
export type SummaryTarget =
  | "events"
  | "closures"
  | "analysis"
  | "preventive"
  | "response"
  | "bridges"
  | "rivers"
  | "schools"
  | "health"
  | "power-plants"
  | "shelters"
  | "machinery"
  | "road-events";

interface ProvinceSummaryPanelProps {
  provinces: readonly ProvinceFeature[] | null;
  selected: ProvinceFeature | null;
  onSelect: (province: ProvinceFeature | null) => void;
  summary: ProvinceSummary;
  /** Abre lo de un cuadro (su pestaña o su capa en el mapa), o lo quita si ya estaba. */
  onOpen: (target: SummaryTarget) => void;
  /** Si lo de un cuadro ya está a la vista: el cuadro se marca. */
  isActive: (target: SummaryTarget) => boolean;
  /** Solo en la vista del país: las provincias más afectadas según el indicador elegido. */
  ranking: {
    indicator: RankIndicator;
    onIndicatorChange: (indicator: RankIndicator) => void;
    rows: ReadonlyArray<{ province: ProvinceFeature; value: number }> | null;
    shadeMap: boolean;
    onShadeMapChange: (shade: boolean) => void;
  };
}

/** Solo alerta alta y muy alta: la moderada no entra en el resumen. */
const LEVELS: readonly Semaphore[] = ["red", "orange"];
/** Cuadros que abren una pestaña del panel de eventos (los demás encienden una capa). */
const PANEL_TARGETS: ReadonlySet<SummaryTarget> = new Set(["events", "closures", "analysis"]);
const fmt = (value: number) => value.toLocaleString("es-EC");
const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/**
 * Lo que está pasando, de un vistazo. En todo el país: una frase, las provincias más
 * afectadas (se pueden pintar en el mapa) y las cifras. Con una provincia: la misma
 * frase comparada con el país, sus cantones más afectados y sus cifras. Las cifras van
 * por componente de la gestión del riesgo, como las pestañas de capas.
 */
export function ProvinceSummaryPanel({ provinces, selected, onSelect, summary, onOpen, isActive, ranking }: ProvinceSummaryPanelProps) {
  const { events, forecast, rivers, totals, bridges, powerPlants, preventive, response, closures } = summary;
  /** Lo que necesita cada cuadro para ser un interruptor de lo suyo. */
  const toggle = (target: SummaryTarget) => ({ onClick: () => onOpen(target), active: isActive(target), kind: PANEL_TARGETS.has(target) ? ("panel" as const) : ("layer" as const) });
  const alerts = forecast ? LEVELS.reduce((sum, level) => sum + forecast.counts[level], 0) : undefined;

  return (
    <div className="space-y-4">
      <FilterSelect
        label="Provincia"
        value={selected?.key ?? ""}
        onChange={(key) => onSelect(provinces?.find((province) => province.key === key) ?? null)}
      >
        <option value="">Todo el país</option>
        {[...(provinces ?? [])]
          .sort((a, b) => a.key.localeCompare(b.key))
          .map((province) => (
            <option key={province.key} value={province.key}>
              {placeName(province.name)}
            </option>
          ))}
      </FilterSelect>

      <Headline selected={selected} {...summary.headline} />

      {!selected && <ProvinceRanking {...ranking} onSelect={onSelect} />}

      <Group title="Amenaza" color="#dc2626">
        <SummaryCard title="Eventos" value={events.total} note={events.period} {...toggle("events")}>
          {SEVERITY_ORDER.filter((severity) => events.bySeverity[severity] > 0).map((severity) => (
            <Chip key={severity} color={SEVERITY_STYLES[severity].color} label={`${events.bySeverity[severity]} ${SEVERITY_STYLES[severity].label.toLowerCase()}`} />
          ))}
        </SummaryCard>
        <SummaryCard title="Parroquias en alerta" value={alerts} note="alta y muy alta, próximas 24 h" {...toggle("analysis")}>
          {forecast &&
            LEVELS.filter((level) => forecast.counts[level] > 0).map((level) => (
              <Chip key={level} color={SEMAPHORE_STYLES[level].color} label={`${forecast.counts[level]} ${SEMAPHORE_STYLES[level].label.toLowerCase()}`} />
            ))}
          {forecast?.max && (
            <span className="block text-[10px] text-slate-500">
              Máx.: {forecast.max.mm.toLocaleString("es-EC", { maximumFractionDigits: 1 })} mm en {forecast.max.parish}
            </span>
          )}
        </SummaryCard>
        {/* Tramos del modelo GEOGLOWS, no ríos: un mismo río tiene muchos. */}
        <SummaryCard title="Tramos de río en alerta" value={rivers?.count} note="por caudal; un río tiene muchos tramos" {...toggle("rivers")}>
          {rivers && rivers.major > 0 && <Chip color="#2563eb" label={`${fmt(rivers.major)} de 5 años o más`} />}
        </SummaryCard>
      </Group>

      <Group title="Exposición" color="#2563eb">
        <SummaryCard title="Educación" value={totals?.schools} note="instituciones en zonas susceptibles" {...toggle("schools")}>
          {totals && totals.schoolsHighFlood > 0 && <Chip color="#1d4ed8" label={`${fmt(totals.schoolsHighFlood)} alta a inundación`} />}
          {totals && totals.students > 0 && <span className="block text-[10px] text-slate-500">{fmt(totals.students)} estudiantes</span>}
        </SummaryCard>
        <SummaryCard
          title="Salud"
          value={totals?.healthFloodSusceptible}
          note={totals ? `susceptibles a inundación, de ${fmt(totals.healthCenters)}` : "susceptibles a inundación"}
          {...toggle("health")}
        />
        <SummaryCard title="Puentes" value={bridges?.count} note="en la red vial" {...toggle("bridges")}>
          {bridges && bridges.good > 0 && <Chip color="#16a34a" label={`${fmt(bridges.good)} en buen estado`} />}
        </SummaryCard>
        <SummaryCard title="Centrales eléctricas" value={powerPlants ?? undefined} note="generación e interconexión" {...toggle("power-plants")} />
      </Group>

      <Group title="Preparación" color="#16a34a">
        <SummaryCard title="Acciones preventivas" value={preventive?.count} note={preventive?.period} {...toggle("preventive")} />
        <SummaryCard title="Alojamientos" value={totals?.shelters} note="temporales" {...toggle("shelters")} />
        <SummaryCard title="Maquinaria pesada" value={totals?.machinery} note="equipos del MIT" {...toggle("machinery")} />
      </Group>

      <Group title="Respuesta" color="#7c3aed">
        <SummaryCard title="Cierres viales" value={closures?.open} note="abiertos" {...toggle("closures")}>
          {closures && (
            <>
              {closures.full > 0 && <Chip color="#dc2626" label={`${closures.full} ${plural(closures.full, "cierre total", "cierres totales")}`} />}
              {/* Los ya habilitados no están en "Abiertos": al abrir sin abiertos, la lista va directo a "Todos". */}
              {closures.closed > 0 && <Chip color="#0d9488" label={`${closures.closed} ya ${plural(closures.closed, "habilitado", "habilitados")}`} />}
            </>
          )}
        </SummaryCard>
        <SummaryCard title="Acciones de respuesta" value={response?.count} note={response?.period} {...toggle("response")} />
        <SummaryCard title="Vías afectadas" value={totals?.roadEventsOpen} note="eventos abiertos en vías" {...toggle("road-events")} />
      </Group>

      <p className="text-[11px] leading-relaxed text-slate-500">
        {selected
          ? "Las capas y los demás paneles muestran solo esta provincia. Toca un cuadro para verlo en el mapa."
          : "Toca una provincia en el mapa, en la lista o elígela arriba para ver solo lo de ella. Toca un cuadro para verlo en el mapa."}
      </p>
    </div>
  );
}

/** La situación en una frase, con las cifras en negrita; con una provincia, comparada con el país. */
function Headline({ selected, here, eventsPeriod }: { selected: ProvinceFeature | null } & ProvinceSummary["headline"]) {
  const place = selected ? (PROVINCE_NAMES[selected.key] ?? placeName(selected.name)) : "Ecuador";
  const alerts = here.parishes ? here.parishes.red + here.parishes.orange : null;

  const parts: ReactNode[] = [
    <span key="events">
      <strong>
        {fmt(here.events)}
      </strong>{" "}
      {plural(here.events, "evento", "eventos")}
      {eventsPeriod && ` (${eventsPeriod})`}
      {here.critical > 0 && (
        <>
          , <strong className="text-red-700">{fmt(here.critical)}</strong> {plural(here.critical, "crítico", "críticos")}
        </>
      )}
    </span>,
  ];
  if (here.closuresOpen !== null) {
    parts.push(
      <span key="closures">
        <strong>
          {fmt(here.closuresOpen)}
        </strong>{" "}
        {plural(here.closuresOpen, "cierre vial abierto", "cierres viales abiertos")}
        {here.closuresFull ? (
          <>
            , <strong className="text-red-700">{fmt(here.closuresFull)}</strong> {plural(here.closuresFull, "total", "totales")}
          </>
        ) : null}
      </span>,
    );
  }
  if (alerts !== null && here.parishes) {
    parts.push(
      <span key="alerts">
        <strong>
          {fmt(alerts)}
        </strong>{" "}
        {plural(alerts, "parroquia en alerta alta o muy alta", "parroquias en alerta alta o muy alta")} en las próximas 24 h
        {here.parishes.red > 0 && (
          <>
            , <strong className="text-red-700">{fmt(here.parishes.red)}</strong> muy {plural(here.parishes.red, "alta", "altas")}
          </>
        )}
      </span>,
    );
  }

  return (
    <section aria-label="Situación" className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 ring-1 ring-slate-200">
      <p className="mb-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Ahora en {place}</p>
      <ul className="space-y-1">
        {parts.map((part, index) => (
          <li key={index} className="flex gap-1.5">
            <span aria-hidden="true" className="mt-1.5 size-1 shrink-0 rounded-full bg-slate-400" />
            <span>{part}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProvinceRanking({
  indicator,
  onIndicatorChange,
  rows,
  shadeMap,
  onShadeMapChange,
  onSelect,
}: ProvinceSummaryPanelProps["ranking"] & { onSelect: (province: ProvinceFeature) => void }) {
  const max = Math.max(1, ...(rows ?? []).map((row) => row.value));
  const unit = RANK_INDICATORS.find((item) => item.id === indicator)?.unit ?? "";
  return (
    <section aria-label="Provincias más afectadas" className="space-y-2">
      <h3 className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Provincias más afectadas</h3>
      <SegmentedControl
        name="summary-rank"
        label="Ordenar por"
        value={indicator}
        options={RANK_INDICATORS.map((item) => ({ value: item.id, label: item.label }))}
        onChange={onIndicatorChange}
      />
      {rows === null ? (
        <p className="text-xs text-slate-500">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-slate-500">Ninguna provincia con {unit} ahora.</p>
      ) : (
        <ol className="space-y-1">
          {rows.map(({ province, value }) => (
            <li key={province.key}>
              <button
                type="button"
                onClick={() => onSelect(province)}
                className="group w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <span className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-slate-800 group-hover:text-blue-700">
                    {PROVINCE_NAMES[province.key] ?? placeName(province.name)}
                  </span>
                  <span className="font-semibold text-slate-900 tabular-nums">{fmt(value)}</span>
                </span>
                <span aria-hidden="true" className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100">
                  {/* Índigo, como las provincias pintadas en el mapa: solo compara cantidades, no es un nivel de alerta. */}
                  <span className="block h-full rounded-full bg-indigo-500" style={{ width: `${(value / max) * 100}%` }} />
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
      <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-2.5 py-2 ring-1 ring-slate-200/70">
        <span className="text-xs font-medium text-slate-700">Colorear provincias en el mapa</span>
        <Toggle checked={shadeMap} onChange={onShadeMapChange} label={`Colorear las provincias por ${unit}`} />
      </div>
    </section>
  );
}

function Group({ title, color, children }: { title: string; color: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
        <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: color }} />
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </section>
  );
}

function SummaryCard({
  title,
  value,
  note,
  onClick,
  active,
  kind,
  children,
}: {
  title: string;
  value: number | undefined;
  note?: string;
  onClick: () => void;
  /** Lo suyo ya está a la vista: se marca, y tocarlo lo quita. */
  active: boolean;
  /** "panel": abre una pestaña; "layer": enciende una capa en el mapa. */
  kind: "panel" | "layer";
  children?: ReactNode;
}) {
  const shown = kind === "panel" ? "Abierto" : "En el mapa";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={active ? (kind === "panel" ? "Cerrar" : "Quitar del mapa") : kind === "panel" ? "Abrir" : "Ver en el mapa"}
      className={cn(
        "relative flex min-w-0 flex-col items-start gap-0.5 rounded-xl p-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-blue-600",
        active ? "bg-blue-50 ring-2 ring-blue-600" : "bg-white ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-blue-300",
      )}
    >
      {active && (
        <span className="mb-0.5 flex items-center gap-1 rounded-full bg-blue-600 py-0.5 pr-1.5 pl-2 text-[9px] font-semibold text-white">
          {shown}
          <CloseIcon className="size-2.5" />
        </span>
      )}
      <span className="text-[11px] font-semibold text-slate-600">{title}</span>
      <span className={cn("text-xl leading-tight font-bold tabular-nums", value === undefined ? "text-slate-300" : "text-slate-900")}>
        {value === undefined ? "…" : fmt(value)}
      </span>
      {note && <span className="text-[10px] text-slate-500">{note}</span>}
      {children && <span className="mt-1 flex flex-wrap gap-1">{children}</span>}
    </button>
  );
}

function Chip({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
      <span aria-hidden="true" className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
