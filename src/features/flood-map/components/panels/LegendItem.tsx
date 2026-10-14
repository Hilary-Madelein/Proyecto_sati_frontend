import { cn } from "@/lib/cn";

interface LegendItemProps {
  label: string;
  color: string;
  /** Color del borde (solo para "square"). */
  borderColor?: string;
  shape?: "circle" | "square" | "diamond";
  /** Cantidad de elementos en el mapa con este valor. */
  count?: number;
  /** Solo "diamond": lado en px (como en el mapa) y si va hueco. */
  sizePx?: number;
  hollow?: boolean;
}

export function LegendItem({ label, color, borderColor, shape = "circle", count, sizePx, hollow }: LegendItemProps) {
  return (
    <li className="flex items-center gap-2 text-xs text-slate-600">
      {shape === "diamond" && sizePx ? (
        // Rombo del tamaño del mapa (a escala), centrado en un recuadro fijo para que los textos queden alineados.
        <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center">
          <span
            className="rotate-45 rounded-[2px]"
            style={{
              width: sizePx * 0.8,
              height: sizePx * 0.8,
              backgroundColor: hollow ? "#ffffff" : color,
              boxShadow: hollow ? `inset 0 0 0 2px ${color}` : undefined,
            }}
          />
        </span>
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "shrink-0",
            shape === "circle" && "size-3 rounded-full",
            shape === "square" && "size-3 rounded-sm border-2",
            // Un poco más chico: girado ocupa lo mismo que los otros.
            shape === "diamond" && "mx-px size-2.5 rotate-45 rounded-[2px]",
          )}
          style={{ backgroundColor: color, borderColor }}
        />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span className="font-semibold text-slate-900 tabular-nums">{count}</span>
      )}
    </li>
  );
}
