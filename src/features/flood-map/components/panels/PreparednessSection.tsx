import { useState } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { cn } from "@/lib/cn";
import { PREPAREDNESS_INDICATOR_LABELS, PREPAREDNESS_LEVEL_STYLES, PREPAREDNESS_RATES } from "../../constants";
import type { PreparednessIndicator, PreparednessLevel, ProvincePreparedness } from "../../types";
import { Notice } from "./RainForecastSection";
import { SectionHeading } from "./SectionHeading";

interface PreparednessSectionProps {
  /** Las 24 provincias, de la más a la menos preparada; null mientras se calcula. */
  provinces: ProvincePreparedness[] | null;
  /** Peso de cada indicador (suman 1); null si el backend no lo informa. */
  weights: Record<PreparednessIndicator, number> | null;
  error: string | null;
  isLoading: boolean;
  /** Pintar las provincias con su nivel en el mapa. */
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
}

const LEVELS: readonly PreparednessLevel[] = ["very-high", "high", "medium", "low", "very-low"];
const INDICATORS: readonly PreparednessIndicator[] = ["shelters", "camps", "preventiveActions", "roadProjects"];
const formatIndex = (value: number) => value.toLocaleString("es-EC", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const formatKm = (value: number) => Math.round(value).toLocaleString("es-EC");

/** Cada cuánto hay uno: "1 cada 32 km²" o "1 cada 172 km de vía"; null si el backend no manda el área ni la red vial. */
function rateText(province: ProvincePreparedness, indicator: PreparednessIndicator): string | null {
  const { by, unit } = PREPAREDNESS_RATES[indicator];
  const size = by === "area" ? province.areaKm2 : province.rveKm;
  const count = province.counts[indicator];
  if (size === undefined || count === 0) return null;
  return `1 cada ${formatKm(size / count)} ${unit}`;
}

/**
 * Índice Simplificado de Preparación Provincial frente al Fenómeno de El Niño
 * (ISPP-FEN): al encenderlo, las provincias se pintan en el mapa y se ve el
 * ranking de las 24 con su semáforo de cinco niveles y, al elegir una, los
 * cuatro indicadores con su conteo y su tasa (por área o por km de vía).
 */
export function PreparednessSection({ provinces, weights, error, isLoading, visible, onVisibleChange }: PreparednessSectionProps) {
  const [openCode, setOpenCode] = useState<string | null>(null);

  return (
    <section>
      <SectionHeading>Índice de preparación provincial</SectionHeading>
      <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-slate-900">Preparación frente a El Niño (ISPP-FEN)</h4>
            <p className="text-xs text-slate-500">Compara las 24 provincias según sus recursos y acciones de preparación.</p>
          </div>
          <Toggle checked={visible} onChange={onVisibleChange} label="Mostrar el índice de preparación en el mapa" />
        </div>

        {/* Apagado, solo el título: las cifras se ven al encenderlo. */}
        {!visible ? null : !provinces ? (
          <div className="mt-3">
            {error ? (
              <Notice>{error}</Notice>
            ) : (
              <p className="flex items-center gap-2 text-xs text-slate-500">
                {isLoading && <span className="size-3.5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />}
                Calculando el índice…
              </p>
            )}
          </div>
        ) : (
          <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
            {/* Cuántas provincias hay en cada nivel. */}
            <ul className="grid grid-cols-5 gap-1">
              {LEVELS.map((level) => (
                <li key={level} className="rounded-lg bg-slate-50 px-1 py-1.5 text-center ring-1 ring-slate-200/70">
                  <span className="block text-base font-semibold text-slate-900 tabular-nums">
                    {provinces.filter((province) => province.level === level).length}
                  </span>
                  <span className="flex items-center justify-center gap-1 text-[10px] leading-tight text-slate-500">
                    <LevelDot level={level} />
                    {PREPAREDNESS_LEVEL_STYLES[level].label}
                  </span>
                </li>
              ))}
            </ul>

            <ol className="space-y-1">
              {provinces.map((province, position) => (
                <li key={province.code}>
                  <ProvinceRow
                    province={province}
                    position={position + 1}
                    open={openCode === province.code}
                    onToggle={() => setOpenCode((current) => (current === province.code ? null : province.code))}
                  />
                </li>
              ))}
            </ol>

            <Legend weights={weights} />
          </div>
        )}
      </div>
    </section>
  );
}

function ProvinceRow({
  province,
  position,
  open,
  onToggle,
}: {
  province: ProvincePreparedness;
  position: number;
  open: boolean;
  onToggle: () => void;
}) {
  const style = PREPAREDNESS_LEVEL_STYLES[province.level];
  return (
    <div className={cn("rounded-lg ring-1 transition-colors", open ? "bg-white ring-blue-600/40" : "ring-transparent")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
      >
        <span className="w-4 shrink-0 text-right text-[10px] text-slate-400 tabular-nums">{position}</span>
        <span className="w-28 shrink-0 truncate text-xs font-medium text-slate-800">{province.name}</span>
        {/* Barra del índice (0–100) con el color de su nivel. */}
        <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
          <span className="block h-full rounded-full" style={{ width: `${province.index}%`, backgroundColor: style.color }} />
        </span>
        <span className="w-8 shrink-0 text-right text-xs font-semibold text-slate-900 tabular-nums">{formatIndex(province.index)}</span>
      </button>
      {open && (
        <dl className="grid grid-cols-2 gap-1.5 border-t border-slate-100 p-2">
          {INDICATORS.map((indicator) => (
            <div key={indicator} className="flex flex-col rounded-md bg-slate-50 p-1.5 ring-1 ring-slate-200/70">
              <dt className="text-[10px] leading-tight text-slate-500">{PREPAREDNESS_INDICATOR_LABELS[indicator]}</dt>
              <dd className="order-first text-sm font-semibold text-slate-900 tabular-nums">
                {province.counts[indicator].toLocaleString("es-EC")}
              </dd>
              {province.counts[indicator] > 0 && rateText(province, indicator) && (
                <dd className="text-[10px] text-slate-500 tabular-nums">{rateText(province, indicator)}</dd>
              )}
            </div>
          ))}
          <p className="col-span-2 text-[10px] text-slate-500">
            Nivel: <strong className="font-semibold text-slate-700">{style.label}</strong> · índice {formatIndex(province.index)} de 100.
            {province.areaKm2 !== undefined &&
              province.rveKm !== undefined &&
              ` Área ${formatKm(province.areaKm2)} km² · Red Vial Estatal ${formatKm(province.rveKm)} km.`}
          </p>
        </dl>
      )}
    </div>
  );
}

const percent = (weight: number) => `${Math.round(weight * 100)} %`;

function Legend({ weights }: { weights: Record<PreparednessIndicator, number> | null }) {
  return (
    <div className="space-y-1.5 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600 ring-1 ring-slate-200/70">
      <p className="font-semibold">¿Cómo se calcula?</p>
      <p>
        Cada conteo se divide por el tamaño de la provincia: los alojamientos por su área y los campamentos, acciones
        preventivas y proyectos viales por los km de Red Vial Estatal que tiene. Esa tasa se compara con la provincia de tasa más
        alta (100) y se multiplica por su peso; el índice es la suma.
        {weights && " Pesos:"}
      </p>
      {weights && (
        <ul className="space-y-0.5">
          {INDICATORS.map((indicator) => (
            <li key={indicator} className="flex justify-between gap-2">
              <span>{PREPAREDNESS_INDICATOR_LABELS[indicator]}</span>
              <span className="font-semibold tabular-nums">{percent(weights[indicator])}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-slate-500">
        Cada registro cuenta en la provincia que indica la institución. Alojamientos: todos los registrados por la SNGR
        (albergues y campamentos calificados). Acciones preventivas: las ya iniciadas. Obras viales: en ejecución o terminadas,
        sin contar dos veces la misma obra.
      </p>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        {LEVELS.map((level) => (
          <li key={level} className="flex items-center gap-1.5">
            <LevelDot level={level} />
            {PREPAREDNESS_LEVEL_STYLES[level].label} · {PREPAREDNESS_LEVEL_STYLES[level].range}
          </li>
        ))}
      </ul>
      <p className="text-slate-500">Es un índice relativo de acciones de preparación, no mide la capacidad real frente a El Niño.</p>
    </div>
  );
}

function LevelDot({ level }: { level: PreparednessLevel }) {
  return (
    <span
      aria-hidden="true"
      className="size-2 shrink-0 rounded-full"
      style={{ backgroundColor: PREPAREDNESS_LEVEL_STYLES[level].color, boxShadow: "0 0 0 1px rgb(0 0 0 / 0.15)" }}
    />
  );
}
