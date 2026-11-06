import { Toggle } from "@/components/ui/Toggle";

/** Quita del mapa (o vuelve a poner) lo de un panel sin cerrarlo: la lista sigue igual. */
export function ShowOnMapToggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
      <span className="text-xs font-medium text-slate-700">Mostrar en el mapa</span>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}
