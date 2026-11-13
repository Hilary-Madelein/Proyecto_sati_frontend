import { placeName } from "./action-timeline";
import { isInProvince, PROVINCE_NAMES } from "./province-geometry";
import type { ProvinceFeature } from "./hooks/useProvinceGeometries";
import { normalizeName } from "./parish-filters";
import { provinceOf } from "./risk-popup";
import type { RiskFeature, RiskLayerData } from "./types";

/** Mismo nombre de provincia aunque cambien tildes y mayúsculas ("MANABI" y "Manabí"). */
export const isSameProvince = (name: string | null | undefined, other: string | null | undefined) =>
  !!name && !!other && normalizeName(name) === normalizeName(other);

/** La opción de una lista que nombra esa provincia (así el selector la muestra elegida), o el nombre tal cual. */
export const provinceOption = (options: readonly string[], name: string) => options.find((option) => isSameProvince(option, name)) ?? name;

/** Primer punto de una geometría, para ubicarla en una provincia. */
function firstPoint(coordinates: unknown): { lat: number; lng: number } | null {
  let item = coordinates;
  while (Array.isArray(item) && Array.isArray(item[0])) item = item[0];
  return Array.isArray(item) && typeof item[0] === "number" ? { lng: item[0] as number, lat: item[1] as number } : null;
}

/** Si la entidad está en la provincia: por la que declara o, si no la trae, por dónde está. */
export function isFeatureInProvince(feature: RiskFeature, province: ProvinceFeature): boolean {
  const declared = provinceOf(feature);
  if (declared) return isSameProvince(declared, province.name);
  const point = feature.geometry && "coordinates" in feature.geometry ? firstPoint(feature.geometry.coordinates) : null;
  return point ? isInProvince(province, point) : false;
}

/** La capa solo con lo de esa provincia. */
export function layerInProvince(data: RiskLayerData, province: ProvinceFeature | null): RiskLayerData {
  if (!province) return data;
  return { ...data, features: data.features.filter((feature) => isFeatureInProvince(feature, province)), view: `${data.view ?? ""}|prov:${province.key}` };
}

/** Si el nombre es de alguna de las provincias elegidas; sin ninguna elegida, todo cuenta. */
export const isInSelectedProvinces = (name: string | null | undefined, provinces: readonly ProvinceFeature[]) =>
  provinces.length === 0 || provinces.some((province) => isSameProvince(name, province.name));

/** Si el punto cae en alguna de las provincias elegidas; sin ninguna elegida, todo cuenta. */
export const isPointInProvinces = (provinces: readonly ProvinceFeature[], point: { lat: number; lng: number }) =>
  provinces.length === 0 || provinces.some((province) => isInProvince(province, point));

/** La capa solo con lo de las provincias elegidas (todas, si no hay ninguna). */
export function layerInProvinces(data: RiskLayerData, provinces: readonly ProvinceFeature[]): RiskLayerData {
  if (provinces.length === 0) return data;
  if (provinces.length === 1) return layerInProvince(data, provinces[0]);
  return {
    ...data,
    features: data.features.filter((feature) => provinces.some((province) => isFeatureInProvince(feature, province))),
    view: `${data.view ?? ""}|prov:${provinces.map((province) => province.key).join(",")}`,
  };
}

/** "Manabí", "Manabí y Guayas", "Manabí, Guayas y El Oro". */
export function joinNames(names: readonly string[]): string {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
}

/** Nombre para mostrar de una provincia ("Santo Domingo de los Tsáchilas"). */
export const provinceLabel = (province: ProvinceFeature) => PROVINCE_NAMES[province.key] ?? placeName(province.name);

/** Lo elegido, para títulos: "Ecuador", "Provincia de Manabí", "Provincias de Manabí y Guayas". */
export function scopeTitle(provinces: readonly ProvinceFeature[]): string {
  if (provinces.length === 0) return "Ecuador";
  return `${provinces.length === 1 ? "Provincia" : "Provincias"} de ${joinNames(provinces.map(provinceLabel))}`;
}
