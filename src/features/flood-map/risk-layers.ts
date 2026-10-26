import type { PlannedLayerIcon } from "./constants";
import type { RiskComponentId, RiskFeature, RiskLayerData } from "./types";

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
  /** Líneas punteadas y más tenues: entidades que se muestran pero no cuentan (p. ej. en el índice de preparación). */
  dashed?: boolean;
}

export interface RiskPopupField {
  field: string;
  label: string;
  /** "plain": número tal cual, sin separador de miles (p. ej. un año). */
  format?: "date" | "number" | "percent" | "money" | "hectares" | "plain";
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
  /** Puntos agrupados en clusters a escala regional (inventarios con miles de puntos o muchos en el mismo sitio). */
  cluster?: boolean;
  /**
   * Parte de otra capa del backend que se muestra como capa propia (p. ej. solo
   * los albergues de los alojamientos temporales): se pide una vez y se filtra aquí.
   */
  subsetOf?: { id: string; field: string; values: readonly string[] };
  /** Capa con fecha: muestra solo los últimos meses (se eligen en el panel; null = todos). */
  period?: { field: string; defaultMonths: RiskPeriodMonths };
  popup: { titleField: string; fallbackTitle: string; fields: readonly RiskPopupField[] };
}

/** Meses hacia atrás que muestra una capa con fecha; null = todos. */
export type RiskPeriodMonths = 3 | 6 | 12 | null;
export const RISK_PERIOD_OPTIONS: readonly RiskPeriodMonths[] = [3, 6, 12, null];

const GOOD = "#16a34a";
const FAIR = "#d97706";
const BAD = "#dc2626";
const NEUTRAL = "#64748b";

const RPIS_POPUP = (extra: RiskPopupField[] = []) => ({
  titleField: "UNI_NOMBRE",
  fallbackTitle: "Establecimiento de salud",
  fields: [
    { field: "TUN_DESCRI", label: "Tipo" },
    { field: "NIVEL_DESC", label: "Nivel de atención" },
    { field: "IGU_DESCRI", label: "Institución" },
    ...extra,
    { field: "PAR_DESCRI", label: "Parroquia" },
    { field: "CAN_DESCRI", label: "Cantón" },
    { field: "PRV_DESCRI", label: "Provincia" },
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
        { field: "TIPO_AMEN", label: "Amenaza" },
        { field: "PENDIENTE", label: "Pendiente" },
        { field: "UNIDAD_GEO", label: "Relieve" },
        { field: "GEOLOGIA", label: "Geología" },
        { field: "SUELOS", label: "Suelos" },
        { field: "NIVEL_III", label: "Cobertura del suelo" },
        { field: "INDICE", label: "Índice de susceptibilidad", format: "number" },
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
        { field: "TRAMO_ID", label: "Código del tramo" },
        { field: "TRONCALES", label: "Troncal" },
        { field: "CLASIFICACION", label: "Clasificación" },
        { field: "DISTANCIA_KM", label: "Longitud (km)", format: "number" },
        { field: "TIPO_CALZADA", label: "Calzada" },
        { field: "ANCHO_DE_CALZADA", label: "Ancho de calzada (m)", format: "number" },
        { field: "NUMERO_CARRILES", label: "Carriles" },
        { field: "ALTURA_MAXIMA_CIRCULACION", label: "Altura máxima (m)", format: "number" },
        { field: "PESO_MAXIMO_CIRCULACION", label: "Peso máximo (t)", format: "number" },
        { field: "ADMINISTRACION", label: "Administración" },
        { field: "ENTIDAD_ADMINISTRA", label: "Entidad que administra" },
        { field: "NOMBRE_OBRA_PROYECTO", label: "Obra o proyecto" },
        { field: "PROVINCIA", label: "Provincia" },
        { field: "ZONAL", label: "Zonal" },
        { field: "OBSERVACIONES", label: "Observaciones" },
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
        { field: "ANCHO_m", label: "Ancho (m)", format: "number" },
        { field: "CARRETERA", label: "Carretera" },
        { field: "EJE_VIAL", label: "Eje vial" },
        { field: "SECTOR", label: "Sector" },
        { field: "FECHA_DE_APERTURA", label: "Año de apertura", format: "plain" },
        { field: "ID_PUENTE", label: "Código del puente" },
        { field: "PROVINCIA", label: "Provincia" },
        { field: "ZONA", label: "Zonal" },
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
    cluster: true,
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
        { field: "SUSCEPTI_1", label: "Otra susceptibilidad" },
        { field: "AMIE", label: "Código AMIE" },
        { field: "TIPOLOGÍA", label: "Tipo" },
        { field: "SOSTENI", label: "Sostenimiento" },
        { field: "JURISDICCI", label: "Jurisdicción" },
        { field: "REGIMEN", label: "Régimen" },
        { field: "ESTUDIANTE", label: "Estudiantes", format: "number" },
        { field: "DOCENTES", label: "Docentes", format: "number" },
        { field: "JORNADA", label: "Jornada" },
        { field: "MODALIDAD", label: "Modalidad" },
        { field: "ACCESO", label: "Acceso" },
        { field: "CONECTIVIDAD", label: "Conectividad" },
        { field: "AREA", label: "Área" },
        { field: "NOMBRE_DIS", label: "Distrito educativo" },
        { field: "DPA_DESPAR", label: "Parroquia" },
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
    cluster: true,
    popup: RPIS_POPUP([
      { field: "SECTORESTA", label: "Sector" },
      { field: "DIFICILACC", label: "Difícil acceso" },
      { field: "HAU_DESCRI", label: "Horario" },
      { field: "EMERGENCIA", label: "Emergencia" },
      { field: "LABORATORI", label: "Laboratorio" },
      { field: "RX_IMAGEN", label: "Rayos X e imagen" },
      { field: "nom_href", label: "Hospital de referencia" },
      { field: "DIST_HREF", label: "Distancia al hospital de referencia (km)", format: "number" },
      { field: "UNI_DIRECC", label: "Dirección" },
      // Teléfono del establecimiento (institucional), no de una persona.
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
    popup: RPIS_POPUP([
      { field: "susce_inun", label: "Susceptibilidad" },
      { field: "pendiente", label: "Pendiente (%)" },
    ]),
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
    popup: RPIS_POPUP([
      { field: "CATEGORIA", label: "Susceptibilidad" },
      { field: "PENDIENTE", label: "Pendiente" },
    ]),
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
    title: "Maquinaria distribuida a nivel nacional",
    description: "Maquinaria y vehículos del MIT, según su estado.",
    component: "preparacion",
    section: "Recursos",
    icon: "pin",
    geometry: "point",
    color: NEUTRAL,
    cluster: true,
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
        { field: "a_o", label: "Año", format: "plain" },
        { field: "descripci_n_de_falla", label: "Falla" },
        { field: "descripci_n_de_fallas_cr_ticas", label: "Fallas críticas" },
        { field: "tiempo_estimado_de_reparaci_n_d", label: "Reparación (días)", format: "number" },
        { field: "hor_metro", label: "Horómetro (h)", format: "number" },
        { field: "kilometraje_actual", label: "Kilometraje", format: "number" },
        { field: "posee_matr_cula_institucional", label: "Matrícula institucional" },
        { field: "posee_seguro_vigente", label: "Seguro vigente" },
        { field: "provincia", label: "Provincia" },
        { field: "provincia_donde_opera", label: "Opera en" },
        { field: "zonal", label: "Zonal" },
        { field: "fecha", label: "Fecha del registro", format: "date" },
        { field: "EditDate", label: "Actualizado", format: "date" },
      ],
    },
  },
  // Albergues y campamentos son la misma capa de la SNGR (alojamientos temporales),
  // separada por modalidad para encenderlos por separado.
  ...(
    [
      { id: "shelters-albergues", title: "Albergues para la población", modality: "ALBERGUE", color: "#7c3aed" },
      { id: "shelters-campamentos", title: "Campamentos para la población", modality: "CAMPAMENTO", color: "#c026d3" },
    ] as const
  ).map(
    ({ id, title, modality, color }): RiskLayerStyle => ({
      id,
      title,
      description: `${modality === "ALBERGUE" ? "Albergues" : "Campamentos"} para la población afectada, calificados por la SNGR.`,
      component: "preparacion",
      section: "Recursos",
      icon: "users",
      geometry: "point",
      color,
      cluster: true,
      subsetOf: { id: "shelters", field: "MODALIDAD", values: [modality] },
      popup: {
        titleField: "NOMBRE_DEL_ALOJAMIENTO",
        fallbackTitle: modality === "ALBERGUE" ? "Albergue" : "Campamento",
        fields: [
          { field: "ESTADO", label: "Estado" },
          { field: "CATEGORÍA", label: "Categoría" },
          { field: "SECTOR", label: "Sector" },
          { field: "PARROQUIA", label: "Parroquia" },
          { field: "CANTON", label: "Cantón" },
          { field: "PROVINCIA", label: "Provincia" },
        ],
      },
    }),
  ),
  {
    id: "mtop-camps",
    title: "Campamentos del MIT",
    description: "Áreas de apoyo a obras viales del MIT: bodegas, maquinaria y talleres.",
    component: "preparacion",
    section: "Recursos",
    icon: "map",
    geometry: "point",
    color: "#475569",
    popup: {
      titleField: "",
      fallbackTitle: "Campamento del MIT",
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
    title: "Proyectos viales asociados al fenómeno de El Niño",
    description: "Obras viales para reducir el impacto de El Niño.",
    component: "preparacion",
    section: "Trabajos y obras",
    icon: "shield",
    geometry: "line",
    color: NEUTRAL,
    // El backend marca cuáles cuentan en el índice de preparación (Estado_indice): las demás
    // (por contratar, obras que no son viales y registros repetidos) van punteadas.
    classify: {
      field: "Estado_indice",
      classes: [
        { label: "En ejecución", color: "#2563eb", values: ["EN EJECUCIÓN"] },
        { label: "Finalizada", color: GOOD, values: ["FINALIZADO"] },
        { label: "Por contratar", color: "#a855f7", values: ["POR CONTRATAR"], dashed: true },
        { label: "Obra no vial", color: "#94a3b8", values: ["OBRA NO VIAL"], dashed: true },
        { label: "Registro repetido", color: "#cbd5e1", values: ["REGISTRO REPETIDO"], dashed: true },
      ],
    },
    popup: {
      titleField: "Accion_Esp",
      fallbackTitle: "Obra de mitigación",
      fields: [
        { field: "Estado_actual", label: "Estado" },
        { field: "Porcentaje_avance", label: "Avance", format: "percent" },
        { field: "Presupuesto_tot", label: "Presupuesto 2026", format: "money" },
        { field: "Total_Obra", label: "Total de la obra", format: "money" },
        { field: "Tipo_financiamiento", label: "Financiamiento" },
        { field: "Fecha_inicio", label: "Inicio", format: "date" },
        { field: "Fecha_fin", label: "Fin", format: "date" },
        { field: "Nro", label: "Número de obra" },
        { field: "NOMBRE_TRAMO", label: "Tramo" },
        { field: "CODIGO_DE_VIA", label: "Vía" },
        { field: "DISTANCIA_KM", label: "Longitud del tramo (km)", format: "number" },
        { field: "ESTADO", label: "Estado de la vía" },
        { field: "ENTIDAD_ADMINISTRA", label: "Entidad que administra" },
        { field: "Provincia", label: "Provincia" },
        { field: "ZONAL", label: "Zonal" },
        { field: "OBSERVACIONES", label: "Observaciones" },
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
    description: "Derrumbes, socavones y otros eventos que atiende el MIT.",
    component: "respuesta",
    section: "Vías",
    icon: "alert",
    geometry: "point",
    // El servicio guarda eventos desde 2015: por defecto, solo los recientes.
    period: { field: "fecha_en_que_ocurri_el_evento", defaultMonths: 3 },
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
        { field: "distancia_afectaci_n_m", label: "Distancia afectada (m)", format: "number" },
        { field: "equipos_de_maquinaria_pesada_ut", label: "Maquinaria utilizada" },
        { field: "la_maquinaria_pesada_empleada_d", label: "La maquinaria pertenece a" },
        { field: "recurso_humano_desplegado_para", label: "Personal desplegado" },
        { field: "los_recursos_humanos_asignados", label: "El personal pertenece a" },
        { field: "en_caso_de_requerirse_indique_l", label: "Ruta alterna" },
        { field: "observaciones", label: "Observaciones" },
        { field: "provincia", label: "Provincia" },
        { field: "zonal", label: "Zonal" },
      ],
    },
  },
  {
    id: "rve-recovery",
    title: "Trabajos para recuperar la transitabilidad",
    description: "Trabajos del MIT para reabrir o mantener las vías afectadas.",
    component: "respuesta",
    section: "Vías",
    icon: "refresh",
    geometry: "point",
    color: "#0f766e",
    popup: {
      titleField: "descripci_n_de_trabaj",
      fallbackTitle: "Trabajo de transitabilidad",
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
    id: "deployed-road-equipment",
    title: "Equipo caminero desplegado",
    description: "Excavadoras atendiendo emergencias viales.",
    component: "respuesta",
    section: "Vías",
    icon: "pin",
    geometry: "point",
    color: "#ca8a04",
    popup: {
      titleField: "Tipo_maquinaria",
      fallbackTitle: "Equipo caminero",
      fields: [
        { field: "DPA_DESCAN", label: "Cantón" },
        { field: "DPA_DESPRO", label: "Provincia" },
      ],
    },
  },
];

/** Radio de los puntos sueltos según el zoom: más chicos a escala nacional. */
export function riskPointRadius(zoom: number): number {
  return zoom <= 7 ? 3.5 : zoom <= 9 ? 4.5 : 5.5;
}

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

/** Capa del backend de la que salen los datos de un estilo (la suya, o aquella de la que es una parte). */
export function riskDataId(style: RiskLayerStyle): string {
  return style.subsetOf?.id ?? style.id;
}

const views = new WeakMap<RiskLayerData, Map<string, RiskLayerData>>();

/**
 * Lo que se dibuja de una capa: solo su parte (subsetOf) y su periodo. Se
 * guarda por descarga, así cada filtro conserva su identidad entre renders
 * (los clusters no se recalculan) y `view` cambia cuando cambia el filtro.
 */
export function riskLayerView(style: RiskLayerStyle, data: RiskLayerData, months: RiskPeriodMonths): RiskLayerData {
  const { subsetOf, period } = style;
  if (!subsetOf && !(period && months)) return data;
  const view = `${style.id}:${period ? (months ?? "todos") : ""}`;
  let cache = views.get(data);
  if (!cache) views.set(data, (cache = new Map()));
  let result = cache.get(view);
  if (!result) {
    const cutoff = period && months ? new Date() : null;
    cutoff?.setMonth(cutoff.getMonth() - (months ?? 0));
    const features = data.features.filter((feature) => {
      if (subsetOf) {
        const value = feature.properties[subsetOf.field];
        if (typeof value !== "string" || !subsetOf.values.includes(value.trim().toUpperCase())) return false;
      }
      if (cutoff && period) {
        const time = Date.parse(String(feature.properties[period.field] ?? ""));
        if (Number.isNaN(time) || time < cutoff.getTime()) return false;
      }
      return true;
    });
    result = { ...data, features, view };
    cache.set(view, result);
  }
  return result;
}
