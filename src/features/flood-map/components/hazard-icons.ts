import type { ComponentType, SVGProps } from "react";
import { AlertTriangleIcon, CircleDotIcon, CloudRainIcon, MountainIcon, WavesIcon } from "@/components/ui/icons";
import type { HazardType } from "../types";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/** Ícono de cada tipo de evento: río, lluvia, alcantarillado o movimiento de masa. */
export const HAZARD_ICONS: Record<HazardType, IconComponent> = {
  flood: WavesIcon,
  river_flood: WavesIcon,
  rain_flood: CloudRainIcon,
  drainage_flood: CircleDotIcon,
  coastal_flood: WavesIcon,
  water_erosion: WavesIcon,
  heavy_rain: CloudRainIcon,
  landslide: MountainIcon,
  mudflow: MountainIcon,
  rockfall: MountainIcon,
  soil_creep: MountainIcon,
  subsidence: MountainIcon,
  other: AlertTriangleIcon,
};
