"use client";

import { useEffect, useState } from "react";
import { ImageOverlay } from "react-leaflet";
import { RAIN_FADE_MS } from "../../constants";
import type { RainImage } from "../../types";

interface AccumulatedRainLayerProps {
  rain: RainImage;
  opacity: number;
  attribution: string;
  onLoadingChange: (loading: boolean) => void;
}

interface Shown {
  rain: RainImage;
  /** Ya cargó: se ve (con su fundido de entrada). */
  visible: boolean;
  /** Llegó otra más nueva: se desvanece mientras la nueva aparece, y después se quita. */
  leaving?: boolean;
}

/**
 * Lluvia acumulada (pronosticada u observada): una sola imagen calculada por
 * el backend (suma de días del WRF o de horas del satélite, ya proyectada a
 * Web Mercator) sobre el Ecuador.
 *
 * Al cambiar de imagen (otra ventana u otro día) la anterior sigue a la vista
 * mientras carga la nueva; cuando la nueva cargó, una aparece mientras la otra se
 * desvanece a la vez (fundido cruzado). Si la anterior siguiera entera debajo, las
 * dos semitransparentes juntas se verían más intensas y al quitarla habría un salto.
 */
export function AccumulatedRainLayer({ rain, opacity, attribution, onLoadingChange }: AccumulatedRainLayerProps) {
  const [images, setImages] = useState<Shown[]>(() => [{ rain, visible: false }]);

  // Imagen nueva: se agrega encima de la que se ve (las anteriores a esa ya no hacen falta).
  const last = images[images.length - 1];
  if (last.rain.imagePath !== rain.imagePath) {
    const showing = images.filter((image) => image.visible && !image.leaving).at(-1);
    setImages([...(showing ? [showing] : []), { rain, visible: false }]);
  }

  // Terminado el fundido cruzado, se quitan las que se desvanecieron.
  const anyLeaving = images.some((image) => image.leaving);
  useEffect(() => {
    if (!anyLeaving) return;
    const timer = setTimeout(() => setImages((current) => current.filter((image) => !image.leaving)), RAIN_FADE_MS + 50);
    return () => clearTimeout(timer);
  }, [anyLeaving]);

  return images.map((image) => (
    <ImageOverlay
      key={image.rain.imagePath}
      url={`/api/sati${image.rain.imagePath}`}
      bounds={image.rain.bounds}
      opacity={image.visible && !image.leaving ? opacity : 0}
      className="rain-fade"
      attribution={attribution}
      eventHandlers={{
        add: () => {
          if (image.rain.imagePath === rain.imagePath) onLoadingChange(true);
        },
        load: () => {
          // Esta aparece y las anteriores se desvanecen a la vez.
          setImages((current) => {
            const index = current.findIndex((item) => item.rain.imagePath === image.rain.imagePath);
            return current.map((item, i) => (i === index ? { ...item, visible: true } : i < index ? { ...item, leaving: true } : item));
          });
          if (image.rain.imagePath === rain.imagePath) onLoadingChange(false);
        },
        error: () => {
          if (image.rain.imagePath === rain.imagePath) onLoadingChange(false);
        },
      }}
    />
  ));
}
