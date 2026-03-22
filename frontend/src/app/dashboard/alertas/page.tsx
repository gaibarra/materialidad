"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import Swal from "sweetalert2";
import { DataCardsSkeleton, InlineEmptyState } from "../../../components/DataState";
import { DashboardShell } from "../../../components/DashboardShell";
import { apiFetch } from "../../../lib/api";
import {
  AlertaOperacion,
  getAlertasOperacion,
  updateAlertaOperacion,
  deleteAlertaOperacion,
} from "../../../lib/alerta-operacion";
import HelpGuide from "../../../components/HelpGuide";

/* ═══════════════════════════════════════════════════════════
   Design-system tokens
   ═══════════════════════════════════════════════════════════ */

const inputCls =
  "w-full rounded-xl border border-[rgba(200,192,177,0.72)] bg-[rgba(255,255,255,0.82)] px-3 py-2 text-sm text-[var(--fiscal-ink)] placeholder:text-[var(--fiscal-muted)] focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)] transition";

const KPI_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  green: { bg: "bg-[var(--fiscal-success-soft)]/80", text: "text-[var(--fiscal-success)]", dot: "bg-[var(--fiscal-success)]" },
  blue:  { bg: "bg-[var(--fiscal-accent-soft)]/80", text: "text-[var(--fiscal-accent)]", dot: "bg-[var(--fiscal-accent)]" },
  amber: { bg: "bg-[var(--fiscal-warning-soft)]/80", text: "text-[var(--fiscal-warning)]", dot: "bg-[var(--fiscal-warning)]" },
  red:   { bg: "bg-[var(--fiscal-danger-soft)]/80", text: "text-[var(--fiscal-danger)]", dot: "bg-[var(--fiscal-danger)]" },
  gray:  { bg: "bg-[rgba(255,255,255,0.78)]", text: "text-[var(--fiscal-muted)]", dot: "bg-[var(--fiscal-muted)]" },
};

/* ── Alert-level styles ── */

type Nivel = "CRITICO" | "ALTO" | "MEDIO" | "INFO";

const NIVEL_STYLE: Record<Nivel, { border: string; bg: string; text: string; badge: string; icon: string }> = {
  CRITICO: { border: "border-red-200",    bg: "bg-red-50/60",    text: "text-red-900",    badge: "bg-red-600 text-white",    icon: "⛔" },
  ALTO:    { border: "border-orange-200",  bg: "bg-orange-50/60", text: "text-orange-900", badge: "bg-orange-500 text-white",  icon: "🔴" },
  MEDIO:   { border: "border-amber-200",   bg: "bg-amber-50/60",  text: "text-amber-900",  badge: "bg-amber-500 text-white",   icon: "⚠️" },
  INFO:    { border: "border-sky-200",     bg: "bg-sky-50/60",    text: "text-sky-900",    badge: "bg-sky-500 text-white",     icon: "ℹ️" },
};

const ESTATUS_BADGE: Record<string, { bg: string; text: string; ring: string; label: string }> = {
  ACTIVA:         { bg: "bg-red-50",      text: "text-red-700",      ring: "ring-red-600/20",      label: "Activa" },
  EN_SEGUIMIENTO: { bg: "bg-amber-50",    text: "text-amber-700",    ring: "ring-amber-600/20",    label: "En seguimiento" },
  CERRADA:        { bg: "bg-emerald-50",  text: "text-emerald-700",  ring: "ring-emerald-600/20",  label: "Cerrada" },
};

/* ═══════════════════════════════════════════════════════════
   Shared UI
   ═══════════════════════════════════════════════════════════ */

function Kpi({ label, value, sub, color = "gray" }: { label: string; value: string | number; sub?: string; color?: string }) {
  const c = KPI_COLORS[color] ?? KPI_COLORS.gray;
  return (
    <div className={`surface-panel rounded-panel px-5 py-4 flex flex-col gap-1 min-w-0 ${c.bg}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fiscal-muted)] flex items-center gap-1.5">
        <span className={`inline-block h-2 w-2 rounded-full ${c.dot}`} />
        {label}
      </span>
      <span className={`text-2xl font-extrabold ${c.text} truncate`}>{value}</span>
      {sub && <span className="text-xs text-[var(--fiscal-muted)] truncate">{sub}</span>}
    </div>
  );
}

function Section({
  badge,
  title,
  defaultOpen = false,
  children,
  right,
  alert: alertStyle,
}: {
  badge?: string;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  right?: React.ReactNode;
  alert?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`overflow-hidden rounded-[1.75rem] shadow-fiscal ${alertStyle ? "border border-[rgba(160,67,61,0.22)] bg-[var(--fiscal-danger-soft)]/55" : "surface-panel"}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => e.key === "Enter" && setOpen((v) => !v)}
        className="flex items-center justify-between px-6 py-5 cursor-pointer select-none"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div>
            {badge && (
              <span className={`text-[11px] font-bold uppercase tracking-widest ${alertStyle ? "text-[var(--fiscal-danger)]" : "text-[var(--fiscal-accent)]"}`}>
                {badge}
              </span>
            )}
            <h2 className="text-lg font-bold text-[var(--fiscal-ink)] leading-tight">{title}</h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {right}
          <ChevronDown className={`h-5 w-5 text-[var(--fiscal-muted)] transition-transform duration-200 ${open ? "" : "-rotate-90"}`} />
        </div>
      </div>
      {open && <div className="px-6 pb-6">{children}</div>}
    </section>
  );
}

function StatusBadge({ estatus }: { estatus: string }) {
  const s = ESTATUS_BADGE[estatus] ?? ESTATUS_BADGE.CERRADA;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${s.bg} ${s.text} ${s.ring}`}>
      {s.label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════
   Types for client-side generated alerts
   ═══════════════════════════════════════════════════════════ */

type AlertaFiscal = {
  id: string;
  nivel: Nivel;
  categoria: string;
  titulo: string;
  detalle: string;
  accion: string;
  fecha: string;
};

type Proveedor = {
  id: number;
  razon_social: string;
  rfc: string;
  estatus_69b: "SIN_COINCIDENCIA" | "PRESUNTO" | "DEFINITIVO" | null;
  ultima_validacion_sat: string | null;
};

type Operacion = {
  id: number;
  proveedor_nombre: string;
  contrato_nombre: string | null;
  cfdi_estatus: string;
  spei_estatus: string;
  monto: string;
  moneda: string;
  fecha_operacion: string;
};

type PaginatedResponse<T> = { count: number; results: T[] };

/* ═══════════════════════════════════════════════════════════
   Checklist Pre-Auditoría
   ═══════════════════════════════════════════════════════════ */

const CHECKLIST_PREAUDITORIA = [
  { id: "c1", texto: "Expediente por proveedor: CSF < 3 meses, REPS, IMSS patronal, fotos domicilio", urgente: true },
  { id: "c2", texto: "Todos los proveedores validados contra Art. 69-B SAT este trimestre", urgente: true },
  { id: "c3", texto: "Memo de análisis de riesgo para proveedores PRESUNTO o DEFINITIVO", urgente: true },
  { id: "c4", texto: "Cada operación > $100,000 tiene entregables con evidencia ligada", urgente: true },
  { id: "c5", texto: "CFDI y SPEI conciliados por operación (no solo por monto global)", urgente: false },
  { id: "c6", texto: "Contratos con cláusula de razón de negocio y penalidades firmados", urgente: false },
  { id: "c7", texto: "Flujo de aprobaciones Art. 5-A completado para contratos clave", urgente: false },
  { id: "c8", texto: "Pólizas contables por operación con NIF aplicable registrada", urgente: false },
  { id: "c9", texto: "Intercompañías con estudio de precios de transferencia actualizado", urgente: false },
  { id: "c10", texto: "Instalaciones y procesos documentados con video/foto (Art. 48 CFF)", urgente: false },
];

/* ═══════════════════════════════════════════════════════════
   Reducer
   ═══════════════════════════════════════════════════════════ */

type State = {
  proveedores: Proveedor[];
  operaciones: Operacion[];
  backendAlertas: AlertaOperacion[];
  loading: boolean;
  filterEstatus: string;
  filterTipo: string;
  searchQ: string;
  checkedItems: Set<string>;
};

const init: State = {
  proveedores: [],
  operaciones: [],
  backendAlertas: [],
  loading: true,
  filterEstatus: "",
  filterTipo: "",
  searchQ: "",
  checkedItems: new Set(),
};

type Action =
  | { type: "SET_DATA"; proveedores: Proveedor[]; operaciones: Operacion[]; backendAlertas: AlertaOperacion[] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_FILTER_ESTATUS"; payload: string }
  | { type: "SET_FILTER_TIPO"; payload: string }
  | { type: "SET_SEARCH"; payload: string }
  | { type: "TOGGLE_CHECK"; id: string }
  | { type: "REMOVE_BACKEND_ALERTA"; id: number };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "SET_DATA":
      return { ...s, proveedores: a.proveedores, operaciones: a.operaciones, backendAlertas: a.backendAlertas, loading: false };
    case "SET_LOADING":
      return { ...s, loading: a.payload };
    case "SET_FILTER_ESTATUS":
      return { ...s, filterEstatus: a.payload };
    case "SET_FILTER_TIPO":
      return { ...s, filterTipo: a.payload };
    case "SET_SEARCH":
      return { ...s, searchQ: a.payload };
    case "TOGGLE_CHECK": {
      const next = new Set(s.checkedItems);
      if (next.has(a.id)) next.delete(a.id); else next.add(a.id);
      return { ...s, checkedItems: next };
    }
    case "REMOVE_BACKEND_ALERTA":
      return { ...s, backendAlertas: s.backendAlertas.filter((x) => x.id !== a.id) };
    default:
      return s;
  }
}

/* ═══════════════════════════════════════════════════════════
   Page component
   ═══════════════════════════════════════════════════════════ */

export default function AlertasPage() {
  const [s, dispatch] = useReducer(reducer, init);
  const [closingId, setClosingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [liveFeedback, setLiveFeedback] = useState<{ tone: "success" | "error" | "info"; message: string } | null>(null);

  /* ── Data loading ── */
  const fetchData = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const [provRes, opRes, backendAlertas] = await Promise.all([
        apiFetch<PaginatedResponse<Proveedor> | Proveedor[]>("/api/materialidad/proveedores/"),
        apiFetch<PaginatedResponse<Operacion> | Operacion[]>("/api/materialidad/operaciones/?ordering=-fecha_operacion"),
        getAlertasOperacion(),
      ]);
      const provList = Array.isArray(provRes) ? provRes : provRes.results ?? [];
      const opList = Array.isArray(opRes) ? opRes : opRes.results ?? [];
      dispatch({ type: "SET_DATA", proveedores: provList, operaciones: opList, backendAlertas: backendAlertas });
    } catch {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  /* ── Generate client-side alerts from raw data ── */
  const alertasFiscales = useMemo<AlertaFiscal[]>(() => {
    const list: AlertaFiscal[] = [];

    // 69-B alerts per proveedor
    s.proveedores
      .filter((p) => p.estatus_69b === "DEFINITIVO" || p.estatus_69b === "PRESUNTO")
      .forEach((p) => {
        list.push({
          id: `prov-${p.id}`,
          nivel: p.estatus_69b === "DEFINITIVO" ? "CRITICO" : "ALTO",
          categoria: "Art. 69-B CFF",
          titulo: `${p.razon_social} — ${p.estatus_69b}`,
          detalle:
            p.estatus_69b === "DEFINITIVO"
              ? `EFOS DEFINITIVO: Las deducciones con ${p.razon_social} (${p.rfc}) serán rechazadas. Operar puede tipificar delito fiscal como EDO (Art. 69-B CFF Reforma 2026).`
              : `EFOS PRESUNTO: ${p.razon_social} (${p.rfc}) está en proceso de resolución. Documenta análisis de riesgo por escrito y considera retención de IVA.`,
          accion:
            p.estatus_69b === "DEFINITIVO"
              ? "Suspende pagos pendientes y consulta a tu abogado fiscal"
              : "Crea memo de análisis de riesgo y valida su estado cada 30 días",
          fecha: p.ultima_validacion_sat ?? new Date().toISOString().slice(0, 10),
        });
      });

    // Operations without contract
    s.operaciones
      .filter((op) => op.cfdi_estatus === "VALIDO" && !op.contrato_nombre)
      .slice(0, 5)
      .forEach((op) => {
        list.push({
          id: `op-${op.id}`,
          nivel: "ALTO",
          categoria: "Materialidad incompleta",
          titulo: `Operación ${op.proveedor_nombre} — CFDI sin contrato`,
          detalle: `Operación del ${op.fecha_operacion} por $${Number(op.monto).toLocaleString("es-MX")} ${op.moneda} tiene CFDI válido pero NO está vinculada a un contrato.`,
          accion: "Vincula la operación a un contrato desde el módulo de contratos",
          fecha: op.fecha_operacion,
        });
      });

    // Stale 69-B validations (>90 days)
    const provSinValidar = s.proveedores.filter((p) => {
      if (!p.ultima_validacion_sat) return true;
      const dias = Math.floor((Date.now() - new Date(p.ultima_validacion_sat).getTime()) / 86400000);
      return dias > 90;
    });
    if (provSinValidar.length > 0) {
      list.push({
        id: "val-vencida",
        nivel: "MEDIO",
        categoria: "Due diligence periódico",
        titulo: `${provSinValidar.length} proveedor${provSinValidar.length > 1 ? "es" : ""} sin validación 69-B reciente`,
        detalle: `La Reforma 2026 exige due diligence trimestral. ${provSinValidar.length} proveedor${provSinValidar.length > 1 ? "es tienen" : " tiene"} más de 90 días sin validar contra las listas SAT.`,
        accion: "Dirígete al módulo Proveedores y solicita validación para cada uno",
        fecha: new Date().toISOString().slice(0, 10),
      });
    }

    // Sort by severity
    const orden: Record<Nivel, number> = { CRITICO: 0, ALTO: 1, MEDIO: 2, INFO: 3 };
    list.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
    return list;
  }, [s.proveedores, s.operaciones]);

  /* ── Metrics ── */
  const metrics = useMemo(() => {
    const totalFiscales = alertasFiscales.length;
    const urgentes = alertasFiscales.filter((a) => a.nivel === "CRITICO" || a.nivel === "ALTO").length;
    const provEnRiesgo = s.proveedores.filter((p) => p.estatus_69b && p.estatus_69b !== "SIN_COINCIDENCIA").length;
    const backendActivas = s.backendAlertas.filter((a) => a.estatus === "ACTIVA").length;
    const backendSeguimiento = s.backendAlertas.filter((a) => a.estatus === "EN_SEGUIMIENTO").length;
    const backendCerradas = s.backendAlertas.filter((a) => a.estatus === "CERRADA").length;
    return { totalFiscales, urgentes, provEnRiesgo, backendActivas, backendSeguimiento, backendCerradas };
  }, [alertasFiscales, s.proveedores, s.backendAlertas]);

  const hasEmergency = metrics.urgentes > 0;

  /* ── Backend alert filters ── */
  const filteredBackend = useMemo(() => {
    let list = [...s.backendAlertas];
    if (s.filterEstatus) list = list.filter((a) => a.estatus === s.filterEstatus);
    if (s.filterTipo) list = list.filter((a) => a.tipo_alerta === s.filterTipo);
    if (s.searchQ) {
      const q = s.searchQ.toLowerCase();
      list = list.filter(
        (a) =>
          a.motivo?.toLowerCase().includes(q) ||
          a.owner_email?.toLowerCase().includes(q) ||
          a.empresa_nombre?.toLowerCase().includes(q) ||
          a.proveedor_nombre?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [s.backendAlertas, s.filterEstatus, s.filterTipo, s.searchQ]);

  /* ── Actions ── */
  const handleCloseAlerta = useCallback(async (id: number) => {
    const res = await Swal.fire({
      title: "¿Cerrar esta alerta?",
      text: "Pasará a estatus Cerrada.",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#2563eb",
      confirmButtonText: "Sí, cerrar",
      cancelButtonText: "Cancelar",
    });
    if (!res.isConfirmed) return;
    setClosingId(id);
    try {
      await updateAlertaOperacion(id, { estatus: "CERRADA", fecha_cierre: new Date().toISOString() });
      await fetchData();
      setLiveFeedback({ tone: "success", message: "La alerta se cerró y la lista fue actualizada." });
      Swal.fire({ icon: "success", title: "Alerta cerrada", timer: 1200, showConfirmButton: false });
    } catch {
      setLiveFeedback({ tone: "error", message: "No se pudo cerrar la alerta seleccionada." });
      Swal.fire({ icon: "error", title: "Error", text: "No se pudo cerrar la alerta." });
    } finally {
      setClosingId(null);
    }
  }, [fetchData]);

  const handleDelete = useCallback(async (id: number) => {
    const res = await Swal.fire({
      title: "¿Eliminar esta alerta?",
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!res.isConfirmed) return;
    setDeletingId(id);
    try {
      await deleteAlertaOperacion(id);
      dispatch({ type: "REMOVE_BACKEND_ALERTA", id });
      setLiveFeedback({ tone: "success", message: "La alerta se eliminó del listado." });
    } catch {
      setLiveFeedback({ tone: "error", message: "No se pudo eliminar la alerta seleccionada." });
      Swal.fire({ icon: "error", title: "Error", text: "No se pudo eliminar." });
    } finally {
      setDeletingId(null);
    }
  }, []);

  const handleRefreshData = useCallback(async () => {
    await fetchData();
    setLiveFeedback({ tone: "info", message: "Los datos de alertas fueron actualizados." });
  }, [fetchData]);

  /* ── Checklist ── */
  const checklistDone = s.checkedItems.size;
  const checklistTotal = CHECKLIST_PREAUDITORIA.length;

  /* ── Loading ── */
  if (s.loading) {
    return (
      <DashboardShell>
        <div className="p-6">
          <DataCardsSkeleton cards={3} />
        </div>
      </DashboardShell>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */
  return (
    <DashboardShell>
    <div className="space-y-6 pb-12">
      {liveFeedback && (
        <div
          role={liveFeedback.tone === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            liveFeedback.tone === "error"
              ? "border-[rgba(160,67,61,0.22)] bg-[var(--fiscal-danger-soft)] text-[var(--fiscal-danger)]"
              : liveFeedback.tone === "success"
              ? "border-[rgba(31,122,90,0.22)] bg-[var(--fiscal-success-soft)] text-[var(--fiscal-success)]"
              : "border-[rgba(45,91,136,0.22)] bg-[var(--fiscal-accent-soft)] text-[var(--fiscal-accent)]"
          }`}
        >
          {liveFeedback.message}
        </div>
      )}

      {/* ── Header ── */}
      <div className="surface-panel-strong rounded-[1.75rem] p-6 shadow-fiscal">
        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div>
            <span className="kicker-label text-[var(--fiscal-danger)]">
              Reforma Fiscal 2026
            </span>
            <h1 className="mt-3 text-4xl font-display font-semibold text-[var(--fiscal-ink)] flex items-center gap-2">
              Alertas ESG y Pre-auditoría
              <AlertTriangle className="h-5 w-5 text-[var(--fiscal-muted)]" />
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--fiscal-muted)] sm:text-base">
              Alertas 69-B, operaciones sin materialidad, checklist de preparación y alertas de operación.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <div className="rounded-full border border-[rgba(160,67,61,0.22)] bg-[var(--fiscal-danger-soft)] px-3 py-2 text-xs font-semibold text-[var(--fiscal-danger)]">
                Riesgo fiscal y penal priorizado
              </div>
              <div className="rounded-full border border-[rgba(184,137,70,0.18)] bg-[rgba(184,137,70,0.10)] px-3 py-2 text-xs font-semibold text-[var(--fiscal-gold)]">
                Pre-auditoría y due diligence continuo
              </div>
            </div>
          </div>
          <div className="surface-shell rounded-[1.5rem] p-5 text-white">
            <p className="eyebrow-shell">Centro de contingencia</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-white">La pantalla debe decir qué amenaza existe, qué tan grave es y qué acción sigue</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-[rgba(216,211,200,0.78)]">
              Este módulo no es un inbox pasivo. Es una mesa de vigilancia para riesgo 69-B, faltantes críticos y preparación de auditoría.
            </p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <HelpGuide
                steps={[
                  "Atiende alertas CRÍTICAS primero: los proveedores EFOS DEFINITIVOS son contingencia fiscal inmediata.",
                  "Para alertas ALTO (PRESUNTO): crea un memo de análisis de riesgo firmado por compliance.",
                  "Completa el checklist pre-auditoría con los 10 puntos clave que el SAT revisará.",
                  "Revisa al menos 1 vez al mes — un proveedor puede aparecer en 69-B sin previo aviso.",
                ]}
                concepts={[
                  { term: "EFOS Definitivo", definition: "Proveedor publicado en el DOF como emisor de operaciones simuladas. Cualquier CFDI emitido es inválido para efectos fiscales." },
                  { term: "EDO — Reforma 2026", definition: "Empresa Que Deduce Operaciones Simuladas. La Reforma 2026 tipifica como delito penal al receptor que sabía que el CFDI era simulado." },
                  { term: "CSD (Art. 17-H Bis)", definition: "Certificado necesario para emitir CFDIs. El SAT puede restringirlo si detecta que recibes CFDIs de EFOS." },
                  { term: "Due diligence periódico", definition: "La Reforma 2026 exige validar trimestral o semestralmente a tus proveedores habituales contra las listas 69-B del SAT." },
                ]}
                tips={[
                  "Un EFOS DEFINITIVO en tu lista de proveedores activos es contingencia fiscal inmediata — actúa hoy.",
                  "La restricción del CSD puede ocurrir en 24-48 horas si el SAT detecta patrones de EFOS.",
                  "Guarda evidencia de tu due diligence (capturas SAT con fecha/hora) como principal defensa.",
                  "Revisa el checklist antes de cualquier auditoría, ACDO o carta-invitación del SAT.",
                ]}
              />
              <button
                onClick={() => void handleRefreshData()}
                disabled={s.loading}
                aria-disabled={s.loading}
                aria-busy={s.loading}
                className="button-institutional inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition"
              >
                <RefreshCw className={`h-4 w-4 ${s.loading ? "animate-spin" : ""}`} /> {s.loading ? "Actualizando…" : "Actualizar datos"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Emergency Banner ── */}
      {hasEmergency && (
        <div className="rounded-2xl border border-[rgba(160,67,61,0.22)] bg-[var(--fiscal-danger-soft)] p-4 flex items-start gap-3 shadow-panel">
          <div className="animate-pulse">
            <ShieldAlert className="h-6 w-6 text-[var(--fiscal-danger)] mt-0.5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--fiscal-danger)]">
              ¡Alertas Críticas Detectadas!
            </h3>
            <p className="text-sm text-[var(--fiscal-danger)] mt-1">
              Tienes {metrics.urgentes} alerta(s) de nivel CRÍTICO o ALTO.
              Los proveedores en listas 69-B representan riesgo penal bajo la Reforma 2026.
            </p>
          </div>
        </div>
      )}

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="Alertas fiscales"
          value={metrics.totalFiscales}
          sub={`${metrics.urgentes} urgentes`}
          color={metrics.urgentes > 0 ? "red" : "green"}
        />
        <Kpi
          label="Proveedores 69-B"
          value={metrics.provEnRiesgo}
          sub={`de ${s.proveedores.length} proveedores`}
          color={metrics.provEnRiesgo > 0 ? "red" : "green"}
        />
        <Kpi
          label="Alertas operación"
          value={s.backendAlertas.length}
          sub={`${metrics.backendActivas} activas · ${metrics.backendSeguimiento} seguimiento`}
          color={metrics.backendActivas > 0 ? "amber" : "gray"}
        />
        <Kpi
          label="Checklist SAT"
          value={`${checklistDone}/${checklistTotal}`}
          sub={checklistDone === checklistTotal ? "¡Completo!" : `${checklistTotal - checklistDone} pendientes`}
          color={checklistDone === checklistTotal ? "green" : "amber"}
        />
      </div>

      {/* ── Section: Alertas Fiscales (client-side generated) ── */}
      <Section
        badge="69-B / Materialidad"
        title="Alertas fiscales detectadas"
        defaultOpen
        alert={hasEmergency}
        right={
          <span className="rounded-full bg-[var(--fiscal-danger-soft)] px-2.5 py-0.5 text-xs font-bold text-[var(--fiscal-danger)]">
            {alertasFiscales.length}
          </span>
        }
      >
        {alertasFiscales.length === 0 ? (
          <InlineEmptyState
            icon={<CheckCircle className="h-6 w-6" />}
            title="Sin alertas activas"
            description="Todos los proveedores siguen sin coincidencia en listas SAT y las operaciones conservan materialidad básica."
          />
        ) : (
          <div className="space-y-3">
            {alertasFiscales.map((alerta) => {
              const st = NIVEL_STYLE[alerta.nivel];
              return (
                <div key={alerta.id} className={`rounded-2xl border p-4 ${st.border} ${st.bg} ${st.text}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className="mt-0.5 text-xl shrink-0">{st.icon}</span>
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${st.badge}`}>
                            {alerta.nivel}
                          </span>
                          <span className="text-[11px] font-semibold uppercase tracking-wider opacity-60">
                            {alerta.categoria}
                          </span>
                        </div>
                        <p className="text-sm font-semibold">{alerta.titulo}</p>
                        <p className="text-xs opacity-80">{alerta.detalle}</p>
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] opacity-50">{alerta.fecha}</span>
                  </div>
                  <div className="mt-3 rounded-xl border border-current/10 bg-white/50 px-3 py-2 text-xs font-medium">
                    <span className="mr-1 font-bold">→ Acción:</span>{alerta.accion}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ── Section: Backend Alertas de Operación ── */}
      {s.backendAlertas.length > 0 && (
          <Section badge="Operaciones" title="Alertas de operación (backend)" defaultOpen>
            <div aria-busy={s.loading} className="mb-4 rounded-2xl border border-[rgba(200,192,177,0.55)] bg-[rgba(244,242,237,0.62)] p-3">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_200px_auto] md:items-center">
            <div className="relative min-w-0 md:max-w-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fiscal-muted)]" />
              <input
                type="text"
                placeholder="Buscar por motivo, empresa, proveedor…"
                value={s.searchQ}
                onChange={(e) => dispatch({ type: "SET_SEARCH", payload: e.target.value })}
                className={inputCls + " pl-9"}
              />
            </div>
            <select
              value={s.filterEstatus}
              onChange={(e) => dispatch({ type: "SET_FILTER_ESTATUS", payload: e.target.value })}
              className={inputCls}
            >
              <option value="">Todos los estatus</option>
              <option value="ACTIVA">🔴 Activa</option>
              <option value="EN_SEGUIMIENTO">🟡 En seguimiento</option>
              <option value="CERRADA">🟢 Cerrada</option>
            </select>
            <select
              value={s.filterTipo}
              onChange={(e) => dispatch({ type: "SET_FILTER_TIPO", payload: e.target.value })}
              className={inputCls}
            >
              <option value="">Todos los tipos</option>
              <option value="FALTANTES_CRITICOS">Faltantes críticos</option>
              <option value="VENCIMIENTO_EVIDENCIA">Vencimiento evidencia</option>
            </select>
            {(s.filterEstatus || s.filterTipo || s.searchQ) && (
              <button
                onClick={() => { dispatch({ type: "SET_FILTER_ESTATUS", payload: "" }); dispatch({ type: "SET_FILTER_TIPO", payload: "" }); dispatch({ type: "SET_SEARCH", payload: "" }); }}
                className="inline-flex min-h-[42px] items-center justify-center gap-1 rounded-xl border border-[rgba(45,91,136,0.14)] bg-white px-3 text-xs font-semibold text-[var(--fiscal-accent)] hover:text-[var(--fiscal-accent)]/80"
              >
                <X className="h-3 w-3" /> Limpiar
              </button>
            )}
          </div>
          </div>

          {filteredBackend.length === 0 ? (
            <InlineEmptyState
              icon={<Search className="h-6 w-6" />}
              title="Sin resultados para estos filtros"
              description="Ajusta los filtros de estatus, tipo o búsqueda para volver a encontrar alertas de operación."
            />
          ) : (
            <div className="space-y-3">
              {filteredBackend.map((a) => (
                <div
                  key={a.id}
                  className={`rounded-2xl border p-4 transition shadow-panel hover:shadow-fiscal ${
                    a.estatus === "ACTIVA" ? "border-[rgba(160,67,61,0.22)] bg-[var(--fiscal-danger-soft)]/50" :
                    a.estatus === "EN_SEGUIMIENTO" ? "border-[rgba(166,103,31,0.22)] bg-[var(--fiscal-warning-soft)]/40" :
                    "border-[rgba(200,192,177,0.72)] bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge estatus={a.estatus} />
                        <span className="rounded-full bg-[rgba(255,255,255,0.72)] px-2 py-0.5 text-xs font-medium text-[var(--fiscal-muted)]">
                          {a.tipo_alerta === "FALTANTES_CRITICOS" ? "Faltantes críticos" : "Vencimiento evidencia"}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-sm">
                        <span className="font-semibold text-[var(--fiscal-ink)]">{a.empresa_nombre}</span>
                        {a.proveedor_nombre && (
                          <span className="text-xs text-[var(--fiscal-muted)]">Proveedor: {a.proveedor_nombre}</span>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm text-[var(--fiscal-muted)] line-clamp-2">{a.motivo}</p>
                      <span className="mt-1 inline-block text-xs text-[var(--fiscal-muted)]">
                        {new Date(a.fecha_alerta).toLocaleDateString("es-MX")}
                        {a.fecha_cierre && ` · Cerrada: ${new Date(a.fecha_cierre).toLocaleDateString("es-MX")}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {a.estatus !== "CERRADA" && (
                        <button
                          onClick={() => handleCloseAlerta(a.id)}
                          disabled={closingId === a.id}
                          aria-disabled={closingId === a.id}
                          aria-busy={closingId === a.id}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--fiscal-accent)] hover:bg-[var(--fiscal-accent-soft)] transition"
                        >
                          {closingId === a.id ? "Cerrando…" : "Cerrar"}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(a.id)}
                        disabled={deletingId === a.id}
                        aria-disabled={deletingId === a.id}
                        aria-busy={deletingId === a.id}
                        className="rounded-lg p-1.5 text-[var(--fiscal-muted)] hover:text-[var(--fiscal-danger)] hover:bg-[var(--fiscal-danger-soft)] transition"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ── Section: Checklist Pre-auditoría ── */}
      <Section
        badge="Preparación"
        title="Checklist pre-auditoría SAT — Reforma 2026"
        defaultOpen={false}
        right={
          <span className="text-sm font-bold text-slate-600">
            {checklistDone}<span className="text-slate-400">/{checklistTotal}</span>
          </span>
        }
      >
        <p className="mb-4 text-sm text-[var(--fiscal-muted)]">
          Los 10 puntos que el SAT revisará primero en cualquier auditoría de materialidad.
        </p>

        {/* Progress bar */}
        <div className="mb-5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-[rgba(200,192,177,0.72)]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${checklistDone === checklistTotal ? "bg-emerald-500" : "bg-amber-500"}`}
              style={{ width: `${(checklistDone / checklistTotal) * 100}%` }}
            />
          </div>
        </div>

        <div className="space-y-2">
          {CHECKLIST_PREAUDITORIA.map((item) => {
            const done = s.checkedItems.has(item.id);
            return (
              <label
                key={item.id}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${done
                  ? "border-[rgba(31,122,90,0.22)] bg-[var(--fiscal-success-soft)]"
                  : item.urgente
                    ? "border-[rgba(160,67,61,0.22)] bg-[var(--fiscal-danger-soft)]/60 hover:border-[rgba(160,67,61,0.32)]"
                    : "border-[rgba(200,192,177,0.72)] bg-[rgba(255,255,255,0.74)] hover:border-[rgba(200,192,177,0.9)]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => dispatch({ type: "TOGGLE_CHECK", id: item.id })}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-emerald-500"
                />
                <p className={`flex-1 text-sm ${done ? "text-[var(--fiscal-success)] line-through" : "text-[var(--fiscal-ink)]"}`}>
                  {item.texto}
                </p>
                {item.urgente && !done && (
                  <span className="shrink-0 rounded-full bg-[var(--fiscal-danger-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--fiscal-danger)] uppercase">
                    Urgente
                  </span>
                )}
                {done && <CheckCircle className="shrink-0 h-5 w-5 text-[var(--fiscal-success)]" />}
              </label>
            );
          })}
        </div>

        {checklistDone === checklistTotal && (
          <div className="mt-4 rounded-2xl border border-[rgba(31,122,90,0.22)] bg-[var(--fiscal-success-soft)] px-5 py-4 text-center">
            <p className="text-sm font-bold text-[var(--fiscal-success)]">
              🎉 ¡Checklist completo! Tu empresa está preparada para una auditoría de materialidad.
            </p>
            <p className="mt-1 text-xs text-[var(--fiscal-success)]">
              Recuerda revisar este checklist trimestralmente o ante cualquier carta-invitación del SAT.
            </p>
          </div>
        )}
      </Section>
    </div>
    </DashboardShell>
  );
}
