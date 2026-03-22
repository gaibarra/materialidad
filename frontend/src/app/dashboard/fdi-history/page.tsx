"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarRange, Filter, Hexagon, RefreshCcw } from "lucide-react";

import { DataCardsSkeleton, InlineEmptyState } from "../../../components/DataState";
import { DashboardShell } from "../../../components/DashboardShell";
import { MobileDataList } from "../../../components/MobileDataList";
import { MetricCard } from "../../../components/MetricCard";
import { apiFetch } from "../../../lib/api";
import { fetchEmpresas, type EmpresaLite } from "../../../lib/providers";

type FDILevel = "NO_DATA" | "ROBUSTO" | "CONTROLADO" | "DEBIL" | "CRITICO";

type FDIHistoryResponse = {
  range: {
    from: string;
    to: string;
    days: number;
    limit: number;
  };
  series: Array<{
    captured_at: string;
    score: number;
    level: FDILevel;
    breakdown: {
      DM?: number;
      SE?: number;
      SC?: number;
      EC?: number;
      DO?: number;
    };
  }>;
  summary: {
    points: number;
    current_score: number;
    trend_delta: number;
  };
};

type FDIResponse = {
  generated_at: string;
  period: {
    days: number;
    from: string;
    to: string;
    empresa_id: number | null;
  };
  score: number;
  level: FDILevel;
  breakdown: {
    DM: number;
    SE: number;
    SC: number;
    EC: number;
    DO: number;
  };
  actions: Array<{ priority: string; title: string; description: string }>;
  inputs: {
    total_operaciones: number;
    operaciones_validadas: number;
    alertas_criticas: number;
    pct_proveedores_riesgo_alto?: number;
  };
};

type FiltersState = {
  days: number;
  empresaId: string;
};

const RANGE_OPTIONS = [30, 90, 180, 365];

const LEVEL_STYLES: Record<FDILevel, { label: string; pill: string; stroke: string; fill: string }> = {
  NO_DATA: {
    label: "Sin datos",
    pill: "border-slate-200 bg-slate-50 text-slate-700",
    stroke: "#64748b",
    fill: "rgba(100,116,139,0.16)",
  },
  ROBUSTO: {
    label: "Robusto",
    pill: "border-emerald-200 bg-emerald-50 text-emerald-700",
    stroke: "#059669",
    fill: "rgba(5,150,105,0.16)",
  },
  CONTROLADO: {
    label: "Controlado",
    pill: "border-sky-200 bg-sky-50 text-sky-700",
    stroke: "#0284c7",
    fill: "rgba(2,132,199,0.16)",
  },
  DEBIL: {
    label: "Débil",
    pill: "border-amber-200 bg-amber-50 text-amber-700",
    stroke: "#d97706",
    fill: "rgba(217,119,6,0.16)",
  },
  CRITICO: {
    label: "Crítico",
    pill: "border-rose-200 bg-rose-50 text-rose-700",
    stroke: "#e11d48",
    fill: "rgba(225,29,72,0.16)",
  },
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-MX", { dateStyle: "medium" });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

function buildPath(series: FDIHistoryResponse["series"], width: number, height: number) {
  if (!series.length) return { line: "", area: "", points: [] as Array<{ x: number; y: number; item: FDIHistoryResponse["series"][number] }> };

  const maxX = Math.max(series.length - 1, 1);
  const points = series.map((item, index) => {
    const x = (index / maxX) * width;
    const y = height - (Math.max(0, Math.min(100, item.score)) / 100) * height;
    return { x, y, item };
  });

  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const area = `${line} L ${width},${height} L 0,${height} Z`;
  return { line, area, points };
}

export default function FDIHistoryPage() {
  const [empresas, setEmpresas] = useState<EmpresaLite[]>([]);
  const [history, setHistory] = useState<FDIHistoryResponse | null>(null);
  const [snapshot, setSnapshot] = useState<FDIResponse | null>(null);
  const [filters, setFilters] = useState<FiltersState>({ days: 180, empresaId: "" });
  const [appliedFilters, setAppliedFilters] = useState<FiltersState>({ days: 180, empresaId: "" });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (nextFilters: FiltersState, forceRecalculate = false) => {
    const params = new URLSearchParams({
      days: String(nextFilters.days),
      limit: String(Math.min(nextFilters.days, 365)),
    });

    const fdiParams = new URLSearchParams({
      period_days: String(nextFilters.days),
    });

    if (nextFilters.empresaId) {
      params.set("empresa_id", nextFilters.empresaId);
      fdiParams.set("empresa_id", nextFilters.empresaId);
    }

    if (forceRecalculate) {
      fdiParams.set("recalculate", "true");
    }

    setError(null);
    if (forceRecalculate) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [historyResponse, fdiResponse] = await Promise.all([
        apiFetch<FDIHistoryResponse>(`/api/materialidad/dashboard/fdi/history/?${params.toString()}`),
        apiFetch<FDIResponse>(`/api/materialidad/dashboard/fdi/?${fdiParams.toString()}`),
      ]);
      setHistory(historyResponse);
      setSnapshot(fdiResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el historial FDI.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const empresasData = await fetchEmpresas();
        if (!cancelled) {
          setEmpresas(empresasData);
        }
      } catch {
        if (!cancelled) {
          setEmpresas([]);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void loadData(appliedFilters);
  }, [appliedFilters, loadData]);

  const currentLevel = snapshot ? LEVEL_STYLES[snapshot.level] : LEVEL_STYLES.NO_DATA;

  const chartModel = useMemo(() => buildPath(history?.series ?? [], 760, 240), [history]);
  const historySeries = history?.series ?? [];

  const chartTone = useMemo(() => {
    const lastLevel = history?.series?.[history.series.length - 1]?.level ?? snapshot?.level ?? "NO_DATA";
    return LEVEL_STYLES[lastLevel];
  }, [history, snapshot]);

  const latestPoint = history?.series?.[history.series.length - 1] ?? null;
  const previousPoint = history && history.series.length > 1 ? history.series[history.series.length - 2] : null;
  const deltaFromPrevious = latestPoint && previousPoint ? latestPoint.score - previousPoint.score : 0;
  const selectedEmpresa = empresas.find((empresa) => String(empresa.id) === appliedFilters.empresaId) ?? null;

  const breakdownCards = useMemo(() => {
    if (!snapshot) return [];
    return [
      { key: "DM", label: "Documentación material", score: snapshot.breakdown.DM, accent: "bg-emerald-500" },
      { key: "SE", label: "Sustancia económica", score: snapshot.breakdown.SE, accent: "bg-sky-500" },
      { key: "SC", label: "Soporte contractual", score: snapshot.breakdown.SC, accent: "bg-indigo-500" },
      { key: "EC", label: "Exposición crítica", score: snapshot.breakdown.EC, accent: "bg-rose-500" },
      { key: "DO", label: "Disciplina operativa", score: snapshot.breakdown.DO, accent: "bg-amber-500" },
    ];
  }, [snapshot]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <header className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className="surface-panel-strong overflow-hidden rounded-[2rem] p-6 shadow-fiscal">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="eyebrow-shell">Historial FDI</p>
                <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-[var(--fiscal-ink)]">Evolución del índice FDI</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--fiscal-muted)]">
                  Consulta la trayectoria del Fiscal Defense Index por ventana temporal y empresa, identifica quiebres recientes y baja a los componentes que explican la presión del periodo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadData(appliedFilters, true)}
                disabled={refreshing}
                className="inline-flex min-h-[46px] items-center gap-2 rounded-full border border-[rgba(2,99,74,0.22)] bg-[rgba(2,99,74,0.08)] px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-[rgba(2,99,74,0.12)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Recalculando..." : "Recalcular ahora"}
              </button>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <div className="rounded-[1.6rem] border border-[rgba(3,84,63,0.42)] bg-[linear-gradient(145deg,rgba(2,99,74,1),rgba(4,120,87,0.96)_48%,rgba(6,78,59,1))] p-5 text-white">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-100/75">Lectura vigente</p>
                    <div className="mt-3 flex items-end gap-3">
                      <span className="font-display text-6xl font-semibold tracking-[-0.05em]">{snapshot?.score.toFixed(1) ?? "0.0"}</span>
                      <span className="mb-2 text-sm font-medium text-emerald-100/75">/100</span>
                    </div>
                  </div>
                  <div className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${currentLevel.pill}`}>
                    {currentLevel.label}
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <div className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100/60">Ventana</p>
                    <p className="mt-1 text-lg font-semibold">{appliedFilters.days} días</p>
                  </div>
                  <div className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100/60">Puntos</p>
                    <p className="mt-1 text-lg font-semibold">{history?.summary.points ?? 0}</p>
                  </div>
                  <div className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100/60">Tendencia</p>
                    <p className="mt-1 text-lg font-semibold">
                      {(history?.summary.trend_delta ?? 0) >= 0 ? "+" : ""}
                      {(history?.summary.trend_delta ?? 0).toFixed(1)}
                    </p>
                  </div>
                  <div className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100/60">Último corte</p>
                    <p className="mt-1 text-sm font-semibold">{latestPoint ? formatDate(latestPoint.captured_at) : "Sin historial"}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.6rem] border border-[rgba(200,192,177,0.72)] bg-white/88 p-5">
                <div className="flex items-center gap-2 text-[var(--fiscal-accent)]">
                  <Filter className="h-4 w-4" />
                  <p className="kicker-label">Filtros</p>
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
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--fiscal-muted)]">Ventana</label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
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
                  <button
                    type="button"
                    onClick={() => setAppliedFilters(filters)}
                    disabled={loading}
                    className="button-institutional w-full justify-center"
                  >
                    <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    {loading ? "Actualizando..." : "Aplicar lectura"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <MetricCard
              title="Score actual"
              value={snapshot ? `${snapshot.score.toFixed(1)}/100` : "-"}
              helper={selectedEmpresa ? selectedEmpresa.razon_social : "Lectura consolidada para todas las empresas"}
              tone={snapshot && snapshot.score >= 80 ? "positive" : snapshot && snapshot.score >= 60 ? "info" : snapshot && snapshot.score >= 40 ? "warning" : "alert"}
            />
            <MetricCard
              title="Cambio vs punto previo"
              value={`${deltaFromPrevious >= 0 ? "+" : ""}${deltaFromPrevious.toFixed(1)}`}
              helper={previousPoint ? `Comparado contra ${formatDate(previousPoint.captured_at)}` : "Aún no hay un punto previo comparable"}
              tone={deltaFromPrevious >= 0 ? "positive" : "warning"}
              trend={deltaFromPrevious >= 0 ? "Mejora" : "Deterioro"}
            />
            <MetricCard
              title="Universo observado"
              value={snapshot ? String(snapshot.inputs.total_operaciones) : "0"}
              helper={snapshot ? `${snapshot.inputs.operaciones_validadas} validadas · ${snapshot.inputs.alertas_criticas} alertas críticas` : "Sin universo analizado"}
              tone="info"
            />
          </div>
        </header>

        {error && (
          <section className="rounded-[1.8rem] border border-rose-200 bg-rose-50 px-6 py-5 text-sm text-rose-700 shadow-sm">
            {error}
          </section>
        )}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
          <div className="surface-panel rounded-[2rem] p-6 shadow-fiscal">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow-shell">Serie histórica</p>
                <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-[var(--fiscal-ink)]">Curva de defendibilidad fiscal</h2>
              </div>
              {history?.range && (
                <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(25,36,52,0.08)] bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
                  <CalendarRange className="h-4 w-4 text-[var(--fiscal-accent)]" />
                  {formatDate(history.range.from)} a {formatDate(history.range.to)}
                </div>
              )}
            </div>

            <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-[rgba(25,36,52,0.08)] bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.98))] p-4">
              {loading ? (
                <div className="h-[280px] animate-pulse rounded-[1.2rem] bg-[rgba(15,23,42,0.06)]" />
              ) : historySeries.length > 0 ? (
                <div className="space-y-4">
                  <div className="relative h-[280px] w-full">
                    <div className="absolute inset-0 grid grid-rows-4">
                      {[25, 50, 75, 100].map((tick) => (
                        <div key={tick} className="relative border-b border-dashed border-[rgba(148,163,184,0.25)]">
                          <span className="absolute -top-2 left-0 rounded bg-white/80 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {tick}
                          </span>
                        </div>
                      ))}
                    </div>
                    <svg viewBox="0 0 760 240" className="absolute inset-0 h-full w-full">
                      <path d={chartModel.area} fill={chartTone.fill} />
                      <path d={chartModel.line} fill="none" stroke={chartTone.stroke} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                      {chartModel.points.map((point) => (
                        <circle
                          key={point.item.captured_at}
                          cx={point.x}
                          cy={point.y}
                          r="5"
                          fill="#ffffff"
                          stroke={LEVEL_STYLES[point.item.level].stroke}
                          strokeWidth="3"
                        />
                      ))}
                    </svg>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[1.2rem] border border-[rgba(25,36,52,0.08)] bg-white/82 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">Pico</p>
                      <p className="mt-2 font-display text-3xl font-semibold text-[var(--fiscal-ink)]">
                        {Math.max(...historySeries.map((point) => point.score)).toFixed(1)}
                      </p>
                    </div>
                    <div className="rounded-[1.2rem] border border-[rgba(25,36,52,0.08)] bg-white/82 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">Valle</p>
                      <p className="mt-2 font-display text-3xl font-semibold text-[var(--fiscal-ink)]">
                        {Math.min(...historySeries.map((point) => point.score)).toFixed(1)}
                      </p>
                    </div>
                    <div className="rounded-[1.2rem] border border-[rgba(25,36,52,0.08)] bg-white/82 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">Ritmo reciente</p>
                      <div className="mt-2 flex items-center gap-2">
                        {deltaFromPrevious >= 0 ? (
                          <ArrowUpRight className="h-5 w-5 text-emerald-600" />
                        ) : (
                          <ArrowDownRight className="h-5 w-5 text-rose-600" />
                        )}
                        <span className="font-display text-3xl font-semibold text-[var(--fiscal-ink)]">
                          {deltaFromPrevious >= 0 ? "+" : ""}{deltaFromPrevious.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <InlineEmptyState
                  icon={<CalendarRange className="h-6 w-6" />}
                  title="Todavía no hay suficientes snapshots para dibujar la serie"
                  description="Genera nuevos cortes desde la operación o con la captura programada para abrir la historia del índice FDI."
                  className="flex h-[280px] items-center justify-center"
                />
              )}
            </div>
          </div>

          <div className="surface-panel rounded-[2rem] p-6 shadow-fiscal">
            <div className="flex items-center gap-2 text-[var(--fiscal-accent)]">
              <Hexagon className="h-4 w-4" />
              <p className="kicker-label">Breakdown vigente</p>
            </div>
            <div className="mt-4 space-y-3">
              {breakdownCards.map((item) => (
                <div key={item.key} className="rounded-[1.3rem] border border-[rgba(25,36,52,0.08)] bg-white/82 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-accent)]">{item.key}</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--fiscal-ink)]">{item.label}</p>
                    </div>
                    <p className="font-display text-3xl font-semibold tracking-[-0.03em] text-[var(--fiscal-ink)]">{item.score.toFixed(1)}</p>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`${item.accent} h-full rounded-full`} style={{ width: `${Math.max(0, Math.min(100, item.score))}%` }} />
                  </div>
                </div>
              ))}
              {!breakdownCards.length && !loading && (
                <InlineEmptyState
                  icon={<Hexagon className="h-6 w-6" />}
                  title="No hay lectura vigente para desglosar componentes"
                  description="Necesitas una lectura FDI válida para mostrar el breakdown actual."
                />
              )}
            </div>
          </div>
        </section>

        <section className="surface-panel rounded-[2rem] p-6 shadow-fiscal">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow-shell">Snapshots</p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-[var(--fiscal-ink)]">Bitácora de cortes FDI</h2>
            </div>
            <p className="text-sm text-[var(--fiscal-muted)]">
              {selectedEmpresa ? `Empresa: ${selectedEmpresa.razon_social}` : "Vista consolidada del tenant"}
            </p>
          </div>

          <MobileDataList
            items={historySeries}
            getKey={(point) => point.captured_at}
            className="mt-5"
            empty={(
              !loading ? (
                <InlineEmptyState
                  icon={<CalendarRange className="h-6 w-6" />}
                  title="No hay snapshots disponibles para este filtro"
                  description="Cambia la ventana o la empresa para recuperar cortes históricos en la bitácora FDI."
                />
              ) : null
            )}
            renderItem={(point, index) => {
              const previous = historySeries[index - 1] ?? null;
              const delta = previous ? point.score - previous.score : null;
              const levelUi = LEVEL_STYLES[point.level] ?? LEVEL_STYLES.NO_DATA;

              return (
                <article className="rounded-[1.35rem] border border-[rgba(25,36,52,0.08)] bg-white/88 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">Corte</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--fiscal-ink)]">{formatDateTime(point.captured_at)}</p>
                    </div>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${levelUi.pill}`}>
                      {levelUi.label}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-[1rem] bg-[rgba(244,242,237,0.62)] px-3 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">Score</p>
                      <p className="mt-1 font-display text-2xl font-semibold text-[var(--fiscal-ink)]">{point.score.toFixed(1)}</p>
                    </div>
                    <div className="rounded-[1rem] bg-[rgba(244,242,237,0.62)] px-3 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">Delta</p>
                      <p className={`mt-1 text-lg font-semibold ${delta === null ? "text-slate-400" : delta >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        {delta === null ? "-" : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}`}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-5 gap-2">
                    {(["DM", "SE", "SC", "EC", "DO"] as const).map((key) => (
                      <div key={key} className="rounded-[1rem] border border-[rgba(25,36,52,0.08)] bg-[rgba(250,248,243,0.78)] px-2 py-2 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--fiscal-muted)]">{key}</p>
                        <p className="mt-1 text-sm font-semibold text-[var(--fiscal-ink)]">{(point.breakdown[key] ?? 0).toFixed(1)}</p>
                      </div>
                    ))}
                  </div>
                </article>
              );
            }}
          />

          <div className="mt-5 hidden overflow-x-auto rounded-[1.5rem] border border-[rgba(25,36,52,0.08)] bg-white/86 lg:block">
            <table className="min-w-full divide-y divide-[rgba(25,36,52,0.08)] text-sm text-slate-700">
              <thead className="bg-[rgba(246,242,235,0.72)] text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Corte</th>
                  <th className="px-4 py-3 text-left">Score</th>
                  <th className="px-4 py-3 text-left">Nivel</th>
                  <th className="px-4 py-3 text-left">Delta</th>
                  <th className="px-4 py-3 text-left">DM</th>
                  <th className="px-4 py-3 text-left">SE</th>
                  <th className="px-4 py-3 text-left">SC</th>
                  <th className="px-4 py-3 text-left">EC</th>
                  <th className="px-4 py-3 text-left">DO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(25,36,52,0.08)]">
                {loading && (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-sm text-[var(--fiscal-muted)]">Cargando snapshots...</td>
                  </tr>
                )}
                {!loading && historySeries.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-sm text-[var(--fiscal-muted)]">No hay snapshots disponibles para este filtro.</td>
                  </tr>
                )}
                {!loading && historySeries.map((point, index) => {
                  const previous = historySeries[index - 1] ?? null;
                  const delta = previous ? point.score - previous.score : null;
                  const levelUi = LEVEL_STYLES[point.level] ?? LEVEL_STYLES.NO_DATA;
                  return (
                    <tr key={point.captured_at} className="hover:bg-[rgba(244,242,237,0.45)]">
                      <td className="whitespace-nowrap px-4 py-3 text-[var(--fiscal-ink)]">{formatDateTime(point.captured_at)}</td>
                      <td className="px-4 py-3 font-semibold text-[var(--fiscal-ink)]">{point.score.toFixed(1)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${levelUi.pill}`}>
                          {levelUi.label}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-medium ${delta === null ? "text-slate-400" : delta >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        {delta === null ? "-" : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}`}
                      </td>
                      <td className="px-4 py-3">{(point.breakdown.DM ?? 0).toFixed(1)}</td>
                      <td className="px-4 py-3">{(point.breakdown.SE ?? 0).toFixed(1)}</td>
                      <td className="px-4 py-3">{(point.breakdown.SC ?? 0).toFixed(1)}</td>
                      <td className="px-4 py-3">{(point.breakdown.EC ?? 0).toFixed(1)}</td>
                      <td className="px-4 py-3">{(point.breakdown.DO ?? 0).toFixed(1)}</td>
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