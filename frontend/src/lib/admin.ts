import { apiFetch } from "./api";

export type AiProvider = "openai" | "perplexity" | "deepseek" | "google";

export const AI_PROVIDERS: Array<{ value: AiProvider; label: string; description: string }> = [
  {
    value: "openai",
    label: "OpenAI",
    description: "Modelos GPT-4o / GPT-4.1 optimizados para contratos y análisis legal",
  },
  {
    value: "perplexity",
    label: "Perplexity",
    description: "Modelos de búsqueda RAG para respuestas citadas y benchmarking",
  },
  {
    value: "deepseek",
    label: "DeepSeek",
    description: "Modelos de bajo costo enfocados en IA generativa de alto volumen",
  },
  {
    value: "google",
    label: "Google",
    description: "Gemini / Vertex AI para cumplimiento con stack Google Cloud",
  },
];

export type AdminUser = {
  id: number;
  email: string;
  full_name: string | null;
  tenant_slug: string | null;
  is_active: boolean;
  is_staff: boolean;
};

export type AdminUserPayload = {
  email: string;
  full_name?: string | null;
  is_active?: boolean;
  is_staff?: boolean;
  password?: string;
};

export type TenantAIConfigResponse = {
  provider: AiProvider;
  api_key_set: boolean;
  updated_at: string | null;
};

export type TenantAIConfigPayload = {
  provider: AiProvider;
  api_key?: string;
};

export type TenantLimitInfo = {
  active_tenants: number;
  limit: number | null;
  has_capacity: boolean;
};

export type TenantProvisionPayload = {
  name: string;
  slug: string;
  despacho?: number;
  db_name: string;
  db_user: string;
  db_password: string;
  db_host: string;
  db_port: number;
  default_currency?: string;
  create_database: boolean;
  admin_email: string;
  admin_password: string;
  admin_name?: string;
};

export type TenantProvisionResponse = {
  name: string;
  slug: string;
  despacho: number | null;
  db_name: string;
  db_user: string;
  db_host: string;
  db_port: number;
  default_currency: string;
  is_active: boolean;
};

export type Despacho = {
  id: number;
  nombre: string;
  tipo: string;
};

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export async function fetchUsers(): Promise<AdminUser[]> {
  const response = await apiFetch<AdminUser[] | PaginatedResponse<AdminUser>>(
    "/api/accounts/users/"
  );
  if (Array.isArray(response)) {
    return response;
  }
  if (response && Array.isArray(response.results)) {
    return response.results;
  }
  return [];
}

export function createUser(payload: AdminUserPayload): Promise<AdminUser> {
  return apiFetch<AdminUser>("/api/accounts/users/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function updateUser(userId: number, payload: AdminUserPayload): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/api/accounts/users/${userId}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function deleteUser(userId: number): Promise<null> {
  return apiFetch<null>(`/api/accounts/users/${userId}/`, {
    method: "DELETE",
  });
}

export function fetchTenantAIConfig(): Promise<TenantAIConfigResponse> {
  return apiFetch<TenantAIConfigResponse>("/api/accounts/ai-config/");
}

export function updateTenantAIConfig(
  payload: TenantAIConfigPayload
): Promise<TenantAIConfigResponse> {
  return apiFetch<TenantAIConfigResponse>("/api/accounts/ai-config/", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function fetchTenantLimits(): Promise<TenantLimitInfo> {
  return apiFetch<TenantLimitInfo>("/api/tenancy/provision/");
}

export function provisionTenant(
  payload: TenantProvisionPayload
): Promise<TenantProvisionResponse> {
  return apiFetch<TenantProvisionResponse>("/api/tenancy/provision/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function fetchDespachos(): Promise<Despacho[]> {
  return apiFetch<Despacho[]>("/api/tenancy/despachos/");
}
