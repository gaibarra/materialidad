import { apiFetch } from "./api";

export type AuditLogEntry = {
  id: number;
  actor_id: number | null;
  actor_email: string;
  actor_name: string;
  action: string;
  object_type: string;
  object_id: string;
  object_repr: string;
  changes: Record<string, any>;
  source_ip: string | null;
  created_at: string;
};

export type AuditLogResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: AuditLogEntry[];
};

export type AuditLogFilters = {
  action?: string;
  object_type?: string;
  object_id?: string;
  actor_email?: string;
  search?: string;
  created_after?: string;
  created_before?: string;
  page?: number;
};

export async function fetchAuditLog(filters: AuditLogFilters = {}): Promise<AuditLogResponse> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.append(key, String(value));
    }
  });
  const qs = params.toString();
  const url = qs ? `/api/materialidad/audit-log/?${qs}` : "/api/materialidad/audit-log/";
  const payload = await apiFetch<AuditLogResponse>(url);
  return payload;
}
