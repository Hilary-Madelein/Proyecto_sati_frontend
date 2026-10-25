import type { ReactNode } from "react";
import { IconTile } from "@/components/ui/IconTile";
import {
  AlertTriangleIcon,
  MapIcon,
  MapPinIcon,
  MountainIcon,
  RefreshIcon,
  ShieldIcon,
  UsersIcon,
  WavesIcon,
} from "@/components/ui/icons";
import type { PlannedLayer, PlannedLayerIcon } from "../../constants";

const ICONS: Record<PlannedLayerIcon, (props: { className?: string }) => ReactNode> = {
  waves: WavesIcon,
  mountain: MountainIcon,
  alert: AlertTriangleIcon,
  map: MapIcon,
  pin: MapPinIcon,
  shield: ShieldIcon,
  users: UsersIcon,
  refresh: RefreshIcon,
};

/** Capa prevista sin fuente de datos todavía: ocupa su lugar en la pestaña, sin interruptor. */
export function PlannedLayerCard({ layer }: { layer: PlannedLayer }) {
  const Icon = ICONS[layer.icon];
  return (
    <li className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-3">
      <IconTile className="bg-slate-100 text-slate-400">
        <Icon className="size-5" />
      </IconTile>
      <div className="min-w-0 flex-1">
        <h4 className="text-sm font-semibold text-slate-500">{layer.title}</h4>
        <p className="text-xs text-slate-400">{layer.description}</p>
      </div>
      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Próximamente</span>
    </li>
  );
}

/** Lista de capas previstas de una pestaña. */
export function PlannedLayerList({ layers }: { layers: readonly PlannedLayer[] }) {
  if (layers.length === 0) return null;
  return (
    <ul className="space-y-2">
      {layers.map((layer) => (
        <PlannedLayerCard key={layer.id} layer={layer} />
      ))}
    </ul>
  );
}
