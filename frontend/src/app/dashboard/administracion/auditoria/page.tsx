"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardShell } from "../../../../components/DashboardShell";
import { alertError } from "../../../../lib/alerts";
import { AuditLogEntry, AuditLogFilters, fetchAuditLog } from "../../../../lib/auditoria";

const ACTIONS = [
  "contrato_creado",
  "contrato_actualizado",
  "entregable_creado",
  "entregable_actualizado",
];

function formatDate(dt: string) {
  return new Date(dt).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [applied, setApplied] = useState<AuditLogFilters>({});
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const pageSize = 50; // DRF default page size unless changed; used for quick math

  const totalPages = useMemo(() => Math.max(1, Math.ceil(count / pageSize)), [count, pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAuditLog({ ...applied, page });
      setLogs(data.results || []);
      setCount(data.count || 0);
    } catch (err) {
      void alertError("No pudimos cargar la bitácora", (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [applied, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyFilters = () => {
    setPage(1);
    setApplied({ ...filters });
  };

  return (
    <DashboardShell>
      <div className="space-y-6 text-white">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Auditoría</p>
            <h1 className="text-xl sm:text-2xl font-semibold text-white">Bitácora de acciones</h1>
            <p className="text-sm text-slate-300">Quién crea, modifica o firma evidencias/contratos.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-200">
            {count} eventos
          </div>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20 space-y-4">
          <div className="grid gap-3 md:grid-cols-6 text-sm">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.3em] text-emerald-300">Acción</label>
              <select
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                value={filters.action || ""}
                onChange={(e) => setFilters((p) => ({ ...p, action: e.target.value || undefined }))}
              >
                <option value="">Todas</option>
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.3em] text-emerald-300">Objeto</label>
              <input
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                placeholder="materialidad.contrato"
                value={filters.object_type || ""}
                onChange={(e) => setFilters((p) => ({ ...p, object_type: e.target.value || undefined }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.3em] text-emerald-300">ID del objeto</label>
              <input
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                placeholder="123"
                value={filters.object_id || ""}
                onChange={(e) => setFilters((p) => ({ ...p, object_id: e.target.value || undefined }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.3em] text-emerald-300">Actor email</label>
              <input
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                placeholder="correo@dominio.com"
                value={filters.actor_email || ""}
                onChange={(e) => setFilters((p) => ({ ...p, actor_email: e.target.value || undefined }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.3em] text-emerald-300">Desde</label>
              <input
                type="date"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                value={filters.created_after || ""}
                onChange={(e) => setFilters((p) => ({ ...p, created_after: e.target.value || undefined }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.3em] text-emerald-300">Hasta</label>
              <input
                type="date"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                value={filters.created_before || ""}
                onChange={(e) => setFilters((p) => ({ ...p, created_before: e.target.value || undefined }))}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              className="flex-1 min-w-[220px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              placeholder="Buscar actor, acción u objeto"
              value={filters.search || ""}
              onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value || undefined }))}
            />
            <button
              onClick={applyFilters}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
              disabled={loading}
            >
              {loading ? "Cargando..." : "Aplicar"}
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20">
          <div className="flex items-center justify-between text-sm text-slate-200">
            <p>Resultados</p>
            <div className="flex items-center gap-2">
              <button
                className="min-h-[44px] rounded-full border border-white/10 px-3 py-1 text-xs text-white hover:border-emerald-300 disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
              >
                ← Anterior
              </button>
              <span className="text-xs text-slate-300">Página {page} / {totalPages}</span>
              <button
                className="min-h-[44px] rounded-full border border-white/10 px-3 py-1 text-xs text-white hover:border-emerald-300 disabled:opacity-50"
                onClick={() => setPage((p) => p + 1)}
                disabled={loading || page >= totalPages}
              >
                Siguiente →
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm text-slate-100">
              <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-300">
                <tr>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Acción</th>
                  <th className="px-3 py-2 text-left">Objeto</th>
                  <th className="px-3 py-2 text-left">Actor</th>
                  <th className="px-3 py-2 text-left">Cambios</th>
                  <th className="px-3 py-2 text-left">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {!loading && logs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-slate-300">Sin eventos</td>
                  </tr>
                )}
                {logs.map((log) => {
                  const changesPreview = (() => {
                    const json = JSON.stringify(log.changes || {});
                    if (!json || json === "{}") return "-";
                    return json.length > 120 ? `${json.slice(0, 120)}…` : json;
                  })();
                  return (
                    <tr key={log.id}>
                      <td className="px-3 py-2 text-slate-200 whitespace-nowrap">{formatDate(log.created_at)}</td>
                      <td className="px-3 py-2 text-slate-100">{log.action}</td>
                      <td className="px-3 py-2 text-slate-100">
                        <p>{log.object_type}</p>
                        <p className="text-xs text-slate-400">ID: {log.object_id}</p>
                        {log.object_repr && <p className="text-xs text-slate-400">{log.object_repr}</p>}
                      </td>
                      <td className="px-3 py-2 text-slate-100">
                        <p>{log.actor_name || log.actor_email || "(anon)"}</p>
                        {log.actor_email && <p className="text-xs text-slate-400">{log.actor_email}</p>}
                        {log.actor_id && <p className="text-xs text-slate-400">User ID: {log.actor_id}</p>}
                      </td>
                      <td className="px-3 py-2 text-slate-100 max-w-xs break-all text-xs">{changesPreview}</td>
                      <td className="px-3 py-2 text-slate-200 text-xs">{log.source_ip || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
