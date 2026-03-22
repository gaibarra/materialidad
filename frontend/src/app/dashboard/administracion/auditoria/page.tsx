"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileSearch } from "lucide-react";

import { DataCardsSkeleton, InlineEmptyState } from "../../../../components/DataState";
import { DashboardShell } from "../../../../components/DashboardShell";
import { MobileDataList } from "../../../../components/MobileDataList";
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
  const [liveFeedback, setLiveFeedback] = useState<{ tone: "success" | "error" | "info"; message: string } | null>(null);
  const pageSize = 50;

  const totalPages = useMemo(() => Math.max(1, Math.ceil(count / pageSize)), [count, pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAuditLog({ ...applied, page });
      setLogs(data.results || []);
      setCount(data.count || 0);
      setLiveFeedback({
        tone: "info",
        message: data.count
          ? `Página ${page} cargada: ${data.results?.length || 0} de ${data.count} eventos.`
          : "Sin eventos con los filtros actuales.",
      });
    } catch (err) {
      setLiveFeedback({ tone: "error", message: `No se pudo cargar la bitácora: ${(err as Error).message}` });
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
    setLiveFeedback({ tone: "info", message: "Aplicando filtros." });
  };

  const applyQuickFilters = (partial: Partial<AuditLogFilters>) => {
    setPage(1);
    setFilters((prev) => {
      const next = { ...prev, ...partial };
      setApplied(next);
      return next;
    });
    setLiveFeedback({ tone: "info", message: "Filtro rápido aplicado." });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow-shell">Auditoría</p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-[var(--fiscal-ink)]">Bitácora de acciones</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Rastrea quién crea, modifica o firma evidencias y contratos dentro del expediente.</p>
          </div>
          <div className="rounded-2xl border border-[rgba(25,36,52,0.08)] bg-white/82 px-4 py-2 text-xs text-slate-600 shadow-[0_12px_30px_rgba(15,23,42,0.07)]">
            {count} eventos
          </div>
        </header>

        {liveFeedback && (
          <div
            role={liveFeedback.tone === "error" ? "alert" : "status"}
            aria-live={liveFeedback.tone === "error" ? "assertive" : "polite"}
            className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
              liveFeedback.tone === "error"
                ? "border-[rgba(160,67,61,0.22)] bg-[var(--fiscal-danger-soft)] text-[var(--fiscal-danger)]"
                : liveFeedback.tone === "success"
                  ? "border-[rgba(31,122,90,0.18)] bg-[var(--fiscal-success-soft)] text-[var(--fiscal-success)]"
                  : "border-[rgba(45,91,136,0.18)] bg-[var(--fiscal-accent-soft)] text-[var(--fiscal-accent)]"
            }`}
          >
            {liveFeedback.message}
          </div>
        )}

        <section className="surface-panel space-y-4 rounded-[30px] border-[rgba(25,36,52,0.08)] p-5" aria-busy={loading}>
          <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.3em] text-slate-500">Acción</label>
              <select
                className="w-full rounded-xl border border-[rgba(25,36,52,0.12)] bg-white px-3 py-2 text-sm text-slate-900"
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
              <label className="text-xs uppercase tracking-[0.3em] text-slate-500">Objeto</label>
              <input
                className="w-full rounded-xl border border-[rgba(25,36,52,0.12)] bg-white px-3 py-2 text-sm text-slate-900"
                placeholder="materialidad.contrato"
                value={filters.object_type || ""}
                onChange={(e) => setFilters((p) => ({ ...p, object_type: e.target.value || undefined }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.3em] text-slate-500">ID del objeto</label>
              <input
                className="w-full rounded-xl border border-[rgba(25,36,52,0.12)] bg-white px-3 py-2 text-sm text-slate-900"
                placeholder="123"
                value={filters.object_id || ""}
                onChange={(e) => setFilters((p) => ({ ...p, object_id: e.target.value || undefined }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.3em] text-slate-500">Actor email</label>
              <input
                className="w-full rounded-xl border border-[rgba(25,36,52,0.12)] bg-white px-3 py-2 text-sm text-slate-900"
                placeholder="correo@dominio.com"
                value={filters.actor_email || ""}
                onChange={(e) => setFilters((p) => ({ ...p, actor_email: e.target.value || undefined }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.3em] text-slate-500">Desde</label>
              <input
                type="date"
                className="w-full rounded-xl border border-[rgba(25,36,52,0.12)] bg-white px-3 py-2 text-sm text-slate-900"
                value={filters.created_after || ""}
                onChange={(e) => setFilters((p) => ({ ...p, created_after: e.target.value || undefined }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.3em] text-slate-500">Hasta</label>
              <input
                type="date"
                className="w-full rounded-xl border border-[rgba(25,36,52,0.12)] bg-white px-3 py-2 text-sm text-slate-900"
                value={filters.created_before || ""}
                onChange={(e) => setFilters((p) => ({ ...p, created_before: e.target.value || undefined }))}
              />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              className="w-full rounded-xl border border-[rgba(25,36,52,0.12)] bg-white px-3 py-2 text-sm text-slate-900 sm:flex-1"
              placeholder="Buscar actor, acción u objeto"
              value={filters.search || ""}
              onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value || undefined }))}
            />
            <button onClick={applyFilters} className="button-institutional w-full justify-center sm:w-auto" disabled={loading} aria-disabled={loading} aria-busy={loading}>
              {loading ? "Cargando..." : "Aplicar"}
            </button>
          </div>
        </section>

        <section className="surface-panel rounded-[30px] border-[rgba(25,36,52,0.08)] p-5" aria-busy={loading}>
          <div className="flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <p>Resultados</p>
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <button
                className="min-h-[44px] rounded-full border border-[rgba(25,36,52,0.12)] px-3 py-1 text-xs text-slate-700 hover:border-[rgba(184,137,70,0.28)] disabled:opacity-50"
                onClick={() => {
                  setLiveFeedback({ tone: "info", message: `Cargando página ${Math.max(1, page - 1)}.` });
                  setPage((p) => Math.max(1, p - 1));
                }}
                disabled={page <= 1 || loading}
              >
                ← Anterior
              </button>
              <span className="text-xs text-slate-500">Página {page} / {totalPages}</span>
              <button
                className="min-h-[44px] rounded-full border border-[rgba(25,36,52,0.12)] px-3 py-1 text-xs text-slate-700 hover:border-[rgba(184,137,70,0.28)] disabled:opacity-50"
                onClick={() => {
                  setLiveFeedback({ tone: "info", message: `Cargando página ${page + 1}.` });
                  setPage((p) => p + 1);
                }}
                disabled={loading || page >= totalPages}
              >
                Siguiente →
              </button>
            </div>
          </div>

          {loading && logs.length === 0 ? (
            <DataCardsSkeleton cards={3} />
          ) : (
            <MobileDataList
              items={logs}
              getKey={(log) => log.id}
              className="mt-4"
              empty={
                !loading ? (
                  <InlineEmptyState
                    icon={<FileSearch className="h-6 w-6" />}
                    title="Sin eventos en la bitácora"
                    description="Prueba con otro rango o afloja los filtros para volver a encontrar movimientos auditables."
                  />
                ) : null
              }
              renderItem={(log) => {
                const changesPreview = (() => {
                  const json = JSON.stringify(log.changes || {});
                  if (!json || json === "{}") return "-";
                  return json.length > 180 ? `${json.slice(0, 180)}…` : json;
                })();

                return (
                  <article className="rounded-[1.4rem] border border-[rgba(25,36,52,0.08)] bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Fecha</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{formatDate(log.created_at)}</p>
                      </div>
                      <span className="rounded-full border border-[rgba(25,36,52,0.12)] bg-[rgba(246,242,235,0.72)] px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                        {log.action}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-[rgba(246,242,235,0.52)] px-3 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Objeto</p>
                        <p className="mt-1 text-sm text-[var(--fiscal-ink)]">{log.object_type}</p>
                        <p className="mt-1 text-xs text-slate-500">ID: {log.object_id}</p>
                        {log.object_repr && <p className="mt-1 text-xs text-slate-500 break-words">{log.object_repr}</p>}
                      </div>
                      <div className="rounded-2xl bg-[rgba(246,242,235,0.52)] px-3 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Actor</p>
                        <p className="mt-1 text-sm text-[var(--fiscal-ink)]">{log.actor_name || log.actor_email || "(anon)"}</p>
                        {log.actor_email && <p className="mt-1 text-xs text-slate-500 break-all">{log.actor_email}</p>}
                        {log.actor_id && <p className="mt-1 text-xs text-slate-500">User ID: {log.actor_id}</p>}
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-[rgba(25,36,52,0.08)] bg-white px-3 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Cambios</p>
                      <p className="mt-1 break-all text-xs text-slate-600">{changesPreview}</p>
                    </div>

                    <div className="mt-4 rounded-2xl border border-[rgba(25,36,52,0.08)] bg-white px-3 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">IP origen</p>
                      <p className="mt-1 text-xs text-slate-600">{log.source_ip || "-"}</p>
                    </div>

                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => applyQuickFilters({ action: log.action })}
                        className="min-h-[40px] rounded-full border border-[rgba(25,36,52,0.12)] bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-[rgba(184,137,70,0.28)] hover:text-[var(--fiscal-ink)]"
                      >
                        Filtrar acción
                      </button>
                      <button
                        type="button"
                        onClick={() => applyQuickFilters({ object_type: log.object_type })}
                        className="min-h-[40px] rounded-full border border-[rgba(25,36,52,0.12)] bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-[rgba(184,137,70,0.28)] hover:text-[var(--fiscal-ink)]"
                      >
                        Filtrar objeto
                      </button>
                      {(log.actor_email || log.actor_name) && (
                        <button
                          type="button"
                          onClick={() => applyQuickFilters({ actor_email: log.actor_email || undefined, search: log.actor_name || log.actor_email || undefined })}
                          className="min-h-[40px] rounded-full border border-[rgba(45,91,136,0.18)] bg-[rgba(45,91,136,0.08)] px-3 py-2 text-xs font-semibold text-[var(--fiscal-accent)] transition hover:bg-[rgba(45,91,136,0.12)]"
                        >
                          Ver actor
                        </button>
                      )}
                    </div>
                  </article>
                );
              }}
            />
          )}

          <div className="mt-4 hidden overflow-x-auto lg:block">
            <table className="min-w-full divide-y divide-[rgba(25,36,52,0.08)] text-sm text-slate-700">
              <thead className="bg-[rgba(246,242,235,0.72)] text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Acción</th>
                  <th className="px-3 py-2 text-left">Objeto</th>
                  <th className="px-3 py-2 text-left">Actor</th>
                  <th className="px-3 py-2 text-left">Cambios</th>
                  <th className="px-3 py-2 text-left">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(25,36,52,0.08)]">
                {!loading && logs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-slate-500">Sin eventos</td>
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
                      <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatDate(log.created_at)}</td>
                      <td className="px-3 py-2 text-[var(--fiscal-ink)]">{log.action}</td>
                      <td className="px-3 py-2 text-[var(--fiscal-ink)]">
                        <p>{log.object_type}</p>
                        <p className="text-xs text-slate-500">ID: {log.object_id}</p>
                        {log.object_repr && <p className="text-xs text-slate-500">{log.object_repr}</p>}
                      </td>
                      <td className="px-3 py-2 text-[var(--fiscal-ink)]">
                        <p>{log.actor_name || log.actor_email || "(anon)"}</p>
                        {log.actor_email && <p className="text-xs text-slate-500">{log.actor_email}</p>}
                        {log.actor_id && <p className="text-xs text-slate-500">User ID: {log.actor_id}</p>}
                      </td>
                      <td className="max-w-xs break-all px-3 py-2 text-xs text-slate-600">{changesPreview}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{log.source_ip || "-"}</td>
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
