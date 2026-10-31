import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDownIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatDateTime, formatHour } from "@/lib/format";
import { SEMAPHORE_STYLES } from "../../constants";
import { DEFAULT_PARISH_FILTERS, RAIN_CATEGORIES, filterParishes, isFiltered, type ParishFilters } from "../../parish-filters";
import type { CantonAnalysis, CantonAnalysisSnapshot, ParishAlert, RainBand, RainCategory, Semaphore } from "../../types";
import { Notice } from "./RainForecastSection";

interface ParishAlertPanelProps {
  snapshot: CantonAnalysisSnapshot | null;
  error: string | null;
  isLoading: boolean;
  selectedCode: string | null;
  /** Elegir una parroquia la abre aquí y la resalta en el mapa; elegirla de nuevo la cierra. */
  onSelect: (parish: ParishAlert | null) => void;
  /** Filtros de la lista, compartidos con el mapa (que dibuja solo las mismas parroquias). */
  filters: ParishFilters;
  onFiltersChange: (filters: ParishFilters) => void;
}

const formatMm = (mm: number) => `${mm.toLocaleString("es-EC", { maximumFractionDigits: 1 })} mm`;
const formatCount = (value: number) => value.toLocaleString("es-EC", { maximumFractionDigits: 1 });
/** "1 punto", "3 puntos". */
const counted = (value: number, singular: string, plural: string) => `${formatCount(value)} ${value === 1 ? singular : plural}`;

/** Parroquias que se ven antes de "Ver las N": pocas, para que la leyenda de niveles quede a la vista. */
const PREVIEW = 5;

/**
 * Alerta de inundación por parroquia con la lluvia pronosticada (WRF) de las
 * próximas 12 y 24 h en el punto de cada parroquia (umbrales del documento de la
 * SNGR: alerta muy alta, alta, moderada y baja; manda el nivel más alto de las
 * dos). Solo se listan y dibujan las de alerta muy alta y alta (rojo y naranja); al abrir una, su cantón con
 * sus factores detonantes, elementos expuestos, acciones preventivas y
 * herramientas para la respuesta.
 */
export function ParishAlertPanel({
  snapshot,
  error,
  isLoading,
  selectedCode,
  onSelect,
  filters,
  onFiltersChange,
}: ParishAlertPanelProps) {
  const [showAll, setShowAll] = useState(false);

  if (!snapshot) {
    return error ? (
      <Notice>{error}</Notice>
    ) : (
      <p className="flex items-center gap-2 py-6 text-sm text-slate-500">
        {isLoading && <span className="size-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />}
        Calculando la alerta por parroquia…
      </p>
    );
  }
  if (!snapshot.parishes) return <Notice>El servidor todavía no calcula la alerta por parroquia.</Notice>;

  const parishes = snapshot.parishes;
  const provinces = [...new Set(parishes.map((parish) => parish.province))].sort((a, b) => a.localeCompare(b, "es"));
  const { counts, categories, listed } = filterParishes(parishes, filters);
  const { levels, category, province, query } = filters;
  const visible = showAll ? listed : listed.slice(0, PREVIEW);
  // La elegida (p. ej. tocándola en el mapa) siempre se ve, aunque los filtros o el "Ver todas" la dejen fuera.
  const selected = selectedCode ? parishes.find((parish) => parish.code === selectedCode) : undefined;
  const pinned = selected && !visible.includes(selected) ? selected : null;
  const filtered = isFiltered(filters);
  const failed = snapshot.sources.filter((source) => !source.ok);
  const cantons = new Map(snapshot.cantons.map((canton) => [canton.code, canton]));
  const update = (patch: Partial<ParishFilters>) => onFiltersChange({ ...filters, ...patch });
  // Cada nivel se enciende o apaga (en la lista y en el mapa); la categoría elegida se reinicia.
  const toggleLevel = (level: Semaphore) =>
    update({ levels: levels.includes(level) ? levels.filter((item) => item !== level) : [...levels, level], category: null });

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Parroquias por nivel de alerta</p>
        {/* Una franja con los cuatro niveles: cada uno se enciende o apaga en el mapa y en la lista. */}
        <div className="grid grid-cols-4 divide-x divide-slate-200 overflow-hidden rounded-lg ring-1 ring-slate-200">
          {(["red", "orange", "yellow", "green"] as const).map((semaphore) => {
            const on = levels.includes(semaphore);
            return (
              <button
                key={semaphore}
                type="button"
                onClick={() => toggleLevel(semaphore)}
                aria-pressed={on}
                title={on ? "Ocultar en el mapa" : "Mostrar en el mapa"}
                className={cn(
                  "px-2 py-1.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600",
                  on ? "bg-white hover:bg-slate-50" : "bg-slate-50 hover:bg-slate-100",
                )}
              >
                <LevelCount semaphore={semaphore} value={counts[semaphore]} on={on} />
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        Lluvia pronosticada para las próximas 12 y 24 h
        {snapshot.forecast12h && `, desde las ${formatHour(snapshot.forecast12h.from)}`}. Toca un nivel para mostrar u ocultar sus
        parroquias en el mapa.
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
            <span className="sr-only">Buscar parroquia o cantón</span>
            <input
              autoComplete="off"
              type="search"
              value={query}
              onChange={(event) => update({ query: event.target.value })}
              placeholder="Parroquia o cantón"
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
            {counted(listed.length, "parroquia", "parroquias")}
            <button type="button" onClick={() => onFiltersChange(DEFAULT_PARISH_FILTERS)} className="font-semibold text-blue-700 hover:underline">
              Quitar filtros
            </button>
          </p>
        )}
      </div>

      {pinned && (
        <div>
          <p className="mb-1 text-[11px] font-semibold text-slate-500">Parroquia elegida</p>
          <ParishRow parish={pinned} canton={cantons.get(pinned.cantonCode)} bands={snapshot.bands} selected onSelect={onSelect} />
        </div>
      )}

      {listed.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600 ring-1 ring-slate-200/70">
          {filtered
            ? levels.length === 0
              ? "Ningún nivel encendido: toca uno arriba para ver sus parroquias."
              : "Ninguna parroquia con estos filtros."
            : "No se pronostican 30 mm o más en 12 h ni 50 mm o más en 24 h en ninguna parroquia."}
        </p>
      ) : (
        <>
          <ul className="space-y-1.5">
            {visible.map((parish) => (
              <li key={parish.code}>
                <ParishRow
                  parish={parish}
                  canton={cantons.get(parish.cantonCode)}
                  bands={snapshot.bands}
                  selected={parish.code === selectedCode}
                  onSelect={onSelect}
                />
              </li>
            ))}
          </ul>
          {listed.length > PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAll((value) => !value)}
              className="w-full rounded-lg py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              {showAll ? "Ver menos" : `Ver las ${listed.length}`}
            </button>
          )}
        </>
      )}

      {snapshot.bands && snapshot.bands.length > 0 && <AlertLegend bands={snapshot.bands} />}
      <AboutCalculation updatedAt={snapshot.updatedAt} failed={failed.map((source) => source.name.toLowerCase())} />
    </div>
  );
}

/** "30 a 69,9 mm", "140 mm o más", "menos de 0,1 mm". */
function rangeText(from: number, next: number | undefined): string {
  const mm = (value: number) => value.toLocaleString("es-EC", { maximumFractionDigits: 1 });
  if (from === 0) return `menos de ${mm(next ?? 0)} mm`;
  return next === undefined ? `${mm(from)} mm o más` : `${mm(from)} a ${mm(Math.round((next - 0.1) * 10) / 10)} mm`;
}

/** "≥ 140", "70–139,9", "< 0,1" (en mm), para cada categoría. */
function shortRange(from: number, next: number | undefined): string {
  const mm = (value: number) => value.toLocaleString("es-EC", { maximumFractionDigits: 1 });
  if (from === 0) return `< ${mm(next ?? 0)}`;
  return next === undefined ? `≥ ${mm(from)}` : `${mm(from)}–${mm(Math.round((next - 0.1) * 10) / 10)}`;
}

const ALERT_LEVELS: readonly Semaphore[] = ["red", "orange", "yellow", "green"];

/** "Extrema" → "Lluvia extrema": la categoría es de la lluvia, no de la alerta. */
const rainLabel = (label: string) => `Lluvia ${label.toLowerCase()}`;

/**
 * Leyenda de la alerta de inundación con la tabla del documento: una franja por
 * nivel (alta, moderada, baja) con su lluvia de 12 y 24 h, y debajo cada
 * categoría con sus potenciales consecuencias y acciones recomendadas.
 */
/** Niveles que se ven abiertos al inicio: los que se dibujan en el mapa. */
const OPEN_LEVELS: readonly Semaphore[] = ["red", "orange"];

function AlertLegend({ bands }: { bands: readonly RainBand[] }) {
  const [open, setOpen] = useState<ReadonlySet<Semaphore>>(() => new Set(OPEN_LEVELS));
  const toggle = (level: Semaphore) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(level)) next.add(level);
      return next;
    });

  return (
    <section className="space-y-2">
      <h4 className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Niveles de alerta</h4>
      <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900 ring-1 ring-amber-200">
        <span className="font-semibold">Sistema en validación.</span> Los umbrales de lluvia y los niveles de alerta están sujetos a
        validación y pueden cambiar.
      </p>
      {ALERT_LEVELS.map((level) => {
        const levelBands = bands.filter((band) => band.semaphore === level);
        if (levelBands.length === 0) return null;
        const lowest = levelBands[0];
        const above = bands[bands.indexOf(levelBands[levelBands.length - 1]) + 1];
        const style = SEMAPHORE_STYLES[level];
        const expanded = open.has(level);
        return (
          <div key={level} className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
            {/* Tocar el encabezado muestra u oculta sus categorías. */}
            <button
              type="button"
              onClick={() => toggle(level)}
              aria-expanded={expanded}
              className={cn(
                "flex w-full items-center gap-2.5 border-l-4 py-1.5 pr-2.5 pl-2 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600",
                style.panelClass,
                "ring-0",
              )}
              style={{ borderLeftColor: style.color }}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold">{style.alert}</span>
                <span className="block text-[10px] opacity-80">
                  12 h: {rangeText(lowest.from12h, above?.from12h)} · 24 h: {rangeText(lowest.from24h, above?.from24h)}
                </span>
              </span>
              <ChevronDownIcon aria-hidden="true" className={cn("size-4 shrink-0 opacity-70 transition-transform", expanded && "rotate-180")} />
            </button>
            <ul hidden={!expanded} className="divide-y divide-slate-100">
              {[...levelBands].reverse().map((band) => {
                const next = bands[bands.indexOf(band) + 1];
                return (
                  <li key={band.category} className="space-y-0.5 px-2.5 py-2 text-[11px]">
                    <p className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold text-slate-800">{rainLabel(band.label)}</span>
                      {/* Los mm de esta categoría (no los del nivel completo). */}
                      <span className="shrink-0 text-[10px] text-slate-500 tabular-nums">
                        12 h {shortRange(band.from12h, next?.from12h)} · 24 h {shortRange(band.from24h, next?.from24h)}
                      </span>
                    </p>
                    <p className="text-slate-600">{band.consequences}</p>
                    <p className="text-slate-500">
                      <span className="font-medium text-slate-600">Acción:</span> {band.actions}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

/** Cómo se calcula la alerta y de dónde sale, en filas cortas en vez de un párrafo. */
function AboutCalculation({ updatedAt, failed }: { updatedAt: string; failed: string[] }) {
  const rows: [string, ReactNode][] = [
    ["Fuente", "Modelo WRF del INAMHI"],
    ["Actualizado", `${formatDateTime(updatedAt)} · cada hora`],
    ["Lluvia", "El valor del pronóstico en el poblado de cada parroquia."],
    ["Nivel", "Cada ventana (12 y 24 h) con sus umbrales; la parroquia toma el más alto de las dos"],
  ];
  return (
    <section className="rounded-lg bg-slate-50 p-2.5 text-[11px] ring-1 ring-slate-200/70">
      <h4 className="mb-1.5 font-semibold text-slate-700">Sobre este cálculo</h4>
      <dl className="space-y-1">
        {rows.map(([term, detail]) => (
          <div key={term} className="grid grid-cols-[5.5rem_1fr] gap-2">
            <dt className="text-slate-500">{term}</dt>
            <dd className="text-slate-700">{detail}</dd>
          </div>
        ))}
      </dl>
      {failed.length > 0 && <p className="mt-1.5 text-amber-800">Sin datos de: {failed.join(", ")}.</p>}
      <p className="mt-1.5 border-t border-slate-200 pt-1.5 text-slate-500">Es apoyo a la decisión, no un aviso oficial.</p>
    </section>
  );
}

function ParishRow({
  parish,
  canton,
  bands,
  selected,
  onSelect,
}: {
  parish: ParishAlert;
  /** Su cantón, con lo que hay en él; undefined si no se encontró. */
  canton: CantonAnalysis | undefined;
  bands: readonly RainBand[] | undefined;
  selected: boolean;
  onSelect: (parish: ParishAlert | null) => void;
}) {
  const decisive = parish.decidedBy === "24h" ? parish.forecast.mm24h : parish.forecast.mm12h;
  const ref = useRef<HTMLDivElement>(null);
  // Al elegirla (en la lista o en el mapa) la lista se desplaza hasta ella.
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);
  return (
    <div
      ref={ref}
      className={cn(
        "scroll-mt-2 overflow-hidden rounded-lg bg-white ring-1 transition-colors",
        selected ? "shadow-sm ring-blue-600/40" : "ring-slate-200/80",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(selected ? null : parish)}
        aria-expanded={selected}
        className="flex w-full items-stretch gap-2.5 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600"
      >
        {/* El color del nivel, en una barra fina. */}
        <span aria-hidden="true" className="w-1 shrink-0" style={{ backgroundColor: SEMAPHORE_STYLES[parish.semaphore].color }} />
        <span className="min-w-0 flex-1 py-2">
          <span className="block truncate text-[13px] font-medium text-slate-900">{parish.name}</span>
          <span className="block truncate text-[11px] text-slate-500">
            {parish.canton}, {parish.province}
          </span>
        </span>
        {/* La lluvia de la ventana que decidió el nivel, con su categoría. */}
        <span className="shrink-0 py-2 pr-2.5 text-right">
          <span className="block text-[13px] font-semibold text-slate-900 tabular-nums">{decisive === null ? "—" : formatMm(decisive)}</span>
          <span className="block text-[10px] text-slate-500">
            {parish.categoryLabel} · {parish.decidedBy === "24h" ? "24 h" : "12 h"}
          </span>
        </span>
      </button>
      {selected && <ParishDetail parish={parish} canton={canton} band={bands?.find((item) => item.category === parish.category)} />}
    </div>
  );
}

function ParishDetail({ parish, canton, band }: { parish: ParishAlert; canton: CantonAnalysis | undefined; band: RainBand | undefined }) {
  return (
    <div className="space-y-3 border-t border-slate-100 px-3 pt-2.5 pb-3 text-[11px]">
      <div className={cn("space-y-1 rounded-lg px-2.5 py-2", SEMAPHORE_STYLES[parish.semaphore].panelClass)}>
        <p className="text-[10px] font-bold tracking-wide uppercase">
          {SEMAPHORE_STYLES[parish.semaphore].alert} · {rainLabel(parish.categoryLabel)}
        </p>
        {band && (
          <>
            <p>{band.consequences}</p>
            <p>
              <span className="font-semibold">Acción:</span> {band.actions}
            </p>
          </>
        )}
      </div>

      <RainSummary parish={parish} />

      {canton && <CantonContext canton={canton} name={parish.canton} />}
    </div>
  );
}

/** Lo que hay en el cantón de la parroquia: detonantes, elementos expuestos, acciones preventivas y recursos. */
function CantonContext({ canton, name }: { canton: CantonAnalysis; name: string }) {
  const { triggers, exposed, preventive, response } = canton;

  return (
    <div className="space-y-2.5">
      <p className="border-t border-slate-100 pt-2.5 text-[11px] font-semibold text-slate-800">En el cantón {name}</p>

      <Section title="Otros factores detonantes">
        {triggers.riverAlerts > 0 && (
          <Stat value={triggers.riverAlerts} label="Tramos de río en alerta" note={`Hoy y mañana · hasta ${triggers.riverMaxLevel} años`} />
        )}
        {triggers.sngrEvents > 0 && <Stat value={triggers.sngrEvents} label="Inundaciones SNGR" note="Últimas 72 h" />}
        {triggers.floodHubFlagged > 0 && <Stat value={triggers.floodHubFlagged} label="Puntos Flood Hub" note="Sobre lo normal" />}
        {triggers.criticalPoints > 0 && <Stat value={triggers.criticalPoints} label="Puntos críticos en la RVE" />}
      </Section>

      <Section title="Elementos expuestos">
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
        {response.provinceMachinery > 0 && <Stat value={response.provinceMachinery} label="Maquinaria pesada en la provincia" note="MIT" />}
        {response.camps > 0 && <Stat value={response.camps} label="Campamentos del MIT" />}
        {response.responseActions > 0 && <Stat value={response.responseActions} label="Acciones de respuesta" note="MIT" />}
        {response.roadEventsOpen > 0 && (
          <Stat value={response.roadEventsOpen} label="Eventos en vías sin atender" note="Últimos 3 meses · por ejecutar o en ejecución" />
        )}
      </Section>
    </div>
  );
}

/** Las dos ventanas del pronóstico en una franja, cada una con su lluvia y su categoría (con sus propios umbrales). */
function RainSummary({ parish }: { parish: ParishAlert }) {
  const { forecast } = parish;
  return (
    <section>
      <SectionTitle>Lluvia pronosticada</SectionTitle>
      <div className="grid grid-cols-2 divide-x divide-slate-200 rounded-lg bg-slate-50 ring-1 ring-slate-200/70">
        <RainWindowTile window="12 h" mm={forecast.mm12h} category={forecast.category12h} />
        <RainWindowTile window="24 h" mm={forecast.mm24h} category={forecast.category24h} />
      </div>
    </section>
  );
}

const CATEGORY_LABELS = Object.fromEntries(RAIN_CATEGORIES.map((item) => [item.id, item.label])) as Record<RainCategory, string>;

function RainWindowTile({ window, mm, category }: { window: string; mm: number | null; category: RainCategory | null }) {
  return (
    <div className="px-2.5 py-1.5">
      <p className="text-[10px] text-slate-500">Próximas {window}</p>
      <p className="text-sm font-semibold text-slate-900 tabular-nums">{mm === null ? "—" : formatMm(mm)}</p>
      {category && <p className="text-[10px] text-slate-500">{rainLabel(CATEGORY_LABELS[category])}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h4 className="mb-1 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">{children}</h4>;
}

/** Sección con sus cifras en filas; sin ningún dato no se muestra. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  // toArray descarta las filas vacías (false/null) y les pone clave.
  const items = Children.toArray(children);
  if (items.length === 0) return null;
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <dl className="divide-y divide-slate-100 rounded-lg bg-slate-50/60 px-2.5 ring-1 ring-slate-200/70">{items}</dl>
    </section>
  );
}

/** Una cifra en una fila: qué es (con su detalle debajo) a la izquierda y el valor a la derecha. */
function Stat({ value, label, note }: { value: ReactNode; label: string; note?: string | false | (string | false)[] }) {
  const notes = (Array.isArray(note) ? note : [note]).filter(Boolean);
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="min-w-0 text-slate-600">
        {label}
        {notes.length > 0 && <span className="block text-[10px] leading-tight text-slate-400">{notes.join(" · ")}</span>}
      </dt>
      <dd className="shrink-0 font-semibold text-slate-900 tabular-nums">{typeof value === "number" ? formatCount(value) : value}</dd>
    </div>
  );
}

/** Un nivel en la franja de contadores: punto de color y cifra, y debajo el nombre; apagado, en gris. */
function LevelCount({ semaphore, value, on }: { semaphore: Semaphore; value: number; on: boolean }) {
  return (
    <>
      <span className="flex items-center gap-1.5">
        <span className={cn("flex shrink-0 transition", !on && "opacity-30 grayscale")}>
          <SemaphoreDot semaphore={semaphore} />
        </span>
        <span className={cn("text-sm font-semibold tabular-nums", on ? "text-slate-900" : "text-slate-400")}>
          {value.toLocaleString("es-EC")}
        </span>
      </span>
      <span className={cn("block truncate text-[10px]", on ? "text-slate-600" : "text-slate-400")}>{SEMAPHORE_STYLES[semaphore].label}</span>
    </>
  );
}

function SemaphoreDot({ semaphore }: { semaphore: Semaphore }) {
  return (
    <span
      aria-hidden="true"
      className="size-2.5 shrink-0 rounded-full ring-2 ring-white"
      style={{ backgroundColor: SEMAPHORE_STYLES[semaphore].color, boxShadow: "0 0 0 1px rgb(0 0 0 / 0.15)" }}
    />
  );
}
