"use client";

import L from "leaflet";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GeoJSON, Pane, useMap, useMapEvents } from "react-leaflet";
import { CheckIcon, CloseIcon, MapPinIcon, MaximizeIcon, PlusIcon } from "@/components/ui/icons";
import { MAP_CONFIG, PROVINCE_OUTLINE_COLORS } from "../../constants";
import type { ProvinceFeature } from "../../hooks/useProvinceGeometries";
import { provinceLabel } from "../../province-filter";
import { goHome, homeZoom, PROVINCE_FOCUS_EVENT, type ProvinceFocusEvent } from "./province-focus";

const PANE = "provinceFocus";
const OUTLINE = { color: PROVINCE_OUTLINE_COLORS.line, weight: 3, opacity: 1, fill: true, fillColor: PROVINCE_OUTLINE_COLORS.line, fillOpacity: 0.08 } as const;
/** Borde oscuro debajo del contorno blanco, para que se lea sobre cualquier color (también sobre el mapa claro). */
const CASING = { color: PROVINCE_OUTLINE_COLORS.casing, weight: 6, opacity: 0.85, fill: false } as const;
/** Ya se ve casi todo Ecuador: no hace falta ofrecer volver. */
const HOME_TOLERANCE = 0.25;

/**
 * Tras acercarse a un punto: resalta su provincia, dice cuál es y ofrece volver a
 * todo Ecuador. Desaparece al volver, con este botón o de cualquier otra forma.
 * Acercarse a una provincia es elegirla (`onProvinceChange`): así el resumen, las
 * capas y los paneles muestran lo mismo que dice la barra. Con "Agregar" se suman
 * otras provincias (tocándolas en el mapa); cada una se puede quitar con su ×.
 */
export function ProvinceFocusBar({
  slot,
  selected,
  adding,
  onAddingChange,
  onRemove,
  onGoHome,
  onProvinceChange,
  onOpenSummary,
}: {
  slot: HTMLElement | null;
  /** Las provincias elegidas (resaltadas y nombradas en la barra). */
  selected: readonly ProvinceFeature[];
  adding: boolean;
  onAddingChange: (adding: boolean) => void;
  /** Quita una de las elegidas (con varias). */
  onRemove: (province: ProvinceFeature) => void;
  onGoHome: () => void;
  /** La provincia a la que se acercó el mapa, o null al volver a todo Ecuador. */
  onProvinceChange: (province: ProvinceFeature | null) => void;
  /** Solo en el celular (menos de 768 px): ahí el resumen no se abre solo (taparía el mapa), se abre con este botón. */
  onOpenSummary: () => void;
}) {
  const map = useMap();
  // undefined = sin acercamiento; null = se acercó, pero no se reconoció la provincia.
  const [province, setProvince] = useState<ProvinceFeature | null | undefined>(undefined);

  const notify = useEffectEvent((focused: ProvinceFeature | null) => onProvinceChange(focused));
  // Si ya llegó a la provincia. Al empezar el vuelo, Leaflet corta cualquier movimiento en
  // curso (p. ej. el globo acomodándose en el celular) y avisa "moveend" todavía en la vista
  // general: eso no es "volvió a todo Ecuador", y quitaba la provincia (y cerraba el globo).
  const arrived = useRef(false);
  useEffect(() => {
    const onFocus = (event: L.LeafletEvent) => {
      const focused = (event as ProvinceFocusEvent).province;
      arrived.current = false;
      setProvince(focused);
      if (focused) notify(focused);
    };
    map.on(PROVINCE_FOCUS_EVENT, onFocus);
    return () => {
      map.off(PROVINCE_FOCUS_EVENT, onFocus);
    };
  }, [map]);

  useMapEvents({
    moveend: () => {
      // De vuelta en la vista general: con el zoom de todo Ecuador y el continente a la vista
      // (encuadrar Galápagos en una pantalla angosta también aleja, pero mira a otro lado).
      const continent = L.latLngBounds(MAP_CONFIG.initialBounds).getCenter();
      if (province === undefined) return;
      const atHome = map.getZoom() <= homeZoom(map) + HOME_TOLERANCE && map.getBounds().contains(continent);
      if (!atHome) {
        arrived.current = true;
        return;
      }
      if (!arrived.current) return;
      setProvince(undefined);
      onProvinceChange(null);
    },
  });

  if (province === undefined && selected.length === 0) return null;
  // Las elegidas; justo al acercarse, la del punto (todavía no llegó como elegida).
  const shown = selected.length > 0 ? selected : province ? [province] : [];
  const several = shown.length > 1;
  return (
    <>
      {shown.length > 0 && (
        // Sin capturar clics: su lienzo cubre todo el mapa y taparía a las capas de abajo.
        <Pane name={PANE} style={{ zIndex: 395, pointerEvents: "none" }}>
          <>
            {shown.map((item) => (
              <GeoJSON key={`c${item.key}`} data={item.geometry} style={CASING} interactive={false} />
            ))}
            {shown.map((item) => (
              <GeoJSON key={item.key} data={item.geometry} style={OUTLINE} interactive={false} />
            ))}
          </>
        </Pane>
      )}
      {slot &&
        createPortal(
          // Si el nombre no cabe junto a los botones (celular), los botones bajan a otra línea: el nombre no se corta.
          <div data-capture-ignore className="flex max-w-md flex-wrap items-center gap-x-1 gap-y-0.5 rounded-xl bg-white/95 py-1 pr-1 pl-2.5 text-xs shadow-lg ring-1 shadow-slate-900/10 ring-slate-900/10 backdrop-blur-md">
            {shown.length > 0 && <MapPinIcon className="size-3.5 shrink-0 text-blue-600" />}
            {!several && shown[0] && (
              <span className="min-w-0 truncate py-1 font-semibold text-slate-800">{provinceLabel(shown[0])}</span>
            )}
            {/* Con varias, cada una con su × para quitarla. */}
            {several &&
              shown.map((item) => (
                <span key={item.key} className="flex items-center gap-0.5 rounded-md bg-blue-50 py-0.5 pr-0.5 pl-1.5 font-semibold text-blue-900 ring-1 ring-blue-200">
                  {provinceLabel(item)}
                  <button
                    type="button"
                    onClick={() => onRemove(item)}
                    aria-label={`Quitar ${provinceLabel(item)}`}
                    className="rounded p-0.5 text-blue-700 transition hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-blue-600"
                  >
                    <CloseIcon className="size-2.5" />
                  </button>
                </span>
              ))}
            {selected.length > 0 &&
              (adding ? (
                <button
                  type="button"
                  onClick={() => onAddingChange(false)}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-2 py-1.5 font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  <CheckIcon className="size-3.5" />
                  Listo
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onAddingChange(true)}
                  title="Elegir más provincias tocándolas en el mapa"
                  className="flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1.5 font-semibold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  <PlusIcon className="size-3.5" />
                  Agregar
                </button>
              ))}
            {adding && <p className="w-full pb-1 text-[11px] text-slate-500">Toca provincias en el mapa para agregarlas o quitarlas.</p>}
            {shown.length > 0 && !adding && (
              <button
                type="button"
                onClick={onOpenSummary}
                className="flex shrink-0 items-center gap-1.5 rounded-lg px-1.5 py-1.5 font-semibold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600 md:hidden"
              >
                Resumen
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                goHome(map);
                onGoHome();
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-1.5 py-1.5 font-semibold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600 lg:ml-1 lg:px-2"
            >
              <MaximizeIcon className="size-3.5" />
              {/* En móvil, más corto: con el botón "Resumen" no cabía el nombre de la provincia. */}
              <span className="max-lg:hidden">Ver todo Ecuador</span>
              <span className="lg:hidden">Todo Ecuador</span>
            </button>
          </div>,
          slot,
        )}
    </>
  );
}
