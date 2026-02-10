"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Users } from "lucide-react";

import { DashboardShell } from "../../components/DashboardShell";
import { useAuthContext } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";
import { alertError, alertSuccess, confirmAction } from "../../lib/alerts";

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

const REGIMENES_FISCALES = [
  { value: "601", label: "601 - General de Ley Personas Morales" },
  { value: "603", label: "603 - Personas Morales con Fines no Lucrativos" },
  { value: "605", label: "605 - Sueldos y Salarios e Ingresos Asimilados a Salarios" },
  { value: "606", label: "606 - Arrendamiento" },
  { value: "608", label: "608 - Demás ingresos" },
  { value: "610", label: "610 - Residentes en el Extranjero sin Establecimiento Permanente" },
  { value: "611", label: "611 - Ingresos por Dividendos (socios y accionistas)" },
  { value: "612", label: "612 - Personas Físicas con Actividades Empresariales y Profesionales" },
  { value: "614", label: "614 - Ingresos por intereses" },
  { value: "615", label: "615 - Régimen de los ingresos por obtención de premios" },
  { value: "620", label: "620 - Sociedades por Acciones Simplificadas" },
  { value: "621", label: "621 - Incorporación Fiscal" },
  { value: "622", label: "622 - Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras" },
  { value: "623", label: "623 - Opcional para Grupos de Sociedades" },
  { value: "624", label: "624 - Coordinados" },
  { value: "625", label: "625 - Actividades Empresariales con ingresos a través de Plataformas Tecnológicas" },
  { value: "626", label: "626 - Régimen Simplificado de Confianza" },
];

const INSIGHT_STYLES: Record<DashboardMetrics["insights"][number]["severity"], string> = {
  info: "text-jade-600 bg-jade-50",
  warning: "text-amber-600 bg-amber-50",
  alert: "text-flame-600 bg-flame-50",
};

type EmpresaFormData = {
  razon_social: string;
  rfc: string;
  regimen_fiscal: string;
  fecha_constitucion: string;
  pais: string;
  estado: string;
  ciudad: string;
  email_contacto: string;
  telefono_contacto: string;
};

const emptyForm: EmpresaFormData = {
  razon_social: "",
  rfc: "",
  regimen_fiscal: "",
  fecha_constitucion: "",
  pais: "",
  estado: "",
  ciudad: "",
  email_contacto: "",
  telefono_contacto: "",
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<EmpresaFormData>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isFormExpanded, setIsFormExpanded] = useState(false);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isMetricsLoading, setIsMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [historyPoints, setHistoryPoints] = useState<DashboardHistoryPoint[]>([]);
  const [historyRange, setHistoryRange] = useState<DashboardHistoryResponse["range"] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyDays, setHistoryDays] = useState<number>(90);

  const inputClass =
    "mt-1 w-full rounded-lg border border-slate-300 bg-white/95 px-3 py-2 text-sm text-ink-700 placeholder-slate-500 focus:border-jade-500 focus:ring-2 focus:ring-jade-500/15 focus:outline-none";

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

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
    void Promise.all([loadEmpresas(), loadMetrics(), loadHistory(historyDays)]);
  }, [historyDays, loadEmpresas, loadMetrics, loadHistory]);

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
    void loadMetrics();
    void loadHistory(historyDays);
  }, [historyDays, isAuthenticated, isGlobalAdmin, isProfileLoaded, loadEmpresas, loadMetrics, loadHistory]);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "rfc" ? value.toUpperCase() : value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const endpoint = editingId
        ? `/api/materialidad/empresas/${editingId}/`
        : "/api/materialidad/empresas/";
      const method = editingId ? "PUT" : "POST";
      await apiFetch<Empresa>(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (editingId) {
        await alertSuccess("Empresa actualizada", "La razón social se actualizó correctamente");
      } else {
        await alertSuccess("Empresa registrada", "La empresa quedó disponible en tu cliente");
      }
      setFormData(emptyForm);
      setEditingId(null);
      await loadEmpresas();
    } catch (err) {
      void alertError("No pudimos guardar la empresa", (err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDateForInput = (value: string) => {
    if (!value) return "";
    return value.split("T")[0];
  };

  const handleEdit = (empresa: Empresa) => {
    setEditingId(empresa.id);
    setFormData({
      razon_social: empresa.razon_social,
      rfc: empresa.rfc,
      regimen_fiscal: empresa.regimen_fiscal,
      fecha_constitucion: formatDateForInput(empresa.fecha_constitucion),
      pais: empresa.pais,
      estado: empresa.estado,
      ciudad: empresa.ciudad,
      email_contacto: empresa.email_contacto || "",
      telefono_contacto: empresa.telefono_contacto || "",
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData(emptyForm);
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
      if (editingId === empresa.id) {
        handleCancelEdit();
      }
      await loadEmpresas();
    } catch (err) {
      void alertError("No pudimos eliminar", (err as Error).message);
    }
  };

  useEffect(() => {
    if (editingId !== null) {
      setIsFormExpanded(true);
    }
  }, [editingId]);

  const isEditing = useMemo(() => editingId !== null, [editingId]);
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
        helper: `${metrics.empresas.con_contrato || 0}/${metrics.empresas.activas || 0} empresas con contratos vigentes${
          metrics.contratos.sin_vigencia ? ` · ${metrics.contratos.sin_vigencia} sin vigencia` : ""
        }`,
        tone: coverageTone,
      },
      {
        id: "contratos_vencer",
        title: "Contratos por vencer (30d)",
        value: formatNumber(metrics.contratos.por_vencer_30),
        helper: `${formatNumber(metrics.contratos.vigentes)} vigentes${
          metrics.contratos.sin_vigencia ? ` · ${formatNumber(metrics.contratos.sin_vigencia)} sin vigencia` : ""
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
      <div className="space-y-10">
        <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-jade-50 p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-widest text-jade-600">Herramientas con IA</p>
              <h2 className="text-2xl font-semibold text-ink-500">Genera contratos con GPT-5 mini</h2>
              <p className="mt-1 text-sm text-slate-600">
                Captura los datos clave y obtén un borrador editable con referencias fiscales sugeridas.
              </p>
            </div>
            <Link
              href="/dashboard/contratos"
              className="inline-flex items-center justify-center rounded-lg bg-jade-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-jade-600"
            >
              Abrir generador
            </Link>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-widest text-slate-500">Salud fiscal</p>
              <h2 className="text-2xl font-semibold text-ink-500">KPIs para anticipar auditorías del SAT</h2>
              {metricsTimestamp && (
                <p className="text-xs text-slate-500">Actualizado {metricsTimestamp}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-ink-500 transition hover:border-jade-400 hover:text-jade-600"
            >
              Actualizar KPIs
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {isMetricsLoading && !metrics &&
              Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={`kpi-skeleton-${index}`}
                  className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-slate-100"
                />
              ))}
            {kpiCards.length > 0 &&
              kpiCards.map((card) => (
                <div
                  key={card.id}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>{card.title}</span>
                    <span
                      className={`rounded-full px-3 py-1 ${KPI_TONE_STYLES[card.tone].bg} ${KPI_TONE_STYLES[card.tone].text}`}
                    >
                      {KPI_TONE_LABEL[card.tone]}
                    </span>
                  </div>
                  <p className={`mt-4 text-3xl font-semibold ${KPI_TONE_STYLES[card.tone].text}`}>
                    {card.value}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">{card.helper}</p>
                </div>
              ))}
          </div>
          {metricsError && (
            <p className="text-sm text-flame-600">{metricsError}</p>
          )}
          {!isMetricsLoading && !metricsError && metrics && kpiCards.length === 0 && (
            <p className="text-sm text-slate-500">Aún no hay datos suficientes para calcular los KPIs.</p>
          )}
          {metrics?.insights?.length ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink-500">Insights fiscales prioritarios</p>
                  <p className="text-sm text-slate-500">
                    Detecciones que requieren preparación adicional frente a posibles revisiones del SAT.
                  </p>
                </div>
                <span className="rounded-full bg-jade-50 px-4 py-1 text-xs font-semibold text-jade-600">
                  {metrics.insights.length} hallazgos
                </span>
              </div>
              <ul className="mt-4 space-y-3">
                {metrics.insights.map((insight) => (
                  <li key={insight.id} className="rounded-2xl border border-slate-100 bg-gradient-to-r from-white to-slate-50 p-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${INSIGHT_STYLES[insight.severity]}`}
                      >
                        {insight.title}
                      </span>
                      <p className="text-sm text-slate-600">{insight.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-slate-900/20 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 text-slate-100 shadow-2xl shadow-black/30">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Tendencia histórica</p>
              <h2 className="text-2xl font-semibold text-white">Preparación ante fiscalizaciones</h2>
              {historyRangeLabel && <p className="text-sm text-slate-400">{historyRangeLabel}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {HISTORY_RANGES.map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => handleHistoryRangeChange(range)}
                  className={`rounded-full px-4 py-1 text-xs font-semibold transition ${historyDays === range
                    ? "bg-emerald-400/20 text-emerald-200"
                    : "border border-white/15 text-slate-300 hover:border-emerald-300"
                    }`}
                >
                  {range} días
                </button>
              ))}
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                {historyPoints.length} snapshots
              </span>
            </div>
          </div>
          {isHistoryLoading && !historyPoints.length ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={`history-skeleton-${index}`}
                  className="h-48 animate-pulse rounded-3xl border border-white/10 bg-white/5"
                />
              ))}
            </div>
          ) : null}
          {historyError && !isHistoryLoading ? (
            <p className="mt-4 text-sm text-amber-300">{historyError}</p>
          ) : null}
          {!historyError && historyPoints.length === 0 && !isHistoryLoading ? (
            <p className="mt-4 text-sm text-slate-400">
              Aún no contamos con snapshots históricos. El cron programado los irá acumulando automáticamente.
            </p>
          ) : null}
          {!historyError && historyPoints.length > 0 ? (
            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <header className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">Cobertura contractual</p>
                    <p className="text-3xl font-semibold text-white">
                      {historySummary ? formatPercentage(historySummary.coverageCurrent) : "--"}
                    </p>
                    {historySummary && (
                      <p className="text-sm text-emerald-200">
                        {formatDelta(historySummary.coverageCurrent, historySummary.coverageCurrent - historySummary.coverageDelta)} pts vs inicio
                      </p>
                    )}
                  </div>
                  <span className="rounded-full border border-white/20 px-3 py-1 text-xs text-slate-200">
                    Meta ≥ 85%
                  </span>
                </header>
                <div className="mt-4 overflow-hidden">
                  <svg
                    width={coverageSparkline.width}
                    height={coverageSparkline.height}
                    viewBox={`0 0 ${coverageSparkline.width} ${coverageSparkline.height}`}
                    className="w-full"
                  >
                    <defs>
                      <linearGradient id="coverage-gradient" x1="0%" x2="0%" y1="0%" y2="100%">
                        <stop offset="0%" stopColor="#34d399" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {coverageSparkline.path && (
                      <>
                        <path
                          d={`${coverageSparkline.path} L${coverageSparkline.width} ${coverageSparkline.height} L0 ${coverageSparkline.height} Z`}
                          fill="url(#coverage-gradient)"
                          opacity={0.7}
                        />
                        <path
                          d={coverageSparkline.path}
                          fill="none"
                          stroke="#34d399"
                          strokeWidth={3}
                          strokeLinecap="round"
                        />
                      </>
                    )}
                  </svg>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <header className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-rose-200">Backlog de validaciones</p>
                    <p className="text-3xl font-semibold text-white">
                      {historySummary ? formatNumber(historySummary.backlogCurrent) : "--"}
                    </p>
                    {historySummary && (
                      <p className={`text-sm ${historySummary.backlogDelta <= 0 ? "text-emerald-200" : "text-rose-200"}`}>
                        {historySummary.backlogDelta <= 0 ? "Descendió" : "Aumentó"} {Math.abs(historySummary.backlogDelta).toFixed(0)} casos
                      </p>
                    )}
                  </div>
                  <span className="rounded-full border border-white/20 px-3 py-1 text-xs text-slate-200">
                    Meta ≤ 3 casos
                  </span>
                </header>
                <div className="mt-4 overflow-hidden">
                  <svg
                    width={backlogSparkline.width}
                    height={backlogSparkline.height}
                    viewBox={`0 0 ${backlogSparkline.width} ${backlogSparkline.height}`}
                    className="w-full"
                  >
                    <defs>
                      <linearGradient id="backlog-gradient" x1="0%" x2="0%" y1="0%" y2="100%">
                        <stop offset="0%" stopColor="#fb7185" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="#fb7185" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {backlogSparkline.path && (
                      <>
                        <path
                          d={`${backlogSparkline.path} L${backlogSparkline.width} ${backlogSparkline.height} L0 ${backlogSparkline.height} Z`}
                          fill="url(#backlog-gradient)"
                          opacity={0.7}
                        />
                        <path
                          d={backlogSparkline.path}
                          fill="none"
                          stroke="#fb7185"
                          strokeWidth={3}
                          strokeLinecap="round"
                        />
                      </>
                    )}
                  </svg>
                </div>
                {historySummary && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.35em] text-slate-300">CFDIs validados</p>
                    <p className="text-2xl font-semibold text-white">{formatCurrencyMx(historySummary.montoActual)}</p>
                    <p className="text-sm text-slate-300">Último snapshot registrado</p>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </section>

        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Empresas registradas en el tenant</p>
              <h2 className="text-2xl font-semibold text-ink-500">Empresas activas</h2>
            </div>
            <button
              onClick={() => {
                handleRefresh();
              }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-ink-500 hover:border-jade-400 hover:text-jade-600"
            >
              Actualizar
            </button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Razón social</th>
                  <th className="px-4 py-3">RFC</th>
                  <th className="px-4 py-3">Régimen</th>
                  <th className="px-4 py-3">Ubicación</th>
                  <th className="px-4 py-3">Estatus</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading && (
                  <tr>
                    <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>
                      Cargando información
                    </td>
                  </tr>
                )}
                {!isLoading && error && (
                  <tr>
                    <td className="px-4 py-6 text-center text-flame-500" colSpan={6}>
                      {error}
                    </td>
                  </tr>
                )}
                {!isLoading && !error && empresas.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>
                      No hay empresas registradas en este tenant
                    </td>
                  </tr>
                )}
                {!isLoading && !error &&
                  empresas.map((empresa) => (
                    <tr key={empresa.id}>
                      <td className="px-4 py-3 font-medium text-ink-500">{empresa.razon_social}</td>
                      <td className="px-4 py-3 text-slate-600">{empresa.rfc}</td>
                      <td className="px-4 py-3 text-slate-600">{empresa.regimen_fiscal}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {empresa.ciudad}, {empresa.estado}, {empresa.pais}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${empresa.activo ? "bg-jade-500/10 text-jade-600" : "bg-slate-200 text-slate-600"
                            }`}
                        >
                          {empresa.activo ? "Activa" : "Suspendida"}
                        </span>
                      </td>
                      <td className="px-4 py-3 space-x-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleEdit(empresa)}
                          className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-ink-500 hover:border-jade-500"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleDelete(empresa);
                          }}
                          className="rounded-lg border border-flame-200 px-3 py-1 text-xs font-medium text-flame-600 hover:bg-flame-50"
                        >
                          Eliminar
                        </button>
                        <Link
                          href={`/dashboard/empresas/${empresa.id}`}
                          className="inline-block rounded-lg border border-jade-200 px-3 py-1 text-xs font-medium text-jade-600 hover:bg-jade-50"
                        >
                          Materialidad
                        </Link>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Registrar empresa</p>
              <h2 className="text-2xl font-semibold text-ink-500">
                {isEditing ? "Actualiza una razón social" : "Agrega una razón social"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Despliega el formulario solo cuando necesites capturar o editar datos fiscales.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsFormExpanded((prev) => !prev)}
              aria-expanded={isFormExpanded}
              aria-controls="empresa-form"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-ink-500 transition hover:border-jade-400 hover:text-jade-600"
            >
              {isFormExpanded ? "Ocultar formulario" : isEditing ? "Reanudar edición" : "Registrar empresa"}
            </button>
          </div>
          {isFormExpanded ? (
            <form id="empresa-form" onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-ink-500">Razón social</label>
                  <input
                    type="text"
                    name="razon_social"
                    required
                    value={formData.razon_social}
                    onChange={handleInputChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-ink-500">RFC</label>
                  <input
                    type="text"
                    name="rfc"
                    required
                    maxLength={13}
                    value={formData.rfc}
                    onChange={handleInputChange}
                    className={`${inputClass} uppercase`}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-ink-500">Régimen fiscal</label>
                  <select
                    name="regimen_fiscal"
                    required
                    value={formData.regimen_fiscal}
                    onChange={handleInputChange}
                    className={inputClass}
                  >
                    <option value="" disabled>
                      Selecciona un régimen
                    </option>
                    {REGIMENES_FISCALES.map((regimen) => (
                      <option key={regimen.value} value={regimen.label}>
                        {regimen.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-ink-500">Fecha de constitución</label>
                  <input
                    type="date"
                    name="fecha_constitucion"
                    required
                    value={formData.fecha_constitucion}
                    onChange={handleInputChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-ink-500">País</label>
                  <input
                    type="text"
                    name="pais"
                    required
                    value={formData.pais}
                    onChange={handleInputChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-ink-500">Estado</label>
                  <input
                    type="text"
                    name="estado"
                    required
                    value={formData.estado}
                    onChange={handleInputChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-ink-500">Ciudad</label>
                  <input
                    type="text"
                    name="ciudad"
                    required
                    value={formData.ciudad}
                    onChange={handleInputChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-ink-500">Correo de contacto</label>
                  <input
                    type="email"
                    name="email_contacto"
                    value={formData.email_contacto}
                    onChange={handleInputChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-ink-500">Teléfono</label>
                  <input
                    type="tel"
                    name="telefono_contacto"
                    value={formData.telefono_contacto}
                    onChange={handleInputChange}
                    className={inputClass}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isSaving}
                className="w-full rounded-lg bg-jade-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-jade-600 disabled:opacity-70"
              >
                {isSaving
                  ? isEditing
                    ? "Guardando cambios..."
                    : "Registrando..."
                  : isEditing
                    ? "Actualizar empresa"
                    : "Agregar empresa"}
              </button>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-ink-500"
                >
                  Cancelar edición
                </button>
              )}
            </form>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-4 text-sm text-ink-500">
              {empresas.length
                ? "Consulta el padrón y abre el formulario cuando necesites agregar o actualizar una razón social."
                : "Aún no hay empresas registradas. Haz clic en \"Registrar empresa\" para capturar la primera."}
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
