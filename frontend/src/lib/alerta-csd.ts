import { apiFetch } from "./api";

export interface AlertaCSD {
    id: number;
    empresa: number;
    empresa_nombre: string;
    proveedor: number | null;
    proveedor_nombre: string | null;
    tipo_alerta: "PROPIETARIO" | "PROVEEDOR";
    estatus: "ACTIVA" | "ACLARACION" | "RESUELTA" | "REVOCADO";
    fecha_deteccion: string;
    fecha_resolucion: string | null;
    oficio_sat: string;
    motivo_presuncion: string;
    acciones_tomadas: string;
    created_at: string;
    updated_at: string;
}

export interface AlertaCSDPayload {
    empresa: number;
    proveedor?: number | null;
    tipo_alerta: "PROPIETARIO" | "PROVEEDOR";
    estatus: "ACTIVA" | "ACLARACION" | "RESUELTA" | "REVOCADO";
    fecha_deteccion: string;
    fecha_resolucion?: string | null;
    oficio_sat?: string;
    motivo_presuncion?: string;
    acciones_tomadas?: string;
}

/**
 * Obtiene las Alertas CSD para una empresa específica.
 */
export async function getAlertasCSD(empresaId: number): Promise<AlertaCSD[]> {
    const url = `/api/materialidad/alertas-csd/?empresa_id=${empresaId}`;
    return apiFetch<AlertaCSD[]>(url);
}

/**
 * Obtiene el detalle de una Alerta CSD por ID.
 */
export async function getAlertaCSD(id: number): Promise<AlertaCSD> {
    const url = `/api/materialidad/alertas-csd/${id}/`;
    return apiFetch<AlertaCSD>(url);
}

/**
 * Crea una nueva contingencia CSD.
 */
export async function createAlertaCSD(data: AlertaCSDPayload): Promise<AlertaCSD> {
    const url = `/api/materialidad/alertas-csd/`;
    return apiFetch<AlertaCSD>(url, {
        method: "POST",
        body: JSON.stringify(data),
    });
}

/**
 * Actualiza una contingencia CSD existente (ej. cambio de estatus a RESUELTA, añadir oficio SAT).
 */
export async function updateAlertaCSD(id: number, data: Partial<AlertaCSDPayload>): Promise<AlertaCSD> {
    const url = `/api/materialidad/alertas-csd/${id}/`;
    return apiFetch<AlertaCSD>(url, {
        method: "PATCH",
        body: JSON.stringify(data),
    });
}

/**
 * Elimina una contingencia CSD (poco común, usualmente se pasa a REVOCADO o RESUELTA, pero útil por si acaso).
 */
export async function deleteAlertaCSD(id: number): Promise<void> {
    const url = `/api/materialidad/alertas-csd/${id}/`;
    return apiFetch<void>(url, {
        method: "DELETE",
    });
}
