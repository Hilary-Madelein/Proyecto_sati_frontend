import type { RainLegend as RainLegendData } from "../../types";

interface RainLegendProps {
  legends: RainLegendData[];
  /** Capas de lluvia visibles, p. ej. ["Pronóstico 24 h", "Satélite PERSIANN 24 h"]. */
  sources: string[];
}

const formatValue = (value: number) => Math.round(value).toLocaleString("es-EC");

/** Marcas de la escala: el mínimo, múltiplos "redondos" y el máximo con "+". */
function ticksFor(min: number, max: number) {
  const step = Math.max(5, Math.round((max - min) / 5 / 5) * 5);
  const ticks = [{ value: min, label: formatValue(min) }];
  for (let value = step; value < max - step / 2; value += step) ticks.push({ value, label: formatValue(value) });
  ticks.push({ value: max, label: `${formatValue(max)}+` });
  return ticks;
}

/** Leyenda flotante de la lluvia (pronosticada u observada) con la paleta oficial. */
export function RainLegend({ legends, sources }: RainLegendProps) {
  if (legends.length === 0) return null;

  return (
    <section
      aria-label="Leyenda de lluvia"
      className="rounded-xl bg-white/90 px-3 py-2.5 shadow-lg ring-1 shadow-slate-900/10 ring-slate-900/10 backdrop-blur-md"
    >
      <h2 className="text-xs font-semibold text-slate-900">Lluvia ({legends[0].unit})</h2>
      {legends.map((legend) => (
        <LegendScale key={legend.id} legend={legend} />
      ))}
      {sources.length > 0 && <p className="mt-1 text-[10px] leading-snug text-slate-400">{sources.join(" · ")}</p>}
    </section>
  );
}

function LegendScale({ legend }: { legend: RainLegendData }) {
  const entries = [...legend.entries].sort((a, b) => a.value - b.value);
  if (entries.length === 0) return null;
  const min = entries[0].value;
  const max = entries.at(-1)!.value;
  const span = Math.max(max - min, 1);
  const position = (value: number) => ((value - min) / span) * 100;

  const gradient = entries.map((entry) => `${entry.color} ${position(entry.value).toFixed(1)}%`).join(", ");
  const ticks = ticksFor(min, max);

  return (
    <div className="mt-1.5">
      <div
        role="img"
        aria-label={`Escala de ${formatValue(min)} a ${formatValue(max)} ${legend.unit} o más`}
        className="h-2.5 rounded-full ring-1 ring-slate-900/10 ring-inset"
        style={{ backgroundImage: `linear-gradient(to right, ${gradient})` }}
      />
      <div className="relative mt-1 h-3.5 text-[10px] text-slate-600 tabular-nums" aria-hidden="true">
        {ticks.map((tick, index) => (
          <span
            key={tick.value}
            className="absolute top-0"
            style={{
              left: `${position(tick.value)}%`,
              // La primera marca se alinea a la izquierda y la última a la derecha para no salirse.
              transform: index === 0 ? "none" : index === ticks.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            {tick.label}
          </span>
        ))}
      </div>
      <p className="mt-0.5 text-[10px] text-slate-500">
        Sin color: menos de {formatValue(min)} {legend.unit}
      </p>
    </div>
  );
}
