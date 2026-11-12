import L from "leaflet";
import "leaflet-rotate";

/**
 * leaflet-rotate (0.2.8) gira solo lo que está dentro de su "rotatePane", pero dejó
 * comentada la parte que mete ahí los panes nuevos: los nuestros (riesgo, crecidas,
 * máscara y contorno de la provincia, red provincial…) quedaban fuera y no giraban.
 * Aquí, en un mapa que se puede girar, todo pane nuevo sin contenedor va al rotatePane
 * (como en el código comentado del complemento). Los marcadores, avisos y globos
 * siguen en el "norotatePane": quedan derechos y solo cambian de lugar.
 */
type RotatableMap = L.Map & { _rotate?: boolean; _rotatePane?: HTMLElement };
const OWN_PANES = new Set(["mapPane", "rotatePane", "norotatePane"]);
const proto = L.Map.prototype as unknown as { createPane: (this: RotatableMap, name: string, container?: HTMLElement) => HTMLElement; __satiRotatePanes?: boolean };

if (!proto.__satiRotatePanes) {
  const original = proto.createPane;
  proto.createPane = function (name, container) {
    if (this._rotate && this._rotatePane && !container && !OWN_PANES.has(name)) return original.call(this, name, this._rotatePane);
    return original.call(this, name, container);
  };
  proto.__satiRotatePanes = true;
}
