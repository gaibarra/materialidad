"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { DashboardShell } from "../../../components/DashboardShell";
import { alertError, alertSuccess } from "../../../lib/alerts";
import { apiFetch } from "../../../lib/api";
import {
  actualizarAprobacionRazon,
  crearAprobacionRazon,
  fetchAprobacionesRazon,
  RazonNegocioAprobacion,
} from "../../../lib/contracts";

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type ContratoLite = {
  id: number;
  nombre: string;
  empresa: number;
  proveedor: number | null;
  proveedor_nombre: string | null;
  razon_negocio?: string;
  beneficio_economico_esperado?: string | null;
};

const ROLES: Array<{ value: RazonNegocioAprobacion["rol"]; label: string }> = [
  { value: "SOLICITANTE", label: "Solicitante" },
  { value: "RESPONSABLE_AREA", label: "Responsable del área" },
  { value: "COMPLIANCE", label: "Compliance / Legal" },
  { value: "FISCAL", label: "Fiscal" },
  { value: "DIRECTOR", label: "Dirección" },
];

const ESTADOS: Array<{ value: RazonNegocioAprobacion["estado"]; label: string }> = [
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "APROBADO", label: "Aprobado" },
  { value: "RECHAZADO", label: "Rechazado" },
];

const estadoColor: Record<RazonNegocioAprobacion["estado"], string> = {
  PENDIENTE: "bg-amber-100 text-amber-700",
  APROBADO: "bg-emerald-100 text-emerald-700",
  RECHAZADO: "bg-flame-100 text-flame-700",
};

export default function RazonNegocioPage() {
  const [contratos, setContratos] = useState<ContratoLite[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [aprobaciones, setAprobaciones] = useState<RazonNegocioAprobacion[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string>("");
  const [form, setForm] = useState<{
    rol: RazonNegocioAprobacion["rol"];
    estado: RazonNegocioAprobacion["estado"];
    comentario: string;
    evidencia_url: string;
    firmado_por: string;
    firmado_email: string;
  }>({
    rol: "RESPONSABLE_AREA",
    estado: "PENDIENTE",
    comentario: "",
    evidencia_url: "",
    firmado_por: "",
    firmado_email: "",
  });

  const selectedContrato = useMemo(
    () => contratos.find((c) => c.id === selectedId) ?? null,
    [contratos, selectedId]
  );

  const nextRol = useMemo(() => {
    const orden = ROLES.map((r) => r.value);
    if (aprobaciones.some((a) => a.estado === "RECHAZADO")) {
      return null;
    }
    for (const rol of orden) {
      const aprobado = aprobaciones.find((a) => a.rol === rol && a.estado === "APROBADO");
      if (!aprobado) return rol;
    }
    return null;
  }, [aprobaciones]);

  const flujoCerrado = useMemo(() => {
    if (aprobaciones.some((a) => a.estado === "RECHAZADO")) return true;
    return aprobaciones.length > 0 && nextRol === null;
  }, [aprobaciones, nextRol]);

  useEffect(() => {
    if (nextRol) {
      setForm((prev) => ({ ...prev, rol: nextRol }));
    }
  }, [nextRol]);

  const loadContratos = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await apiFetch<PaginatedResponse<ContratoLite> | ContratoLite[]>(
        "/api/materialidad/contratos/?ordering=-created_at"
      );
      const list = Array.isArray(payload) ? payload : payload.results ?? [];
      setContratos(list);
      const first = list[0]?.id ?? null;
      setSelectedId(first);
      if (first) {
        await loadAprobaciones(first);
      }
    } catch (err) {
      void alertError("No pudimos cargar contratos", (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContratos();
  }, [loadContratos]);

  const loadAprobaciones = async (contratoId: number) => {
    try {
      const data = await fetchAprobacionesRazon(contratoId);
      setAprobaciones(data);
    } catch (err) {
      void alertError("No pudimos cargar aprobaciones", (err as Error).message);
    }
  };

  const handleSelectContrato = async (id: number) => {
    setSelectedId(id);
    await loadAprobaciones(id);
  };

  const extractErrorMessage = (err: unknown): string => {
    if (err instanceof Error) {
      const raw = err.message;
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === "string") return parsed;
        if (parsed?.detail) return String(parsed.detail);
        if (parsed && typeof parsed === "object") {
          const values = Object.values(parsed).flat().map(String);
          if (values.length) return values.join(" ");
        }
      } catch {
        /* ignore json parse */
      }
      return raw;
    }
    return "Error desconocido";
  };

  const handleSave = async () => {
    if (!selectedId) {
      await alertError("Falta contrato", "Elige un contrato para registrar la aprobación");
      return;
    }
    if (form.estado !== "PENDIENTE") {
      if (!form.firmado_por.trim() || !form.firmado_email.trim()) {
        await alertError("Datos de aprobador", "Captura nombre y correo de quien aprueba/rechaza");
        return;
      }
    }
    setSaving(true);
    setFormError("");
    try {
      await crearAprobacionRazon({
        contrato: selectedId,
        rol: form.rol,
        estado: form.estado,
        comentario: form.comentario,
        evidencia_url: form.evidencia_url,
        firmado_por: form.firmado_por,
        firmado_email: form.firmado_email,
      });
      await alertSuccess("Guardado", "Aprobación registrada");
      await loadAprobaciones(selectedId);
      setForm((prev) => ({ ...prev, estado: "PENDIENTE", comentario: "", evidencia_url: "", firmado_por: "", firmado_email: "" }));
    } catch (err) {
      const message = extractErrorMessage(err);
      setFormError(message);
      await alertError("No pudimos guardar", message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6 text-white">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/40 to-emerald-900/30 p-6 shadow-2xl shadow-emerald-500/20">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Razón de negocio</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Aprobaciones Art. 5-A</h1>
          <p className="mt-2 text-sm text-slate-200">
            Define la necesidad, monto esperado y registra quién autoriza cada contrato antes de ejecutar.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20 lg:col-span-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Contratos</p>
                <h2 className="text-lg font-semibold text-white">Selecciona un contrato</h2>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-100">{contratos.length}</span>
            </div>
            <div className="mt-4 space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {loading && <p className="text-sm text-slate-300">Cargando...</p>}
              {!loading && contratos.length === 0 && (
                <p className="text-sm text-slate-300">Aún no hay contratos.</p>
              )}
              {!loading &&
                contratos.map((c) => {
                  const isActive = c.id === selectedId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        void handleSelectContrato(c.id);
                      }}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        isActive
                          ? "border-emerald-300/60 bg-emerald-500/10 text-white"
                          : "border-white/10 bg-white/5 text-slate-200 hover:border-emerald-300/40"
                      }`}
                    >
                      <p className="text-sm font-semibold">{c.nombre}</p>
                      <p className="text-xs text-slate-300">{c.proveedor_nombre || "Sin proveedor"}</p>
                      {c.beneficio_economico_esperado && (
                        <p className="text-[11px] text-emerald-200">
                          Beneficio esperado: ${c.beneficio_economico_esperado}
                        </p>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Registro</p>
                  <h3 className="text-lg font-semibold text-white">Nueva aprobación</h3>
                  <p className="text-sm text-slate-300">
                    Captura quién aprueba/rechaza y adjunta evidencia de la decisión.
                  </p>
                </div>
                {selectedContrato && (
                  <div className="text-right text-xs text-slate-300">
                    <p className="font-semibold text-white">{selectedContrato.nombre}</p>
                    <p>{selectedContrato.proveedor_nombre || "Sin proveedor"}</p>
                  </div>
                )}
              </div>
              {flujoCerrado && (
                <div className="mt-3 rounded-xl border border-emerald-300/40 bg-emerald-900/30 px-4 py-3 text-sm text-emerald-100">
                  El flujo de aprobaciones ya concluyó (aprobado o rechazado). No puedes capturar más pasos.
                </div>
              )}
              {!flujoCerrado && nextRol && (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-slate-100">
                  Próximo rol esperado: <span className="font-semibold text-white">{ROLES.find((r) => r.value === nextRol)?.label}</span>
                </div>
              )}
              {formError && (
                <div className="mt-3 rounded-xl border border-flame-300/60 bg-flame-900/40 px-4 py-3 text-sm text-flame-50">
                  {formError}
                </div>
              )}
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-200">Rol</label>
                    <select
                      value={form.rol}
                      onChange={(e) => setForm((prev) => ({ ...prev, rol: e.target.value as RazonNegocioAprobacion["rol"] }))}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-300 focus:outline-none"
                      disabled={flujoCerrado}
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value} disabled={Boolean(nextRol && r.value !== nextRol)}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-200">Estado</label>
                    <select
                      value={form.estado}
                      onChange={(e) => setForm((prev) => ({ ...prev, estado: e.target.value as RazonNegocioAprobacion["estado"] }))}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-300 focus:outline-none"
                      disabled={flujoCerrado}
                    >
                      {ESTADOS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-200">Evidencia (URL)</label>
                    <input
                      value={form.evidencia_url}
                      onChange={(e) => setForm((prev) => ({ ...prev, evidencia_url: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-300 focus:outline-none"
                      placeholder="Carpeta de aprobaciones, correo o acta"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-200">Nombre aprobador</label>
                      <input
                        value={form.firmado_por}
                        onChange={(e) => setForm((prev) => ({ ...prev, firmado_por: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-300 focus:outline-none"
                        placeholder="Quien autoriza"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-200">Correo</label>
                      <input
                        type="email"
                        value={form.firmado_email}
                        onChange={(e) => setForm((prev) => ({ ...prev, firmado_email: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-300 focus:outline-none"
                        placeholder="correo@empresa.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-200">Comentarios</label>
                    <textarea
                      value={form.comentario}
                      onChange={(e) => setForm((prev) => ({ ...prev, comentario: e.target.value }))}
                      rows={3}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-300 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    void handleSave();
                  }}
                  disabled={saving || !selectedId || flujoCerrado}
                  className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"
                >
                  {saving ? "Guardando..." : "Guardar aprobación"}
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Historial</p>
                  <h3 className="text-lg font-semibold text-white">Aprobaciones registradas</h3>
                  <p className="text-sm text-slate-300">Queda constancia con rol, nombre y evidencia.</p>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-100">{aprobaciones.length}</span>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-sm text-slate-100">
                  <thead className="text-xs uppercase tracking-wide text-slate-300">
                    <tr>
                      <th className="px-3 py-2 text-left">Rol</th>
                      <th className="px-3 py-2 text-left">Estado</th>
                      <th className="px-3 py-2 text-left">Aprobador</th>
                      <th className="px-3 py-2 text-left">Evidencia</th>
                      <th className="px-3 py-2 text-left">Comentario</th>
                      <th className="px-3 py-2 text-left">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {aprobaciones.length === 0 && (
                      <tr>
                        <td className="px-3 py-4 text-center text-slate-300" colSpan={6}>
                          No hay aprobaciones registradas.
                        </td>
                      </tr>
                    )}
                    {aprobaciones.map((ap) => (
                      <tr key={ap.id}>
                        <td className="px-3 py-3 text-slate-100">{ap.rol}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${estadoColor[ap.estado]}`}>
                            {ap.estado}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-semibold text-white">{ap.firmado_por || "-"}</p>
                          <p className="text-xs text-slate-300">{ap.firmado_email || ""}</p>
                        </td>
                        <td className="px-3 py-3">
                          {ap.evidencia_url ? (
                            <a
                              href={ap.evidencia_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-emerald-200 hover:text-emerald-100"
                            >
                              Evidencia
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400">N/A</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-slate-100">{ap.comentario || "-"}</td>
                        <td className="px-3 py-3 text-slate-200">{ap.decidido_en || ap.created_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
