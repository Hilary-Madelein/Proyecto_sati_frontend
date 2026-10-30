"use client";

import { ChevronDownIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatCalendarDate } from "@/lib/format";
import { ACTION_LAYERS, type ActionKind, type WeekCount } from "../../action-timeline";
import { SeriesLegend, StackedBarChart, type ChartSeries } from "../charts/StackedBarChart";

const COLOR = Object.fromEntries(ACTION_LAYERS.map((layer) => [layer.kind, layer.color])) as Record<ActionKind, string>;
const SERIES: Record<ActionKind, ChartSeries> = {
  preventive: { key: "preventive", label: "Preventivas", plural: "preventivas", color: COLOR.preventive },
  response: { key: "response", label: "De respuesta", plural: "de respuesta", color: COLOR.response },
};

/**
 * Acciones que empezaron cada semana: columnas apiladas, con las cifras de la
 * semana al pasar el cursor o al enfocarla, y la misma información en una
 * tabla. Tocar una semana la elige; tocarla otra vez la quita.
 */
export function WeeklyActionsChart({
  weeks,
  kinds,
  selected,
  onSelect,
  undated,
}: {
  weeks: readonly WeekCount[];
  kinds: readonly ActionKind[];
  selected: string | null;
  onSelect: (week: string) => void;
  /** Acciones sin fecha de inicio: no caen en ninguna semana (la tabla lo aclara, para que el total cuadre con el resumen). */
  undated: number;
}) {
  const series = kinds.map((kind) => SERIES[kind]);
  return (
    <figure className="min-w-0 space-y-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-slate-800">Acciones por semana</span>
        <SeriesLegend series={series} />
      </figcaption>
      <StackedBarChart
        bars={weeks.map((row) => ({ key: row.week, values: { preventive: row.preventive, response: row.response } }))}
        series={series}
        height={140}
        label="Acciones que empezaron cada semana"
        titleOf={(week) => `Semana del ${formatCalendarDate(week)}`}
        // El mes, bajo la primera semana de cada uno.
        axisLabelOf={(index) =>
          index === 0 || weeks[index].week.slice(5, 7) !== weeks[index - 1].week.slice(5, 7)
            ? formatCalendarDate(weeks[index].week).split(" ")[1]
            : null
        }
        selected={selected}
        onSelect={onSelect}
      />
      <WeeksTable weeks={weeks} kinds={kinds} selected={selected} undated={undated} />
    </figure>
  );
}

/**
 * Las mismas cifras del gráfico en una tabla (plegada al inicio): cada semana
 * de lunes a domingo, de la más reciente a la más antigua, con el total de la
 * semana y de todo el periodo. La semana elegida en el gráfico va resaltada.
 */
function WeeksTable({
  weeks,
  kinds,
  selected,
  undated,
}: {
  weeks: readonly WeekCount[];
  kinds: readonly ActionKind[];
  selected: string | null;
  undated: number;
}) {
  const totalOf = (row: WeekCount) => kinds.reduce((sum, kind) => sum + row[kind], 0);
  const sums = Object.fromEntries(kinds.map((kind) => [kind, weeks.reduce((sum, row) => sum + row[kind], 0)])) as Record<ActionKind, number>;
  const showTotal = kinds.length > 1;
  // En celular, más compacta: así caben las cuatro columnas sin desplazarse de lado.
  const cell = "px-2 py-2 text-right tabular-nums sm:px-3";

  return (
    <details className="group overflow-hidden rounded-xl ring-1 ring-slate-200">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 select-none hover:text-slate-900 [&::-webkit-details-marker]:hidden">
        <ChevronDownIcon className="size-3.5 -rotate-90 transition group-open:rotate-0" />
        Ver las cifras en una tabla
      </summary>
      <div className="max-h-72 overflow-auto border-t border-slate-200">
        <table className="w-full text-xs sm:text-sm">
          <thead className="sticky top-0 z-1 bg-white text-[10px] tracking-wide text-slate-500 uppercase shadow-[0_1px_0_var(--color-slate-200)] sm:text-[11px]">
            <tr>
              <th scope="col" className="px-2 py-2 text-left font-semibold sm:px-3">
                Semana
              </th>
              {kinds.map((kind) => (
                <th key={kind} scope="col" className="px-2 py-2 text-right font-semibold sm:px-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-2 rounded-xs" style={{ backgroundColor: COLOR[kind] }} />
                    <span className="sm:hidden" aria-hidden="true">
                      {kind === "preventive" ? "Prev." : "Resp."}
                    </span>
                    <span className="max-sm:sr-only">{kind === "preventive" ? "Preventivas" : "Respuesta"}</span>
                  </span>
                </th>
              ))}
              {showTotal && (
                <th scope="col" className="px-2 py-2 text-right font-semibold sm:px-3">
                  Total
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[...weeks].reverse().map((row) => (
              <tr key={row.week} className={selected === row.week ? "bg-blue-50" : "even:bg-slate-50/60"}>
                <th scope="row" className="px-2 py-2 text-left font-normal whitespace-nowrap text-slate-700 sm:px-3">
                  {weekRange(row.week)}
                </th>
                {kinds.map((kind) => (
                  <td key={kind} className={cell}>
                    {row[kind] > 0 ? <span className="text-slate-900">{row[kind]}</span> : <span className="text-slate-300">–</span>}
                  </td>
                ))}
                {showTotal && <td className={cn(cell, "font-semibold text-slate-900")}>{totalOf(row) || <span className="font-normal text-slate-300">–</span>}</td>}
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 bg-slate-100 font-semibold text-slate-900 shadow-[0_-1px_0_var(--color-slate-200)]">
            <tr>
              <th scope="row" className="px-2 py-2 text-left sm:px-3">
                Total
              </th>
              {kinds.map((kind) => (
                <td key={kind} className={cell}>
                  {sums[kind]}
                </td>
              ))}
              {showTotal && <td className={cell}>{kinds.reduce((sum, kind) => sum + sums[kind], 0)}</td>}
            </tr>
          </tfoot>
        </table>
      </div>
      {undated > 0 && (
        <p className="border-t border-slate-200 px-3 py-2 text-[11px] text-slate-500">
          {undated === 1 ? "1 acción no tiene fecha de inicio y no entra" : `${undated} acciones no tienen fecha de inicio y no entran`} en ninguna semana.
        </p>
      )}
    </details>
  );
}

/** "26 oct – 1 nov": la semana de lunes a domingo. */
function weekRange(monday: string): string {
  const sunday = new Date(Date.parse(`${monday}T00:00:00Z`) + 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return `${formatCalendarDate(monday)} – ${formatCalendarDate(sunday)}`;
}
