"use client";

import { cn } from "@/lib/cn";
import { WATERSHED_SLOPES } from "../../constants";
import { useWatershedAt } from "../../watersheds";

/** Línea informativa para popups: en qué cuenca está el punto y hacia dónde drena. */
export function WatershedInfo({ lat, lng, className }: { lat: number; lng: number; className?: string }) {
  const watershed = useWatershedAt(lat, lng);
  if (!watershed) return null;
  const slope = WATERSHED_SLOPES[watershed.slope];
  return (
    <p className={cn("flex items-center gap-1.5 text-[11px] text-slate-500", className)}>
      <span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: slope.fill, boxShadow: `inset 0 0 0 1px ${slope.stroke}` }} />
      <span>
        Cuenca {watershed.name} · {slope.label}
      </span>
    </p>
  );
}
