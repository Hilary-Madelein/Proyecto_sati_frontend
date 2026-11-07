import { cn } from "@/lib/cn";
import type { MapGlyph } from "../../map-glyphs";
import { GlyphDot } from "./GlyphDot";

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
  /** Solo "square": borde punteado y sin relleno (como las líneas punteadas del mapa). */
  dashed?: boolean;
  /** Punto con dibujo (puente, maquinaria, cierre): se muestra así, como en el mapa de cerca. */
  glyph?: MapGlyph;
  /** Con esto la clase es un botón que la muestra u oculta en el mapa; `hidden`: está oculta. */
  onToggle?: () => void;
  hidden?: boolean;
}

export function LegendItem({ label, color, borderColor, shape = "circle", count, sizePx, hollow, dashed, glyph, onToggle, hidden }: LegendItemProps) {
  const content = (
    <>
      {glyph ? (
        <GlyphDot glyph={glyph} color={color} />
      ) : shape === "diamond" && sizePx ? (
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
            shape === "square" && dashed && "border-dashed",
            // Un poco más chico: girado ocupa lo mismo que los otros.
            shape === "diamond" && "mx-px size-2.5 rotate-45 rounded-[2px]",
          )}
          style={{ backgroundColor: shape === "square" && dashed ? "transparent" : color, borderColor }}
        />
      )}
      <span className={cn("min-w-0 flex-1 truncate", hidden && "text-slate-400 line-through")}>{label}</span>
      {count !== undefined && (
        <span className={cn("font-semibold tabular-nums", hidden ? "text-slate-400" : "text-slate-900")}>{count}</span>
      )}
    </>
  );
  if (!onToggle) return <li className="flex items-center gap-2 text-xs text-slate-600">{content}</li>;
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={!hidden}
        title={`${hidden ? "Mostrar" : "Ocultar"}: ${label.toLowerCase()}`}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-xs text-slate-600 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600",
          hidden && "opacity-60",
        )}
      >
        {content}
      </button>
    </li>
  );
}
