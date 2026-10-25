import { Children, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatDateTime, formatHour } from "@/lib/format";
import { SEMAPHORE_STYLES } from "../../constants";
import type { CantonAnalysis, CantonAnalysisSnapshot, Semaphore } from "../../types";
import { Notice } from "./RainForecastSection";

interface CantonAnalysisPanelProps {
  snapshot: CantonAnalysisSnapshot | null;
  error: string | null;
  isLoading: boolean;
  selectedCode: string | null;
  /** Elegir un cantón lo abre aquí y lo resalta en el mapa; elegirlo de nuevo lo cierra. */
  onSelect: (canton: CantonAnalysis | null) => void;
}

const formatMm = (mm: number) => `${mm.toLocaleString("es-EC", { maximumFractionDigits: 1 })} mm`;
const formatCount = (value: number) => value.toLocaleString("es-EC", { maximumFractionDigits: 1 });
/** "1 punto", "3 puntos". */
const counted = (value: number, singular: string, plural: string) => `${formatCount(value)} ${value === 1 ? singular : plural}`;

/**
 * Semáforo por cantón con la lluvia de las últimas 12 h (umbrales del documento
 * de la SNGR: verde, amarillo y rojo) y, por cantón alertado, sus factores
 * detonantes, elementos expuestos, acciones preventivas y herramientas para la respuesta.
 */
export function CantonAnalysisPanel({ snapshot, error, isLoading, selectedCode, onSelect }: CantonAnalysisPanelProps) {
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

  const alerted = snapshot.cantons.filter((canton) => canton.semaphore !== "green");
  const failed = snapshot.sources.filter((source) => !source.ok);
  const correction = snapshot.satellite?.correction;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {(["red", "yellow", "green"] as const).map((semaphore) => (
          <div key={semaphore} className="rounded-xl bg-white p-2 ring-1 ring-slate-200">
            <p className="text-xl font-semibold text-slate-900 tabular-nums">{snapshot.counts[semaphore]}</p>
            <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <SemaphoreDot semaphore={semaphore} />
              {SEMAPHORE_STYLES[semaphore].label}
            </p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-500">
        Lluvia de las últimas {snapshot.windowHours} h
        {snapshot.satellite && ` hasta las ${formatHour(snapshot.satellite.to)}`}. Medida por el INAMHI en{" "}
        {snapshot.counts.stationCantons} cantones con estación; en el resto, estimada por satélite
        {correction ? ` ajustado con ${correction.pairs} estaciones (× ${correction.factor.toLocaleString("es-EC")})` : ""}.
      </p>
      {error && <Notice>{error}</Notice>}

      {alerted.length === 0 ? (
        <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800 ring-1 ring-green-600/20">
          Ningún cantón supera los 5 mm en las últimas 12 h.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {alerted.map((canton) => (
            <li key={canton.code}>
              <CantonRow canton={canton} selected={canton.code === selectedCode} onSelect={onSelect} />
            </li>
          ))}
        </ul>
      )}

      <p className="border-t border-slate-100 pt-2 text-[11px] text-slate-500">
        Umbrales de 12 h: verde menos de 5 mm, amarillo de 5 a 29,9 mm y rojo desde 30 mm. Los{" "}
        {snapshot.counts.green} cantones en verde no se listan. Calculado el {formatDateTime(snapshot.updatedAt)}; se
        actualiza cada hora. Es apoyo a la decisión, no un aviso oficial.
        {failed.length > 0 && ` Sin datos de: ${failed.map((source) => source.name.toLowerCase()).join(", ")}.`}
      </p>
    </div>
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
  return (
    <div className={cn("rounded-xl ring-1 transition-colors", selected ? "bg-white ring-blue-600/40" : "bg-slate-50/70 ring-slate-200/70")}>
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
            {canton.province} · {canton.categoryLabel.toLowerCase()} ·{" "}
            {canton.basis === "station" ? "medida en estación" : canton.basis === "satellite" ? "estimada por satélite" : "sin dato"}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-sm font-semibold text-slate-900 tabular-nums">
            {canton.rain12hMm === null ? "—" : formatMm(canton.rain12hMm)}
          </span>
          <span className="block text-[10px] text-slate-400">12 h</span>
        </span>
      </button>
      {selected && <CantonDetail canton={canton} />}
    </div>
  );
}

function CantonDetail({ canton }: { canton: CantonAnalysis }) {
  const { triggers, exposed, preventive, response } = canton;
  const station = triggers.stations[0];

  return (
    <div className="space-y-3 border-t border-slate-100 px-3 pt-2.5 pb-3 text-xs">
      <div className={cn("rounded-lg p-2", SEMAPHORE_STYLES[canton.semaphore].panelClass)}>
        <p className="font-semibold">{canton.consequences}</p>
        <p className="mt-0.5">{canton.actions}</p>
      </div>

      <Section title="Factores detonantes">
        {station ? (
          <Item label={triggers.stations.length > 1 ? `Lluvia 12 h · ${triggers.stations.length} estaciones` : "Lluvia 12 h · estación"}>
            {formatMm(station.mm)} en {station.name}
            {triggers.stations.length > 1 && ` (otras: ${triggers.stations.slice(1, 3).map((item) => formatMm(item.mm)).join(", ")})`}
          </Item>
        ) : (
          triggers.satellite12hAdjustedMm !== null && (
            <Item label="Lluvia 12 h · satélite">
              {formatMm(triggers.satellite12hAdjustedMm)} ajustada ({formatMm(triggers.satellite12hMm ?? 0)} sin ajustar)
            </Item>
          )
        )}
        {triggers.forecast24hMm !== null && <Item label="Pronóstico próximas 24 h">{formatMm(triggers.forecast24hMm)} (WRF)</Item>}
        {triggers.riverAlerts > 0 && (
          <Item label="Ríos en alerta (hoy y mañana)">
            {counted(triggers.riverAlerts, "tramo", "tramos")}, hasta {triggers.riverMaxLevel} años
          </Item>
        )}
        {triggers.floodHubFlagged > 0 && <Item label="Flood Hub sobre lo normal">{counted(triggers.floodHubFlagged, "punto", "puntos")}</Item>}
        {triggers.sngrEvents > 0 && <Item label="Inundaciones SNGR (72 h)">{counted(triggers.sngrEvents, "evento", "eventos")}</Item>}
        {triggers.criticalPoints > 0 && <Item label="Puntos críticos en la RVE">{triggers.criticalPoints}</Item>}
      </Section>

      <Section title="Elementos expuestos">
        {exposed.population !== null && <Item label="Población*">{formatCount(exposed.population)}</Item>}
        {exposed.schools > 0 && (
          <Item label="Escuelas en zona susceptible">
            {exposed.schools} ({counted(exposed.students, "estudiante", "estudiantes")})
            {exposed.schoolsHighFlood > 0 && `, ${exposed.schoolsHighFlood} con susceptibilidad alta a inundación`}
          </Item>
        )}
        {exposed.healthCenters > 0 && (
          <Item label="Establecimientos de salud">
            {exposed.healthCenters}
            {exposed.healthFloodSusceptible > 0 && ` (${exposed.healthFloodSusceptible} susceptibles a inundación)`}
          </Item>
        )}
        {exposed.rveKm > 0 && (
          <Item label="Red Vial Estatal">
            {formatCount(exposed.rveKm)} km{exposed.rveCautionKm > 0 && ` (${formatCount(exposed.rveCautionKm)} km "circule con precaución")`}
          </Item>
        )}
        {exposed.bridges > 0 && (
          <Item label="Puentes">
            {exposed.bridges}
            {exposed.bridgesBad > 0 && ` (${exposed.bridgesBad} en mal estado o colapsados)`}
          </Item>
        )}
        {exposed.floodTowns > 0 && <Item label="Poblados inundables (modelo)">{exposed.floodTowns}</Item>}
      </Section>

      <Section title="Acciones preventivas realizadas">
        {preventive.actions > 0 && <Item label="Acciones preventivas">{preventive.actions}</Item>}
        {preventive.enosWorksActive > 0 && <Item label="Obras ENOS en ejecución">{preventive.enosWorksActive}</Item>}
        {preventive.culverts > 0 && <Item label="Alcantarillas limpiadas">{preventive.culverts}</Item>}
      </Section>

      <Section title="Herramientas para la respuesta">
        {response.shelters > 0 && (
          <Item label="Alojamientos temporales">
            {response.shelters}
            {response.sheltersActive > 0 && ` (${response.sheltersActive} activos)`}
          </Item>
        )}
        {response.machinery > 0 && (
          <Item label="Maquinaria del MTOP">
            {response.machineryOperational} operativa de {response.machinery}
          </Item>
        )}
        {response.camps > 0 && <Item label="Campamentos del MTOP">{response.camps}</Item>}
        {response.recoveryWorks > 0 && <Item label="Trabajos de transitabilidad">{response.recoveryWorks}</Item>}
        {response.roadEventsOpen > 0 && <Item label="Eventos en vías por atender">{response.roadEventsOpen}</Item>}
      </Section>

      <p className="text-[10px] text-slate-400">
        Conteos dentro del cantón según las capas del mapa. *Población de la capa de cantones del INEC (año por confirmar).
      </p>
    </div>
  );
}

/** Sección con sus filas; si ninguna tiene datos, lo dice en vez de quedar vacía. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  // toArray descarta las filas vacías (false/null) y les pone clave.
  const items = Children.toArray(children);
  return (
    <section>
      <h4 className="mb-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{title}</h4>
      {items.length > 0 ? (
        <dl className="space-y-0.5">{items}</dl>
      ) : (
        <p className="text-slate-400">Sin registros en las capas disponibles.</p>
      )}
    </section>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-32 shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 flex-1 font-medium text-slate-800">{children}</dd>
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
