"use client";

import { useState } from "react";
import { ChevronDownIcon, CircleDotIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatCalendarDate } from "@/lib/format";
import { SEVERITY_ORDER } from "../../constants";
import { useEventsPerDay } from "../../hooks/useEventsPerDay";
import type { EventSeverity } from "../../types";
import { StackedBarChart, type ChartSeries } from "../charts/StackedBarChart";

/** Días que muestra el gráfico, hasta hoy. */
const DAYS = 30;
const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
/**
 * Una sola serie, el total del día. Por severidad no se apila: sus colores (rojo,
 * naranja y amarillo) no se distinguen entre sí apilados, y casi todos son moderados.
 * La severidad va en el cuadro de cada día.
 */
const SERIES: readonly ChartSeries[] = [{ key: "total", label: "Eventos", plural: "eventos", color: "#2563eb" }];
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
export function EventsPerDayWidget({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const { data } = useEventsPerDay(DAYS);
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
            key: row.day,
            values: { total: row.total },
            // De mayor a menor severidad, solo las que hubo: "3 altos", "22 moderados".
            details: SEVERITY_ORDER.flatMap((severity) => {
              const count = row.counts[severity] ?? 0;
              return count > 0 ? [`${count} ${SEVERITY_NAMES[severity][count === 1 ? 0 : 1]}`] : [];
            }),
          }))}
          series={SERIES}
          height={112}
          label={`Eventos registrados cada día de los últimos ${DAYS}`}
          titleOf={(day) => `${WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()]} ${formatCalendarDate(day)}`}
          // Una fecha por semana, contando desde hoy hacia atrás (la última columna es hoy).
          axisLabelOf={(index) => ((DAYS - 1 - index) % 7 === 0 ? (index === DAYS - 1 ? "hoy" : formatCalendarDate(data.days[index].day)) : null)}
          // En celular el recuadro está arriba del mapa: el cuadro del día sale por debajo (arriba lo taparía la barra).
          tooltipClassName="top-0 -translate-y-[105%] max-lg:top-full max-lg:translate-y-1"
        />
        <p className="mt-1 text-[10px] text-slate-400">Abiertos y cerrados, según el día en que ocurrieron.</p>
      </section>
    </div>
  );
}
