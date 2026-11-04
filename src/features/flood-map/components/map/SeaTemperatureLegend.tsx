import { formatSigned } from "@/lib/format";
import type { SeaTemperatureAnomaly } from "../../types";
import { LegendCard } from "./LegendCard";

/** Marcas de la escala (°C); la primera y la última son los extremos de la paleta. */
const TICKS = [-4, -2, 0, 3, 5, 7];

/** Leyenda de la anomalía de la temperatura del mar: azul más frío de lo normal, rojo más cálido. */
export function SeaTemperatureLegend({ legend }: { legend: SeaTemperatureAnomaly["legend"] }) {
  const entries = [...legend.entries].sort((a, b) => a.value - b.value);
  if (entries.length === 0) return null;
  const min = entries[0].value;
  const max = entries.at(-1)!.value;
  const position = (value: number) => ((value - min) / Math.max(max - min, 1)) * 100;
  const gradient = entries.map((entry) => `${entry.color} ${position(entry.value).toFixed(1)}%`).join(", ");
  const ticks = TICKS.filter((tick) => tick >= min && tick <= max);

  return (
    <LegendCard id="sea" label="Leyenda de la anomalía de temperatura del mar" title={`Anomalía del mar (${legend.unit})`}>
      <div
        role="img"
        aria-label={`Escala de ${formatSigned(min)} a ${formatSigned(max)} ${legend.unit}: azul más frío de lo normal, rojo más cálido`}
        className="h-2.5 rounded-full ring-1 ring-slate-900/10 ring-inset"
        style={{ backgroundImage: `linear-gradient(to right, ${gradient})` }}
      />
      <div className="relative mt-1 h-3.5 text-[10px] text-slate-600 tabular-nums" aria-hidden="true">
        {ticks.map((tick, index) => (
          <span
            key={tick}
            className="absolute top-0"
            style={{
              left: `${position(tick)}%`,
              // La primera marca se alinea a la izquierda y la última a la derecha para no salirse.
              transform: index === 0 ? "none" : index === ticks.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            {tick === 0 ? "0" : formatSigned(tick).replace(",0", "")}
          </span>
        ))}
      </div>
      <p className="mt-0.5 text-[10px] text-slate-500">Diferencia con la temperatura normal del día</p>
    </LegendCard>
  );
}
