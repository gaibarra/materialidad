import { apiFetch } from "./api";

export type Proveedor = {
  id: number;
  razon_social: string;
  rfc: string;
  pais: string;
  estado?: string;
  ciudad?: string;
  actividad_principal?: string;
  estatus_sat?: string;
  estatus_69b?: "SIN_COINCIDENCIA" | "PRESUNTO" | "DEFINITIVO";
  riesgo_fiscal?: "BAJO" | "MEDIO" | "ALTO";
  ultima_validacion_sat?: string | null;
  ultima_validacion_69b?: string | null;
  riesgos_detectados?: string[];
  detalle_validacion?: Record<string, unknown> | null;
  correo_contacto?: string;
  telefono_contacto?: string;
  reps_registro?: string;
  imss_patronal?: string;
  activos_relevantes?: string[];
  personal_clave?: Array<Record<string, unknown> | string>;
  fotos_domicilio?: string[];
  sitio_web?: string;
  sitio_web_capturas?: string[];
  notas_capacidad?: string;
  created_at?: string;
  updated_at?: string;
};

export type ProveedorPayload = Partial<Omit<Proveedor, "id" | "created_at" | "updated_at">>;

export async function createProveedor(payload: ProveedorPayload): Promise<Proveedor> {
  return apiFetch<Proveedor>("/api/materialidad/proveedores/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateProveedor(id: number, payload: ProveedorPayload): Promise<Proveedor> {
  return apiFetch<Proveedor>(`/api/materialidad/proveedores/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export type EmpresaLite = {
  id: number;
  razon_social: string;
  rfc: string;
};

export async function fetchProviders(): Promise<Proveedor[]> {
  const payload = await apiFetch<any>("/api/materialidad/proveedores/");
  return payload?.results ?? payload ?? [];
}

export async function fetchEmpresas(): Promise<EmpresaLite[]> {
  const payload = await apiFetch<any>("/api/materialidad/empresas/");
  return payload?.results ?? payload ?? [];
}

export async function requestProveedorValidacion(proveedorId: number, empresaId: number) {
  return apiFetch(`/api/materialidad/proveedores/${proveedorId}/validaciones/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ empresa: empresaId }),
  });
}
