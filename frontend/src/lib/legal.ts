import { apiFetch } from "./api";

export type LegalSourceType = "LEY" | "REGLAMENTO" | "NOM" | "CRITERIO_SAT" | "RESOLUCION";

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
  tipo_fuente: LegalSourceType;
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
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type LegalReferencePayload = {
  ley: string;
  tipo_fuente: LegalSourceType;
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
  tipo_fuente?: LegalSourceType;
  page?: number;
  page_size?: number;
  ordering?: string;
};

export type LegalSourcesResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: LegalReferenceSource[];
};

const buildQueryString = (params: Record<string, string | number | undefined>) => {
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
