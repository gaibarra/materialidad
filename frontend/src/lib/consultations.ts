import { apiFetch, apiFetchRaw } from "./api";

const LEGAL_CONSULTATION_TIMEOUT_MS = 90_000;

export type LegalConsultationReference = {
  id: number | null;
  ley: string;
  ordenamiento?: string;
  tipo_fuente: string;
  estatus_vigencia?: string;
  es_vigente?: boolean;
  fecha_vigencia_desde?: string;
  fecha_vigencia_hasta?: string;
  fecha_ultima_revision?: string;
  autoridad_emisora?: string;
  articulo: string;
  fraccion: string;
  parrafo: string;
  resumen: string;
  extracto: string;
  fuente_documento: string;
  fuente_url: string;
  vigencia: string;
  sat_categoria: string;
  section_type?: string;
  identifier?: string;
  registro_digital?: string;
  rubro?: string;
  tesis?: string;
  parser?: string;
  header?: string;
  matched_phrases?: string[];
  matched_terms?: string[];
  match_reason?: string;
};

export type LegalConsultation = {
  id: number;
  pregunta: string;
  contexto: string;
  respuesta: string;
  modelo: string;
  estado: "ok" | "error";
  tipo_consulta: {
    code: string;
    label: string;
  };
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
  }, LEGAL_CONSULTATION_TIMEOUT_MS);
}
export function deleteLegalConsultation(id: number): Promise<void> {
  return apiFetch<void>(`/api/materialidad/consultas-legales/${id}/`, {
    method: "DELETE",
  });
}

export async function exportLegalConsultationPdf(id: number): Promise<void> {
  const response = await apiFetchRaw(`/api/materialidad/consultas-legales/${id}/exportar-pdf/`);
  const disposition = response.headers.get("Content-Disposition");
  let filename = `consulta-legal-${id}.pdf`;
  if (disposition && disposition.includes("filename=")) {
    filename = disposition.split("filename=")[1].replace(/"/g, "");
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}
