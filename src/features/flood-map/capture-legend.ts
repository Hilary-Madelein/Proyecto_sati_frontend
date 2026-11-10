import {
  FLASH_FLOOD_LIKELIHOODS,
  PREPAREDNESS_LEVEL_STYLES,
  PROVINCIAL_ROADS_LAYER,
  RIVER_ALERT_LEVELS,
  RIVER_NETWORK_LAYER,
  SEMAPHORE_STYLES,
  SEVERITY_ORDER,
  SEVERITY_STYLES,
  STATION_RAIN_LEVEL_ORDER,
  STATION_RAIN_LEVELS,
  WATERSHED_SLOPES,
} from "./constants";
import type { MapGlyph } from "./map-glyphs";
import { riskClassOf, type RiskLayerStyle } from "./risk-layers";
import type { EventSeverity, FlashFloodLikelihood, RainLegend, RiskFeature, Semaphore } from "./types";

/** Cómo se dibuja cada símbolo en la leyenda de la imagen (igual que en el mapa). */
export type LegendSymbol = "circle" | "square" | "diamond" | "triangle" | "line" | "area";

export interface CaptureLegendItem {
  label: string;
  color: string;
  symbol: LegendSymbol;
  /** Punto con dibujo (puente, maquinaria, cierre), como en el mapa de cerca. */
  glyph?: MapGlyph;
  /** Cuántos hay de este tipo en el mapa (lo dibujado al capturar); sin cuenta, no se muestra. */
  count?: number;
}

/** Un bloque de la leyenda: una capa con sus símbolos, o una escala de colores (lluvia, mar). */
export interface CaptureLegendGroup {
  title: string;
  items?: CaptureLegendItem[];
  /**
   * Escala de colores (repartidos en partes iguales a lo largo de la barra) con sus
   * valores: `at` es la posición en la barra, de 0 (izquierda) a 1 (derecha).
   */
  ramp?: { colors: string[]; ticks: { label: string; at: number }[] };
}

/** Lo que hay en el mapa al capturar. */
export interface CaptureLegendInput {
  /** Capas de gestión del riesgo con lo que se dibujó de cada una (para contar por clase). */
  riskLayers: ReadonlyArray<{ style: RiskLayerStyle; colored: boolean; hidden?: readonly string[]; features: readonly RiskFeature[] }>;
  /** Cuántos eventos dibujados hay de cada severidad (vacío = no hay eventos en el mapa). */
  events: Partial<Record<EventSeverity, number>>;
  /** Niveles encendidos de las parroquias en alerta y cuántas hay de cada uno; null = no están en el mapa. */
  parishes: { levels: readonly Semaphore[]; counts: Partial<Record<Semaphore, number>> } | null;
  rain: ReadonlyArray<{ title: string; legend: RainLegend }>;
  sea: Omit<RainLegend, "id"> | null;
  imerg: boolean;
  stations: boolean;
  riverNetwork: boolean;
  /** Tramos en alerta por periodo de retorno (años → cuántos); null = la capa no está. */
  riverAlerts: ReadonlyMap<number, number> | null;
  /** Zonas de crecida repentina por probabilidad; null = la capa no está. */
  flashFloods: Partial<Record<FlashFloodLikelihood, number>> | null;
  watersheds: boolean;
  preparedness: boolean;
  provincialRoads: boolean;
  /** Provincias pintadas por el ranking del resumen (su indicador), o null. */
  shading: { label: string; colors: readonly string[] } | null;
}

const number = (value: number) => Math.round(value).toLocaleString("es-EC");

function ramp(title: string, legend: Omit<RainLegend, "id">): CaptureLegendGroup | null {
  const entries = [...legend.entries].sort((a, b) => a.value - b.value);
  if (entries.length < 2) return null;
  // Cada valor va bajo su color (la barra reparte los colores en partes iguales). Con
  // muchos colores (la lluvia tiene ~20), solo cinco: el primero, tres intermedios y el último.
  const last = entries.length - 1;
  const indices = entries.length <= 7 ? entries.map((_, index) => index) : [...new Set([0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * last)))];
  // Escalas con negativos (anomalía del mar): con signo, "+7". Las de lluvia: el último con "+", "75+" (o más).
  const signed = entries[0].value < 0;
  const ticks = indices.map((index) => {
    const value = Math.round(entries[index].value) || 0; // sin "-0"
    const text = signed ? `${value > 0 ? "+" : ""}${number(value)}` : `${number(value)}${index === last ? "+" : ""}`;
    return { label: index === 0 ? `${text} ${legend.unit}` : text, at: index / last };
  });
  return { title, ramp: { colors: entries.map((entry) => entry.color), ticks } };
}

function riskSymbol(style: RiskLayerStyle): LegendSymbol {
  if (style.geometry === "line") return "line";
  if (style.geometry === "area") return "area";
  return style.pointShape ?? "circle";
}

/**
 * Leyenda de todo lo que está dibujado en el mapa, para la imagen descargada:
 * así quien la recibe sabe qué es cada color y cada símbolo sin ver el panel.
 */
export function buildCaptureLegend(input: CaptureLegendInput): CaptureLegendGroup[] {
  const groups: (CaptureLegendGroup | null)[] = [];

  const shownSeverities = SEVERITY_ORDER.filter((severity) => (input.events[severity] ?? 0) > 0);
  if (shownSeverities.length > 0) {
    groups.push({
      title: "Eventos críticos (SNGR)",
      items: shownSeverities.map((severity) => ({
        label: SEVERITY_STYLES[severity].label,
        color: SEVERITY_STYLES[severity].color,
        symbol: "circle" as const,
        count: input.events[severity],
      })),
    });
  }
  if (input.parishes && input.parishes.levels.length > 0) {
    const { levels, counts } = input.parishes;
    groups.push({
      title: "Alerta de inundación por parroquia",
      items: levels.map((level) => ({ label: SEMAPHORE_STYLES[level].alert, color: SEMAPHORE_STYLES[level].color, symbol: "circle" as const, count: counts[level] ?? 0 })),
    });
  }
  for (const { title, legend } of input.rain) groups.push(ramp(title, legend));
  if (input.imerg) groups.push({ title: "Lluvia IMERG (NASA), última media hora" });
  if (input.stations) {
    groups.push({
      title: "Lluvia en estaciones del INAMHI",
      items: STATION_RAIN_LEVEL_ORDER.map((level) => ({ label: STATION_RAIN_LEVELS[level].label, color: STATION_RAIN_LEVELS[level].color, symbol: "diamond" as const })),
    });
  }
  if (input.sea) groups.push(ramp("Anomalía de temperatura del mar", input.sea));
  if (input.riverNetwork) groups.push({ title: "Red de ríos", items: [{ label: "Río (GEOGLOWS)", color: RIVER_NETWORK_LAYER.color, symbol: "line" }] });
  if (input.riverAlerts) {
    const counts = input.riverAlerts;
    groups.push({
      title: "Caudal sobre el periodo de retorno",
      items: RIVER_ALERT_LEVELS.map((level) => ({ label: level.label, color: level.color, symbol: "triangle" as const, count: counts.get(level.level) ?? 0 })),
    });
  }
  if (input.flashFloods) {
    const counts = input.flashFloods;
    groups.push({
      title: "Crecidas repentinas urbanas",
      items: (Object.keys(FLASH_FLOOD_LIKELIHOODS) as FlashFloodLikelihood[]).map((key) => ({
        label: FLASH_FLOOD_LIKELIHOODS[key].label,
        color: FLASH_FLOOD_LIKELIHOODS[key].color,
        symbol: "area" as const,
        count: counts[key] ?? 0,
      })),
    });
  }
  if (input.watersheds) {
    groups.push({
      title: "Cuencas hidrográficas",
      items: Object.values(WATERSHED_SLOPES).map((slope) => ({ label: slope.label, color: slope.stroke, symbol: "area" as const })),
    });
  }
  if (input.provincialRoads) {
    groups.push({ title: "Red vial provincial", items: [{ label: "Vía provincial", color: PROVINCIAL_ROADS_LAYER.color, symbol: "line" }] });
  }
  for (const { style, colored, hidden = [], features } of input.riskLayers) {
    const symbol = riskSymbol(style);
    // Sin las clases ocultas desde la leyenda: no están en el mapa.
    const classes = style.classify && (!style.plainColor || colored) ? style.classify.classes.filter((item) => !hidden.includes(item.label)) : null;
    const byClass = new Map<string, number>();
    for (const feature of features) {
      const label = riskClassOf(style, feature)?.label ?? "";
      byClass.set(label, (byClass.get(label) ?? 0) + 1);
    }
    groups.push({
      title: style.title,
      items: classes
        ? classes.map((item) => ({ label: item.label, color: item.color, symbol, glyph: style.pointGlyph, count: byClass.get(item.label) ?? 0 }))
        : [{ label: style.title, color: style.plainColor ?? style.color, symbol, glyph: style.pointGlyph, count: features.length }],
    });
  }
  if (input.preparedness) {
    groups.push({
      title: "Índice de preparación provincial",
      items: Object.values(PREPAREDNESS_LEVEL_STYLES).map((level) => ({ label: level.label, color: level.color, symbol: "area" as const })),
    });
  }
  if (input.shading) {
    groups.push({ title: `Provincias por ${input.shading.label}`, ramp: { colors: [...input.shading.colors], ticks: [{ label: "menos", at: 0 }, { label: "más", at: 1 }] } });
  }
  return groups.filter((group): group is CaptureLegendGroup => group !== null);
}
