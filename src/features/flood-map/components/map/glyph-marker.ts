import L from "leaflet";
import { drawGlyph, GLYPH_MIN_ZOOM, type MapGlyph } from "../../map-glyphs";

export interface GlyphMarkerOptions extends L.CircleMarkerOptions {
  glyph: MapGlyph;
}

type Drawable = L.CircleMarker & {
  options: GlyphMarkerOptions;
  _renderer: unknown;
  _map: L.Map | null;
  _point: L.Point;
  _radius: number;
  _empty: () => boolean;
};

/**
 * Punto que de cerca es su dibujo (puente, maquinaria, cierre…) pintado del color de
 * su estado, en el lienzo; se toca como un círculo. Más lejos que GLYPH_MIN_ZOOM es
 * un punto de color común (a escala nacional los dibujos serían una mancha).
 */
export const GlyphMarker = L.CircleMarker.extend({
  _updatePath(this: Drawable) {
    const renderer = this._renderer as { _drawing: boolean; _ctx: CanvasRenderingContext2D; _fillStroke: (ctx: CanvasRenderingContext2D, layer: unknown) => void };
    if (!renderer._drawing || this._empty()) return;
    const { x, y } = this._point;
    const ctx = renderer._ctx;
    if (this._map && this._map.getZoom() >= GLYPH_MIN_ZOOM) {
      // Solo el dibujo, del color del punto (con borde blanco: se ve sobre cualquier fondo).
      ctx.save();
      ctx.globalAlpha = this.options.opacity ?? 1;
      drawGlyph(ctx, this.options.glyph, x, y, this._radius * 2.1, String(this.options.fillColor ?? this.options.color));
      ctx.restore();
      return;
    }
    ctx.beginPath();
    ctx.arc(x, y, this._radius, 0, Math.PI * 2);
    renderer._fillStroke(ctx, this);
  },
}) as unknown as new (latlng: L.LatLngExpression, options: GlyphMarkerOptions) => L.CircleMarker;
