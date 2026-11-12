/**
 * Tipos de leaflet-rotate (el paquete no trae los suyos): opciones para girar el
 * mapa y lo que agrega a L.Map. Ver FloodMap y MapControls.
 */
import "leaflet";

declare module "leaflet" {
  interface MapOptions {
    /** Permite girar el mapa. */
    rotate?: boolean;
    /** Giro inicial, en grados. */
    bearing?: number;
    /** Brújula propia del complemento (aquí se usa una propia, ver MapControls). */
    rotateControl?: boolean | Record<string, unknown>;
    /** Girar con dos dedos (celular). */
    touchRotate?: boolean;
    /** Girar con Shift + rueda del mouse. */
    shiftKeyRotate?: boolean;
  }
  interface LeafletEventHandlerFnMap {
    /** El mapa se giró (setBearing). */
    rotate?: LeafletEventHandlerFn | undefined;
  }
  interface Map {
    /** Gira el mapa: grados en sentido horario. */
    setBearing(theta: number): this;
    /** Giro actual, en grados. */
    getBearing(): number;
  }
}
