import { IconTile } from "@/components/ui/IconTile";
import { CloudRainIcon } from "@/components/ui/icons";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Toggle } from "@/components/ui/Toggle";
import { cn } from "@/lib/cn";
import { formatDateTime, formatDayMonth } from "@/lib/format";
import { OBSERVED_RAIN_WINDOWS } from "../../constants";
import type {
  ObservedAccumulatedRain,
  ObservedRainAvailability,
  ObservedRainProduct,
  ObservedRainProductStatus,
  RainWindowHours,
} from "../../types";
import { LoadingBadge, Notice } from "./RainForecastSection";
import { SectionHeading } from "./SectionHeading";

interface ObservedRainSectionProps {
  availability: ObservedRainAvailability | null;
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  product: ObservedRainProduct;
  onProductChange: (product: ObservedRainProduct) => void;
  hours: RainWindowHours;
  onHoursChange: (hours: RainWindowHours) => void;
  /** Acumulado que se está mostrando (null mientras se calcula o si falló). */
  accumulated: ObservedAccumulatedRain | null;
  error: string | null;
  isLoading: boolean;
}

const staleHint = (status: ObservedRainProductStatus) =>
  status.latest ? `Sin datos desde el ${formatDayMonth(status.latest)}` : "Sin datos";

/**
 * Lluvia que ya cayó, estimada por satélite. El backend suma la lluvia de cada
 * hora hasta la última disponible (no es pronóstico).
 */
export function ObservedRainSection({
  availability,
  visible,
  onVisibleChange,
  product,
  onProductChange,
  hours,
  onHoursChange,
  accumulated,
  error,
  isLoading,
}: ObservedRainSectionProps) {
  const products = availability?.products ?? [];
  const status = products.find((item) => item.key === product);
  const window = status?.windows.find((item) => item.hours === hours);
  const staleProducts = products.filter((item) => item.isStale);
  const anyAvailable = products.some((item) => !item.isStale);

  const hourOptions = OBSERVED_RAIN_WINDOWS.map((option) => {
    const available = status?.windows.find((item) => String(item.hours) === option.value)?.available ?? false;
    return { ...option, disabled: !available, hint: available ? undefined : "No hay suficientes horas con datos" };
  });
  const productOptions = products.map((item) => ({
    value: item.key,
    label: item.name,
    disabled: item.isStale,
    hint: item.isStale ? staleHint(item) : undefined,
  }));

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
              Lluvia registrada
            </h4>
            <p className="text-xs text-slate-500">
              {window?.from && window.to
                ? `Últimas ${hours} h, hasta el ${formatDateTime(window.to)}`
                : anyAvailable
                  ? `Últimas ${hours} h · sin datos suficientes`
                  : "Sin datos recientes"}
            </p>
          </div>
          <Toggle checked={visible} onChange={onVisibleChange} label="Mostrar lluvia observada" />
        </div>

        {visible && (
          <div className="mt-3 space-y-2">
            <SegmentedControl
              name="observed-rain-hours"
              label="Horas de lluvia observada"
              value={String(hours) as `${RainWindowHours}`}
              options={hourOptions}
              onChange={(value) => onHoursChange(Number(value) as RainWindowHours)}
            />
            {/* El selector solo aparece si hay más de un producto para elegir. */}
            {productOptions.length > 1 && (
              <SegmentedControl
                name="observed-rain-product"
                label="Producto satelital"
                value={product}
                options={productOptions}
                onChange={onProductChange}
              />
            )}

            {!availability && <Notice>No se pudo cargar la lluvia observada.</Notice>}
            {availability && !anyAvailable && <Notice>Ningún satélite tiene datos recientes.</Notice>}
            {staleProducts.map((item) => (
              <Notice key={item.key}>
                {item.name}: {staleHint(item).toLowerCase()} (el INAMHI no lo está publicando).
              </Notice>
            ))}
            {error && <Notice>{error}</Notice>}
            {window && window.missingHours > 0 && (
              <Notice>Faltan {window.missingHours} h de datos en esta ventana: el total puede quedarse corto.</Notice>
            )}

            {accumulated && !error && (
              <p className="text-[11px] text-slate-500">
                Máximo acumulado:{" "}
                <strong className="font-semibold text-slate-700">{accumulated.maxMm.toLocaleString("es-EC")} mm</strong>
              </p>
            )}
            {status && !status.isStale && (
              <p className="text-[11px] text-slate-500">
                Suma de la lluvia de cada hora estimada por satélite · {status.attribution.replace("Lluvia observada: ", "")}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
