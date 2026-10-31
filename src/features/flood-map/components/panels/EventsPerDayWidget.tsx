"use client";

import { useState } from "react";
import { ChevronDownIcon, CircleDotIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatDateTime, formatDayMonth } from "@/lib/format";
import { SEVERITY_ORDER } from "../../constants";
import { useEventsPerDay } from "../../hooks/useEventsPerDay";
import type { SeverityCounts } from "../../hooks/useEventsPerDay";
import type { EventSeverity } from "../../types";
import { SeriesLegend, StackedBarChart, type ChartSeries } from "../charts/StackedBarChart";

/** Días que muestra el gráfico, hasta hoy. */
const DAYS = 30;
/**
 * Cada día en los grupos del panel de eventos, de abajo hacia arriba: cerrados,
 * abiertos sin afectaciones y abiertos con afectaciones (los que muestra el
 * panel). Colores validados para daltonismo (un gris no se distinguía lo
 * suficiente). Por severidad no se apila: sus colores (rojo, naranja y amarillo)
 * no se distinguen entre sí; la severidad de los abiertos va en el cuadro del día.
 */
const CLOSED: ChartSeries = { key: "closed", label: "Cerrados", plural: "cerrados", color: "#0d9488" };
const WITHOUT_DAMAGE: ChartSeries = { key: "withoutDamage", label: "Sin afectaciones", plural: "sin afectaciones", color: "#d97706" };
const OPEN: ChartSeries = { key: "open", label: "Abiertos", plural: "abiertos con afectaciones", color: "#2563eb" };
const SERIES: readonly ChartSeries[] = [CLOSED, WITHOUT_DAMAGE, OPEN];
const SEVERITY_NAMES: Record<EventSeverity, [string, string]> = {
  critical: ["crítico", "críticos"],
  high: ["alto", "altos"],
  moderate: ["moderado", "moderados"],
};

/**
 * Recuadro flotante sobre el mapa: cuántos eventos registró la SNGR cada día de
 * los últimos 30 (abiertos y cerrados). Abierto ocupa todo el ancho de su
 * franja (`className` la ubica); plegado es un botón, en la esquina de la
 * franja. Al inicio está plegado, para dejar el mapa libre.
 */
export function EventsPerDayWidget({
  until,
  className,
}: {
  /** Hora de la consulta del panel de eventos: las columnas son bloques de 24 h hacia atrás desde ella. */
  until: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { data } = useEventsPerDay(DAYS, until);
  if (!data) return null;

  const showCard = open ? "block" : "hidden";
  const showButton = open ? "hidden" : "";

  return (
    // La franja no captura clics: así el mapa sigue usable al lado del botón plegado.
    <div className={cn("pointer-events-none flex flex-col items-end lg:items-start", className)}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        className={cn(
          "pointer-events-auto flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2 text-sm font-semibold text-slate-800 shadow-lg ring-1 shadow-slate-900/10 ring-slate-900/10 backdrop-blur-md hover:bg-white focus-visible:outline-2 focus-visible:outline-blue-600",
          showButton,
        )}
      >
        <CircleDotIcon className="size-4 text-blue-600" />
        Eventos por día
        <ChevronDownIcon className="size-3.5 rotate-180 text-slate-400" />
      </button>

      <section
        aria-label="Eventos registrados por día"
        className={cn(
          "pointer-events-auto w-full rounded-2xl bg-white/95 p-3 shadow-xl ring-1 shadow-slate-900/15 ring-slate-900/10 backdrop-blur-md",
          showCard,
        )}
      >
        <header className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-slate-900">Eventos registrados por día</h2>
            <p className="text-[11px] text-slate-500">
              {data.total.toLocaleString("es-EC")} {data.total === 1 ? "evento" : "eventos"} en los últimos {DAYS} días · SNGR
            </p>
            {/* Leyenda con el total de cada grupo en el periodo, de arriba hacia abajo como en las columnas. */}
            <SeriesLegend
              series={[
                { ...OPEN, label: `Abiertos: ${data.open.toLocaleString("es-EC")}` },
                { ...WITHOUT_DAMAGE, label: `Sin afectaciones: ${data.withoutDamage.toLocaleString("es-EC")}` },
                { ...CLOSED, label: `Cerrados: ${data.closed.toLocaleString("es-EC")}` },
              ]}
              className="mt-1 flex-wrap gap-y-0.5 text-[11px] font-medium text-slate-600"
            />
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-expanded
            aria-label="Plegar el gráfico de eventos"
            className="-mt-0.5 -mr-0.5 grid size-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <ChevronDownIcon className="size-4" />
          </button>
        </header>

        <StackedBarChart
          bars={data.days.map((row) => ({
            key: String(row.index),
            values: { open: row.open, withoutDamage: row.withoutDamage, closed: row.closed },
            // Severidad de los abiertos con afectaciones (como en el panel): "1 crítico · 6 moderados".
            details: row.open > 0 ? [`De los abiertos: ${openSeverities(row.openBySeverity)}`] : [],
          }))}
          series={SERIES}
          height={112}
          label={`Eventos registrados cada día de los últimos ${DAYS}`}
          // El último bloque son las "últimas 24 h" del panel; los demás, de hora a hora.
          titleOf={(key) => {
            const row = data.days.find((item) => String(item.index) === key);
            if (!row || row.index === 0) return "Últimas 24 h";
            return `${formatDateTime(row.start)} – ${formatDateTime(row.end)}`;
          }}
          // Una fecha por semana, contando desde hoy hacia atrás (la última columna es hoy).
          axisLabelOf={(index) => ((DAYS - 1 - index) % 7 === 0 ? (index === DAYS - 1 ? "24 h" : formatDayMonth(data.days[index].end)) : null)}
          // En celular el recuadro está arriba del mapa: el cuadro del día sale por debajo (arriba lo taparía la barra).
          tooltipClassName="top-0 -translate-y-[105%] max-lg:top-full max-lg:translate-y-1"
        />
        <p className="mt-1 text-[10px] text-slate-400">
          Cada columna son 24 h, contadas hacia atrás desde la hora del panel de eventos: la última son sus «últimas 24 h». Estado de hoy
          en la SNGR. Sin afectaciones: moderados abiertos sin daños registrados (el panel de eventos los oculta).
        </p>
      </section>
    </div>
  );
}

/** "1 crítico · 1 alto · 6 moderados": de mayor a menor severidad, solo las que hubo. */
function openSeverities(counts: SeverityCounts): string {
  return SEVERITY_ORDER.flatMap((severity) => {
    const count = counts[severity] ?? 0;
    return count > 0 ? [`${count} ${SEVERITY_NAMES[severity][count === 1 ? 0 : 1]}`] : [];
  }).join(" · ");
}
