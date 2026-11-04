"use client";

import { useState, type ReactNode } from "react";
import { ChevronDownIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/**
 * Leyendas comprimidas en esta visita. Fuera del componente: una leyenda se desmonta
 * mientras carga su capa (p. ej. al cambiar de 3 a 6 h) y no debe volver a abrirse sola.
 */
const compressed = new Set<string>();

/** Marco de una leyenda flotante: su título comprime o despliega el contenido. */
export function LegendCard({ id, label, title, children }: { id: string; label: string; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(() => !compressed.has(id));
  const toggle = () => {
    if (open) compressed.add(id);
    else compressed.delete(id);
    setOpen(!open);
  };

  return (
    <section
      aria-label={label}
      className={cn(
        "rounded-xl bg-white/90 shadow-lg ring-1 shadow-slate-900/10 ring-slate-900/10 backdrop-blur-md",
        // Comprimida ocupa solo lo que mide su título: así deja más mapa a la vista.
        !open && "self-start",
      )}
    >
      <h2>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          title={open ? "Comprimir la leyenda" : "Desglosar la leyenda"}
          className="flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-900 transition hover:bg-slate-900/5 focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <span className="min-w-0 flex-1">{title}</span>
          <ChevronDownIcon aria-hidden="true" className={cn("mt-px size-3.5 shrink-0 text-slate-500 transition-transform motion-reduce:transition-none", open && "rotate-180")} />
        </button>
      </h2>
      {open && <div className="px-3 pb-2.5">{children}</div>}
    </section>
  );
}
