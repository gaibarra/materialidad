import { apiFetch } from "./api";

export type TipoFedatario = "NOTARIO" | "CORREDOR" | "OTRO";

export interface Fedatario {
  id: number;
  nombre: string;
  tipo: TipoFedatario;
  numero_notaria: string;
  estado: string;
  ciudad: string;
  direccion: string;
  telefono: string;
  telefono_alterno: string;
  email: string;
  rfc: string;
  cedula_profesional: string;
  horario_atencion: string;
  contacto_asistente: string;
  contacto_asistente_tel: string;
  contacto_asistente_email: string;
  notas: string;
  activo: boolean;
  display_label: string;
  created_at: string;
  updated_at: string;
}

export type FedatarioPayload = Omit<Fedatario, "id" | "display_label" | "created_at" | "updated_at">;

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export async function fetchFedatarios(): Promise<Fedatario[]> {
  const payload = await apiFetch<PaginatedResponse<Fedatario> | Fedatario[]>(
    "/api/materialidad/fedatarios/?ordering=nombre"
  );
  return Array.isArray(payload) ? payload : payload.results ?? [];
}

export async function createFedatario(data: Partial<FedatarioPayload>): Promise<Fedatario> {
  return apiFetch<Fedatario>("/api/materialidad/fedatarios/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateFedatario(id: number, data: Partial<FedatarioPayload>): Promise<Fedatario> {
  return apiFetch<Fedatario>(`/api/materialidad/fedatarios/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteFedatario(id: number): Promise<void> {
  await apiFetch(`/api/materialidad/fedatarios/${id}/`, { method: "DELETE" });
}
