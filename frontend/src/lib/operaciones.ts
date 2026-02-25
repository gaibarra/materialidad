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

export async function updateOperacion(id: number, data: Partial<Operacion>): Promise<Operacion> {
  return apiFetch<Operacion>(`/api/materialidad/operaciones/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function fetchOperacionEntregables(operacionId: number): Promise<OperacionEntregable[]> {
  const payload = await apiFetch<PaginatedResponse<OperacionEntregable> | OperacionEntregable[]>(
    `/api/materialidad/operacion-entregables/?operacion=${operacionId}`
  );
  if (Array.isArray(payload)) return payload;
  return payload?.results ?? [];
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
