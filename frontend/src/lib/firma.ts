import { apiFetch } from "./api";

export type FirmaModalidad = "NOTARIAL" | "ELECTRONICA" | "MANUSCRITA";
export type EstadoLogistica = "PENDIENTE" | "AGENDADA" | "EN_PROCESO" | "COMPLETADA" | "CANCELADA";

export type FirmaLogisticaPayload = {
  firma_modalidad?: FirmaModalidad;
  logistica_estado?: EstadoLogistica;
  fecha_cita_firma?: string | null;
  lugar_cita?: string;
  responsable_logistica?: string;
  contacto_responsable?: string;
  fecha_cierta_requerida?: boolean;
  fecha_cierta_obtenida?: boolean;
  fecha_ratificacion?: string | null;
  fedatario_nombre?: string;
  numero_instrumento?: string;
  archivo_notariado_url?: string;
  sello_tiempo_aplicado?: string | null;
  sello_tiempo_proveedor?: string;
  sello_tiempo_acuse_url?: string;
  registro_publico_folio?: string;
  registro_publico_url?: string;
  notas_logistica?: string;
};

export type ContratoLogistica = {
  id: number;
  nombre: string;
  empresa: number;
  proveedor: number | null;
  fecha_cierta_requerida: boolean;
  fecha_cierta_obtenida: boolean;
  fecha_ratificacion: string | null;
  fedatario_nombre: string;
  numero_instrumento: string;
  archivo_notariado_url: string;
  sello_tiempo_aplicado: string | null;
  sello_tiempo_proveedor: string;
  sello_tiempo_acuse_url: string;
  registro_publico_folio: string;
  registro_publico_url: string;
  firma_modalidad: FirmaModalidad;
  logistica_estado: EstadoLogistica;
  fecha_cita_firma: string | null;
  lugar_cita: string;
  responsable_logistica: string;
  contacto_responsable: string;
  notas_logistica: string;
  updated_at: string;
};

export async function actualizarFirmaLogistica(
  contratoId: number,
  payload: FirmaLogisticaPayload
): Promise<ContratoLogistica> {
  return apiFetch<ContratoLogistica>(`/api/materialidad/contratos/${contratoId}/firma-logistica/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
