import type { ReactNode } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { cn } from "@/lib/cn";

interface LayerCardProps {
  title: string;
  /** Texto corto bajo el título, p. ej. "16 estaciones". */
  meta: string;
  icon: ReactNode;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  /** Elementos <LegendItem />; solo se muestran con la capa encendida. */
  children: ReactNode;
}

export function LayerCard({ title, meta, icon, enabled, onToggle, children }: LayerCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl p-3 ring-1 transition-colors",
        enabled ? "bg-white ring-slate-200" : "bg-slate-50/70 ring-slate-200/70",
      )}
    >
      <div className="flex items-center gap-3">
        {icon}
        <div className="min-w-0 flex-1">
          <h4 className={cn("text-sm font-semibold", enabled ? "text-slate-900" : "text-slate-500")}>{title}</h4>
          <p className="text-xs text-slate-500">{meta}</p>
        </div>
        <Toggle checked={enabled} onChange={onToggle} label={`Mostrar ${title.toLowerCase()}`} />
      </div>
      {enabled && <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-3">{children}</ul>}
    </div>
  );
}
