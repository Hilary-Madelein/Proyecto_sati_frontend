import L from "leaflet";

/**
 * Hacia dónde queda el norte en la pantalla, en grados (0 = arriba, en sentido
 * horario). Se mide con dos puntos del mapa, uno al norte del otro, así vale con
 * cualquier giro (ver leaflet-rotate) sin depender de cómo lo aplica el complemento.
 */
export function northOnScreen(map: L.Map): number {
  const center = map.getCenter();
  const a = map.latLngToContainerPoint(center);
  const b = map.latLngToContainerPoint(L.latLng(Math.min(center.lat + 0.5, 89), center.lng));
  const degrees = (Math.atan2(b.x - a.x, a.y - b.y) * 180) / Math.PI;
  return Math.abs(degrees) < 0.5 ? 0 : degrees;
}
