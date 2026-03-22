import { apiFetch } from "./api";

export type LegalSourceType = "LEY" | "REGLAMENTO" | "NOM" | "CRITERIO_SAT" | "RESOLUCION";

export type LegalVigencyStatus = "VIGENTE" | "DESCONOCIDA" | "HISTORICA" | "DEROGADA" | "ABROGADA";

export type LegalAuthority = "DOF" | "SAT" | "SCJN" | "TFJA" | "OTRO";

export const LEGAL_AUTHORITY_OPTIONS: Array<{ value: LegalAuthority; label: string }> = [
  { value: "DOF", label: "DOF" },
  { value: "SAT", label: "SAT" },
  { value: "SCJN", label: "SCJN" },
  { value: "TFJA", label: "TFJA" },
  { value: "OTRO", label: "Otra autoridad" },
];

export const SOURCE_TYPE_OPTIONS: Array<{ value: LegalSourceType; label: string }> = [
  { value: "LEY", label: "Ley" },
  { value: "REGLAMENTO", label: "Reglamento" },
  { value: "NOM", label: "Norma Oficial" },
  { value: "CRITERIO_SAT", label: "Criterio SAT" },
  { value: "RESOLUCION", label: "Resolución" },
];

export type LegalReferenceSource = {
  id: number;
  slug: string;
  ley: string;
  ordenamiento: string;
  corpus_upload: number | null;
  tipo_fuente: LegalSourceType;
  estatus_vigencia: LegalVigencyStatus;
  es_vigente: boolean;
  fecha_vigencia_desde: string;
  fecha_vigencia_hasta: string;
  fecha_ultima_revision: string;
  autoridad_emisora: string;
  articulo: string;
  fraccion: string;
  parrafo: string;
  contenido: string;
  resumen: string;
  fuente_documento: string;
  fuente_url: string;
  vigencia: string;
  sat_categoria: string;
  hash_contenido: string;
  vectorizacion_modelo: string;
  vectorizacion_dim: number;
  vectorizado_en: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type LegalCorpusUpload = {
  id: number;
  titulo: string;
  slug: string;
  archivo: string;
  autoridad: LegalAuthority;
  ordenamiento: string;
  tipo_fuente: LegalSourceType;
  estatus: "PENDIENTE" | "PROCESANDO" | "COMPLETADO" | "ERROR";
  estatus_vigencia: LegalVigencyStatus;
  es_vigente: boolean;
  force_vigencia: boolean;
  fecha_vigencia_desde: string | null;
  fecha_vigencia_hasta: string | null;
  fecha_ultima_revision: string | null;
  vigencia: string;
  fuente_documento: string;
  fuente_url: string;
  sat_categoria: string;
  total_fragmentos: number;
  fragmentos_procesados: number;
  error_detalle: string;
  uploaded_by: number | null;
  uploaded_by_email: string | null;
  metadata: Record<string, unknown>;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LegalReferencePayload = {
  ley: string;
  tipo_fuente: LegalSourceType;
  estatus_vigencia?: LegalVigencyStatus;
  es_vigente?: boolean;
  fecha_vigencia_desde?: string;
  fecha_vigencia_hasta?: string;
  fecha_ultima_revision?: string;
  autoridad_emisora?: string;
  articulo?: string;
  fraccion?: string;
  parrafo?: string;
  contenido: string;
  resumen?: string;
  fuente_documento?: string;
  fuente_url?: string;
  vigencia?: string;
  sat_categoria?: string;
};

export type LegalSourcesQuery = {
  search?: string;
  ley?: string;
  ordenamiento?: string;
  tipo_fuente?: LegalSourceType;
  estatus_vigencia?: LegalVigencyStatus;
  es_vigente?: boolean;
  autoridad_emisora?: LegalAuthority;
  corpus_upload?: number;
  solo_vigentes?: boolean;
  page?: number;
  page_size?: number;
  ordering?: string;
};

export type LegalCorpusUploadPayload = {
  titulo: string;
  autoridad: LegalAuthority;
  ordenamiento: string;
  tipo_fuente: LegalSourceType;
  archivo: File;
  estatus_vigencia?: LegalVigencyStatus;
  es_vigente?: boolean;
  force_vigencia?: boolean;
  fecha_vigencia_desde?: string;
  fecha_vigencia_hasta?: string;
  fecha_ultima_revision?: string;
  vigencia?: string;
  fuente_documento?: string;
  fuente_url?: string;
  sat_categoria?: string;
  procesar_ahora?: boolean;
};

export type LegalSourcesResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: LegalReferenceSource[];
};

const buildQueryString = (params: Record<string, string | number | boolean | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : "";
};

export function fetchLegalSources(params: LegalSourcesQuery = {}): Promise<LegalSourcesResponse> {
  const query = buildQueryString(params);
  return apiFetch<LegalSourcesResponse>(`/api/materialidad/fuentes-legales/${query}`);
}

export function createLegalSource(payload: LegalReferencePayload): Promise<LegalReferenceSource> {
  return apiFetch<LegalReferenceSource>("/api/materialidad/fuentes-legales/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function fetchAvailableLaws(): Promise<string[]> {
  const response = await apiFetch<{ results: string[] }>("/api/materialidad/fuentes-legales/leyes/");
  return response?.results ?? [];
}

export function uploadLegalCorpus(payload: LegalCorpusUploadPayload): Promise<LegalCorpusUpload> {
  const formData = new FormData();
  formData.set("titulo", payload.titulo);
  formData.set("autoridad", payload.autoridad);
  formData.set("ordenamiento", payload.ordenamiento);
  formData.set("tipo_fuente", payload.tipo_fuente);
  formData.set("archivo", payload.archivo);
  if (payload.estatus_vigencia) formData.set("estatus_vigencia", payload.estatus_vigencia);
  if (payload.es_vigente !== undefined) formData.set("es_vigente", String(payload.es_vigente));
  if (payload.force_vigencia !== undefined) formData.set("force_vigencia", String(payload.force_vigencia));
  if (payload.fecha_vigencia_desde) formData.set("fecha_vigencia_desde", payload.fecha_vigencia_desde);
  if (payload.fecha_vigencia_hasta) formData.set("fecha_vigencia_hasta", payload.fecha_vigencia_hasta);
  if (payload.fecha_ultima_revision) formData.set("fecha_ultima_revision", payload.fecha_ultima_revision);
  if (payload.vigencia) formData.set("vigencia", payload.vigencia);
  if (payload.fuente_documento) formData.set("fuente_documento", payload.fuente_documento);
  if (payload.fuente_url) formData.set("fuente_url", payload.fuente_url);
  if (payload.sat_categoria) formData.set("sat_categoria", payload.sat_categoria);
  formData.set("procesar_ahora", String(payload.procesar_ahora ?? true));
  return apiFetch<LegalCorpusUpload>("/api/materialidad/corpus-legales/", {
    method: "POST",
    body: formData,
  });
}
