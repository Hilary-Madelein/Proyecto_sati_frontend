import { GLYPH_PATHS, GLYPH_STROKE, type MapGlyph } from "../../map-glyphs";

/** El dibujo de un punto, del color de su clase, como se ve en el mapa de cerca (para leyendas). */
export function GlyphDot({ glyph, color, size = 20 }: { glyph: MapGlyph; color: string; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="-2 -2 28 28" className="shrink-0">
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {GLYPH_PATHS[glyph].map((d) => (
          <path key={`h${d}`} d={d} stroke="#ffffff" strokeWidth={GLYPH_STROKE.halo} />
        ))}
        {GLYPH_PATHS[glyph].map((d) => (
          <path key={d} d={d} stroke={color} strokeWidth={GLYPH_STROKE.stroke} />
        ))}
      </g>
    </svg>
  );
}
