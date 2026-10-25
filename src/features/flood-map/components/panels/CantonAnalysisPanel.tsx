import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatDateTime, formatHour } from "@/lib/format";
import { SEMAPHORE_STYLES } from "../../constants";
import { DEFAULT_CANTON_FILTERS, RAIN_CATEGORIES, filterCantons, isFiltered, type CantonFilters } from "../../canton-filters";
import type { CantonAnalysis, CantonAnalysisSnapshot, RainCategory, Semaphore } from "../../types";
import { Notice } from "./RainForecastSection";

interface CantonAnalysisPanelProps {
  snapshot: CantonAnalysisSnapshot | null;
  error: string | null;
  isLoading: boolean;
  selectedCode: string | null;
  /** Elegir un cantón lo abre aquí y lo resalta en el mapa; elegirlo de nuevo lo cierra. */
  onSelect: (canton: CantonAnalysis | null) => void;
  /** Filtros de la lista, compartidos con el mapa (que pinta solo los mismos cantones). */
  filters: CantonFilters;
  onFiltersChange: (filters: CantonFilters) => void;
}

const formatMm = (mm: number) => `${mm.toLocaleString("es-EC", { maximumFractionDigits: 1 })} mm`;
const formatCount = (value: number) => value.toLocaleString("es-EC", { maximumFractionDigits: 1 });
/** "1 punto", "3 puntos". */
const counted = (value: number, singular: string, plural: string) => `${formatCount(value)} ${value === 1 ? singular : plural}`;

/** Cantones que se ven antes de "Ver todos". */
const PREVIEW = 15;

/**
 * Semáforo por cantón con la lluvia pronosticada (WRF) de las próximas 12 y 24 h
 * (umbrales del documento de la SNGR: verde, amarillo y rojo; manda el más alto
 * de los dos) y, por cantón alertado, sus factores detonantes, elementos
 * expuestos, acciones preventivas y herramientas para la respuesta.
 */
export function CantonAnalysisPanel({
  snapshot,
  error,
  isLoading,
  selectedCode,
  onSelect,
  filters,
  onFiltersChange,
}: CantonAnalysisPanelProps) {
  const [showAll, setShowAll] = useState(false);

  if (!snapshot) {
    return error ? (
      <Notice>{error}</Notice>
    ) : (
      <p className="flex items-center gap-2 py-6 text-sm text-slate-500">
        {isLoading && <span className="size-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />}
        Calculando el análisis por cantón…
      </p>
    );
  }

  const provinces = [...new Set(snapshot.cantons.map((canton) => canton.province))].sort((a, b) => a.localeCompare(b, "es"));
  const { counts, categories, listed } = filterCantons(snapshot.cantons, filters);
  const { color, category, province, query } = filters;
  const visible = showAll ? listed : listed.slice(0, PREVIEW);
  // El elegido (p. ej. tocándolo en el mapa) siempre se ve, aunque los filtros o el "Ver todos" lo dejen fuera.
  const selected = selectedCode ? snapshot.cantons.find((canton) => canton.code === selectedCode) : undefined;
  const pinned = selected && !visible.includes(selected) ? selected : null;
  const filtered = isFiltered(filters);
  const failed = snapshot.sources.filter((source) => !source.ok);
  const update = (patch: Partial<CantonFilters>) => onFiltersChange({ ...filters, ...patch });

  return (
    <div className="space-y-3">
      {/* Contadores: también filtran la lista por color (tocar de nuevo vuelve a rojo y amarillo). */}
      <div className="grid grid-cols-3 gap-2">
        {(["red", "yellow", "green"] as const).map((semaphore) => (
          <button
            key={semaphore}
            type="button"
            // Tocar de nuevo el mismo color vuelve a rojo y amarillo; la categoría se reinicia.
            onClick={() => update({ color: color === semaphore ? "alerted" : semaphore, category: null })}
            aria-pressed={color === semaphore}
            className={cn(
              "rounded-xl p-2 text-left ring-1 transition focus-visible:outline-2 focus-visible:outline-blue-600",
              color === semaphore ? "bg-white ring-2" : "bg-white ring-slate-200 hover:ring-slate-300",
            )}
            style={color === semaphore ? { ["--tw-ring-color" as string]: SEMAPHORE_STYLES[semaphore].color } : undefined}
          >
            <span className="block text-xl font-semibold text-slate-900 tabular-nums">{counts[semaphore]}</span>
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <SemaphoreDot semaphore={semaphore} />
              {SEMAPHORE_STYLES[semaphore].label}
            </span>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-slate-500">
        Lluvia pronosticada para las próximas 12 y 24 h
        {snapshot.forecast12h && `, desde las ${formatHour(snapshot.forecast12h.from)}`}
        {snapshot.counts.noData > 0 && ` · ${counted(snapshot.counts.noData, "cantón sin pronóstico", "cantones sin pronóstico")}`}
      </p>
      {error && <Notice>{error}</Notice>}

      <div className="space-y-2 rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200/70">
        <div className="grid grid-cols-2 gap-2">
          <label className="min-w-0">
            <span className="sr-only">Provincia</span>
            <select
              autoComplete="off"
              value={province}
              onChange={(event) => update({ province: event.target.value })}
              className="w-full rounded-lg bg-white px-2 py-1.5 text-xs text-slate-800 ring-1 ring-slate-200 focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              <option value="">Todas las provincias</option>
              {provinces.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0">
            <span className="sr-only">Buscar cantón</span>
            <input
              autoComplete="off"
              type="search"
              value={query}
              onChange={(event) => update({ query: event.target.value })}
              placeholder="Buscar cantón"
              className="w-full rounded-lg bg-white px-2 py-1.5 text-xs text-slate-800 ring-1 ring-slate-200 placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-blue-600"
            />
          </label>
        </div>
        {categories.length > 1 && (
          <div role="group" aria-label="Categoría de lluvia" className="flex flex-wrap gap-1">
            {categories.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => update({ category: category === item.id ? null : item.id })}
                aria-pressed={category === item.id}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 transition focus-visible:outline-2 focus-visible:outline-blue-600",
                  category === item.id ? "bg-blue-600 text-white ring-blue-600" : "bg-white text-slate-600 ring-slate-200 hover:ring-slate-300",
                )}
              >
                {item.label} <span className="tabular-nums opacity-70">{item.count}</span>
              </button>
            ))}
          </div>
        )}
        {filtered && (
          <p className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
            {counted(listed.length, "cantón", "cantones")}
            <button type="button" onClick={() => onFiltersChange(DEFAULT_CANTON_FILTERS)} className="font-semibold text-blue-700 hover:underline">
              Quitar filtros
            </button>
          </p>
        )}
      </div>

      {pinned && (
        <div>
          <p className="mb-1 text-[11px] font-semibold text-slate-500">Cantón elegido</p>
          <CantonRow canton={pinned} selected onSelect={onSelect} />
        </div>
      )}

      {listed.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600 ring-1 ring-slate-200/70">
          {filtered
            ? "Ningún cantón con estos filtros."
            : "No se pronostican 5 mm o más en 12 h ni 10 mm o más en 24 h en ningún cantón."}
        </p>
      ) : (
        <>
          <ul className="space-y-1.5">
            {visible.map((canton) => (
              <li key={canton.code}>
                <CantonRow canton={canton} selected={canton.code === selectedCode} onSelect={onSelect} />
              </li>
            ))}
          </ul>
          {listed.length > PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAll((value) => !value)}
              className="w-full rounded-lg py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              {showAll ? "Ver menos" : `Ver los ${listed.length}`}
            </button>
          )}
        </>
      )}

      <ThresholdsLegend />
      <p className="text-[11px] text-slate-500">
        Pronóstico del modelo WRF del INAMHI. Actualizado el {formatDateTime(snapshot.updatedAt)}, cada hora. Es apoyo a la
        decisión, no un aviso oficial.
        {failed.length > 0 && ` Sin datos de: ${failed.map((source) => source.name.toLowerCase()).join(", ")}.`}
      </p>
    </div>
  );
}

/** Umbrales del documento en una tabla corta: color, lluvia pronosticada en 12 h y en 24 h. */
function ThresholdsLegend() {
  const rows = [
    { semaphore: "red", h12: "30 mm o más", h24: "50 mm o más" },
    { semaphore: "yellow", h12: "5 a 29,9 mm", h24: "10 a 49,9 mm" },
    { semaphore: "green", h12: "menos de 5 mm", h24: "menos de 10 mm" },
  ] as const;
  return (
    <section className="rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-200/70">
      <table className="w-full text-[11px]">
        <caption className="mb-1 text-left font-semibold text-slate-600">¿Cómo se asigna el color?</caption>
        <thead>
          <tr className="text-left text-slate-400">
            <th className="pb-1 font-medium">Color</th>
            <th className="pb-1 font-medium">Lluvia en 12 h</th>
            <th className="pb-1 font-medium">Lluvia en 24 h</th>
          </tr>
        </thead>
        <tbody className="text-slate-700">
          {rows.map((row) => (
            <tr key={row.semaphore}>
              <td className="py-0.5">
                <span className="flex items-center gap-1.5">
                  <SemaphoreDot semaphore={row.semaphore} />
                  {SEMAPHORE_STYLES[row.semaphore].label}
                </span>
              </td>
              <td className="py-0.5 tabular-nums">{row.h12}</td>
              <td className="py-0.5 tabular-nums">{row.h24}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1.5 text-[11px] text-slate-500">
        Con la lluvia pronosticada, el cantón toma el color más alto de las dos. Los verdes no se listan.
      </p>
    </section>
  );
}

function CantonRow({
  canton,
  selected,
  onSelect,
}: {
  canton: CantonAnalysis;
  selected: boolean;
  onSelect: (canton: CantonAnalysis | null) => void;
}) {
  const decisive = canton.decidedBy === "24h" ? canton.forecast.mm24h : canton.forecast.mm12h;
  const ref = useRef<HTMLDivElement>(null);
  // Al elegirlo (en la lista o en el mapa) la lista se desplaza hasta él.
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);
  return (
    <div
      ref={ref}
      className={cn("scroll-mt-2 rounded-xl ring-1 transition-colors", selected ? "bg-white ring-blue-600/40" : "bg-slate-50/70 ring-slate-200/70")}
    >
      <button
        type="button"
        onClick={() => onSelect(selected ? null : canton)}
        aria-expanded={selected}
        className="flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left hover:bg-white focus-visible:outline-2 focus-visible:outline-blue-600"
      >
        <SemaphoreDot semaphore={canton.semaphore} large />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-900">{canton.name}</span>
          <span className="block truncate text-[11px] text-slate-500">
            {canton.province} · {canton.categoryLabel.toLowerCase()}
          </span>
        </span>
        {/* La lluvia pronosticada de la ventana que decidió el color. */}
        <span className="shrink-0 text-right">
          <span className="block text-sm font-semibold text-slate-900 tabular-nums">
            {decisive === null ? "—" : formatMm(decisive)}
          </span>
          <span className="block text-[10px] text-slate-400">próx. {canton.decidedBy === "24h" ? "24 h" : "12 h"}</span>
        </span>
      </button>
      {selected && <CantonDetail canton={canton} />}
    </div>
  );
}

function CantonDetail({ canton }: { canton: CantonAnalysis }) {
  const { triggers, exposed, preventive, response } = canton;

  return (
    <div className="space-y-3 border-t border-slate-100 px-3 pt-2.5 pb-3 text-xs">
      <div className={cn("rounded-lg p-2", SEMAPHORE_STYLES[canton.semaphore].panelClass)}>
        <p className="font-semibold">{canton.consequences}</p>
        <p className="mt-0.5">{canton.actions}</p>
      </div>

      <RainSummary canton={canton} />

      <Section title="Otros factores detonantes">
        {triggers.riverAlerts > 0 && (
          <Stat value={triggers.riverAlerts} label="Tramos de río en alerta" note={`Hoy y mañana · hasta ${triggers.riverMaxLevel} años`} />
        )}
        {triggers.sngrEvents > 0 && <Stat value={triggers.sngrEvents} label="Inundaciones SNGR" note="Últimas 72 h" />}
        {triggers.floodHubFlagged > 0 && <Stat value={triggers.floodHubFlagged} label="Puntos Flood Hub" note="Sobre lo normal" />}
        {triggers.criticalPoints > 0 && <Stat value={triggers.criticalPoints} label="Puntos críticos en la RVE" />}
      </Section>

      <Section title="Elementos expuestos">
        {exposed.population !== null && <Stat value={formatCount(exposed.population)} label="Población*" />}
        {exposed.schools > 0 && (
          <Stat
            value={exposed.schools}
            label="Escuelas en zona susceptible"
            note={[
              counted(exposed.students, "estudiante", "estudiantes"),
              exposed.schoolsHighFlood > 0 && `${exposed.schoolsHighFlood} con susceptibilidad alta a inundación`,
            ]}
          />
        )}
        {exposed.healthCenters > 0 && (
          <Stat
            value={exposed.healthCenters}
            label="Establecimientos de salud"
            note={exposed.healthFloodSusceptible > 0 && `${exposed.healthFloodSusceptible} susceptibles a inundación`}
          />
        )}
        {exposed.rveKm > 0 && (
          <Stat
            value={`${formatCount(exposed.rveKm)} km`}
            label="Red Vial Estatal"
            note={exposed.rveCautionKm > 0 && `${formatCount(exposed.rveCautionKm)} km "circule con precaución"`}
          />
        )}
        {exposed.bridges > 0 && (
          <Stat value={exposed.bridges} label="Puentes" note={exposed.bridgesBad > 0 && `${exposed.bridgesBad} en mal estado o colapsados`} />
        )}
        {exposed.floodTowns > 0 && <Stat value={exposed.floodTowns} label="Poblados inundables" note="Modelo" />}
      </Section>

      <Section title="Acciones preventivas realizadas">
        {preventive.actions > 0 && <Stat value={preventive.actions} label="Acciones preventivas" />}
        {preventive.enosWorksActive > 0 && <Stat value={preventive.enosWorksActive} label="Obras ENOS en ejecución" />}
        {preventive.culverts > 0 && <Stat value={preventive.culverts} label="Alcantarillas limpiadas" />}
      </Section>

      <Section title="Herramientas para la respuesta">
        {response.shelters > 0 && (
          <Stat value={response.shelters} label="Alojamientos temporales" note={response.sheltersActive > 0 && `${response.sheltersActive} activos`} />
        )}
        {response.machinery > 0 && (
          <Stat value={`${response.machineryOperational} de ${response.machinery}`} label="Maquinaria operativa" note="MTOP" />
        )}
        {response.camps > 0 && <Stat value={response.camps} label="Campamentos del MTOP" />}
        {response.recoveryWorks > 0 && <Stat value={response.recoveryWorks} label="Trabajos de transitabilidad" />}
        {response.roadEventsOpen > 0 && <Stat value={response.roadEventsOpen} label="Eventos en vías por atender" />}
      </Section>

      <p className="text-[10px] text-slate-400">
        Conteos dentro del cantón según las capas del mapa. *Población de la capa de cantones del INEC (año por confirmar).
      </p>
    </div>
  );
}

/**
 * Las dos ventanas del pronóstico lado a lado, cada una con su categoría (con
 * sus propios umbrales). Define el color la que llega a la categoría del
 * cantón; si las dos llegan (empate), las dos.
 */
function RainSummary({ canton }: { canton: CantonAnalysis }) {
  const { forecast } = canton;
  return (
    <section>
      <SectionTitle>Lluvia pronosticada</SectionTitle>
      <div className="grid grid-cols-2 gap-1.5">
        <RainWindowTile
          window="12 h"
          mm={forecast.mm12h}
          category={forecast.category12h}
          decides={forecast.category12h === canton.category}
          semaphore={canton.semaphore}
        />
        <RainWindowTile
          window="24 h"
          mm={forecast.mm24h}
          category={forecast.category24h}
          decides={forecast.category24h === canton.category}
          semaphore={canton.semaphore}
        />
      </div>
    </section>
  );
}

const CATEGORY_LABELS = Object.fromEntries(RAIN_CATEGORIES.map((item) => [item.id, item.label])) as Record<RainCategory, string>;

function RainWindowTile({
  window,
  mm,
  category,
  decides,
  semaphore,
}: {
  window: string;
  mm: number | null;
  category: RainCategory | null;
  decides: boolean;
  semaphore: Semaphore;
}) {
  return (
    <div
      className={cn("rounded-lg p-2 ring-1", decides ? "bg-white ring-2" : "bg-slate-50 ring-slate-200/70")}
      style={decides ? { ["--tw-ring-color" as string]: SEMAPHORE_STYLES[semaphore].color } : undefined}
    >
      <p className="text-[11px] text-slate-500">Próximas {window}</p>
      <p className="text-base font-semibold text-slate-900 tabular-nums">{mm === null ? "—" : formatMm(mm)}</p>
      {category && <p className="text-[10px] text-slate-500">{CATEGORY_LABELS[category]}</p>}
      {decides && <p className="mt-0.5 text-[10px] font-semibold text-slate-700">Define el color</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h4 className="mb-1.5 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{children}</h4>;
}

/** Sección con sus cifras en tarjetas; si ninguna tiene datos, lo dice en vez de quedar vacía. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  // toArray descarta las tarjetas vacías (false/null) y les pone clave.
  const items = Children.toArray(children);
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      {items.length > 0 ? (
        <dl className="grid grid-cols-2 gap-1.5">{items}</dl>
      ) : (
        <p className="text-slate-400">Sin registros en las capas disponibles.</p>
      )}
    </section>
  );
}

/** Una cifra: el número grande, qué es y, debajo, el detalle (las partes vacías no se muestran). */
function Stat({ value, label, note }: { value: ReactNode; label: string; note?: string | false | (string | false)[] }) {
  const notes = (Array.isArray(note) ? note : [note]).filter(Boolean);
  return (
    // La cifra se ve arriba (order-first), pero en el orden de lectura va después de su etiqueta.
    <div className="flex flex-col rounded-lg bg-slate-50 p-2 ring-1 ring-slate-200/70">
      <dt className="text-[11px] leading-tight text-slate-500">{label}</dt>
      <dd className="order-first text-sm font-semibold text-slate-900 tabular-nums">
        {typeof value === "number" ? formatCount(value) : value}
      </dd>
      {notes.length > 0 && <dd className="mt-0.5 text-[10px] leading-tight text-slate-400">{notes.join(" · ")}</dd>}
    </div>
  );
}

function SemaphoreDot({ semaphore, large = false }: { semaphore: Semaphore; large?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn("shrink-0 rounded-full ring-2 ring-white", large ? "size-3.5" : "size-2.5")}
      style={{ backgroundColor: SEMAPHORE_STYLES[semaphore].color, boxShadow: "0 0 0 1px rgb(0 0 0 / 0.15)" }}
    />
  );
}
