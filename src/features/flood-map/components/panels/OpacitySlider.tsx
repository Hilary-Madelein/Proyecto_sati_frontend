"use client";

import { useId } from "react";

interface OpacitySliderProps {
  /** De 0 (transparente) a 1 (opaca). */
  value: number;
  onChange: (value: number) => void;
  /** Para el lector de pantalla: de qué capa es la opacidad. */
  layerName: string;
}

/**
 * Opacidad de una capa de imagen (lluvia, mar). Al superponer capas, bajarla deja
 * ver lo que hay debajo; subirla hace resaltar los colores.
 */
export function OpacitySlider({ value, onChange, layerName }: OpacitySliderProps) {
  const id = useId();
  const percent = Math.round(value * 100);
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className="shrink-0 text-[11px] font-medium text-slate-600">
        Opacidad
      </label>
      <input
        id={id}
        type="range"
        min={10}
        max={100}
        step={5}
        value={percent}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
        aria-label={`Opacidad de ${layerName}`}
        aria-valuetext={`${percent} %`}
        className="min-w-0 flex-1 cursor-pointer accent-blue-600"
      />
      <span className="w-9 shrink-0 text-right text-[11px] font-semibold text-slate-700 tabular-nums">{percent} %</span>
    </div>
  );
}
