import type { ComponentType, SVGProps } from "react";
import { AlertTriangleIcon, CloudRainIcon, MountainIcon, WavesIcon } from "@/components/ui/icons";
import type { HazardType } from "../types";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/** Ícono de cada tipo de evento: agua, lluvia o movimiento de masa. */
export const HAZARD_ICONS: Record<HazardType, IconComponent> = {
  flood: WavesIcon,
  water_erosion: WavesIcon,
  heavy_rain: CloudRainIcon,
  landslide: MountainIcon,
  mudflow: MountainIcon,
  rockfall: MountainIcon,
  soil_creep: MountainIcon,
  subsidence: MountainIcon,
  other: AlertTriangleIcon,
};
