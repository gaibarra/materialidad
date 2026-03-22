"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, AlertTriangle, Clock3, DatabaseZap, Hexagon, RefreshCw } from "lucide-react";

import { DataCardsSkeleton, InlineEmptyState } from "../../../../components/DataState";
import { DashboardShell } from "../../../../components/DashboardShell";
import { MobileDataList } from "../../../../components/MobileDataList";
import { useAuthContext } from "../../../../context/AuthContext";
import { alertError } from "../../../../lib/alerts";
import {
  fetchFDIJobRuns,
  type FDIJobRunCommand,
  type FDIJobRunHistoryResponse,
  type FDIJobRunRecord,
  type FDIJobRunStatus,
} from "../../../../lib/admin";
import { fetchEmpresas, type EmpresaLite } from "../../../../lib/providers";

type FiltersState = {
  days: number;
  limit: number;
  empresaId: string;
  command: "" | FDIJobRunCommand;
  status: "" | FDIJobRunStatus;
};

const RANGE_OPTIONS = [1, 7, 30, 90] as const;

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatDuration(durationMs: number) {
  if (durationMs < 1000) return `${durationMs} ms`;
  const seconds = durationMs / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = seconds / 60;
  return `${minutes.toFixed(1)} min`;
}

function commandLabel(command: FDIJobRunCommand) {
  if (command === "capture_fdi_snapshots") return "Captura snapshots";
  if (command === "backfill_fdi_formula_version") return "Backfill fórmula";
  return "Refresh proyecciones";
}

function statusBadge(status: FDIJobRunStatus) {
  if (status === "failure") return "border-red-200 bg-red-50 text-red-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export default function FDIRunsPage() {
  const router = useRouter();
  const { isAuthenticated, isProfileLoaded, user } = useAuthContext();

  const [empresas, setEmpresas] = useState<EmpresaLite[]>([]);
  const [filters, setFilters] = useState<FiltersState>({
    days: 7,
    limit: 25,
    empresaId: "",
    command: "",
    status: "",
  });
  const [appliedFilters, setAppliedFilters] = useState<FiltersState>({
    days: 7,
    limit: 25,
    empresaId: "",
    command: "",
    status: "",
  });
  const [response, setResponse] = useState<FDIJobRunHistoryResponse | null>(null);
  const [items, setItems] = useState<FDIJobRunRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!isProfileLoaded) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (user && !user.is_staff) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isProfileLoaded, user, router]);

  useEffect(() => {
    let cancelled = false;
    async function loadEmpresas() {
      try {
        const payload = await fetchEmpresas();
        if (!cancelled) setEmpresas(payload);
      } catch {
        if (!cancelled) setEmpresas([]);
      }
    }
    void loadEmpresas();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadRuns = useCallback(
    async ({ append, cursor }: { append: boolean; cursor?: string | null }) => {
      const current = append ? appliedFilters : appliedFilters;
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      try {
        const data = await fetchFDIJobRuns({
          days: current.days,
          limit: current.limit,
          empresa: current.empresaId || undefined,
          command: current.command || undefined,
          status: current.status || undefined,
          cursor: cursor || undefined,
        });
        setResponse(data);
        setItems((prev) => (append ? [...prev, ...data.items] : data.items));
      } catch (error) {
        void alertError("No pudimos cargar los runs FDI", (error as Error).message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [appliedFilters]
  );

  useEffect(() => {
    if (!isAuthenticated || !user?.is_staff) return;
    void loadRuns({ append: false });
  }, [isAuthenticated, user?.is_staff, loadRuns]);

  const selectedEmpresa = useMemo(
    () => empresas.find((empresa) => String(empresa.id) === appliedFilters.empresaId) ?? null,
    [empresas, appliedFilters.empresaId]
  );

  const derivedSummary = useMemo(() => {
    const failures = items.filter((item) => item.status === "failure").length;
    const latest = items[0] ?? null;
    const avgDurationMs = items.length
      ? Math.round(items.reduce((acc, item) => acc + item.duration_ms, 0) / items.length)
      : 0;
    return {
      total: items.length,
      failures,
      failureRate: items.length ? (failures / items.length) * 100 : 0,
      latest,
      avgDurationMs,
    };
  }, [items]);

  const applyFilters = () => {
    setItems([]);
    setResponse(null);
    setAppliedFilters(filters);
  };

  const applyQuickFilter = (partial: Partial<FiltersState>) => {
    setItems([]);
    setResponse(null);
    setFilters((prev) => {
      const next = { ...prev, ...partial };
      setAppliedFilters(next);
      return next;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!isProfileLoaded) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-32">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[rgba(184,137,70,0.22)] border-t-[var(--fiscal-accent)]" />
        </div>
      </DashboardShell>
    );
  }

  if (!isAuthenticated || !user?.is_staff) {
    return null;
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <header className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <section className="surface-panel-strong overflow-hidden rounded-[2rem] p-6 shadow-fiscal">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="eyebrow-shell">Operación FDI</p>
                <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-[var(--fiscal-ink)]">Historial administrativo de runs</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--fiscal-muted)]">
                  Sigue la ejecución real del pipeline: capturas de snapshots, refresh de proyecciones, backfills versionados, errores recientes, duración y trazabilidad por ventana y empresa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadRuns({ append: false })}
                disabled={loading}
                className="inline-flex min-h-[46px] items-center gap-2 rounded-full border border-[rgba(2,99,74,0.22)] bg-[rgba(2,99,74,0.08)] px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-[rgba(2,99,74,0.12)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                {loading ? "Actualizando..." : "Refrescar runs"}
              </button>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-4 text-white">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100/70">Runs cargados</p>
                  <Hexagon className="h-4 w-4 text-emerald-100/70" />
                </div>
                <p className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em]">{derivedSummary.total}</p>
                <p className="mt-2 text-xs text-emerald-100/70">Ventana de {appliedFilters.days} días{selectedEmpresa ? ` · ${selectedEmpresa.razon_social}` : ""}</p>
              </article>
              <article className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-4 text-white">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100/70">Fallas</p>
                  <AlertTriangle className="h-4 w-4 text-emerald-100/70" />
                </div>
                <p className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em]">{derivedSummary.failures}</p>
                <p className="mt-2 text-xs text-emerald-100/70">Tasa acumulada: {derivedSummary.failureRate.toFixed(1)}%</p>
              </article>
              <article className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-4 text-white">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100/70">Duración media</p>
                  <Clock3 className="h-4 w-4 text-emerald-100/70" />
                </div>
                <p className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em]">{formatDuration(derivedSummary.avgDurationMs)}</p>
                <p className="mt-2 text-xs text-emerald-100/70">Promedio sobre los runs recuperados</p>
              </article>
              <article className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-4 text-white">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100/70">Último run</p>
                  <Activity className="h-4 w-4 text-emerald-100/70" />
                </div>
                <p className="mt-3 text-lg font-semibold">{derivedSummary.latest ? commandLabel(derivedSummary.latest.command) : "Sin datos"}</p>
                <p className="mt-2 text-xs text-emerald-100/70">{derivedSummary.latest ? formatDateTime(derivedSummary.latest.started_at) : "Aún no hay ejecuciones en el rango"}</p>
              </article>
            </div>
          </section>

          <section className="surface-panel rounded-[2rem] p-6">
            <div className="flex items-center gap-2 text-[var(--fiscal-accent)]">
              <DatabaseZap className="h-4 w-4" />
              <p className="kicker-label">Filtros operativos</p>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--fiscal-muted)]">Empresa</label>
                <select
                  value={filters.empresaId}
                  onChange={(event) => setFilters((prev) => ({ ...prev, empresaId: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">Todas las empresas</option>
                  {empresas.map((empresa) => (
                    <option key={empresa.id} value={empresa.id}>{empresa.razon_social}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--fiscal-muted)]">Comando</label>
                  <select
                    value={filters.command}
                    onChange={(event) => setFilters((prev) => ({ ...prev, command: event.target.value as FiltersState["command"] }))}
                    className="mt-2 w-full rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white px-4 py-3 text-sm text-slate-900 shadow-sm"
                  >
                    <option value="">Todos</option>
                    <option value="capture_fdi_snapshots">Captura snapshots</option>
                    <option value="refresh_operation_defense_projections">Refresh proyecciones</option>
                    <option value="backfill_fdi_formula_version">Backfill fórmula</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--fiscal-muted)]">Estado</label>
                  <select
                    value={filters.status}
                    onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value as FiltersState["status"] }))}
                    className="mt-2 w-full rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white px-4 py-3 text-sm text-slate-900 shadow-sm"
                  >
                    <option value="">Todos</option>
                    <option value="success">Success</option>
                    <option value="failure">Failure</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--fiscal-muted)]">Ventana</label>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {RANGE_OPTIONS.map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setFilters((prev) => ({ ...prev, days }))}
                      className={days === filters.days
                        ? "rounded-2xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700"
                        : "rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:border-emerald-200 hover:text-emerald-700"
                      }
                    >
                      {days}d
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--fiscal-muted)]">Tamaño de página</label>
                <select
                  value={filters.limit}
                  onChange={(event) => setFilters((prev) => ({ ...prev, limit: Number(event.target.value) }))}
                  className="mt-2 w-full rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white px-4 py-3 text-sm text-slate-900 shadow-sm"
                >
                  <option value={25}>25 runs</option>
                  <option value={50}>50 runs</option>
                  <option value={100}>100 runs</option>
                </select>
              </div>
              <button type="button" onClick={applyFilters} disabled={loading} className="button-institutional w-full justify-center min-h-[46px]">
                {loading ? "Actualizando..." : "Aplicar lectura"}
              </button>
            </div>
          </section>
        </header>

        <section className="surface-panel rounded-[2rem] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="kicker-label">Runs recuperados</p>
              <p className="mt-2 text-sm text-[var(--fiscal-muted)]">
                Ordenados del más reciente al más antiguo. El botón Cargar más usa cursor estable para evitar páginas rotas por nuevos inserts.
              </p>
            </div>
            <div className="rounded-full border border-[rgba(25,36,52,0.08)] bg-[rgba(246,242,235,0.8)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--fiscal-muted)]">
              {response?.pagination.has_more ? "Hay más páginas" : "Fin del rango cargado"}
            </div>
          </div>

          {loading && items.length === 0 ? (
            <DataCardsSkeleton cards={3} />
          ) : (
            <MobileDataList
              items={items}
              getKey={(run) => run.id}
              className="mt-5"
              empty={
                !loading ? (
                  <InlineEmptyState
                    icon={<DatabaseZap className="h-6 w-6" />}
                    title="Sin runs en el rango solicitado"
                    description="Cambia la ventana, la empresa o el estado para recuperar ejecuciones administrativas en móvil."
                  />
                ) : null
              }
              renderItem={(run) => (
                <article className="rounded-[1.4rem] border border-[rgba(25,36,52,0.08)] bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Inicio</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--fiscal-ink)]">{formatDateTime(run.started_at)}</p>
                      <p className="mt-1 text-xs text-slate-500">Fin: {formatDateTime(run.finished_at)}</p>
                    </div>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusBadge(run.status)}`}>
                      {run.status}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <div className="rounded-2xl bg-[rgba(246,242,235,0.52)] px-3 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Comando</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--fiscal-ink)]">{commandLabel(run.command)}</p>
                      <p className="mt-1 text-xs text-slate-500">Ventana {run.days}d{run.refresh_projections ? " · con refresh" : ""}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-[rgba(25,36,52,0.08)] bg-white px-3 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Empresa</p>
                      <p className="mt-1 text-sm text-slate-700">{run.empresa_id ? `ID ${run.empresa_id}` : "Tenant completo"}</p>
                    </div>
                    <div className="rounded-2xl border border-[rgba(25,36,52,0.08)] bg-white px-3 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Duración</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{formatDuration(run.duration_ms)}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-[rgba(25,36,52,0.08)] bg-white px-3 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Impacto</p>
                    <p className="mt-1 text-sm text-slate-700">Proyecciones: {run.projections_synced}</p>
                    <p className="text-sm text-slate-500">Snapshots: {run.snapshots_created}{run.snapshot_id ? ` · snapshot #${run.snapshot_id}` : ""}</p>
                  </div>

                  <div className="mt-4 rounded-2xl border border-[rgba(25,36,52,0.08)] bg-white px-3 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Error</p>
                    <p className="mt-1 break-words text-xs text-slate-600">{run.error_message || "-"}</p>
                  </div>

                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => applyQuickFilter({ command: run.command })}
                      className="min-h-[40px] rounded-full border border-[rgba(25,36,52,0.12)] bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-[rgba(184,137,70,0.28)] hover:text-[var(--fiscal-ink)]"
                    >
                      Mismo comando
                    </button>
                    <button
                      type="button"
                      onClick={() => applyQuickFilter({ status: run.status })}
                      className="min-h-[40px] rounded-full border border-[rgba(25,36,52,0.12)] bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-[rgba(184,137,70,0.28)] hover:text-[var(--fiscal-ink)]"
                    >
                      Solo {run.status}
                    </button>
                    {run.empresa_id && (
                      <button
                        type="button"
                        onClick={() => applyQuickFilter({ empresaId: String(run.empresa_id) })}
                        className="min-h-[40px] rounded-full border border-[rgba(45,91,136,0.18)] bg-[rgba(45,91,136,0.08)] px-3 py-2 text-xs font-semibold text-[var(--fiscal-accent)] transition hover:bg-[rgba(45,91,136,0.12)]"
                      >
                        Ver empresa
                      </button>
                    )}
                  </div>
                </article>
              )}
            />
          )}

          <div className="mt-5 hidden overflow-x-auto lg:block">
            <table className="min-w-full divide-y divide-[rgba(25,36,52,0.08)] text-sm text-slate-700">
              <thead className="bg-[rgba(246,242,235,0.72)] text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3 text-left">Inicio</th>
                  <th className="px-3 py-3 text-left">Comando</th>
                  <th className="px-3 py-3 text-left">Estado</th>
                  <th className="px-3 py-3 text-left">Empresa</th>
                  <th className="px-3 py-3 text-left">Impacto</th>
                  <th className="px-3 py-3 text-left">Duración</th>
                  <th className="px-3 py-3 text-left">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(25,36,52,0.08)]">
                {!loading && items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-500">Sin runs en el rango y filtros solicitados.</td>
                  </tr>
                ) : (
                  items.map((run) => (
                    <tr key={run.id}>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                        <p>{formatDateTime(run.started_at)}</p>
                        <p className="text-xs text-slate-500">Fin: {formatDateTime(run.finished_at)}</p>
                      </td>
                      <td className="px-3 py-3 text-[var(--fiscal-ink)]">
                        <p className="font-semibold">{commandLabel(run.command)}</p>
                        <p className="text-xs text-slate-500">Ventana {run.days}d{run.refresh_projections ? " · con refresh" : ""}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusBadge(run.status)}`}>
                          {run.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        {run.empresa_id ? `ID ${run.empresa_id}` : "Tenant completo"}
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        <p>Proyecciones: {run.projections_synced}</p>
                        <p className="text-xs text-slate-500">Snapshots: {run.snapshots_created}{run.snapshot_id ? ` · snapshot #${run.snapshot_id}` : ""}</p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-700">{formatDuration(run.duration_ms)}</td>
                      <td className="max-w-sm px-3 py-3 text-xs text-slate-600">{run.error_message || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(25,36,52,0.08)] pt-4">
            <p className="text-xs text-slate-500">
              Recuperados {items.length} runs. Rango API: {response ? `${formatDateTime(response.range.from)} a ${formatDateTime(response.range.to)}` : "sin datos"}.
            </p>
            <button
              type="button"
              onClick={() => void loadRuns({ append: true, cursor: response?.pagination.next_cursor })}
              disabled={!response?.pagination.has_more || loadingMore}
              className="inline-flex min-h-[46px] items-center gap-2 rounded-full border border-[rgba(25,36,52,0.12)] bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[rgba(184,137,70,0.28)] hover:text-[var(--fiscal-ink)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loadingMore ? "animate-spin" : ""}`} />
              {loadingMore ? "Cargando..." : response?.pagination.has_more ? "Cargar más" : "Sin más páginas"}
            </button>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}