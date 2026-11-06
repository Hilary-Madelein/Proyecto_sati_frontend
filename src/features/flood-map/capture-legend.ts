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
import type { RiskLayerStyle } from "./risk-layers";
import type { EventSeverity, RainLegend, Semaphore } from "./types";

/** Cómo se dibuja cada símbolo en la leyenda de la imagen (igual que en el mapa). */
export type LegendSymbol = "circle" | "square" | "diamond" | "triangle" | "line" | "area";

export interface CaptureLegendItem {
  label: string;
  color: string;
  symbol: LegendSymbol;
  /** Punto con dibujo (puente, maquinaria, cierre), como en el mapa de cerca. */
  glyph?: MapGlyph;
}

/** Un bloque de la leyenda: una capa con sus símbolos, o una escala de colores (lluvia, mar). */
export interface CaptureLegendGroup {
  title: string;
  items?: CaptureLegendItem[];
  ramp?: { colors: string[]; min: string; max: string };
}

/** Lo que hay en el mapa al capturar. */
export interface CaptureLegendInput {
  riskLayers: ReadonlyArray<{ style: RiskLayerStyle; colored: boolean }>;
  /** Severidades de los eventos dibujados (vacío = no hay eventos en el mapa). */
  eventSeverities: ReadonlySet<EventSeverity>;
  /** Niveles de las parroquias en alerta dibujadas; null = no están en el mapa. */
  parishLevels: readonly Semaphore[] | null;
  rain: ReadonlyArray<{ title: string; legend: RainLegend }>;
  sea: Omit<RainLegend, "id"> | null;
  imerg: boolean;
  stations: boolean;
  riverNetwork: boolean;
  riverAlerts: boolean;
  flashFloods: boolean;
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
  return {
    title,
    ramp: {
      colors: entries.map((entry) => entry.color),
      min: `${number(entries[0].value)} ${legend.unit}`,
      max: `${number(entries.at(-1)!.value)}+ ${legend.unit}`,
    },
  };
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

  if (input.eventSeverities.size > 0) {
    groups.push({
      title: "Eventos críticos (SNGR)",
      items: SEVERITY_ORDER.filter((severity) => input.eventSeverities.has(severity)).map((severity) => ({
        label: SEVERITY_STYLES[severity].label,
        color: SEVERITY_STYLES[severity].color,
        symbol: "circle" as const,
      })),
    });
  }
  if (input.parishLevels && input.parishLevels.length > 0) {
    groups.push({
      title: "Alerta de inundación por parroquia",
      items: input.parishLevels.map((level) => ({ label: SEMAPHORE_STYLES[level].alert, color: SEMAPHORE_STYLES[level].color, symbol: "circle" as const })),
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
    groups.push({
      title: "Caudal sobre el periodo de retorno",
      items: RIVER_ALERT_LEVELS.map((level) => ({ label: level.label, color: level.color, symbol: "triangle" as const })),
    });
  }
  if (input.flashFloods) {
    groups.push({
      title: "Crecidas repentinas urbanas",
      items: Object.values(FLASH_FLOOD_LIKELIHOODS).map((item) => ({ label: item.label, color: item.color, symbol: "area" as const })),
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
  for (const { style, colored } of input.riskLayers) {
    const symbol = riskSymbol(style);
    const classes = style.classify && (!style.plainColor || colored) ? style.classify.classes : null;
    groups.push({
      title: style.title,
      items: classes
        ? classes.map((item) => ({ label: item.label, color: item.color, symbol, glyph: style.pointGlyph }))
        : [{ label: style.title, color: style.plainColor ?? style.color, symbol, glyph: style.pointGlyph }],
    });
  }
  if (input.preparedness) {
    groups.push({
      title: "Índice de preparación provincial",
      items: Object.values(PREPAREDNESS_LEVEL_STYLES).map((level) => ({ label: level.label, color: level.color, symbol: "area" as const })),
    });
  }
  if (input.shading) {
    groups.push({ title: `Provincias por ${input.shading.label}`, ramp: { colors: [...input.shading.colors], min: "menos", max: "más" } });
  }
  return groups.filter((group): group is CaptureLegendGroup => group !== null);
}
