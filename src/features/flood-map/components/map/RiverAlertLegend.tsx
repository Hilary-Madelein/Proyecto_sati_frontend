import { RIVER_ALERT_LEVELS } from "../../constants";
import type { RiverAlertsSnapshot } from "../../types";
import { alertLevelForDay } from "../../utils";

interface RiverAlertLegendProps {
  snapshot: RiverAlertsSnapshot;
  /** Día del pronóstico que se ve en el mapa (índice 0 = primer día). */
  dayIndex: number;
}

/**
 * Leyenda flotante de las alertas por caudal: qué periodo de retorno indica cada
 * color de triángulo y cuántos tramos hay en cada nivel el día elegido.
 */
export function RiverAlertLegend({ snapshot, dayIndex }: RiverAlertLegendProps) {
  const counts = new Map<number, number>();
  for (const alert of snapshot.alerts) {
    const level = alertLevelForDay(alert, dayIndex);
    if (level > 0) counts.set(level, (counts.get(level) ?? 0) + 1);
  }

  return (
    <section
      aria-label="Leyenda de las alertas por caudal"
      className="rounded-xl bg-white/90 px-3 py-2.5 shadow-lg ring-1 shadow-slate-900/10 ring-slate-900/10 backdrop-blur-md"
    >
      <h2 className="text-xs font-semibold text-slate-900">Caudal sobre el periodo de retorno</h2>
      <ul className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
        {RIVER_ALERT_LEVELS.map(({ level, label, color }) => (
          <li key={level} className="flex items-center gap-1.5 text-[11px] text-slate-700">
            <TriangleSwatch color={color} />
            <span className="flex-1">{label}</span>
            <span className="font-semibold text-slate-900 tabular-nums">{(counts.get(level) ?? 0).toLocaleString("es-EC")}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Mismo triángulo que marca las alertas en el mapa (ver triangleSymbolHtml). */
function TriangleSwatch({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path d="M12 2.5 22.5 21h-21L12 2.5Z" fill={color} stroke="#1f2937" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 9v5.5" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17.6" r="1.2" fill="#1f2937" />
    </svg>
  );
}
