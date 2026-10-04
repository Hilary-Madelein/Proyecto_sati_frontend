import { cn } from "@/lib/cn";

interface LegendItemProps {
  label: string;
  color: string;
  /** Color del borde (solo para "square"). */
  borderColor?: string;
  shape?: "circle" | "square";
  /** Cantidad de elementos en el mapa con este valor. */
  count?: number;
}

export function LegendItem({ label, color, borderColor, shape = "circle", count }: LegendItemProps) {
  return (
    <li className="flex items-center gap-2 text-xs text-slate-600">
      <span
        aria-hidden="true"
        className={cn("size-3 shrink-0", shape === "circle" ? "rounded-full" : "rounded-sm border-2")}
        style={{ backgroundColor: color, borderColor }}
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span className="font-semibold text-slate-900 tabular-nums">{count}</span>
      )}
    </li>
  );
}
