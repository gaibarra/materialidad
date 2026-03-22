import { apiFetch } from "./api";
import { DeliverableRequirement } from "./checklists";

export type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type Operacion = {
  id: number;
  empresa: number;
  empresa_nombre: string;
  proveedor: number;
  proveedor_nombre: string;
  contrato: number | null;
  contrato_nombre: string | null;
  contrato_categoria?: string | null;
  monto: string;
  moneda: string;
  fecha_operacion: string;
  tipo_operacion: string;
  concepto: string;
  concepto_generico?: boolean;
  concepto_sugerido?: string | null;
  estatus_validacion: string;
  cfdi_estatus?: string;
  spei_estatus?: string;
  nif_aplicable?: string | null;
  riesgo_nivel?: "BAJO" | "MEDIO" | "ALTO";
  riesgo_score?: number;
  riesgo_motivos?: string[];
  checklists_resumen?: OperacionChecklistResumen[];
};

export type OperacionChecklistResumen = {
  id: number;
  nombre: string;
  tipo_gasto?: string;
  estado_general: "PENDIENTE" | "EN_PROCESO" | "COMPLETO";
  progreso_porcentaje: number;
  total_items: number;
  completos: number;
  pendientes: number;
  requeridos_pendientes: number;
};

export type OperacionChecklistItem = {
  id: number;
  operacion_checklist: number;
  checklist_item: number | null;
  pillar: string;
  titulo: string;
  descripcion: string;
  requerido: boolean;
  responsable: string;
  estado: "PENDIENTE" | "EN_PROCESO" | "COMPLETO";
  created_at: string;
  updated_at: string;
};

export type OperacionChecklist = {
  id: number;
  operacion: number;
  checklist: number | null;
  nombre: string;
  tipo_gasto: string;
  origen: "AUTO" | "MANUAL";
  estado_general: "PENDIENTE" | "EN_PROCESO" | "COMPLETO";
  progreso_porcentaje: number;
  total_items: number;
  completos: number;
  pendientes: number;
  created_at: string;
  updated_at: string;
  items: OperacionChecklistItem[];
};

export type OperacionCambioEstatusPayload = {
  estatus_validacion: "PENDIENTE" | "EN_PROCESO" | "VALIDADO" | "RECHAZADO";
  comentario?: string;
};

export type AlertaOperacion = {
  id: number;
  operacion: number;
  empresa?: number;
  proveedor?: number;
  tipo_alerta: "FALTANTES_CRITICOS" | "VENCIMIENTO_EVIDENCIA";
  estatus: "ACTIVA" | "EN_SEGUIMIENTO" | "CERRADA";
  motivo: string;
  detalle?: Record<string, unknown>;
  owner_email?: string;
  fecha_alerta?: string;
};

export type BandejaRevisionItem = {
  id: number;
  fecha_operacion: string;
  estatus_validacion: string;
  tipo_operacion: string;
  monto: string;
  moneda: string;
  concepto: string;
  empresa: number;
  empresa_rfc: string;
  empresa_nombre: string;
  proveedor: number;
  proveedor_rfc: string;
  proveedor_nombre: string;
  contrato: number | null;
  contrato_nombre: string | null;
  contrato_categoria: string | null;
  perfil_validacion: "SERVICIOS" | "COMPRAS" | "PARTES_RELACIONADAS" | "GENERAL";
  riesgo_nivel: "BAJO" | "MEDIO" | "ALTO";
  riesgo_score: number;
  riesgo_motivos: string[];
  faltantes: string[];
  alertas_activas: AlertaOperacion[];
  checklists_resumen: OperacionChecklistResumen[];
};

export type MatrizCadenaDocumental = {
  cfdi: {
    presente: boolean;
    uuid?: string;
    estatus?: string;
  };
  contrato: {
    presente: boolean;
    id?: number;
    nombre?: string;
  };
  pago: {
    presente: boolean;
    tipo?: string;
    referencia_spei?: string;
    soporte_metadata?: boolean;
  };
  evidencia: {
    presente: boolean;
    total?: number;
    tipos?: string[];
  };
};

export type MatrizMaterialidadItem = {
  id: number;
  fecha_operacion: string;
  estatus_validacion: string;
  monto: string;
  moneda: string;
  empresa_nombre: string;
  proveedor_nombre: string;
  empresa_rfc: string;
  proveedor_rfc: string;
  perfil_validacion: "SERVICIOS" | "COMPRAS" | "PARTES_RELACIONADAS" | "GENERAL";
  riesgo_nivel: "BAJO" | "MEDIO" | "ALTO";
  riesgo_score: number;
  estado_completitud: "COMPLETO" | "INCOMPLETO";
  faltantes: string[];
  cadena_documental: MatrizCadenaDocumental;
  alertas_activas: AlertaOperacion[];
  checklists_resumen: OperacionChecklistResumen[];
};

export type OperacionEntregable = {
  id: number;
  operacion: number;
  requirement: number | null;
  titulo: string;
  descripcion: string;
  tipo_gasto: string;
  codigo: string;
  pillar: string;
  requerido: boolean;
  estado: "PENDIENTE" | "EN_PROCESO" | "ENTREGADO" | "RECIBIDO" | "FACTURADO";
  fecha_compromiso: string | null;
  fecha_entregado: string | null;
  fecha_recepcion: string | null;
  fecha_factura: string | null;
  oc_numero: string;
  oc_fecha: string | null;
  oc_archivo_url: string;
  evidencia_cargada_en: string | null;
  recepcion_firmada_en: string | null;
  recepcion_firmado_por: string;
  recepcion_firmado_email: string;
  comentarios: string;
  metadata: Record<string, any>;
  vencido: boolean;
  dias_atraso: number;
  created_at: string;
  updated_at: string;
  operacion_info?: {
    id: number;
    contrato: number | null;
    proveedor: number;
    empresa: number;
    monto: string;
    moneda: string;
    fecha_operacion: string;
  };
};

export async function fetchOperaciones(): Promise<Operacion[]> {
  const payload = await apiFetch<PaginatedResponse<Operacion> | Operacion[]>("/api/materialidad/operaciones/");
  if (Array.isArray(payload)) return payload;
  return payload?.results ?? [];
}

export type OperacionPayload = {
  empresa?: number;
  proveedor: number;
  contrato?: number | null;
  uuid_cfdi?: string | null;
  monto?: number | string | null;
  moneda?: string;
  fecha_operacion?: string | null;
  tipo_operacion?: string;
  concepto?: string;
};

export async function createOperacion(data: OperacionPayload): Promise<Operacion> {
  return apiFetch<Operacion>("/api/materialidad/operaciones/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateOperacion(id: number, data: Partial<Operacion>): Promise<Operacion> {
  return apiFetch<Operacion>(`/api/materialidad/operaciones/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteOperacion(id: number): Promise<void> {
  await apiFetch(`/api/materialidad/operaciones/${id}/`, {
    method: "DELETE",
  });
}

export async function cambiarOperacionEstatus(
  id: number,
  payload: OperacionCambioEstatusPayload
): Promise<Operacion> {
  return apiFetch<Operacion>(`/api/materialidad/operaciones/${id}/cambiar-estatus/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function fetchOperacionEntregables(operacionId: number): Promise<OperacionEntregable[]> {
  const payload = await apiFetch<PaginatedResponse<OperacionEntregable> | OperacionEntregable[]>(
    `/api/materialidad/operacion-entregables/?operacion=${operacionId}`
  );
  if (Array.isArray(payload)) return payload;
  return payload?.results ?? [];
}

export async function fetchOperacionChecklists(operacionId: number): Promise<OperacionChecklist[]> {
  return apiFetch<OperacionChecklist[]>(`/api/materialidad/operaciones/${operacionId}/checklists/`);
}

export async function updateOperacionChecklistItem(
  id: number,
  data: Partial<Pick<OperacionChecklistItem, "estado">>
): Promise<OperacionChecklistItem> {
  return apiFetch<OperacionChecklistItem>(`/api/materialidad/operacion-checklist-items/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export type OperacionEntregablePayload = {
  operacion: number;
  requirement?: number | null;
  titulo: string;
  descripcion?: string;
  tipo_gasto?: string;
  codigo?: string;
  pillar?: string;
  requerido?: boolean;
  estado?: OperacionEntregable["estado"];
  fecha_compromiso?: string | null;
  fecha_entregado?: string | null;
  fecha_recepcion?: string | null;
  fecha_factura?: string | null;
  oc_numero?: string;
  oc_fecha?: string | null;
  oc_archivo_url?: string;
  recepcion_firmado_por?: string;
  recepcion_firmado_email?: string;
  comentarios?: string;
  metadata?: Record<string, any>;
};

export async function createOperacionEntregable(data: OperacionEntregablePayload): Promise<OperacionEntregable> {
  return apiFetch<OperacionEntregable>("/api/materialidad/operacion-entregables/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateOperacionEntregable(
  id: number,
  data: Partial<OperacionEntregablePayload>
): Promise<OperacionEntregable> {
  return apiFetch<OperacionEntregable>(`/api/materialidad/operacion-entregables/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function mapRequirementToEntregable(req: DeliverableRequirement): OperacionEntregablePayload {
  return {
    operacion: 0, // se reemplaza antes de enviar
    requirement: req.id ?? undefined,
    titulo: req.titulo,
    descripcion: req.descripcion ?? "",
    tipo_gasto: req.tipo_gasto,
    codigo: req.codigo,
    pillar: req.pillar,
    requerido: req.requerido,
  };
}

export async function exportOperacionDossier(id: number): Promise<void> {
  // Using apiFetchRaw to get the raw response because it's a binary file (ZIP)
  const { apiFetchRaw } = await import("./api");
  const response = await apiFetchRaw(`/api/materialidad/operaciones/${id}/exportar-dossier/`);

  // Extract filename from Content-Disposition if present
  const disposition = response.headers.get("Content-Disposition");
  let filename = `dossier-operacion-${id}.zip`;
  if (disposition && disposition.includes("filename=")) {
    filename = disposition.split("filename=")[1].replace(/"/g, "");
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function exportOperacionDefensaPdf(id: number): Promise<void> {
  const { apiFetchRaw } = await import("./api");
  const response = await apiFetchRaw(`/api/materialidad/operaciones/${id}/exportar-pdf-defensa/`);

  const disposition = response.headers.get("Content-Disposition");
  let filename = `defensa-operacion-${id}.pdf`;
  if (disposition && disposition.includes("filename=")) {
    filename = disposition.split("filename=")[1].replace(/"/g, "");
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

type QueryValue = string | number | boolean | null | undefined;

function buildQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const raw = search.toString();
  return raw ? `?${raw}` : "";
}

export async function fetchBandejaRevision(params: {
  rol?: "SERVICIOS" | "COMPRAS" | "PARTES_RELACIONADAS" | "GENERAL";
  estatus?: string;
  riesgo?: "BAJO" | "MEDIO" | "ALTO";
  rfc?: string;
  orden?: "riesgo" | "antiguedad";
} = {}): Promise<PaginatedResponse<BandejaRevisionItem>> {
  const query = buildQuery(params);
  return apiFetch<PaginatedResponse<BandejaRevisionItem>>(`/api/materialidad/operaciones/bandeja-revision/${query}`);
}

export async function fetchMatrizMaterialidad(params: {
  empresa?: number;
  proveedor?: number;
  estatus?: string;
  riesgo?: "BAJO" | "MEDIO" | "ALTO";
  rfc?: string;
  orden?: "riesgo" | "antiguedad";
} = {}): Promise<PaginatedResponse<MatrizMaterialidadItem>> {
  const query = buildQuery(params);
  return apiFetch<PaginatedResponse<MatrizMaterialidadItem>>(`/api/materialidad/operaciones/matriz-materialidad/${query}`);
}

export async function fetchAlertasOperacion(params: {
  empresa?: number;
  proveedor?: number;
  estatus?: "ACTIVA" | "EN_SEGUIMIENTO" | "CERRADA";
  tipo_alerta?: "FALTANTES_CRITICOS" | "VENCIMIENTO_EVIDENCIA";
  operacion?: number;
  empresa_rfc?: string;
  proveedor_rfc?: string;
} = {}): Promise<PaginatedResponse<AlertaOperacion>> {
  const query = buildQuery(params);
  return apiFetch<PaginatedResponse<AlertaOperacion>>(`/api/materialidad/alertas-operacion/${query}`);
}
