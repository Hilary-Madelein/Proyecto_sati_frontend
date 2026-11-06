"use client";

import type { ReactNode } from "react";
import { ChevronDownIcon, MapPinIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

interface SummarySidebarProps {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  title: string;
  subtitle: string;
  children: ReactNode;
}

/**
 * Barra lateral que se despliega y se comprime, como el menú de una página web.
 * Comprimida queda una franja con su nombre. Desplegada, en pantallas grandes corre
 * el mapa a un lado (no lo tapa); en el celular se abre encima del mapa.
 */
export function SummarySidebar({ expanded, onExpandedChange, title, subtitle, children }: SummarySidebarProps) {
  return (
    <aside
      aria-label={title}
      className={cn(
        "relative z-1100 flex shrink-0 border-r border-slate-200 bg-white transition-[width] duration-200 ease-out motion-reduce:transition-none",
        expanded ? "w-11 lg:w-80" : "w-11",
      )}
    >
      {/* Franja: siempre visible, despliega y comprime. */}
      <button
        type="button"
        onClick={() => onExpandedChange(!expanded)}
        aria-expanded={expanded}
        title={expanded ? "Comprimir el resumen" : "Desplegar el resumen"}
        className={cn(
          "flex h-full w-11 shrink-0 flex-col items-center gap-3 py-3 text-slate-600 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600",
          expanded && "lg:hidden",
        )}
      >
        <span className="grid size-7 place-items-center rounded-lg bg-blue-600 text-white">
          <MapPinIcon className="size-4" />
        </span>
        <ChevronDownIcon className={cn("size-4 transition-transform", expanded ? "rotate-90" : "-rotate-90")} />
        <span className="text-xs font-semibold tracking-wide [writing-mode:vertical-rl] rotate-180">Resumen</span>
      </button>

      {expanded && (
        <div
          className={cn(
            "flex min-w-0 flex-col bg-white",
            // Celular: encima del mapa, al lado de la franja. Escritorio: ocupa el ancho de la barra.
            "max-lg:absolute max-lg:inset-y-0 max-lg:left-11 max-lg:w-[min(20rem,calc(100vw-3.5rem))] max-lg:shadow-2xl lg:w-full",
          )}
        >
          <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-slate-900 max-lg:text-[13px]">{title}</h2>
              <p className="text-xs text-slate-500 max-lg:text-[11px]">{subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => onExpandedChange(false)}
              aria-label="Comprimir el resumen"
              title="Comprimir el resumen"
              className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              <ChevronDownIcon className="size-4 rotate-90" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
        </div>
      )}
    </aside>
  );
}
