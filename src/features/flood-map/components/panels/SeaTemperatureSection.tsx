import { IconTile } from "@/components/ui/IconTile";
import { WavesIcon } from "@/components/ui/icons";
import { Toggle } from "@/components/ui/Toggle";
import { cn } from "@/lib/cn";
import { formatDateTime, formatSigned } from "@/lib/format";
import type { SeaTemperatureAnomaly } from "../../types";
import { LoadingBadge, Notice } from "./RainForecastSection";
import { SectionHeading } from "./SectionHeading";

interface SeaTemperatureSectionProps {
  /** Null si el backend no pudo informar la temperatura del mar. */
  sea: SeaTemperatureAnomaly | null;
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  isLoading: boolean;
}

/**
 * Cuánto más cálido (o frío) está el mar que lo normal frente a Ecuador, el
 * indicador con el que se vigila El Niño. No es pronóstico: es el dato diario más reciente.
 */
export function SeaTemperatureSection({ sea, visible, onVisibleChange, isLoading }: SeaTemperatureSectionProps) {
  return (
    <section>
      <SectionHeading aside={isLoading && visible && <LoadingBadge />}>Océano · El Niño</SectionHeading>

      <div className={cn("rounded-xl p-3 ring-1 transition-colors", visible ? "bg-white ring-slate-200" : "bg-slate-50/70 ring-slate-200/70")}>
        <div className="flex items-center gap-3">
          <IconTile className="bg-orange-50 text-orange-600">
            <WavesIcon className="size-5" />
          </IconTile>
          <div className="min-w-0 flex-1">
            <h4 className={cn("text-sm font-semibold", visible ? "text-slate-900" : "text-slate-500")}>
              Anomalía de temperatura del mar
            </h4>
            <p className="text-xs text-slate-500">
              {sea ? `Dato del ${formatDateTime(sea.time)}` : "Sin conexión con la fuente"}
            </p>
          </div>
          <Toggle checked={visible} onChange={onVisibleChange} label="Mostrar anomalía de la temperatura del mar" />
        </div>

        {visible && sea && (
          <div className="mt-3 space-y-2">
            {sea.nino12Anomaly !== null && (
              <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-xs text-slate-600">
                Región Niño 1+2 (costa de Ecuador y Perú):{" "}
                <strong className="font-semibold text-slate-900 tabular-nums">{formatSigned(sea.nino12Anomaly)} °C</strong>{" "}
                sobre lo normal
              </p>
            )}
            <p className="text-[11px] text-slate-500">
              En el mapa va de{" "}
              <strong className="font-semibold text-slate-700 tabular-nums">{formatSigned(sea.minAnomaly)}</strong> a{" "}
              <strong className="font-semibold text-slate-700 tabular-nums">{formatSigned(sea.maxAnomaly)} °C</strong>. Haz clic en el
              mar para ver la temperatura de un punto.
            </p>
            {sea.isStale && <Notice>El dato tiene varios días de atraso: la fuente no se está actualizando.</Notice>}
            <p className="text-[11px] text-slate-500">{sea.attribution.replace("Temperatura del mar: ", "")}</p>
          </div>
        )}
      </div>
    </section>
  );
}
