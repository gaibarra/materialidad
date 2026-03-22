import { apiFetch, apiFetchRaw } from "./api";

export type PersistedAuditMaterialityDossier = {
  id: number;
  empresa: number;
  empresa_nombre: string;
  ejercicio: number;
  payload: Record<string, unknown>;
  last_edited_by_email: string;
  last_edited_by_name: string;
  created_at: string;
  updated_at: string;
};

export type AuditMaterialityDossierVersion = {
  id: number;
  dossier: number;
  version_number: number;
  payload: Record<string, unknown>;
  source: "MANUAL" | "AUTOSAVE" | "RESTORE";
  edited_by_email: string;
  edited_by_name: string;
  created_at: string;
};

export type AuditMaterialityDossierPayload = {
  empresa: number;
  ejercicio: number;
  payload: Record<string, unknown>;
};

export async function fetchAuditMaterialityDossier(empresaId: number, ejercicio: string | number) {
  const payload = await apiFetch<{ results?: PersistedAuditMaterialityDossier[] } | PersistedAuditMaterialityDossier[]>(
    `/api/materialidad/materialidad-auditoria/?empresa=${empresaId}&ejercicio=${ejercicio}`
  );
  const records = Array.isArray(payload) ? payload : payload?.results ?? [];
  return records[0] ?? null;
}

export async function upsertAuditMaterialityDossier(data: AuditMaterialityDossierPayload) {
  return apiFetch<PersistedAuditMaterialityDossier>("/api/materialidad/materialidad-auditoria/upsert/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function fetchAuditMaterialityVersions(dossierId: number) {
  return apiFetch<AuditMaterialityDossierVersion[]>(`/api/materialidad/materialidad-auditoria/${dossierId}/versiones/`);
}

export async function restoreAuditMaterialityVersion(dossierId: number, versionId: number) {
  return apiFetch<PersistedAuditMaterialityDossier>(`/api/materialidad/materialidad-auditoria/${dossierId}/restaurar-version/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version_id: versionId }),
  });
}

async function downloadAuditMaterialityFile(id: number, path: "exportar-pdf" | "exportar-docx", fallbackFilename: string) {
  const response = await apiFetchRaw(`/api/materialidad/materialidad-auditoria/${id}/${path}/`);
  const disposition = response.headers.get("Content-Disposition");
  let filename = fallbackFilename;
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

export async function exportAuditMaterialityPdf(id: number) {
  return downloadAuditMaterialityFile(id, "exportar-pdf", `materialidad-auditoria-${id}.pdf`);
}

export async function exportAuditMaterialityDocx(id: number) {
  return downloadAuditMaterialityFile(id, "exportar-docx", `materialidad-auditoria-${id}.docx`);
}
