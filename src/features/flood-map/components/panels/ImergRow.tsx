import { IconTile } from "@/components/ui/IconTile";
import { CloudRainIcon } from "@/components/ui/icons";
import { Toggle } from "@/components/ui/Toggle";
import { cn } from "@/lib/cn";
import { IMERG_LEGEND_URL } from "../../constants";
import { OpacitySlider } from "./OpacitySlider";

interface ImergRowProps {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
}

/**
 * Tasa de lluvia del satélite IMERG (NASA) en la última media hora, servida por
 * NASA GIBS. Es intensidad (mm/h), no acumulado. Fila del cuadro "Lluvia observada".
 */
export function ImergRow({ visible, onVisibleChange, opacity, onOpacityChange }: ImergRowProps) {
  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="flex items-center gap-3">
        <IconTile className="bg-teal-50 text-teal-700">
          <CloudRainIcon className="size-5" />
        </IconTile>
        <div className="min-w-0 flex-1">
          <h4 className={cn("text-sm font-semibold", visible ? "text-slate-900" : "text-slate-500")}>Lluvia IMERG (NASA)</h4>
          <p className="text-xs text-slate-500">Intensidad de la última media hora</p>
        </div>
        <Toggle checked={visible} onChange={onVisibleChange} label="Mostrar la lluvia IMERG de la NASA" />
      </div>
      {visible && (
        <div className="mt-3 space-y-2">
          <OpacitySlider value={opacity} onChange={onOpacityChange} layerName="la lluvia IMERG" />
          {/* Leyenda oficial de NASA GIBS (tasa de precipitación, mm/h). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={IMERG_LEGEND_URL} alt="Leyenda de la tasa de lluvia IMERG en mm/h" className="w-full rounded-md bg-white" />
          <p className="text-[11px] text-slate-500">
            Tasa de precipitación promedio de 30 minutos (mm/h), satélites GPM · NASA GIBS. Resolución gruesa (~10 km).
          </p>
        </div>
      )}
    </div>
  );
}
