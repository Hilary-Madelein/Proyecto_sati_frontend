/**
 * Datos SIMULADOS de las capas que todavía no tienen fuente real
 * (inundaciones repentinas e históricas). Las ubicaciones son reales, pero las
 * zonas son ficticias. Eventos, lluvia y caudales ya vienen del backend.
 */
import type { FloodMapData } from "../types";

export const MOCK_FLOOD_LAYERS: Pick<FloodMapData, "flashFloodZones" | "historicalZones"> = {
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
