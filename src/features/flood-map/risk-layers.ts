import type { PlannedLayerIcon } from "./constants";
import type { RiskComponentId, RiskFeature } from "./types";

/*
 * Capas de amenaza, exposición, preparación y respuesta. Los datos llegan del
 * backend (GET /risk-layers/:id); aquí se decide cómo se ven: pestaña, sección,
 * color, clases de la leyenda y qué campos muestra el popup.
 */

export type RiskGeometry = "point" | "line" | "area";

export interface RiskClass {
  label: string;
  color: string;
  /** Valores del campo (sin distinguir mayúsculas) que caen en esta clase. */
  values: readonly string[];
}

export interface RiskPopupField {
  field: string;
  label: string;
  format?: "date" | "number" | "percent" | "money" | "hectares";
}

export interface RiskLayerStyle {
  id: string;
  title: string;
  description: string;
  component: RiskComponentId;
  /** Subtítulo dentro de la pestaña, p. ej. "Vías" o "Salud". */
  section: string;
  icon: PlannedLayerIcon;
  geometry: RiskGeometry;
  /** Color de las entidades que no caen en ninguna clase (o de todas, si no hay clases). */
  color: string;
  classify?: { field: string; classes: readonly RiskClass[]; otherLabel?: string };
  popup: { titleField: string; fallbackTitle: string; fields: readonly RiskPopupField[] };
}

const GOOD = "#16a34a";
const FAIR = "#d97706";
const BAD = "#dc2626";
const NEUTRAL = "#64748b";

const RPIS_POPUP = (extra: RiskPopupField[] = []) => ({
  titleField: "UNI_NOMBRE",
  fallbackTitle: "Establecimiento de salud",
  fields: [
    { field: "TUN_DESCRI", label: "Tipo" },
    { field: "NIVEL_DESC", label: "Nivel" },
    { field: "CAN_DESCRI", label: "Cantón" },
    { field: "PRV_DESCRI", label: "Provincia" },
    ...extra,
  ],
});

export const RISK_LAYER_STYLES: readonly RiskLayerStyle[] = [
  // ── Amenaza ──────────────────────────────────────────────────────────────
  {
    id: "flood-model-zones",
    title: "Zonas inundables (modelo)",
    description: "Áreas que inunda el modelo en Manabí y Azuay/Cañar, mientras llega Flood Hub.",
    component: "amenaza",
    section: "Otras amenazas",
    icon: "waves",
    geometry: "area",
    color: "#2563eb",
    popup: {
      titleField: "",
      fallbackTitle: "Zona inundable (modelo)",
      fields: [
        { field: "region", label: "Modelo" },
        { field: "areaHa", label: "Superficie", format: "hectares" },
      ],
    },
  },
  {
    id: "mass-movements",
    title: "Movimientos en masa",
    description: "Zonas de susceptibilidad muy alta a deslizamientos.",
    component: "amenaza",
    section: "Otras amenazas",
    icon: "mountain",
    geometry: "area",
    color: "#92400e",
    popup: {
      titleField: "CATEGORIA",
      fallbackTitle: "Movimientos en masa",
      fields: [
        { field: "PENDIENTE", label: "Pendiente" },
        { field: "GEOLOGIA", label: "Geología" },
        { field: "NIVEL_III", label: "Cobertura" },
      ],
    },
  },
  {
    id: "rve-critical-points",
    title: "Puntos críticos en la RVE",
    description: "Sitios de la Red Vial Estatal con fallas o amenazas recurrentes.",
    component: "amenaza",
    section: "Otras amenazas",
    icon: "alert",
    geometry: "point",
    color: "#ea580c",
    popup: {
      titleField: "Nomenclatura",
      fallbackTitle: "Punto crítico",
      fields: [
        { field: "Ubicación", label: "Ubicación" },
        { field: "Tipo_de_amenaza", label: "Amenaza" },
        { field: "Zonal", label: "Zonal" },
        { field: "DPA_DESPRO", label: "Provincia" },
      ],
    },
  },

  // ── Exposición ───────────────────────────────────────────────────────────
  {
    id: "rve",
    title: "Red Vial Estatal",
    description: "Tramos de la RVE según su estado.",
    component: "exposicion",
    section: "Vías",
    icon: "map",
    geometry: "line",
    color: NEUTRAL,
    classify: {
      field: "ESTADO",
      classes: [
        { label: "Bueno", color: GOOD, values: ["MUY BUENO", "BUENO"] },
        { label: "Regular", color: FAIR, values: ["REGULAR"] },
        { label: "Precaución", color: BAD, values: ["CIRCULE CON PRECAUCIÓN"] },
      ],
    },
    popup: {
      titleField: "NOMBRE_TRAMO",
      fallbackTitle: "Tramo de la RVE",
      fields: [
        { field: "CODIGO_DE_VIA", label: "Vía" },
        { field: "ESTADO", label: "Estado" },
        { field: "CLASIFICACION", label: "Clasificación" },
        { field: "TIPO_CALZADA", label: "Calzada" },
        { field: "NUMERO_CARRILES", label: "Carriles" },
        { field: "DISTANCIA_KM", label: "Longitud (km)", format: "number" },
        { field: "PROVINCIA", label: "Provincia" },
      ],
    },
  },
  {
    id: "bridges",
    title: "Puentes",
    description: "Puentes fijos de la red vial y su estado.",
    component: "exposicion",
    section: "Vías",
    icon: "map",
    geometry: "point",
    color: NEUTRAL,
    classify: {
      field: "ESTADO",
      classes: [
        { label: "Bueno", color: GOOD, values: ["BUENO"] },
        { label: "Regular", color: FAIR, values: ["REGULAR"] },
        { label: "Malo", color: BAD, values: ["MALO"] },
        { label: "Colapsado", color: "#111827", values: ["COLAPSADO"] },
      ],
    },
    popup: {
      titleField: "NOMBRE_DEL_PUENTE",
      fallbackTitle: "Puente",
      fields: [
        { field: "ESTADO", label: "Estado" },
        { field: "TIPO", label: "Tipo" },
        { field: "LONGITUD_m", label: "Longitud (m)", format: "number" },
        { field: "CARRETERA", label: "Carretera" },
        { field: "EJE_VIAL", label: "Eje vial" },
        { field: "PROVINCIA", label: "Provincia" },
        { field: "OBSERVACIONES", label: "Observaciones" },
      ],
    },
  },
  {
    id: "flood-prone-towns",
    title: "Poblados inundables",
    description: "Poblados dentro de las zonas que inunda el modelo.",
    component: "exposicion",
    section: "Población",
    icon: "users",
    geometry: "point",
    color: "#1d4ed8",
    popup: { titleField: "poblado", fallbackTitle: "Poblado", fields: [{ field: "region", label: "Modelo" }] },
  },
  {
    id: "schools",
    title: "Instituciones educativas",
    description: "Escuelas y colegios en zonas de susceptibilidad media o alta.",
    component: "exposicion",
    section: "Servicios",
    icon: "pin",
    geometry: "point",
    color: NEUTRAL,
    classify: {
      field: "SUSCEPTIBI",
      classes: [
        { label: "Alta a inundaciones", color: "#1d4ed8", values: ["SUSCEPTIBILIDAD ALTA A INUNDACIONES"] },
        { label: "Media a inundaciones", color: "#60a5fa", values: ["SUSCEPTIBILIDAD MEDIA A INUNDACIONES"] },
        { label: "Alta a mov. en masa", color: "#92400e", values: ["SUSCEPTIBILIDAD ALTA A MOVIMIENTOS EN MASA"] },
        { label: "Media a mov. en masa", color: "#d97706", values: ["SUSCEPTIBILIDAD MEDIA A MOVIMIENTOS EN MASA"] },
      ],
    },
    popup: {
      titleField: "NOM_INSTIT",
      fallbackTitle: "Institución educativa",
      fields: [
        { field: "SUSCEPTIBI", label: "Susceptibilidad" },
        { field: "AMIE", label: "Código AMIE" },
        { field: "SOSTENI", label: "Sostenimiento" },
        { field: "ESTUDIANTE", label: "Estudiantes", format: "number" },
        { field: "DOCENTES", label: "Docentes", format: "number" },
        { field: "DPA_DESCAN", label: "Cantón" },
        { field: "DPA_DESPRO", label: "Provincia" },
      ],
    },
  },
  {
    id: "health-centers",
    title: "Establecimientos de salud",
    description: "Todos los de la Red Pública Integral de Salud.",
    component: "exposicion",
    section: "Servicios",
    icon: "pin",
    geometry: "point",
    color: "#0d9488",
    popup: RPIS_POPUP([
      { field: "HAU_DESCRI", label: "Horario" },
      { field: "UNI_TELEFO", label: "Teléfono" },
    ]),
  },
  {
    id: "health-centers-floods",
    title: "Salud: susceptibles a inundaciones",
    description: "Establecimientos en zonas susceptibles a inundaciones.",
    component: "exposicion",
    section: "Servicios",
    icon: "waves",
    geometry: "point",
    color: "#2563eb",
    popup: RPIS_POPUP([{ field: "susce_inun", label: "Susceptibilidad" }]),
  },
  {
    id: "health-centers-mass-movements",
    title: "Salud: susceptibles a mov. en masa",
    description: "Establecimientos en zonas susceptibles a deslizamientos.",
    component: "exposicion",
    section: "Servicios",
    icon: "mountain",
    geometry: "point",
    color: "#b45309",
    popup: RPIS_POPUP([{ field: "CATEGORIA", label: "Susceptibilidad" }]),
  },
  {
    id: "health-centers-priority",
    title: "Salud: priorizados",
    description: "Establecimientos priorizados por el MSP.",
    component: "exposicion",
    section: "Servicios",
    icon: "shield",
    geometry: "point",
    color: "#be123c",
    popup: RPIS_POPUP(),
  },

  // ── Preparación ──────────────────────────────────────────────────────────
  {
    id: "machinery",
    title: "Maquinaria pesada",
    description: "Maquinaria y vehículos del MTOP, según su estado.",
    component: "preparacion",
    section: "Recursos",
    icon: "pin",
    geometry: "point",
    color: NEUTRAL,
    classify: {
      field: "estado",
      classes: [
        { label: "Operativa", color: GOOD, values: ["OPERATIVA S/N"] },
        { label: "Operativa con falla", color: FAIR, values: ["OPERATIVA CON FALLA"] },
        { label: "En reparación", color: "#ea580c", values: ["MAQUINARIA EN REPARACIÓN"] },
        { label: "Parada", color: BAD, values: ["MAQUINARIA PARADA - REQUIERE RE"] },
        { label: "De baja", color: "#94a3b8", values: ["BAJA"] },
      ],
      otherLabel: "Sin estado",
    },
    popup: {
      titleField: "tipo_de_maquinaria_y_veh_culo",
      fallbackTitle: "Maquinaria",
      fields: [
        { field: "estado", label: "Estado" },
        { field: "marca", label: "Marca" },
        { field: "modelo", label: "Modelo" },
        { field: "a_o", label: "Año" },
        { field: "tiempo_estimado_de_reparaci_n_d", label: "Reparación (días)", format: "number" },
        { field: "provincia", label: "Provincia" },
        { field: "provincia_donde_opera", label: "Opera en" },
        { field: "EditDate", label: "Actualizado", format: "date" },
      ],
    },
  },
  {
    id: "shelters",
    title: "Alojamientos temporales",
    description: "Albergues y campamentos calificados por la SNGR.",
    component: "preparacion",
    section: "Recursos",
    icon: "users",
    geometry: "point",
    color: NEUTRAL,
    classify: {
      field: "MODALIDAD",
      classes: [
        { label: "Albergue", color: "#7c3aed", values: ["ALBERGUE"] },
        { label: "Campamento", color: "#c026d3", values: ["CAMPAMENTO"] },
      ],
    },
    popup: {
      titleField: "NOMBRE_DEL_ALOJAMIENTO",
      fallbackTitle: "Alojamiento temporal",
      fields: [
        { field: "MODALIDAD", label: "Modalidad" },
        { field: "ESTADO", label: "Estado" },
        { field: "CATEGORÍA", label: "Categoría" },
        { field: "SECTOR", label: "Sector" },
        { field: "PARROQUIA", label: "Parroquia" },
        { field: "CANTON", label: "Cantón" },
        { field: "PROVINCIA", label: "Provincia" },
      ],
    },
  },
  {
    id: "mtop-camps",
    title: "Campamentos del MTOP",
    description: "Campamentos registrados por el MTOP.",
    component: "preparacion",
    section: "Recursos",
    icon: "map",
    geometry: "point",
    color: "#475569",
    popup: {
      titleField: "",
      fallbackTitle: "Campamento del MTOP",
      fields: [
        { field: "provincia", label: "Provincia" },
        { field: "EditDate", label: "Actualizado", format: "date" },
      ],
    },
  },
  {
    id: "rve-preventive-works",
    title: "Acciones preventivas",
    description: "Trabajos preventivos en vías y cauces.",
    component: "preparacion",
    section: "Trabajos y obras",
    icon: "shield",
    geometry: "point",
    color: "#15803d",
    popup: {
      titleField: "descripci_n_de_la_acci_n_preven",
      fallbackTitle: "Acción preventiva",
      fields: [
        { field: "fecha_de_inicio", label: "Inicio", format: "date" },
        { field: "fecha_fin", label: "Fin", format: "date" },
        { field: "maquinaria", label: "Maquinaria" },
        { field: "instituciones_involucradas", label: "Instituciones" },
        { field: "cant_n", label: "Cantón" },
        { field: "provincia", label: "Provincia" },
      ],
    },
  },
  {
    id: "el-nino-road-projects",
    title: "Obras de mitigación ENOS",
    description: "Obras viales para reducir el impacto de El Niño.",
    component: "preparacion",
    section: "Trabajos y obras",
    icon: "shield",
    geometry: "line",
    color: NEUTRAL,
    classify: {
      field: "Estado_actual",
      classes: [
        { label: "En ejecución", color: "#2563eb", values: ["EN EJECUCIÓN"] },
        { label: "Finalizada", color: GOOD, values: ["FINALIZADO"] },
        { label: "Por contratar", color: "#a855f7", values: ["POR CONTRATAR", "POR ADJUDICAR"] },
      ],
    },
    popup: {
      titleField: "Accion_Esp",
      fallbackTitle: "Obra de mitigación",
      fields: [
        { field: "Estado_actual", label: "Estado" },
        { field: "Porcentaje_avance", label: "Avance", format: "percent" },
        { field: "Presupuesto_tot", label: "Presupuesto 2026", format: "money" },
        { field: "Fecha_inicio", label: "Inicio", format: "date" },
        { field: "Fecha_fin", label: "Fin", format: "date" },
        { field: "CODIGO_DE_VIA", label: "Vía" },
        { field: "Provincia", label: "Provincia" },
      ],
    },
  },
  {
    id: "culverts-zone7",
    title: "Limpieza de alcantarillas · Zona 7",
    description: "Alcantarillas limpiadas por las microempresas en la provincia de Loja.",
    component: "preparacion",
    section: "Trabajos y obras",
    icon: "users",
    geometry: "point",
    color: "#0891b2",
    popup: {
      titleField: "SUBTRAMO",
      fallbackTitle: "Alcantarilla",
      fields: [
        { field: "ESTADO", label: "Estado" },
        { field: "FECHA", label: "Limpieza", format: "date" },
        { field: "MICROEMPRE", label: "Microempresa" },
        { field: "TIPO", label: "Tipo" },
        { field: "MATERIAL", label: "Material" },
        { field: "PRIORIDAD", label: "Prioridad" },
        { field: "CARRETERA", label: "Carretera" },
        { field: "EJE", label: "Eje" },
        { field: "ABSCISA", label: "Abscisa" },
        { field: "PROVINCIA", label: "Provincia" },
      ],
    },
  },

  // ── Respuesta ────────────────────────────────────────────────────────────
  {
    id: "road-adverse-events",
    title: "Eventos adversos en vías",
    description: "Derrumbes, socavones y otros eventos que atiende el MTOP.",
    component: "respuesta",
    section: "Vías",
    icon: "alert",
    geometry: "point",
    color: NEUTRAL,
    classify: {
      field: "circulaci_n",
      classes: [
        { label: "Vía cerrada", color: BAD, values: ["CERRADA"] },
        { label: "Un carril", color: FAIR, values: ["HABILITADA UN CARRIL"] },
        { label: "Normal", color: "#94a3b8", values: ["CIRCULACIÓN NORMAL"] },
      ],
    },
    popup: {
      titleField: "tipo_de_evento",
      fallbackTitle: "Evento adverso",
      fields: [
        { field: "fecha_en_que_ocurri_el_evento", label: "Fecha", format: "date" },
        { field: "circulaci_n", label: "Circulación" },
        { field: "situaci_n_del_evento", label: "Situación" },
        { field: "nombre_del_tramo_o_sector", label: "Tramo o sector" },
        { field: "en_caso_de_requerirse_indique_l", label: "Ruta alterna" },
        { field: "observaciones", label: "Observaciones" },
        { field: "provincia", label: "Provincia" },
      ],
    },
  },
];

/** Clase de la leyenda en la que cae una entidad; null = "otro" (color base de la capa). */
export function riskClassOf(style: RiskLayerStyle, feature: RiskFeature): RiskClass | null {
  if (!style.classify) return null;
  const value = feature.properties[style.classify.field];
  if (typeof value !== "string") return null;
  const key = value.trim().toUpperCase();
  return style.classify.classes.find((item) => item.values.includes(key)) ?? null;
}

export function riskColorOf(style: RiskLayerStyle, feature: RiskFeature): string {
  return riskClassOf(style, feature)?.color ?? style.color;
}
