"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Bell,
  Clock3,
  Eye,
  Radio,
  RefreshCw,
  ShieldAlert,
  Users,
} from "lucide-react";

import { DataCardsSkeleton, InlineEmptyState } from "../../../../components/DataState";
import { DashboardShell } from "../../../../components/DashboardShell";
import { MobileDataList } from "../../../../components/MobileDataList";
import { useAuthContext } from "../../../../context/AuthContext";
import { alertError } from "../../../../lib/alerts";
import {
  fetchTenantActivityMonitoring,
  type TenantActivityResponse,
  type TenantActivityRow,
  type TenantMonitoringRange,
} from "../../../../lib/admin";

const RANGE_OPTIONS: Array<{ value: TenantMonitoringRange; label: string }> = [
  { value: "24h", label: "Últimas 24h" },
  { value: "7d", label: "Últimos 7 días" },
  { value: "30d", label: "Últimos 30 días" },
];

const AUTO_REFRESH_MS = 60_000;

function formatDateTime(value: string | null) {
  if (!value) return "Sin actividad";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatRelativeTime(value: string | null) {
  if (!value) return "Sin actividad registrada";
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(Math.round(diffMs / 60_000), 0);
  if (diffMinutes < 1) return "Hace instantes";
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  const diffDays = Math.round(diffHours / 24);
  return `Hace ${diffDays} d`;
}

function statusClasses(status: TenantActivityRow["health_status"]) {
  if (status === "critical") return "bg-red-50 text-red-700 border-red-200";
  if (status === "warning") return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "ok") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function statusLabel(status: TenantActivityRow["health_status"]) {
  if (status === "critical") return "Crítico";
  if (status === "warning") return "Atención";
  if (status === "ok") return "Estable";
  return "Sin actividad";
}

function activityClasses(bucket: TenantActivityRow["activity_bucket"]) {
  if (bucket === "now") return "bg-blue-50 text-blue-700 border-blue-200";
  if (bucket === "recent") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (bucket === "today") return "bg-cyan-50 text-cyan-700 border-cyan-200";
  if (bucket === "week") return "bg-amber-50 text-amber-700 border-amber-200";
  if (bucket === "stale") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function activityLabel(bucket: TenantActivityRow["activity_bucket"], liveMinutes: number, recentMinutes: number, idleDays: number) {
  if (bucket === "now") return `Ahora (<${liveMinutes}m)`;
  if (bucket === "recent") return `Reciente (<${recentMinutes}m)`;
  if (bucket === "today") return "Actividad 24h";
  if (bucket === "week") return `Actividad <${idleDays}d`;
  if (bucket === "stale") return `Sin uso >${idleDays}d`;
  return "Sin actividad";
}

function toneClasses(tone: "blue" | "emerald" | "amber" | "red" | "slate") {
  if (tone === "blue") return "border-blue-200 bg-blue-50/80 text-blue-900";
  if (tone === "emerald") return "border-emerald-200 bg-emerald-50/80 text-emerald-900";
  if (tone === "amber") return "border-amber-200 bg-amber-50/80 text-amber-900";
  if (tone === "red") return "border-red-200 bg-red-50/80 text-red-900";
  return "border-slate-200 bg-white text-slate-900";
}

function KpiCard({
  title,
  value,
  helper,
  tone,
  icon,
}: {
  title: string;
  value: number | string;
  helper: string;
  tone: "blue" | "emerald" | "amber" | "red" | "slate";
  icon: ReactNode;
}) {
  return (
    <article className={`rounded-[26px] border p-4 shadow-sm ${toneClasses(tone)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.26em] opacity-70">{title}</p>
          <p className="mt-2 font-display text-3xl font-semibold leading-none">{value}</p>
        </div>
        <div className="rounded-2xl bg-white/70 p-3 shadow-sm">{icon}</div>
      </div>
      <p className="mt-3 text-xs leading-5 opacity-80">{helper}</p>
    </article>
  );
}

function PriorityPanel({
  title,
  helper,
  rows,
  tone,
  emptyLabel,
  activityWindows,
}: {
  title: string;
  helper: string;
  rows: TenantActivityRow[];
  tone: "blue" | "amber" | "red" | "slate";
  emptyLabel: string;
  activityWindows: TenantActivityResponse["activity_windows"];
}) {
  return (
    <section className={`rounded-[28px] border p-5 shadow-sm ${toneClasses(tone)}`}>
      <div>
        <p className="text-xs uppercase tracking-[0.26em] opacity-70">{title}</p>
        <p className="mt-2 text-sm leading-6 opacity-80">{helper}</p>
      </div>
      <div className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm opacity-75">{emptyLabel}</p>
        ) : (
          rows.map((row) => (
            <div key={row.tenant_id} className="rounded-2xl border border-white/60 bg-white/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{row.tenant_name}</p>
                  <p className="text-xs text-slate-500">{row.tenant_slug} · {row.despacho || "Sin despacho"}</p>
                </div>
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${activityClasses(row.activity_bucket)}`}>
                  {activityLabel(row.activity_bucket, activityWindows.live_minutes, activityWindows.recent_minutes, activityWindows.idle_days)}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-600">{row.health_reason}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default function MonitoreoTenantsPage() {
  const router = useRouter();
  const { isAuthenticated, isProfileLoaded, user } = useAuthContext();

  const [range, setRange] = useState<TenantMonitoringRange>("7d");
  const [query, setQuery] = useState("");
  const [payload, setPayload] = useState<TenantActivityResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isProfileLoaded) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (user && !user.is_superuser) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isProfileLoaded, user, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTenantActivityMonitoring(range);
      setPayload(data);
    } catch (error) {
      void alertError("No pudimos cargar el monitoreo", (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    if (!isAuthenticated || !user?.is_superuser) return;
    void load();
  }, [isAuthenticated, user?.is_superuser, load]);

  useEffect(() => {
    if (!isAuthenticated || !user?.is_superuser) return;
    const timer = window.setInterval(() => {
      void load();
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [isAuthenticated, user?.is_superuser, load]);

  const rows = useMemo(() => {
    const source = payload?.tenants || [];
    const q = query.trim().toLowerCase();
    if (!q) return source;
    return source.filter((item) => {
      const haystack = [item.tenant_name, item.tenant_slug, item.despacho || ""].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [payload?.tenants, query]);

  const generatedAt = useMemo(() => formatDateTime(payload?.generated_at || null), [payload?.generated_at]);
  const summary = payload?.summary;
  const activityWindows = payload?.activity_windows ?? { live_minutes: 5, recent_minutes: 60, idle_days: 7 };

  const priorityGroups = useMemo(() => {
    return {
      critical: rows.filter((row) => row.health_status === "critical").slice(0, 3),
      live: rows.filter((row) => row.activity_bucket === "now").slice(0, 3),
      stale: rows.filter((row) => row.activity_bucket === "idle" || row.activity_bucket === "stale").slice(0, 3),
    };
  }, [rows]);

  const focusTenant = (value: string) => {
    setQuery(value);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const copyTenantSlug = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(slug);
    } catch {
      /* noop: if clipboard fails the tenant is still visible in UI */
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        <header className="surface-panel-strong flex flex-col gap-4 rounded-[32px] p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow-shell">Superusuario</p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-[var(--fiscal-ink)]">Monitoreo de actividad por tenant</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Vista global de salud, actividad y atención operativa por cuenta ({generatedAt}).
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-slate-500">
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">
                Cuentas activas ahora = actividad registrada en los últimos {activityWindows.live_minutes} minutos
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">
                Actualización automática cada {AUTO_REFRESH_MS / 1000} segundos
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={range}
              onChange={(event) => setRange(event.target.value as TenantMonitoringRange)}
              className="rounded-xl border border-[rgba(25,36,52,0.12)] bg-white px-3 py-2 text-sm text-slate-900"
            >
              {RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void load()}
              className="button-institutional inline-flex items-center gap-2"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Actualizando..." : "Actualizar"}
            </button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
          <KpiCard title="Cuentas totales" value={summary?.tenants_total ?? 0} helper="Universo total registrado" tone="slate" icon={<Users className="h-5 w-5 text-slate-700" />} />
          <KpiCard title="Cuentas activas ahora" value={summary?.tenants_active_now ?? 0} helper={`Actividad en los últimos ${activityWindows.live_minutes} minutos`} tone="blue" icon={<Radio className="h-5 w-5 text-blue-700" />} />
          <KpiCard title="Activas 24h" value={summary?.tenants_active_24h ?? 0} helper="Con movimiento reciente en el día" tone="emerald" icon={<Activity className="h-5 w-5 text-emerald-700" />} />
          <KpiCard title="Sin uso 7d" value={summary?.tenants_idle_7d ?? 0} helper="Sin actividad útil reciente" tone="amber" icon={<Clock3 className="h-5 w-5 text-amber-700" />} />
          <KpiCard title="Deshabilitadas" value={summary?.tenants_disabled ?? 0} helper="Cuentas fuera de operación" tone="red" icon={<ShieldAlert className="h-5 w-5 text-red-700" />} />
          <KpiCard title="Bajo atención" value={(summary?.tenants_warning ?? 0) + (summary?.tenants_critical ?? 0)} helper="Warning + crítico" tone="amber" icon={<AlertTriangle className="h-5 w-5 text-amber-700" />} />
          <KpiCard title="Críticas" value={summary?.tenants_critical ?? 0} helper="Requieren seguimiento inmediato" tone="red" icon={<Bell className="h-5 w-5 text-red-700" />} />
          <KpiCard title="Usuarios 24h" value={summary?.users_active_24h ?? 0} helper={`Total usuarios activos / ${summary?.users_total ?? 0}`} tone="blue" icon={<Eye className="h-5 w-5 text-blue-700" />} />
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <PriorityPanel
            title="Requieren atención"
            helper="Cuentas con mayor prioridad operativa por errores, inactividad o deshabilitación."
            rows={priorityGroups.critical}
            tone="red"
            emptyLabel="No hay cuentas críticas en este momento."
            activityWindows={activityWindows}
          />
          <PriorityPanel
            title="Cuentas activas ahora"
            helper="Cuentas con actividad detectada en la ventana más reciente."
            rows={priorityGroups.live}
            tone="blue"
            emptyLabel="No hay actividad reciente en este momento."
            activityWindows={activityWindows}
          />
          <PriorityPanel
            title="Cuentas sin uso reciente"
            helper="Conviene revisar cuentas ociosas o con baja señal operativa antes de que se enfríen demasiado."
            rows={priorityGroups.stale}
            tone="amber"
            emptyLabel="No hay cuentas inactivas destacadas en la lectura actual."
            activityWindows={activityWindows}
          />
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="surface-panel rounded-[26px] border-[rgba(25,36,52,0.08)] p-4">
            <p className="text-xs uppercase tracking-[0.26em] text-slate-500">Usuarios</p>
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-semibold text-slate-900">Ahora:</span> {summary?.users_active_now ?? 0} · <span className="font-semibold text-slate-900">24h:</span> {summary?.users_active_24h ?? 0} · <span className="font-semibold text-slate-900">Total:</span> {summary?.users_total ?? 0}
            </p>
          </article>
          <article className="surface-panel rounded-[26px] border-[rgba(25,36,52,0.08)] p-4">
            <p className="text-xs uppercase tracking-[0.26em] text-slate-500">Eventos</p>
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-semibold text-slate-900">24h:</span> {summary?.events_24h ?? 0} · <span className="font-semibold text-slate-900">Rango:</span> {summary?.events_window ?? 0}
            </p>
          </article>
          <article className="surface-panel rounded-[26px] border-[rgba(25,36,52,0.08)] p-4">
            <p className="text-xs uppercase tracking-[0.26em] text-slate-500">Consultas legales</p>
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-semibold text-slate-900">24h:</span> {summary?.legal_consultations_24h ?? 0} · <span className="font-semibold text-slate-900">Rango:</span> {summary?.legal_consultations_window ?? 0}
            </p>
          </article>
        </section>

        <section className="surface-panel space-y-4 rounded-[30px] border-[rgba(25,36,52,0.08)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Actividad por cuenta</h2>
              <p className="text-sm text-slate-500">La tabla prioriza cuentas críticas y después las de menor actividad reciente.</p>
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full max-w-md rounded-xl border border-[rgba(25,36,52,0.12)] px-3 py-2 text-sm text-slate-900"
              placeholder="Buscar por cuenta o despacho"
            />
          </div>

          {loading && rows.length === 0 ? (
            <DataCardsSkeleton cards={4} />
          ) : (
            <MobileDataList
              items={rows}
              getKey={(row) => row.tenant_id}
              empty={(
                !loading ? (
                  <InlineEmptyState
                    icon={<Users className="h-6 w-6" />}
                    title="Sin cuentas para mostrar"
                    description="Prueba con otra ventana o cambia la búsqueda para recuperar tenants en esta lectura móvil."
                  />
                ) : null
              )}
              renderItem={(row) => (
                <article className={`rounded-[1.4rem] border p-4 shadow-sm ${!row.is_active ? 'border-red-200 bg-red-50/30' : 'border-[rgba(25,36,52,0.08)] bg-white'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">{row.tenant_name}</p>
                        {!row.is_active && (
                          <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                            Deshabilitada
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{row.tenant_slug} · {row.despacho || 'Sin despacho'}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${activityClasses(row.activity_bucket)}`}>
                        {activityLabel(row.activity_bucket, activityWindows.live_minutes, activityWindows.recent_minutes, activityWindows.idle_days)}
                      </span>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(row.health_status)}`}>
                        {statusLabel(row.health_status)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-[rgba(246,242,235,0.52)] px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Última actividad</p>
                      <p className="mt-1 text-sm text-slate-700">{formatRelativeTime(row.last_activity_at)}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatDateTime(row.last_activity_at)}</p>
                    </div>
                    <div className="rounded-2xl bg-[rgba(246,242,235,0.52)] px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Salud</p>
                      <p className="mt-1 text-sm text-slate-700">{row.health_reason}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-[rgba(25,36,52,0.08)] bg-white px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Usuarios</p>
                      <p className="mt-1 text-sm text-slate-700"><span className="font-semibold text-blue-700">Ahora:</span> {row.users_active_now}</p>
                      <p className="text-sm text-slate-700"><span className="font-semibold text-emerald-700">1h:</span> {row.users_active_1h}</p>
                      <p className="text-sm text-slate-700"><span className="font-semibold text-slate-700">24h/total:</span> {row.users_active_24h} / {row.users_total}</p>
                    </div>
                    <div className="rounded-2xl border border-[rgba(25,36,52,0.08)] bg-white px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Actividad</p>
                      <p className="mt-1 text-sm text-slate-700"><span className="font-semibold">Eventos 24h:</span> {row.events_24h}</p>
                      <p className="text-sm text-slate-700"><span className="font-semibold">Eventos rango:</span> {row.events_window}</p>
                      <p className="text-sm text-slate-700"><span className="font-semibold">Consultas 24h:</span> {row.legal_consultations_24h}</p>
                      <p className="text-sm text-slate-700"><span className="font-semibold">Consultas rango:</span> {row.legal_consultations_window}</p>
                    </div>
                </div>

                <div className="mt-4 rounded-2xl border border-[rgba(25,36,52,0.08)] bg-white px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Errores</p>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{row.error_events_window}</p>
                    <p className="text-sm text-slate-500">Tasa {row.error_rate.toFixed(2)}%</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => focusTenant(row.tenant_slug)}
                    className="min-h-[40px] rounded-full border border-[rgba(25,36,52,0.12)] bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-[rgba(184,137,70,0.28)] hover:text-[var(--fiscal-ink)]"
                  >
                    Filtrar cuenta
                  </button>
                  {row.despacho && (
                    <button
                      type="button"
                      onClick={() => focusTenant(row.despacho || "")}
                      className="min-h-[40px] rounded-full border border-[rgba(25,36,52,0.12)] bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-[rgba(184,137,70,0.28)] hover:text-[var(--fiscal-ink)]"
                    >
                      Ver despacho
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void copyTenantSlug(row.tenant_slug)}
                    className="min-h-[40px] rounded-full border border-[rgba(45,91,136,0.18)] bg-[rgba(45,91,136,0.08)] px-3 py-2 text-xs font-semibold text-[var(--fiscal-accent)] transition hover:bg-[rgba(45,91,136,0.12)]"
                  >
                    Copiar slug
                  </button>
                </div>
                </article>
              )}
            />
          )}

          <div className="hidden overflow-x-auto lg:block">
            <table className="min-w-full divide-y divide-[rgba(25,36,52,0.08)] text-sm text-slate-700">
              <thead className="bg-[rgba(246,242,235,0.72)] text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Cuenta</th>
                  <th className="px-3 py-2 text-left">Estado actual</th>
                  <th className="px-3 py-2 text-left">Última actividad</th>
                  <th className="px-3 py-2 text-right">Usuarios</th>
                  <th className="px-3 py-2 text-right">Eventos</th>
                  <th className="px-3 py-2 text-right">Consultas</th>
                  <th className="px-3 py-2 text-right">Errores</th>
                  <th className="px-3 py-2 text-left">Salud</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                      Sin cuentas para mostrar.
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={row.tenant_id} className={!row.is_active ? "bg-red-50/40" : undefined}>
                    <td className="px-3 py-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">{row.tenant_name}</p>
                          {!row.is_active && (
                            <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                              Deshabilitada
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{row.tenant_slug} · {row.despacho || "Sin despacho"}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${activityClasses(row.activity_bucket)}`}>
                        {activityLabel(row.activity_bucket, activityWindows.live_minutes, activityWindows.recent_minutes, activityWindows.idle_days)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-xs text-slate-700">{formatRelativeTime(row.last_activity_at)}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(row.last_activity_at)}</p>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <p><span className="font-semibold text-blue-700">Ahora:</span> {row.users_active_now}</p>
                      <p><span className="font-semibold text-emerald-700">1h:</span> {row.users_active_1h}</p>
                      <p><span className="font-semibold text-slate-700">24h/total:</span> {row.users_active_24h} / {row.users_total}</p>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <p><span className="font-semibold text-slate-700">24h:</span> {row.events_24h}</p>
                      <p><span className="font-semibold text-slate-700">Rango:</span> {row.events_window}</p>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <p><span className="font-semibold text-slate-700">24h:</span> {row.legal_consultations_24h}</p>
                      <p><span className="font-semibold text-slate-700">Rango:</span> {row.legal_consultations_window}</p>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <p className="font-semibold text-slate-900">{row.error_events_window}</p>
                      <p className="text-xs text-slate-500">{row.error_rate.toFixed(2)}%</p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="space-y-1">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(row.health_status)}`}>
                          {statusLabel(row.health_status)}
                        </span>
                        <p className="text-xs text-slate-500">{row.health_reason}</p>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
