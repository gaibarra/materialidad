import { apiFetch } from "./api";

/* ── Types ── */

export interface AlertaOperacion {
  id: number;
  operacion: number;
  empresa: number;
  empresa_nombre: string;
  proveedor: number | null;
  proveedor_nombre: string | null;
  tipo_alerta: "FALTANTES_CRITICOS" | "VENCIMIENTO_EVIDENCIA";
  estatus: "ACTIVA" | "EN_SEGUIMIENTO" | "CERRADA";
  clave_dedupe: string;
  owner_email: string;
  motivo: string;
  detalle: Record<string, unknown>;
  fecha_alerta: string;
  fecha_cierre: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlertaOperacionPayload {
  operacion: number;
  empresa: number;
  proveedor?: number | null;
  tipo_alerta: string;
  estatus?: string;
  owner_email?: string;
  motivo: string;
  detalle?: Record<string, unknown>;
  fecha_alerta?: string;
  fecha_cierre?: string | null;
}

/* ── CRUD ── */

export async function getAlertasOperacion(params?: Record<string, string>): Promise<AlertaOperacion[]> {
  const qs = new URLSearchParams({ page_size: "200", ...(params ?? {}) });
  const url = `/api/materialidad/alertas-operacion/?${qs}`;
  const res = await apiFetch<AlertaOperacion[] | { results: AlertaOperacion[] }>(url);
  return Array.isArray(res) ? res : res.results ?? [];
}

export async function getAlertaOperacion(id: number): Promise<AlertaOperacion> {
  return apiFetch<AlertaOperacion>(`/api/materialidad/alertas-operacion/${id}/`);
}

export async function createAlertaOperacion(data: AlertaOperacionPayload): Promise<AlertaOperacion> {
  return apiFetch<AlertaOperacion>("/api/materialidad/alertas-operacion/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAlertaOperacion(
  id: number,
  data: Partial<AlertaOperacionPayload>,
): Promise<AlertaOperacion> {
  return apiFetch<AlertaOperacion>(`/api/materialidad/alertas-operacion/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteAlertaOperacion(id: number): Promise<void> {
  return apiFetch<void>(`/api/materialidad/alertas-operacion/${id}/`, {
    method: "DELETE",
  });
}
