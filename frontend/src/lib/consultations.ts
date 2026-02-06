import { apiFetch } from "./api";

export type LegalConsultationReference = {
  id: number | null;
  ley: string;
  tipo_fuente: string;
  articulo: string;
  fraccion: string;
  parrafo: string;
  resumen: string;
  extracto: string;
  fuente_documento: string;
  fuente_url: string;
  vigencia: string;
  sat_categoria: string;
};

export type LegalConsultation = {
  id: number;
  pregunta: string;
  contexto: string;
  respuesta: string;
  modelo: string;
  referencias: LegalConsultationReference[];
  created_at: string;
};

export type LegalConsultationListResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: LegalConsultation[];
};

export type LegalConsultationPayload = {
  pregunta: string;
  contexto?: string;
  ley?: string;
  tipo_fuente?: string;
  max_referencias?: number;
};

export function fetchLegalConsultations(): Promise<LegalConsultationListResponse> {
  return apiFetch<LegalConsultationListResponse>("/api/materialidad/consultas-legales/");
}

export function createLegalConsultation(payload: LegalConsultationPayload): Promise<LegalConsultation> {
  return apiFetch<LegalConsultation>("/api/materialidad/consultas-legales/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
export function deleteLegalConsultation(id: number): Promise<void> {
  return apiFetch<void>(`/api/materialidad/consultas-legales/${id}/`, {
    method: "DELETE",
  });
}
