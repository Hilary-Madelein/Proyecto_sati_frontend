/**
 * Datos SIMULADOS de las capas que todavía no tienen fuente real
 * (inundaciones fluviales, repentinas e históricas). Las ubicaciones son
 * reales, pero niveles y zonas son ficticios. Eventos, lluvia y la red de ríos
 * de GEOGLOWS ya vienen del backend.
 */
import type { FloodMapData } from "../types";

export const MOCK_FLOOD_LAYERS: Pick<FloodMapData, "fluvialStations" | "flashFloodZones" | "historicalZones"> = {
  fluvialStations: [
    { id: "st-01", name: "Babahoyo", river: "Río Babahoyo", province: "Los Ríos", position: [-1.8, -79.53], level: "extremo", flowM3s: 1840 },
    { id: "st-02", name: "Tena", river: "Río Napo", province: "Napo", position: [-0.99, -77.81], level: "extremo", flowM3s: 2310 },
    { id: "st-03", name: "La Capilla", river: "Río Guayas", province: "Guayas", position: [-1.7, -79.99], level: "peligro", flowM3s: 1525 },
    { id: "st-04", name: "Quevedo", river: "Río Quevedo", province: "Los Ríos", position: [-1.02, -79.46], level: "peligro", flowM3s: 980 },
    { id: "st-05", name: "San Rafael", river: "Río Coca", province: "Napo", position: [-0.1, -77.58], level: "peligro", flowM3s: 1210 },
    { id: "st-06", name: "Daule", river: "Río Daule", province: "Guayas", position: [-1.86, -79.98], level: "advertencia", flowM3s: 640 },
    { id: "st-07", name: "Portoviejo", river: "Río Portoviejo", province: "Manabí", position: [-1.05, -80.45], level: "advertencia", flowM3s: 120 },
    { id: "st-08", name: "Zamora", river: "Río Zamora", province: "Zamora Chinchipe", position: [-4.07, -78.95], level: "advertencia", flowM3s: 410 },
    { id: "st-09", name: "Lago Agrio", river: "Río Aguarico", province: "Sucumbíos", position: [0.09, -76.88], level: "advertencia", flowM3s: 870 },
    { id: "st-10", name: "San Mateo", river: "Río Esmeraldas", province: "Esmeraldas", position: [0.9, -79.65], level: "normal", flowM3s: 560 },
    { id: "st-11", name: "Paute", river: "Río Paute", province: "Azuay", position: [-2.78, -78.76], level: "normal", flowM3s: 95 },
    { id: "st-12", name: "Baños", river: "Río Pastaza", province: "Tungurahua", position: [-1.4, -78.42], level: "normal", flowM3s: 230 },
    { id: "st-13", name: "Pasaje", river: "Río Jubones", province: "El Oro", position: [-3.33, -79.81], level: "normal", flowM3s: 75 },
    { id: "st-14", name: "Lita", river: "Río Mira", province: "Imbabura", position: [0.87, -78.45], level: "normal", flowM3s: 140 },
    { id: "st-15", name: "Macas", river: "Río Upano", province: "Morona Santiago", position: [-2.31, -78.11], level: "sin-datos", flowM3s: null },
    { id: "st-16", name: "Catamayo", river: "Río Catamayo", province: "Loja", position: [-3.99, -79.36], level: "sin-datos", flowM3s: null },
  ],

  flashFloodZones: [
    { id: "ff-01", name: "Babahoyo – Samborondón", province: "Los Ríos / Guayas", probability: "probable", bounds: [[-2.05, -79.85], [-1.65, -79.45]] },
    { id: "ff-02", name: "Tena – Archidona", province: "Napo", probability: "muy-probable", bounds: [[-1.12, -77.98], [-0.82, -77.68]] },
    { id: "ff-03", name: "Lago Agrio", province: "Sucumbíos", probability: "muy-probable", bounds: [[-0.05, -77.05], [0.25, -76.75]] },
    { id: "ff-04", name: "Quevedo – Buena Fe", province: "Los Ríos", probability: "probable", bounds: [[-1.15, -79.6], [-0.85, -79.3]] },
    { id: "ff-05", name: "Macas – Sucúa", province: "Morona Santiago", probability: "probable", bounds: [[-2.5, -78.25], [-2.2, -77.95]] },
  ],

  historicalZones: [
    {
      id: "hz-01",
      name: "Cuenca baja del Guayas",
      frequency: "p05",
      polygon: [[-1.25, -79.75], [-1.2, -79.35], [-1.6, -79.3], [-2.2, -79.45], [-2.45, -79.8], [-2.3, -80.05], [-1.8, -80.1]],
    },
    {
      id: "hz-02",
      name: "Llanura del Babahoyo",
      frequency: "p1",
      polygon: [[-1.45, -79.65], [-1.45, -79.42], [-1.95, -79.45], [-2.15, -79.7], [-1.9, -79.9], [-1.6, -79.85]],
    },
    {
      id: "hz-03",
      name: "Confluencia Daule – Babahoyo",
      frequency: "p5",
      polygon: [[-1.72, -79.62], [-1.75, -79.5], [-2.0, -79.6], [-2.05, -79.82], [-1.85, -79.85]],
    },
    {
      id: "hz-04",
      name: "Desembocadura del Esmeraldas",
      frequency: "p1",
      polygon: [[0.98, -79.72], [0.95, -79.6], [0.7, -79.55], [0.62, -79.68], [0.78, -79.78]],
    },
    {
      id: "hz-05",
      name: "Ribera del Napo",
      frequency: "p05",
      polygon: [[-0.92, -77.2], [-0.85, -76.6], [-0.98, -76.4], [-1.08, -76.65], [-1.05, -77.15]],
    },
  ],
};
