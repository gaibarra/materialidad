import { apiFetch } from "./api";

export type ChecklistItem = {
  id?: number;
  checklist?: number;
  pillar: string;
  titulo: string;
  descripcion?: string;
  requerido: boolean;
  estado: string;
  vence_el?: string | null;
  responsable?: string;
  created_at?: string;
};

export type Checklist = {
  id?: number;
  tenant_slug?: string;
  nombre: string;
  tipo_gasto?: string;
  vigente?: boolean;
  items: ChecklistItem[];
  created_at?: string;
};

export type DeliverableRequirement = {
  id?: number;
  tenant_slug?: string;
  tipo_gasto: string;
  codigo: string;
  titulo: string;
  descripcion?: string;
  pillar: string;
  requerido: boolean;
  created_at?: string;
};

export async function fetchChecklists(): Promise<Checklist[]> {
  const payload = await apiFetch<any>("/api/materialidad/checklists/");
  return payload?.results ?? payload ?? [];
}

export async function createChecklist(payload: Checklist): Promise<Checklist> {
  return apiFetch<Checklist>("/api/materialidad/checklists/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateChecklistItem(id: number, data: Partial<ChecklistItem>): Promise<ChecklistItem> {
  return apiFetch<ChecklistItem>(`/api/materialidad/checklist-items/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function fetchDeliverableRequirements(): Promise<DeliverableRequirement[]> {
  const payload = await apiFetch<any>("/api/materialidad/entregables/");
  return payload?.results ?? payload ?? [];
}

export async function createDeliverableRequirement(data: DeliverableRequirement): Promise<DeliverableRequirement> {
  return apiFetch<DeliverableRequirement>("/api/materialidad/entregables/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export const PILLARS = [
  { value: "ENTREGABLES", label: "Entregables" },
  { value: "RAZON_NEGOCIO", label: "Razón de negocio" },
  { value: "CAPACIDAD_PROVEEDOR", label: "Capacidad del proveedor" },
  { value: "FECHA_CIERTA", label: "Fecha cierta" },
];

export const ITEM_STATES = [
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "EN_PROCESO", label: "En proceso" },
  { value: "COMPLETO", label: "Completo" },
];
