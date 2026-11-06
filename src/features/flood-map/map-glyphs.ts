/**
 * Dibujos de algunas capas de puntos (puente, maquinaria, cierre de vía, escuela…):
 * de cerca, el punto es el dibujo mismo, pintado del color de su estado o clase, con
 * un borde blanco para que se vea sobre cualquier fondo. Trazos sobre una cuadrícula
 * de 24 × 24, muy simples para leerse a ~20 px.
 * Sin Leaflet: lo usan el mapa, las leyendas del panel y la imagen descargada.
 */
export type MapGlyph = "bridge" | "machinery" | "barrier" | "school" | "health" | "power" | "shelter" | "tent" | "car";

export const GLYPH_PATHS: Record<MapGlyph, readonly string[]> = {
  // Puente colgante: dos torres, el tablero, los cables y un tirante al centro.
  bridge: ["M6 5v14", "M18 5v14", "M2 15h20", "M3 8a7.5 7.5 0 0 0 3-2a6.5 6.5 0 0 0 12 0a7.5 7.5 0 0 0 3 2", "M12 10v5"],
  // Excavadora: oruga, cabina, brazo y cuchara.
  machinery: ["M3 17h10a2 2 0 0 1 0 4H3a2 2 0 0 1 0-4z", "M4 17v-5h5l2 5", "M10 12l5-7 6 5", "M21 10l-1 4h-3"],
  // Barrera de cierre: tablero con franjas y dos patas.
  barrier: ["M2 7h20v6H2z", "M8 7l-4 6", "M14 7l-4 6", "M20 7l-4 6", "M5 13v8", "M19 13v8"],
  // Birrete.
  school: ["M22 9L12 5 2 9l10 4 10-4v6", "M6 10.6V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-5.4"],
  // Cruz de salud.
  health: ["M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"],
  // Rayo.
  power: ["M13 2L4 14h7l-1 8 9-12h-7l1-8z"],
  // Casa (alojamiento).
  shelter: ["M3 11l9-7 9 7", "M5 10v10h14V10", "M10 20v-5h4v5"],
  // Carpa (campamento).
  tent: ["M3 20L12 5l9 15z", "M10 20l2-5 2 5"],
  // Carro.
  car: ["M5 17H3v-5l2-5h14l2 5v5h-2", "M3 12h18", "M9 17h6", "M5 17a2 2 0 1 0 4 0a2 2 0 1 0-4 0", "M15 17a2 2 0 1 0 4 0a2 2 0 1 0-4 0"],
};

/**
 * Desde este zoom los puntos son su dibujo; más lejos (todo el país) serían una
 * mancha y se ven como puntos de color. 8: al encuadrar una provincia el mapa queda entre 8 y 9.
 */
export const GLYPH_MIN_ZOOM = 8;

/** Radio de toque del punto con dibujo (el dibujo mide ~2 radios): más grande que un punto común, para que se lea. */
export function glyphRadius(zoom: number, scale = 1): number {
  return Math.max(9, (zoom >= 12 ? 11 : 9.5) * Math.min(scale, 1.25));
}

/** Grosor del trazo de color y del borde blanco que lo rodea, en unidades de la cuadrícula de 24. */
export const GLYPH_STROKE = { stroke: 2.6, halo: 5.6 } as const;

/** Dibuja el dibujo centrado en (x, y), de `size` px de lado: primero el borde blanco, encima el color. */
export function drawGlyph(context: CanvasRenderingContext2D, glyph: MapGlyph, x: number, y: number, size: number, color: string) {
  const paths = GLYPH_PATHS[glyph].map((d) => new Path2D(d));
  context.save();
  context.translate(x - size / 2, y - size / 2);
  context.scale(size / 24, size / 24);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "#ffffff";
  context.lineWidth = GLYPH_STROKE.halo;
  for (const path of paths) context.stroke(path);
  context.strokeStyle = color;
  context.lineWidth = GLYPH_STROKE.stroke;
  for (const path of paths) context.stroke(path);
  context.restore();
}
