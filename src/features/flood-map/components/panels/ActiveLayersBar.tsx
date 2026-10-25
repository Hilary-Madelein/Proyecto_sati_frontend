import { CloseIcon } from "@/components/ui/icons";
import { RISK_COMPONENTS } from "../../constants";
import type { ActiveLayer } from "../../types";

/**
 * Capas encendidas en el mapa, de todas las pestañas: deja ver de un vistazo qué
 * se está superponiendo (p. ej. amenaza y exposición) y apagar cualquiera sin
 * tener que buscar su pestaña.
 */
export function ActiveLayersBar({ layers }: { layers: ActiveLayer[] }) {
  if (layers.length === 0) return null;
  const labelOf = (id: ActiveLayer["component"]) => RISK_COMPONENTS.find((item) => item.id === id)?.label ?? "";

  return (
    <div className="rounded-xl bg-blue-50/70 p-2.5 ring-1 ring-blue-600/10">
      <p className="text-[11px] font-semibold text-slate-700">
        En el mapa · {layers.length} {layers.length === 1 ? "capa" : "capas"}
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {layers.map((layer) => (
          <li key={layer.key}>
            <button
              type="button"
              onClick={layer.turnOff}
              title={`Apagar ${layer.label.toLowerCase()}`}
              className="flex items-center gap-1.5 rounded-full bg-white py-1 pr-1.5 pl-2.5 text-[11px] text-slate-700 shadow-sm ring-1 ring-slate-900/10 transition hover:text-slate-900 hover:ring-slate-900/20 focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              <span className="font-medium">{layer.label}</span>
              <span className="text-slate-400">{labelOf(layer.component)}</span>
              <CloseIcon className="size-3 text-slate-400" />
              <span className="sr-only">: apagar</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
