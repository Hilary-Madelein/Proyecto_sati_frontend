import { IconTile } from "@/components/ui/IconTile";
import { MapIcon } from "@/components/ui/icons";
import { Toggle } from "@/components/ui/Toggle";
import { cn } from "@/lib/cn";
import { PROVINCIAL_ROADS_LAYER } from "../../constants";
import { OpacitySlider } from "./OpacitySlider";

/**
 * Red vial provincial (teselas del SNGR). Va en la sección "Vías" de Exposición,
 * con el mismo aspecto que las demás capas. El servicio solo trae el trazado:
 * no hay conteo, leyenda por estado ni ficha al tocarla.
 */
export function ProvincialRoadsRow({
  visible,
  onVisibleChange,
  opacity,
  onOpacityChange,
}: {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
}) {
  return (
    <li
      className={cn(
        "rounded-xl p-3 ring-1 transition-colors",
        visible
          ? "bg-white ring-slate-200"
          : "bg-slate-50/70 ring-slate-200/70",
      )}
    >
      <div className="flex items-center gap-3">
        <IconTile className="bg-slate-100">
          <span style={{ color: PROVINCIAL_ROADS_LAYER.color }}>
            <MapIcon className="size-5" />
          </span>
        </IconTile>
        <div className="min-w-0 flex-1">
          <h4
            className={cn(
              "text-sm font-semibold",
              visible ? "text-slate-900" : "text-slate-500",
            )}
          >
            Red vial provincial
          </h4>
          <p className="text-xs text-slate-500">
            Vías a cargo de los gobiernos provinciales.
          </p>
        </div>
        <Toggle
          checked={visible}
          onChange={onVisibleChange}
          label="Mostrar red vial provincial"
        />
      </div>
      {visible && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <OpacitySlider
            value={opacity}
            onChange={onOpacityChange}
            layerName="la red vial provincial"
          />
          <p className="text-[11px] text-slate-500">
            Se ve al acercar el mapa a nivel de ciudad, como en el servicio
            original. Solo trae el trazado: sin nombre ni estado de cada vía.
            Fuente: SNGR.
          </p>
        </div>
      )}
    </li>
  );
}
