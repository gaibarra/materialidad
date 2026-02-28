"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Users } from "lucide-react";

import { DashboardShell } from "../../components/DashboardShell";
import { useAuthContext } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";
import { alertError, alertSuccess, confirmAction } from "../../lib/alerts";
import { fetchProviders, Proveedor } from "../../lib/providers";
import { ExecutiveOverview } from "./(components)/ExecutiveOverview";

type Empresa = {
  id: number;
  razon_social: string;
  rfc: string;
  regimen_fiscal: string;
  fecha_constitucion: string;
  pais: string;
  estado: string;
  ciudad: string;
  email_contacto: string;
  telefono_contacto: string;
  activo: boolean;
  created_at: string;
};

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type DashboardMetrics = {
  generated_at: string;
  empresas: {
    total: number;
    activas: number;
    con_contrato: number;
    cobertura_contractual: number;
  };
  contratos: {
    vigentes: number;
    por_vencer_30: number;
    vencidos: number;
    sin_vigencia: number;
  };
  operaciones: {
    pendientes_validacion: number;
    rechazadas: number;
    validadas_30d: number;
    monto_validado_mxn: number;
  };
  proveedores: {
    total: number;
    observados: number;
    sin_validacion_sat: number;
  };
  insights: Array<{
    id: string;
    title: string;
    severity: "info" | "warning" | "alert";
    message: string;
  }>;
};

type DashboardHistoryPoint = {
  captured_at: string;
  cobertura_contractual: number;
  contratos_por_vencer_30: number;
  operaciones_pendientes: number;
  proveedores_sin_validacion_sat: number;
  monto_validado_mxn: number;
  insights: DashboardMetrics["insights"];
};

type DashboardHistoryResponse = {
  range: {
    from: string | null;
    to: string | null;
    days: number;
    limit: number;
  };
  results: DashboardHistoryPoint[];
};

type MetricTone = "positive" | "warning" | "alert" | "info";

type KpiCard = {
  id: string;
  title: string;
  value: string;
  helper: string;
  tone: MetricTone;
};

const KPI_TONE_STYLES: Record<MetricTone, { text: string; bg: string }> = {
  positive: { text: "text-emerald-500", bg: "bg-emerald-500/10" },
  warning: { text: "text-amber-600", bg: "bg-amber-500/10" },
  alert: { text: "text-flame-600", bg: "bg-flame-500/10" },
  info: { text: "text-slate-600", bg: "bg-slate-200/40" },
};
const KPI_TONE_LABEL: Record<MetricTone, string> = {
  positive: "Saludable",
  warning: "Vigilar",
  alert: "Riesgo",
  info: "Seguimiento",
};

const INSIGHT_STYLES: Record<DashboardMetrics["insights"][number]["severity"], string> = {
  info: "text-jade-600 bg-jade-50",
  warning: "text-amber-600 bg-amber-50",
  alert: "text-flame-600 bg-flame-50",
};



const formatNumber = (value: number) => value.toLocaleString("es-MX");
const formatPercentage = (value: number) => `${value.toFixed(1)}%`;
const formatCurrencyMx = (value: number) =>
  value.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const HISTORY_RANGES = [30, 90, 180] as const;
const SPARKLINE_WIDTH = 320;
const SPARKLINE_HEIGHT = 120;

const buildSparklinePath = (
  points: DashboardHistoryPoint[],
  accessor: (point: DashboardHistoryPoint) => number,
  width = SPARKLINE_WIDTH,
  height = SPARKLINE_HEIGHT
) => {
  if (!points.length) {
    return { path: "", min: 0, max: 0, width, height };
  }
  const values = points.map(accessor);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const segments = points.map((point, index) => {
    const x = (index / Math.max(points.length - 1, 1)) * width;
    const value = accessor(point);
    const y = height - ((value - min) / range) * height;
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const path = segments.join(" ");
  return { path, min, max, width, height };
};

const formatDelta = (current: number, previous: number) => {
  const delta = current - previous;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}`;
};

export default function DashboardPage() {
  const { isAuthenticated, user, tenant, isProfileLoaded } = useAuthContext();
  const router = useRouter();

  // Detectar si es superusuario sin tenant (Modo Admin Global)
  const isGlobalAdmin = isAuthenticated && user?.is_superuser && !tenant;

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isMetricsLoading, setIsMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [historyPoints, setHistoryPoints] = useState<DashboardHistoryPoint[]>([]);
  const [historyRange, setHistoryRange] = useState<DashboardHistoryResponse["range"] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyDays, setHistoryDays] = useState<number>(90);

  useEffect(() => {
    if (isProfileLoaded && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isProfileLoaded, router]);

  const loadEmpresas = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiFetch<PaginatedResponse<Empresa>>("/api/materialidad/empresas/");
      setEmpresas(response.results);
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      void alertError("No pudimos cargar las empresas", message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadProveedores = useCallback(async () => {
    try {
      const data = await fetchProviders();
      setProveedores(data);
    } catch {
      // silenciar — no es crítico en el dashboard
    }
  }, []);

  const loadMetrics = useCallback(async () => {
    setIsMetricsLoading(true);
    setMetricsError(null);
    try {
      const response = await apiFetch<DashboardMetrics>("/api/materialidad/dashboard/metricas/");
      setMetrics(response);
    } catch (err) {
      const message = (err as Error).message;
      setMetricsError(message);
      void alertError("No pudimos cargar los KPIs fiscales", message);
    } finally {
      setIsMetricsLoading(false);
    }
  }, []);

  const loadHistory = useCallback(
    async (days: number) => {
      setIsHistoryLoading(true);
      setHistoryError(null);
      try {
        const response = await apiFetch<DashboardHistoryResponse>(
          `/api/materialidad/dashboard/metricas/historico/?days=${days}`
        );
        setHistoryPoints(response.results);
        setHistoryRange(response.range);
      } catch (err) {
        const message = (err as Error).message;
        setHistoryError(message);
        void alertError("No pudimos recuperar el histórico de KPIs", message);
      } finally {
        setIsHistoryLoading(false);
      }
    },
    []
  );

  const handleRefresh = useCallback(() => {
    void Promise.all([loadEmpresas(), loadProveedores(), loadMetrics(), loadHistory(historyDays)]);
  }, [historyDays, loadEmpresas, loadProveedores, loadMetrics, loadHistory]);

  const handleHistoryRangeChange = (days: number) => {
    if (historyDays === days) return;
    setHistoryDays(days);
  };

  // Efecto principal de carga de datos
  useEffect(() => {
    // No cargar nada hasta que el perfil esté listo
    if (!isProfileLoaded) return;
    // Si no está autenticado O es admin global, no cargar datos de tenant
    if (!isAuthenticated || isGlobalAdmin) return;

    void loadEmpresas();
    void loadProveedores();
    void loadMetrics();
    void loadHistory(historyDays);
  }, [historyDays, isAuthenticated, isGlobalAdmin, isProfileLoaded, loadEmpresas, loadProveedores, loadMetrics, loadHistory]);

  const handleEdit = (empresa: Empresa) => {
    router.push("/dashboard/empresas");
  };

  const handleDelete = async (empresa: Empresa) => {
    const result = await confirmAction({
      title: `Eliminar ${empresa.razon_social}?`,
      text: "Esta acción no se puede deshacer",
      confirmButtonText: "Sí, eliminar",
    });
    if (!result.isConfirmed) {
      return;
    }
    try {
      await apiFetch<null>(`/api/materialidad/empresas/${empresa.id}/`, {
        method: "DELETE",
      });
      await alertSuccess("Empresa eliminada", "Se retiró del catálogo del cliente");
      await loadEmpresas();
    } catch (err) {
      void alertError("No pudimos eliminar", (err as Error).message);
    }
  };

  const kpiCards = useMemo<KpiCard[]>(() => {
    if (!metrics) return [];
    const coverageTone: MetricTone =
      metrics.empresas.cobertura_contractual >= 85
        ? "positive"
        : metrics.empresas.cobertura_contractual >= 70
          ? "warning"
          : "alert";
    const pendientesTone: MetricTone =
      metrics.operaciones.pendientes_validacion === 0
        ? "positive"
        : metrics.operaciones.pendientes_validacion <= 3
          ? "warning"
          : "alert";
    const proveedoresTone: MetricTone =
      metrics.proveedores.sin_validacion_sat === 0
        ? "positive"
        : metrics.proveedores.sin_validacion_sat <= 2
          ? "warning"
          : "alert";
    return [
      {
        id: "cobertura",
        title: "Cobertura contractual",
        value: formatPercentage(metrics.empresas.cobertura_contractual),
        helper: `${metrics.empresas.con_contrato || 0}/${metrics.empresas.activas || 0} empresas con contratos vigentes${metrics.contratos.sin_vigencia ? ` · ${metrics.contratos.sin_vigencia} sin vigencia` : ""
          }`,
        tone: coverageTone,
      },
      {
        id: "contratos_vencer",
        title: "Contratos por vencer (30d)",
        value: formatNumber(metrics.contratos.por_vencer_30),
        helper: `${formatNumber(metrics.contratos.vigentes)} vigentes${metrics.contratos.sin_vigencia ? ` · ${formatNumber(metrics.contratos.sin_vigencia)} sin vigencia` : ""
          }`,
        tone: metrics.contratos.por_vencer_30 > 0 ? "alert" : "positive",
      },
      {
        id: "operaciones_pendientes",
        title: "Operaciones sin validar",
        value: formatNumber(metrics.operaciones.pendientes_validacion),
        helper: `${formatNumber(metrics.operaciones.rechazadas)} observadas`,
        tone: pendientesTone,
      },
      {
        id: "proveedores_sin_sat",
        title: "Proveedores sin estatus SAT",
        value: formatNumber(metrics.proveedores.sin_validacion_sat),
        helper: `${formatNumber(metrics.proveedores.observados)} con alertas`,
        tone: proveedoresTone,
      },
      {
        id: "monto_validado",
        title: "CFDIs validados (MXN)",
        value: formatCurrencyMx(metrics.operaciones.monto_validado_mxn),
        helper: `${formatNumber(metrics.operaciones.validadas_30d)} validados en 30 días`,
        tone: metrics.operaciones.monto_validado_mxn > 0 ? "positive" : "info",
      },
    ];
  }, [metrics]);
  const metricsTimestamp = useMemo(() => {
    if (!metrics) return null;
    try {
      return new Date(metrics.generated_at).toLocaleString("es-MX", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return null;
    }
  }, [metrics]);
  const historySummary = useMemo(() => {
    if (!historyPoints.length) return null;
    const first = historyPoints[0];
    const last = historyPoints[historyPoints.length - 1];
    return {
      coverageCurrent: last.cobertura_contractual,
      coverageDelta: last.cobertura_contractual - first.cobertura_contractual,
      backlogCurrent: last.operaciones_pendientes,
      backlogDelta: last.operaciones_pendientes - first.operaciones_pendientes,
      montoActual: last.monto_validado_mxn,
    };
  }, [historyPoints]);
  const coverageSparkline = useMemo(
    () => buildSparklinePath(historyPoints, (point) => point.cobertura_contractual),
    [historyPoints]
  );
  const backlogSparkline = useMemo(
    () => buildSparklinePath(historyPoints, (point) => point.operaciones_pendientes),
    [historyPoints]
  );
  const historyRangeLabel = useMemo(() => {
    if (!historyRange?.from || !historyRange?.to) return null;
    const from = new Date(historyRange.from).toLocaleDateString("es-MX", { dateStyle: "medium" });
    const to = new Date(historyRange.to).toLocaleDateString("es-MX", { dateStyle: "medium" });
    return `${from} · ${to}`;
  }, [historyRange]);

  // Mostrar carga mientras se resuelve el perfil del usuario
  if (!isProfileLoaded) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-jade-200 border-t-jade-600" />
            <p className="text-sm text-slate-500">Cargando perfil…</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  // Renderizado especial para Super Admin Global
  if (isGlobalAdmin) {
    return (
      <DashboardShell>
        <div className="space-y-8">
          <section className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-white to-indigo-50 p-8 shadow-sm dark:border-indigo-900 dark:from-slate-900 dark:to-indigo-950/30">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                  Control Plane
                </p>
                <h2 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                  Administración Global
                </h2>
                <p className="mt-2 text-lg text-slate-600 dark:text-slate-300 max-w-2xl">
                  Bienvenido al panel de control central. Desde aquí puedes gestionar las organizaciones,
                  suscribir nuevos despachos y monitorear el estado general de la plataforma.
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Tarjeta de Gestión de Organizaciones */}
            <Link
              href="/dashboard/admin/organizaciones"
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="absolute right-0 top-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-blue-50 transition group-hover:bg-blue-100 dark:bg-blue-900/10 dark:group-hover:bg-blue-900/20"></div>
              <div className="relative">
                <div className="mb-4 inline-flex rounded-xl bg-blue-100 p-3 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  <Building2 className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Organizaciones
                </h3>
                <p className="mt-2 text-slate-600 dark:text-slate-400">
                  Gestiona Despachos Contables y Corporativos. Crea nuevos inquilinos y administra sus accesos.
                </p>
                <div className="mt-4 flex items-center text-sm font-semibold text-blue-600 dark:text-blue-400">
                  Ir a gestión <span className="ml-2 transition-transform group-hover:translate-x-1">→</span>
                </div>
              </div>
            </Link>

            {/* Tarjeta de Usuarios (Placeholder) */}
            <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm opacity-60">
              <div className="relative">
                <div className="mb-4 inline-flex rounded-xl bg-purple-100 p-3 text-purple-600">
                  <Users className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">
                  Usuarios Globales
                </h3>
                <p className="mt-2 text-slate-600">
                  Administra superusuarios y staff de soporte plataforma.
                </p>
                <div className="mt-4 text-xs font-medium text-slate-400 uppercase tracking-wide">
                  Próximamente
                </div>
              </div>
            </div>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <DashboardShell>
      <ExecutiveOverview />
    </DashboardShell>
  );
}


