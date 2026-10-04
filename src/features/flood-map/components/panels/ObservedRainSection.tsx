import { IconTile } from "@/components/ui/IconTile";
import { CloudRainIcon } from "@/components/ui/icons";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Toggle } from "@/components/ui/Toggle";
import { cn } from "@/lib/cn";
import { OBSERVED_RAIN_PRODUCTS, OBSERVED_RAIN_WINDOWS } from "../../constants";
import type { ObservedRainProduct, ObservedRainWindow } from "../../types";
import { LoadingBadge } from "./RainForecastSection";
import { SectionHeading } from "./SectionHeading";

interface ObservedRainSectionProps {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  product: ObservedRainProduct;
  onProductChange: (product: ObservedRainProduct) => void;
  timeWindow: ObservedRainWindow;
  onTimeWindowChange: (timeWindow: ObservedRainWindow) => void;
  isLoading: boolean;
}

/** Lluvia que ya cayó, estimada por satélite y acumulada por el INAMHI (no es pronóstico). */
export function ObservedRainSection({
  visible,
  onVisibleChange,
  product,
  onProductChange,
  timeWindow,
  onTimeWindowChange,
  isLoading,
}: ObservedRainSectionProps) {
  return (
    <section>
      <SectionHeading aside={isLoading && visible && <LoadingBadge />}>Lluvia observada</SectionHeading>

      <div className={cn("rounded-xl p-3 ring-1 transition-colors", visible ? "bg-white ring-slate-200" : "bg-slate-50/70 ring-slate-200/70")}>
        <div className="flex items-center gap-3">
          <IconTile className="bg-indigo-50 text-indigo-600">
            <CloudRainIcon className="size-5" />
          </IconTile>
          <div className="min-w-0 flex-1">
            <h4 className={cn("text-sm font-semibold", visible ? "text-slate-900" : "text-slate-500")}>
              Lluvia acumulada (satélite)
            </h4>
            <p className="text-xs text-slate-500">Últimas {timeWindow} · ya ocurrida</p>
          </div>
          <Toggle checked={visible} onChange={onVisibleChange} label="Mostrar lluvia observada" />
        </div>

        {visible && (
          <div className="mt-3 space-y-2">
            <SegmentedControl
              name="observed-rain-window"
              label="Ventana de lluvia observada"
              value={timeWindow}
              options={OBSERVED_RAIN_WINDOWS}
              onChange={onTimeWindowChange}
            />
            <SegmentedControl
              name="observed-rain-product"
              label="Producto satelital"
              value={product}
              options={OBSERVED_RAIN_PRODUCTS}
              onChange={onProductChange}
            />
            <p className="text-[11px] text-slate-500">
              {OBSERVED_RAIN_PRODUCTS.find((option) => option.value === product)?.attribution}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
