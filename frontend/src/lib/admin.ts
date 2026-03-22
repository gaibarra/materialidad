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

export type TenantMonitoringRange = "24h" | "7d" | "30d";

export type TenantActivityRow = {
  tenant_id: number;
  tenant_slug: string;
  tenant_name: string;
  despacho: string | null;
  is_active: boolean;
  last_activity_at: string | null;
  last_login_at: string | null;
  last_legal_consultation_at: string | null;
  last_audit_event_at: string | null;
  users_total: number;
  users_active_now: number;
  users_active_1h: number;
  users_active_24h: number;
  events_24h: number;
  events_window: number;
  legal_consultations_24h: number;
  legal_consultations_window: number;
  error_events_window: number;
  error_rate: number;
  activity_bucket: "now" | "recent" | "today" | "week" | "idle" | "stale";
  health_status: "ok" | "warning" | "critical" | "idle";
  health_reason: string;
};

export type TenantActivitySummary = {
  tenants_total: number;
  tenants_enabled: number;
  tenants_disabled: number;
  tenants_active_now: number;
  tenants_active_1h: number;
  tenants_active_24h: number;
  tenants_active_window: number;
  tenants_idle_7d: number;
  tenants_warning: number;
  tenants_critical: number;
  users_total: number;
  users_active_now: number;
  users_active_24h: number;
  events_24h: number;
  events_window: number;
  legal_consultations_24h: number;
  legal_consultations_window: number;
  error_events_window: number;
};

export type TenantActivityWindows = {
  live_minutes: number;
  recent_minutes: number;
  idle_days: number;
};

export type TenantActivityResponse = {
  range: TenantMonitoringRange;
  generated_at: string;
  summary: TenantActivitySummary;
  activity_windows: TenantActivityWindows;
  tenants: TenantActivityRow[];
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

export type FDIJobRunCommand =
  | "capture_fdi_snapshots"
  | "refresh_operation_defense_projections"
  | "backfill_fdi_formula_version";

export type FDIJobRunStatus = "success" | "failure";

export type FDIJobRunRecord = {
  id: number;
  command: FDIJobRunCommand;
  status: FDIJobRunStatus;
  empresa_id: number | null;
  days: number;
  refresh_projections: boolean;
  projections_synced: number;
  snapshots_created: number;
  snapshot_id: number | null;
  duration_ms: number;
  error_message: string;
  started_at: string;
  finished_at: string;
};

export type FDIJobRunHistoryResponse = {
  range: {
    from: string;
    to: string;
    days: number;
    limit: number;
  };
  items: FDIJobRunRecord[];
  pagination: {
    has_more: boolean;
    next_cursor: string | null;
  };
  summary: {
    total: number;
    failures: number;
    failure_rate: number;
    latest_status: FDIJobRunStatus | null;
    latest_command: FDIJobRunCommand | null;
  };
};

export type FDIJobRunHistoryFilters = {
  days?: number;
  limit?: number;
  empresa?: number | string;
  command?: FDIJobRunCommand;
  status?: FDIJobRunStatus;
  cursor?: string;
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

export function fetchTenantActivityMonitoring(
  range: TenantMonitoringRange = "7d"
): Promise<TenantActivityResponse> {
  return apiFetch<TenantActivityResponse>(`/api/tenancy/superadmin/tenant-activity/?range=${range}`);
}

export function fetchFDIJobRuns(filters: FDIJobRunHistoryFilters = {}): Promise<FDIJobRunHistoryResponse> {
  const params = new URLSearchParams();
  if (filters.days) params.set("days", String(filters.days));
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.empresa !== undefined && filters.empresa !== null && filters.empresa !== "") {
    params.set("empresa", String(filters.empresa));
  }
  if (filters.command) params.set("command", filters.command);
  if (filters.status) params.set("status", filters.status);
  if (filters.cursor) params.set("cursor", filters.cursor);
  const query = params.toString();
  return apiFetch<FDIJobRunHistoryResponse>(`/api/materialidad/dashboard/fdi/job-runs/${query ? `?${query}` : ""}`);
}
