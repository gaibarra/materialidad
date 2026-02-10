import { apiFetch, apiFetchRaw } from "./api";

export type SatCriterion = {
  nombre: string;
  referencia: string;
  descripcion?: string | null;
  estatus?: string | null;
  riesgo?: string | null;
  fuente_url?: string | null;
  vigencia?: string | null;
  notas?: string | null;
};

export type LegalCitation = {
  referencia: string;
  tipo_fuente: string;
  ley: string;
  articulo: string;
  fraccion?: string | null;
  parrafo?: string | null;
  resumen?: string | null;
  extracto?: string | null;
  dimension_cumplimiento?: string | null;
  riesgo?: string | null;
  fuente_documento?: string | null;
  fuente_url?: string | null;
  vigencia?: string | null;
  ultima_actualizacion?: string | null;
  notas?: string | null;
  criterios_sat: SatCriterion[];
};

export type CitationCacheMetadata = {
  documento_hash: string;
  cache_hit: boolean;
  cache_updated_at?: string | null;
  cache_sources_version?: string | null;
  cache_id?: number | null;
  cache_contrato_id?: number | null;
  regenerations?: number;
};

export type ContractGenerationPayload = {
  contrato?: number | null;
  empresa: number;
  template?: number | null;
  razon_negocio?: string;
  beneficio_economico_esperado?: number;
  beneficio_fiscal_estimado?: number;
  fecha_cierta_requerida?: boolean;
  resumen_necesidades?: string;
  clausulas_especiales?: string[];
  idioma?: "es" | "en";
  tono?: "formal" | "neutral";
};

export type ContractGenerationResponse = {
  documento_markdown: string;
  idioma: "es" | "en";
  tono: "formal" | "neutral";
  modelo: string;
  citas_legales: LegalCitation[];
  citas_legales_metadata?: CitationCacheMetadata | null;
  contrato_id?: number;
  documento_id?: number;
};

export type ContractDocument = {
  id: number;
  contrato: number;
  kind: string;
  source: string;
  idioma: string;
  tono: string;
  modelo: string;
  archivo?: string | null;
  archivo_nombre?: string | null;
  markdown_text?: string;
  extracted_text?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type ContractDocxExportPayload = {
  documento_markdown: string;
  nombre_archivo?: string;
  idioma?: "es" | "en";
};

export type ContractDocxExportResult = {
  blob: Blob;
  filename: string;
  citas_legales: LegalCitation[];
  citas_legales_metadata?: CitationCacheMetadata | null;
};

export type ClauseSuggestion = {
  slug: string;
  titulo: string;
  categorias_contrato: string[];
  procesos: string[];
  nivel_riesgo: string;
  resumen: string;
  texto: string;
  tips_redline: string[];
  palabras_clave: string[];
  relevancia: number;
};

export type ClauseSuggestionFilters = {
  categoria?: string;
  proceso?: string;
  idioma?: "es" | "en";
  query?: string;
  resumen_necesidades?: string;
  template?: number | null;
  limit?: number;
};

export type DiffSegment = {
  type: "equal" | "replace" | "delete" | "insert";
  original: string[];
  revisado: string[];
};

export type RedlineRisk = {
  titulo: string;
  impacto: string;
  detalle?: string;
  accion?: string;
};

export type RedlineOpportunity = {
  titulo: string;
  descripcion: string;
};

export type RedlineAnalysisPayload = {
  texto_original: string;
  texto_revisado: string;
  idioma?: "es" | "en";
};

export type RedlineAnalysis = {
  diff: DiffSegment[];
  change_ratio: number;
  alerta_global: string;
  resumen: string;
  riesgos: RedlineRisk[];
  oportunidades: RedlineOpportunity[];
  modelo: string;
};

export type RazonNegocioAprobacion = {
  id: number;
  contrato: number;
  rol: "SOLICITANTE" | "RESPONSABLE_AREA" | "COMPLIANCE" | "FISCAL" | "DIRECTOR";
  estado: "PENDIENTE" | "APROBADO" | "RECHAZADO";
  comentario: string;
  evidencia_url: string;
  firmado_por: string;
  firmado_email: string;
  decidido_en: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export async function fetchAprobacionesRazon(contratoId: number): Promise<RazonNegocioAprobacion[]> {
  const payload = await apiFetch<any>(`/api/materialidad/razon-negocio-aprobaciones/?contrato=${contratoId}`);
  return payload?.results ?? payload ?? [];
}

export async function crearAprobacionRazon(
  data: Partial<RazonNegocioAprobacion> & { contrato: number; rol: RazonNegocioAprobacion["rol"] }
): Promise<RazonNegocioAprobacion> {
  return apiFetch<RazonNegocioAprobacion>("/api/materialidad/razon-negocio-aprobaciones/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function actualizarAprobacionRazon(
  id: number,
  data: Partial<RazonNegocioAprobacion>
): Promise<RazonNegocioAprobacion> {
  return apiFetch<RazonNegocioAprobacion>(`/api/materialidad/razon-negocio-aprobaciones/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function generateContract(
  payload: ContractGenerationPayload
): Promise<ContractGenerationResponse> {
  return apiFetch<ContractGenerationResponse>("/api/materialidad/contratos/generar/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function exportContractDocx(
  payload: ContractDocxExportPayload
): Promise<ContractDocxExportResult> {
  const response = await apiFetchRaw("/api/materialidad/contratos/exportar-docx/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const contentDisposition = response.headers.get("Content-Disposition") ?? "";
  let filename = "contrato.docx";
  const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
  if (match?.[1]) {
    filename = match[1];
  }

  const citationsHeader = response.headers.get("X-Contrato-Citas");
  let citas_legales: LegalCitation[] = [];
  if (citationsHeader) {
    try {
      const parsed = JSON.parse(citationsHeader) as LegalCitation[];
      if (Array.isArray(parsed)) {
        citas_legales = parsed;
      }
    } catch (error) {
      console.warn("No pudimos leer las citas legales del encabezado", error);
    }
  }

  const metadataHeader = response.headers.get("X-Contrato-Citas-Metadata");
  let citas_legales_metadata: CitationCacheMetadata | null = null;
  if (metadataHeader) {
    try {
      const parsed = JSON.parse(metadataHeader) as CitationCacheMetadata;
      if (parsed && typeof parsed === "object") {
        citas_legales_metadata = parsed;
      }
    } catch (error) {
      console.warn("No pudimos leer la metadata de caché", error);
    }
  }

  const blob = await response.blob();
  return { blob, filename, citas_legales, citas_legales_metadata };
}

export async function uploadContractDocument(
  contratoId: number,
  formData: FormData
): Promise<ContractDocument> {
  const response = await apiFetchRaw(`/api/materialidad/contratos/${contratoId}/documentos/`, {
    method: "POST",
    body: formData,
  });
  return (await response.json()) as ContractDocument;
}

export async function correctContractDocument(
  contratoId: number,
  documentoId: number,
  idioma: "es" | "en" = "es"
): Promise<ContractGenerationResponse> {
  return apiFetch<ContractGenerationResponse>(
    `/api/materialidad/contratos/${contratoId}/documentos/${documentoId}/corregir/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idioma }),
    }
  );
}

export async function fetchClauseSuggestions(
  filters: ClauseSuggestionFilters = {}
): Promise<ClauseSuggestion[]> {
  const params = new URLSearchParams();
  if (filters.categoria) params.set("categoria", filters.categoria);
  if (filters.proceso) params.set("proceso", filters.proceso);
  if (filters.idioma) params.set("idioma", filters.idioma);
  if (filters.query) params.set("query", filters.query);
  if (filters.resumen_necesidades) {
    params.set("resumen_necesidades", filters.resumen_necesidades);
  }
  if (typeof filters.limit === "number") params.set("limit", String(filters.limit));
  if (typeof filters.template === "number") {
    params.set("template", String(filters.template));
  }
  const queryString = params.toString();
  const url = `/api/materialidad/contratos/clausulas-sugeridas/${queryString ? `?${queryString}` : ""}`;
  return apiFetch<ClauseSuggestion[]>(url);
}

export function analyzeRedlines(
  payload: RedlineAnalysisPayload
): Promise<RedlineAnalysis> {
  return apiFetch<RedlineAnalysis>("/api/materialidad/contratos/redlines/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/* ───── Clause Optimizer ───── */

export type ClauseOptimizePayload = {
  texto_clausula: string;
  contexto_contrato?: string;
  idioma?: "es" | "en";
  objetivo?:
    | "mejorar_fiscal"
    | "simplificar"
    | "reforzar_materialidad"
    | "ampliar_proteccion"
    | "adaptar_idioma";
};

export type ClauseOptimizeResponse = {
  texto_mejorado: string;
  justificacion: string;
  cambios_principales: string[];
  referencias_legales: string[];
  modelo: string;
};

export function optimizeClause(
  payload: ClauseOptimizePayload
): Promise<ClauseOptimizeResponse> {
  return apiFetch<ClauseOptimizeResponse>(
    "/api/materialidad/contratos/optimizar-clausula/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
}

/* ───── Promover Plantilla (seed contract) ───── */

export type PromoverPlantillaPayload = {
  nombre: string;
  clave?: string;
  descripcion?: string;
  categoria?: string;
  proceso?: string;
  tipo_empresa?: string;
};

export type PromoverPlantillaResponse = {
  template_id: number;
  nombre: string;
  clave: string;
  markdown_base_length: number;
  mensaje: string;
};

export function promoverPlantilla(
  contratoId: number,
  payload: PromoverPlantillaPayload
): Promise<PromoverPlantillaResponse> {
  return apiFetch<PromoverPlantillaResponse>(
    `/api/materialidad/contratos/${contratoId}/promover-plantilla/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
}
