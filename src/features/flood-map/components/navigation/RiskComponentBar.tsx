"use client";

import type { ReactNode } from "react";
import { AlertTriangleIcon, MapPinIcon, RefreshIcon, ShieldIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { RISK_COMPONENTS } from "../../constants";
import type { RiskComponentId } from "../../types";

export const RISK_COMPONENT_ICONS: Record<RiskComponentId, (props: { className?: string }) => ReactNode> = {
  amenaza: AlertTriangleIcon,
  exposicion: MapPinIcon,
  preparacion: ShieldIcon,
  respuesta: RefreshIcon,
};

/** Frase corta bajo cada botón en pantallas anchas. */
const SHORT_DESCRIPTIONS: Record<RiskComponentId, string> = {
  amenaza: "Lluvia, ríos e inundaciones",
  exposicion: "Vías, puentes y servicios",
  preparacion: "Recursos y prevención",
  respuesta: "Atención y recuperación",
};

interface RiskComponentBarProps {
  value: RiskComponentId;
  onSelect: (value: RiskComponentId) => void;
  /** Capas encendidas de cada componente. */
  activeCounts: Record<RiskComponentId, number>;
}

/**
 * Navegación principal de la herramienta: Amenaza · Exposición · Preparación ·
 * Respuesta. Elegir uno muestra sus capas en el panel de capas; las capas ya
 * encendidas de los demás siguen en el mapa, así se cruzan entre componentes.
 */
export function RiskComponentBar({ value, onSelect, activeCounts }: RiskComponentBarProps) {
  return (
    <nav aria-label="Componentes de la gestión del riesgo" className="relative z-1200 shrink-0 border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-2 py-1.5 sm:px-4 sm:py-2">
        <p className="hidden shrink-0 text-[11px] leading-tight font-semibold tracking-wider text-slate-500 uppercase xl:block">
          Gestión
          <br />
          del riesgo
        </p>
        <ul className="grid flex-1 grid-cols-4 gap-1 sm:gap-2">
          {RISK_COMPONENTS.map((item) => {
            const Icon = RISK_COMPONENT_ICONS[item.id];
            const selected = item.id === value;
            const count = activeCounts[item.id];
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(item.id)}
                  title={item.description}
                  className={cn(
                    "group relative flex w-full items-center justify-center gap-1 rounded-xl px-1 py-1.5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
                    "max-sm:flex-col sm:justify-start sm:gap-2.5 sm:px-3 sm:py-2",
                    selected
                      ? "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-lg transition sm:size-8",
                      selected ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30" : "bg-slate-100 text-slate-500 group-hover:bg-white",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 text-center sm:text-left">
                    <span className="block truncate text-[11px] font-semibold sm:text-sm">{item.label}</span>
                    <span className={cn("hidden truncate text-[11px] xl:block", selected ? "text-blue-700/70" : "text-slate-500")}>
                      {SHORT_DESCRIPTIONS[item.id]}
                    </span>
                  </span>
                  {count > 0 && (
                    <span
                      className={cn(
                        "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-bold tabular-nums",
                        "max-sm:absolute max-sm:top-0.5 max-sm:right-1 sm:ml-auto",
                        selected ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-700",
                      )}
                    >
                      {count}
                      <span className="sr-only"> capas encendidas</span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
