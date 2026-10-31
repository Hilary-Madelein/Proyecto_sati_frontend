"use client";

import { useEffect, useState } from "react";
import { ResponsivePanel } from "@/components/shared/ResponsivePanel";
import { IconTile } from "@/components/ui/IconTile";
import { ChevronDownIcon, HistoryIcon, MapPinIcon, SearchIcon } from "@/components/ui/icons";
import { satiClientGet } from "@/lib/api/sati-client";
import { ACTION_LAYER_IDS } from "../../action-timeline";
import { RISK_COMPONENTS } from "../../constants";
import type { RiskHit } from "../../risk-identify";
import type { FeatureDetailState } from "../../hooks/useFeatureDetail";
import { sectionsOf, titleOf } from "../../risk-popup";
import type { RiskAttachment } from "../../types";

interface FeatureDetailPanelProps {
  state: FeatureDetailState | null;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onZoom: () => void;
  /** Abre la línea de tiempo con esta acción ubicada (solo en las acciones preventivas y de respuesta del MIT). */
  onShowInTimeline: (hit: RiskHit) => void;
}

/**
 * Detalle de lo que hay en el punto tocado, de todas las capas de gestión del
 * riesgo encendidas: "‹ 1 de N ›", "Acercar", las fotos del servicio de origen
 * y los datos de la entidad. En celular es una hoja inferior, como los demás paneles.
 */
export function FeatureDetailPanel({ state, onClose, onNext, onPrevious, onZoom, onShowInTimeline }: FeatureDetailPanelProps) {
  const hit = state?.hits[state.index];
  if (!state || !hit) return null;
  const total = state.hits.length;
  const component = RISK_COMPONENTS.find((item) => item.id === hit.style.component)?.label;
  const sections = sectionsOf(hit.style, hit.feature);
  const objectId = hit.feature.id;

  return (
    <ResponsivePanel
      title={hit.style.title}
      subtitle={[component, hit.data.attribution].filter(Boolean).join(" · ")}
      icon={
        <IconTile className="bg-amber-400 text-slate-900 shadow-sm shadow-amber-500/30">
          <MapPinIcon className="size-4.5" />
        </IconTile>
      }
      mobileOpen
      desktopOpen
      onClose={onClose}
      desktopClassName="lg:top-4 lg:right-101 lg:bottom-auto lg:left-auto lg:w-96 lg:max-h-[calc(100%-2rem)]"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          {total > 1 && (
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={onPrevious}
                aria-label="Elemento anterior"
                className="grid size-7 place-items-center rounded-md text-slate-600 hover:bg-white hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <ChevronDownIcon className="size-3.5 rotate-90" />
              </button>
              <span className="px-1 text-xs font-semibold text-slate-700 tabular-nums" aria-live="polite">
                {state.index + 1} de {total}
              </span>
              <button
                type="button"
                onClick={onNext}
                aria-label="Elemento siguiente"
                className="grid size-7 place-items-center rounded-md text-slate-600 hover:bg-white hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <ChevronDownIcon className="size-3.5 -rotate-90" />
              </button>
            </div>
          )}
          <div className="ml-auto flex gap-2">
            {ACTION_LAYER_IDS.includes(hit.style.id) && (
              <button
                type="button"
                onClick={() => onShowInTimeline(hit)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-700/25 transition hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <HistoryIcon className="size-3.5" />
                Línea de tiempo
              </button>
            )}
            <button
              type="button"
              onClick={onZoom}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-600/20 transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              <SearchIcon className="size-3.5" />
              Acercar
            </button>
          </div>
        </div>

        <h3 className="text-base font-semibold text-slate-900">{titleOf(hit.style, hit.feature)}</h3>

        {hit.data.hasAttachments && typeof objectId === "number" && (
          <FeaturePhotos key={hit.key} layerId={hit.style.id} objectId={objectId} />
        )}

        {/* Los datos, por secciones si la capa las tiene (p. ej. las del reporte de novedad vial del MIT). */}
        {sections.map((section) => (
          <section key={section.title ?? "datos"} className="space-y-1.5">
            {section.title && <h4 className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{section.title}</h4>}
            <dl className="overflow-hidden rounded-xl ring-1 ring-slate-200">
              {section.rows.map((row) => (
                <div key={row.label} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 px-3 py-2 text-xs odd:bg-slate-50">
                  <dt className="text-slate-500">{row.label}</dt>
                  <dd className="font-medium break-words text-slate-900">{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </ResponsivePanel>
  );
}

/** Fotos de la entidad (solo las que tiene el servicio de origen; se piden al abrirla). Al tocar una, se abre en grande. */
function FeaturePhotos({ layerId, objectId }: { layerId: string; objectId: number }) {
  const [photos, setPhotos] = useState<RiskAttachment[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    satiClientGet<RiskAttachment[]>(`/risk-layers/${layerId}/features/${objectId}/attachments`, undefined, controller.signal)
      .then(setPhotos)
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") setPhotos([]);
      });
    return () => controller.abort();
  }, [layerId, objectId]);

  if (photos === null) return <p className="text-xs text-slate-500">Buscando fotos…</p>;
  if (photos.length === 0) return null;
  return (
    <section aria-label="Fotografías">
      <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Fotografías · {photos.length}</p>
      <ul className="grid grid-cols-2 gap-2">
        {photos.map((photo) => (
          <li key={photo.id} className={photos.length === 1 ? "col-span-2" : undefined}>
            <a
              href={photo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200 focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={`Fotografía: ${photo.name}`}
                loading="lazy"
                className="aspect-4/3 w-full object-cover transition hover:scale-105"
              />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
