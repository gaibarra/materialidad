import { apiFetch, apiFetchRaw } from "./api";

export type TipoPersona = "MORAL" | "FISICA";

export interface Empresa {
  id: number;
  tipo_persona: TipoPersona;
  razon_social: string;
  rfc: string;
  regimen_fiscal: string;
  actividad_economica: string;
  fecha_constitucion: string | null;
  // PF
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  curp: string;
  // Domicilio
  calle: string;
  no_exterior: string;
  no_interior: string;
  colonia: string;
  codigo_postal: string;
  municipio: string;
  estado: string;
  ciudad: string;
  pais: string;
  // Contacto
  contacto_nombre: string;
  contacto_puesto: string;
  contacto_email: string;
  contacto_telefono: string;
  // Legacy
  email_contacto: string;
  telefono_contacto: string;
  // CSF
  csf_archivo: string | null;
  csf_datos_extraidos: Record<string, string>;
  csf_fecha_emision: string | null;
  // Computed
  display_name: string;
  domicilio_fiscal: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export type EmpresaPayload = Partial<Omit<Empresa, "id" | "created_at" | "updated_at" | "display_name" | "domicilio_fiscal" | "csf_datos_extraidos">>;

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export async function fetchEmpresas(): Promise<Empresa[]> {
  const res = await apiFetch<PaginatedResponse<Empresa>>("/api/materialidad/empresas/?page_size=500");
  return res.results ?? [];
}

export async function fetchEmpresa(id: number): Promise<Empresa> {
  return apiFetch<Empresa>(`/api/materialidad/empresas/${id}/`);
}

export async function createEmpresa(data: EmpresaPayload): Promise<Empresa> {
  return apiFetch<Empresa>("/api/materialidad/empresas/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateEmpresa(id: number, data: EmpresaPayload): Promise<Empresa> {
  return apiFetch<Empresa>(`/api/materialidad/empresas/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteEmpresa(id: number): Promise<void> {
  await apiFetchRaw(`/api/materialidad/empresas/${id}/`, { method: "DELETE" });
}

export interface CSFExtractionResult {
  datos_extraidos: Record<string, string>;
  registro?: Empresa;
}

export async function uploadCSFEmpresa(archivo: File, id?: number): Promise<CSFExtractionResult> {
  const formData = new FormData();
  formData.append("archivo", archivo);
  if (id) formData.append("id", String(id));

  return apiFetch<CSFExtractionResult>("/api/materialidad/empresas/upload-csf/", {
    method: "POST",
    body: formData,
  });
}
