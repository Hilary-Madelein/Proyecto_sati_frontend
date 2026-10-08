"use client";

import { useMapEvents } from "react-leaflet";

/** Avisa los clics sobre el mapa (no los de marcadores ni popups, que no se propagan). */
export function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (event) => onClick(event.latlng.lat, event.latlng.lng),
  });
  return null;
}
