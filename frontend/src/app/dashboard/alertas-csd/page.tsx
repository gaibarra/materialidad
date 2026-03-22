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
  CheckCircle,
  ChevronDown,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import Swal from "sweetalert2";
import { useAuthContext } from "../../../context/AuthContext";
import {
  AlertaCSD,
  AlertaCSDPayload,
  getAlertasCSD,
  createAlertaCSD,
  updateAlertaCSD,
  deleteAlertaCSD,
} from "../../../lib/alerta-csd";
import { Proveedor, fetchProviders, fetchEmpresas, EmpresaLite } from "../../../lib/providers";
import HelpGuide from "../../../components/HelpGuide";
import { DataCardsSkeleton, InlineEmptyState } from "../../../components/DataState";
import { DashboardShell } from "../../../components/DashboardShell";

/* ═══════════════════════════════════════════════════════════
   Design-system tokens (alineados al resto de la app)
   ═══════════════════════════════════════════════════════════ */

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition";

const KPI_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  green: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  blue:  { bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-500" },
  amber: { bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-500" },
  red:   { bg: "bg-red-50",     text: "text-red-700",     dot: "bg-red-500" },
  gray:  { bg: "bg-slate-50",   text: "text-slate-500",   dot: "bg-slate-400" },
};

const STATUS_STYLE: Record<string, { bg: string; text: string; ring: string; label: string }> = {
  ACTIVA:     { bg: "bg-red-50",    text: "text-red-700",    ring: "ring-red-600/20",    label: "Activa" },
  ACLARACION: { bg: "bg-amber-50",  text: "text-amber-700",  ring: "ring-amber-600/20",  label: "Aclaración" },
  RESUELTA:   { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-600/20", label: "Resuelta" },
  REVOCADO:   { bg: "bg-slate-100", text: "text-slate-700",  ring: "ring-slate-500/20",  label: "Revocado" },
};

/* ═══════════════════════════════════════════════════════════
   Shared UI components
   ═══════════════════════════════════════════════════════════ */

function Kpi({ label, value, sub, color = "gray" }: { label: string; value: string | number; sub?: string; color?: string }) {
  const c = KPI_COLORS[color] ?? KPI_COLORS.gray;
  return (
    <div className={`rounded-2xl ${c.bg} px-5 py-4 flex flex-col gap-1 min-w-0`}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
        <span className={`inline-block h-2 w-2 rounded-full ${c.dot}`} />
        {label}
      </span>
      <span className={`text-2xl font-extrabold ${c.text} truncate`}>{value}</span>
      {sub && <span className="text-xs text-slate-500 truncate">{sub}</span>}
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
    <section className={`rounded-3xl border ${alertStyle ? "border-red-200 bg-red-50/30" : "border-slate-100 bg-white"} shadow-2xl shadow-slate-200/60 overflow-hidden`}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => e.key === "Enter" && setOpen((v) => !v)}
        className="flex items-center justify-between px-6 py-4 cursor-pointer select-none"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div>
            {badge && (
              <span className={`text-[11px] font-bold uppercase tracking-widest ${alertStyle ? "text-red-500" : "text-blue-500"}`}>
                {badge}
              </span>
            )}
            <h2 className="text-lg font-bold text-slate-800 leading-tight">{title}</h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {right}
          <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${open ? "" : "-rotate-90"}`} />
        </div>
      </div>
      {open && <div className="px-6 pb-6">{children}</div>}
    </section>
  );
}

function StatusBadge({ estatus }: { estatus: string }) {
  const s = STATUS_STYLE[estatus] ?? STATUS_STYLE.REVOCADO;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${s.bg} ${s.text} ${s.ring}`}>
      {s.label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════
   Reducer
   ═══════════════════════════════════════════════════════════ */

type State = {
  alertas: AlertaCSD[];
  empresas: EmpresaLite[];
  proveedores: Proveedor[];
  selectedEmpresa: number | null;
  loading: boolean;
  filterEstatus: string;
  filterTipo: string;
  searchQ: string;
  showForm: boolean;
  editingId: number | null;
  formData: AlertaCSDPayload;
  saving: boolean;
};

const defaultForm = (empresaId: number): AlertaCSDPayload => ({
  empresa: empresaId,
  tipo_alerta: "PROPIETARIO",
  estatus: "ACTIVA",
  fecha_deteccion: new Date().toISOString().split("T")[0],
  proveedor: null,
  oficio_sat: "",
  motivo_presuncion: "",
  acciones_tomadas: "",
});

const init: State = {
  alertas: [],
  empresas: [],
  proveedores: [],
  selectedEmpresa: null,
  loading: true,
  filterEstatus: "",
  filterTipo: "",
  searchQ: "",
  showForm: false,
  editingId: null,
  formData: defaultForm(0),
  saving: false,
};

type Action =
  | { type: "SET_EMPRESAS"; payload: EmpresaLite[] }
  | { type: "SET_EMPRESA"; payload: number }
  | { type: "SET_DATA"; alertas: AlertaCSD[]; proveedores: Proveedor[] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_FILTER_ESTATUS"; payload: string }
  | { type: "SET_FILTER_TIPO"; payload: string }
  | { type: "SET_SEARCH"; payload: string }
  | { type: "OPEN_NEW" }
  | { type: "OPEN_EDIT"; alerta: AlertaCSD }
  | { type: "CLOSE_FORM" }
  | { type: "UPDATE_FORM"; payload: Partial<AlertaCSDPayload> }
  | { type: "SET_SAVING"; payload: boolean };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "SET_EMPRESAS": {
      const first = a.payload[0]?.id ?? null;
      return { ...s, empresas: a.payload, selectedEmpresa: first, formData: defaultForm(first ?? 0) };
    }
    case "SET_EMPRESA":
      return { ...s, selectedEmpresa: a.payload, formData: { ...s.formData, empresa: a.payload } };
    case "SET_DATA":
      return { ...s, alertas: a.alertas, proveedores: a.proveedores, loading: false };
    case "SET_LOADING":
      return { ...s, loading: a.payload };
    case "SET_FILTER_ESTATUS":
      return { ...s, filterEstatus: a.payload };
    case "SET_FILTER_TIPO":
      return { ...s, filterTipo: a.payload };
    case "SET_SEARCH":
      return { ...s, searchQ: a.payload };
    case "OPEN_NEW":
      return { ...s, showForm: true, editingId: null, formData: defaultForm(s.selectedEmpresa ?? 0) };
    case "OPEN_EDIT":
      return {
        ...s,
        showForm: true,
        editingId: a.alerta.id,
        formData: {
          empresa: a.alerta.empresa,
          tipo_alerta: a.alerta.tipo_alerta,
          estatus: a.alerta.estatus,
          fecha_deteccion: a.alerta.fecha_deteccion,
          fecha_resolucion: a.alerta.fecha_resolucion || "",
          proveedor: a.alerta.proveedor,
          oficio_sat: a.alerta.oficio_sat || "",
          motivo_presuncion: a.alerta.motivo_presuncion || "",
          acciones_tomadas: a.alerta.acciones_tomadas || "",
        },
      };
    case "CLOSE_FORM":
      return { ...s, showForm: false, editingId: null };
    case "UPDATE_FORM":
      return { ...s, formData: { ...s.formData, ...a.payload } };
    case "SET_SAVING":
      return { ...s, saving: a.payload };
    default:
      return s;
  }
}

/* ═══════════════════════════════════════════════════════════
   Page component
   ═══════════════════════════════════════════════════════════ */

export default function AlertaCSDPage() {
  const { user } = useAuthContext();
  const [s, dispatch] = useReducer(reducer, init);
  const formRef = useRef<HTMLDivElement>(null);
  const [liveFeedback, setLiveFeedback] = useState<{ tone: "success" | "error" | "info"; message: string } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  /* ── Data loading ── */
  const fetchData = useCallback(async (empresaId: number) => {
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const [alertas, provs] = await Promise.all([
        getAlertasCSD(empresaId),
        fetchProviders(),
      ]);
      const provList = Array.isArray(provs) ? provs : (provs as any).results ?? [];
      const alertaList = Array.isArray(alertas) ? alertas : (alertas as any).results ?? [];
      dispatch({ type: "SET_DATA", alertas: alertaList as AlertaCSD[], proveedores: provList });
    } catch (e) {
      console.error("Error cargando Alertas CSD", e);
      setLiveFeedback({ tone: "error", message: "No se pudieron cargar las contingencias CSD." });
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const emps = await fetchEmpresas();
        dispatch({ type: "SET_EMPRESAS", payload: emps });
      } catch {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    })();
  }, []);

  useEffect(() => {
    if (s.selectedEmpresa) fetchData(s.selectedEmpresa);
  }, [s.selectedEmpresa, fetchData]);

  /* ── Computed values ── */
  const metrics = useMemo(() => {
    const total = s.alertas.length;
    const activas = s.alertas.filter((a) => a.estatus === "ACTIVA").length;
    const aclaracion = s.alertas.filter((a) => a.estatus === "ACLARACION").length;
    const resueltas = s.alertas.filter((a) => a.estatus === "RESUELTA").length;
    const revocados = s.alertas.filter((a) => a.estatus === "REVOCADO").length;
    return { total, activas, aclaracion, resueltas, revocados };
  }, [s.alertas]);

  const hasEmergency = metrics.activas > 0 || metrics.revocados > 0;

  const filtered = useMemo(() => {
    let list = [...s.alertas];
    if (s.filterEstatus) list = list.filter((a) => a.estatus === s.filterEstatus);
    if (s.filterTipo) list = list.filter((a) => a.tipo_alerta === s.filterTipo);
    if (s.searchQ) {
      const q = s.searchQ.toLowerCase();
      list = list.filter(
        (a) =>
          a.oficio_sat?.toLowerCase().includes(q) ||
          a.motivo_presuncion?.toLowerCase().includes(q) ||
          a.acciones_tomadas?.toLowerCase().includes(q) ||
          a.empresa_nombre?.toLowerCase().includes(q) ||
          a.proveedor_nombre?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [s.alertas, s.filterEstatus, s.filterTipo, s.searchQ]);

  /* ── Actions ── */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!s.selectedEmpresa) return;
      dispatch({ type: "SET_SAVING", payload: true });
      try {
        const payload = { ...s.formData };
        if (payload.tipo_alerta === "PROPIETARIO") payload.proveedor = null;
        if (!payload.fecha_resolucion) delete payload.fecha_resolucion;
        if (s.editingId) {
          await updateAlertaCSD(s.editingId, payload);
        } else {
          await createAlertaCSD(payload);
        }
        dispatch({ type: "CLOSE_FORM" });
        setLiveFeedback({ tone: "success", message: s.editingId ? "Contingencia actualizada." : "Contingencia registrada." });
        await Swal.fire({ icon: "success", title: s.editingId ? "Actualizado" : "Registrado", timer: 1200, showConfirmButton: false });
        fetchData(s.selectedEmpresa);
      } catch {
        setLiveFeedback({ tone: "error", message: "No se pudo guardar la contingencia CSD." });
        Swal.fire({ icon: "error", title: "Error", text: "No se pudo guardar la contingencia." });
      } finally {
        dispatch({ type: "SET_SAVING", payload: false });
      }
    },
    [s.formData, s.editingId, s.selectedEmpresa, fetchData]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      const res = await Swal.fire({
        title: "¿Eliminar esta contingencia?",
        text: "Esta acción no se puede deshacer.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#ef4444",
        confirmButtonText: "Sí, eliminar",
        cancelButtonText: "Cancelar",
      });
      if (!res.isConfirmed || !s.selectedEmpresa) return;
      try {
        setDeletingId(id);
        await deleteAlertaCSD(id);
        setLiveFeedback({ tone: "success", message: "Contingencia eliminada." });
        fetchData(s.selectedEmpresa);
      } catch {
        setLiveFeedback({ tone: "error", message: "No se pudo eliminar la contingencia CSD." });
        Swal.fire({ icon: "error", title: "Error", text: "No se pudo eliminar." });
      } finally {
        setDeletingId(null);
      }
    },
    [s.selectedEmpresa, fetchData]
  );

  /* ── Loading state ── */
  if (s.loading) {
    return (
      <DashboardShell>
        <div className="p-6">
          <DataCardsSkeleton cards={3} />
        </div>
      </DashboardShell>
    );
  }

  const fv = s.formData;
  const fd = (k: keyof AlertaCSDPayload, v: any) => dispatch({ type: "UPDATE_FORM", payload: { [k]: v } });

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */

  return (
    <DashboardShell>
    <div className="space-y-6 pb-12">
      {/* ── Header ── */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl shadow-slate-200/60">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-blue-500">
              Control y Defensa Fiscal
            </span>
            <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
              Contingencias CSD
              <ShieldAlert className="h-5 w-5 text-slate-400" />
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Gestión y seguimiento de bloqueos de Sellos Digitales (Art. 17-H Bis CFF).
            </p>
          </div>

          <div className="flex items-center gap-3">
            {s.empresas.length > 1 && (
              <select
                value={s.selectedEmpresa ?? ""}
                onChange={(e) => dispatch({ type: "SET_EMPRESA", payload: Number(e.target.value) })}
                className={inputCls + " max-w-[200px]"}
              >
                {s.empresas.map((e) => (
                  <option key={e.id} value={e.id}>{e.razon_social}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => { dispatch({ type: "OPEN_NEW" }); setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 100); }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 transition"
            >
              <Plus className="h-4 w-4" /> Registrar contingencia
            </button>
          </div>
        </div>

        {liveFeedback && (
          <div
            role={liveFeedback.tone === "error" ? "alert" : "status"}
            aria-live={liveFeedback.tone === "error" ? "assertive" : "polite"}
            className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
              liveFeedback.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : liveFeedback.tone === "error"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-blue-200 bg-blue-50 text-blue-700"
            }`}
          >
            {liveFeedback.message}
          </div>
        )}

        {/* Guide */}
        <div className="mt-4">
          <HelpGuide
            steps={[
              "Detectar la restricción temporal del CSD vía Buzón Tributario o al intentar timbrar.",
              "Presentar Solicitud de Aclaración en Buzón Tributario de inmediato (el SAT reactiva el sello al día hábil siguiente).",
              "Aportar evidencia de materialidad en los 10 días hábiles siguientes (contratos, entregables, EXIF, transferencias).",
              "Monitorear requerimientos adicionales del SAT y anotar cada avance en la bitácora.",
            ]}
            concepts={[
              { term: "Art. 17-H Bis CFF", definition: "Restricción temporal de CSD por presuntas irregularidades. Permite defensa sin revocación inmediata." },
              { term: "Aclaración en Buzón", definition: "Medio oficial para contestar al SAT. Al ingresar, el CSD se reactiva temporalmente." },
              { term: "Materialidad", definition: "Evidencia documental que demuestra la sustancia económica de las operaciones cuestionadas." },
              { term: "Revocación (Art. 17-H)", definition: "Cancelación definitiva del CSD. Distinta de la restricción temporal del 17-H Bis." },
            ]}
            tips={[
              "Registra la alerta aquí el mismo día que la detectes para mantener trazabilidad.",
              "Usa la bitácora de acciones como diario de seguimiento con fechas específicas.",
              "Vincula las evidencias del módulo de Expedientes para armar tu dossier de defensa.",
              "Si el estatus cambia a REVOCADO, escala a asesor fiscal externo inmediatamente.",
            ]}
          />
        </div>
      </div>

      {/* ── Emergency banner ── */}
      {hasEmergency && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <div className="animate-pulse">
            <ShieldAlert className="h-6 w-6 text-red-500 mt-0.5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-red-800">
              ¡Alerta Crítica! CSD en Riesgo o Suspendido
            </h3>
            <p className="text-sm text-red-700 mt-1">
              Tienes {metrics.activas > 0 ? `${metrics.activas} alerta(s) ACTIVA(s)` : ""}
              {metrics.activas > 0 && metrics.revocados > 0 ? " y " : ""}
              {metrics.revocados > 0 ? `${metrics.revocados} CSD REVOCADO(s)` : ""}.
              El plazo para aclaración es inmediato para evitar el cese de facturación.
            </p>
          </div>
        </div>
      )}

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Total alertas" value={metrics.total} sub={`${s.alertas.filter(a => a.tipo_alerta === "PROPIETARIO").length} propias · ${s.alertas.filter(a => a.tipo_alerta === "PROVEEDOR").length} proveedores`} color="gray" />
        <Kpi label="Activas" value={metrics.activas} sub={metrics.activas > 0 ? "Requieren acción inmediata" : "Sin bloqueos"} color={metrics.activas > 0 ? "red" : "green"} />
        <Kpi label="En aclaración" value={metrics.aclaracion} sub="En proceso ante el SAT" color={metrics.aclaracion > 0 ? "amber" : "gray"} />
        <Kpi label="Resueltas" value={metrics.resueltas} sub="CSD reactivado" color={metrics.resueltas > 0 ? "green" : "gray"} />
      </div>

      {/* ── Section: Registrar / Editar ── */}
      {s.showForm && (
        <div ref={formRef}>
          <Section
            badge={s.editingId ? "Editar registro" : "Nuevo registro"}
            title={s.editingId ? "Actualizar contingencia" : "Registrar nueva contingencia"}
            defaultOpen
          >
            <form onSubmit={handleSubmit} aria-busy={s.saving} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Tipo */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de restricción</label>
                  <select value={fv.tipo_alerta} onChange={(e) => fd("tipo_alerta", e.target.value)} className={inputCls}>
                    <option value="PROPIETARIO">CSD Propio (empresa)</option>
                    <option value="PROVEEDOR">CSD de proveedor clave</option>
                  </select>
                </div>

                {/* Proveedor (condicional) */}
                {fv.tipo_alerta === "PROVEEDOR" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Proveedor afectado</label>
                    <select
                      required
                      value={fv.proveedor ?? ""}
                      onChange={(e) => fd("proveedor", Number(e.target.value))}
                      className={inputCls}
                    >
                      <option value="">Selecciona un proveedor…</option>
                      {s.proveedores.map((p) => (
                        <option key={p.id} value={p.id}>{p.razon_social} ({p.rfc})</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Estatus */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Estatus legal</label>
                  <select value={fv.estatus} onChange={(e) => fd("estatus", e.target.value)} className={inputCls}>
                    <option value="ACTIVA">🔴 Activa (bloqueo total)</option>
                    <option value="ACLARACION">🟡 Aclaración (en buzón)</option>
                    <option value="RESUELTA">🟢 Resuelta (CSD reactivado)</option>
                    <option value="REVOCADO">⚫ Revocado (cancelación)</option>
                  </select>
                </div>

                {/* Fechas */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha de detección</label>
                  <input type="date" required value={fv.fecha_deteccion} onChange={(e) => fd("fecha_deteccion", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha de resolución</label>
                  <input type="date" value={fv.fecha_resolucion || ""} onChange={(e) => fd("fecha_resolucion", e.target.value)} className={inputCls} />
                </div>

                {/* Oficio SAT */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Número de oficio (SAT)</label>
                  <input type="text" placeholder="Ej. 500-05-2026-10293" value={fv.oficio_sat || ""} onChange={(e) => fd("oficio_sat", e.target.value)} className={inputCls + " font-mono"} />
                </div>
              </div>

              {/* Textos largos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Motivo de presunción</label>
                  <textarea rows={3} placeholder="Fracción del 17-H Bis invocada y detalles…" value={fv.motivo_presuncion || ""} onChange={(e) => fd("motivo_presuncion", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Bitácora de acciones</label>
                  <textarea rows={3} placeholder="24-Feb: Presentación en Buzón.&#10;25-Feb: Ingreso de evidencias…" value={fv.acciones_tomadas || ""} onChange={(e) => fd("acciones_tomadas", e.target.value)} className={inputCls} />
                </div>
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => dispatch({ type: "CLOSE_FORM" })} disabled={s.saving} aria-disabled={s.saving} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
                  Cancelar
                </button>
                <button type="submit" disabled={s.saving} aria-disabled={s.saving} aria-busy={s.saving} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition disabled:opacity-50">
                  {s.saving && <RefreshCw className="mr-2 inline h-4 w-4 animate-spin" />}
                  {s.saving ? "Guardando…" : s.editingId ? "Guardar cambios" : "Crear registro"}
                </button>
              </div>
            </form>
          </Section>
        </div>
      )}

      {/* ── Section: Alertas ── */}
      <Section badge="Bitácora" title="Contingencias registradas" defaultOpen>
        {/* Filtros */}
        <div className="mb-4 rounded-2xl border border-slate-200 bg-[rgba(244,242,237,0.52)] p-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_auto] md:items-center">
          <div className="relative min-w-0 md:max-w-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por oficio, motivo, acciones…"
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
            <option value="ACLARACION">🟡 Aclaración</option>
            <option value="RESUELTA">🟢 Resuelta</option>
            <option value="REVOCADO">⚫ Revocado</option>
          </select>
          <select
            value={s.filterTipo}
            onChange={(e) => dispatch({ type: "SET_FILTER_TIPO", payload: e.target.value })}
            className={inputCls}
          >
            <option value="">Todos los tipos</option>
            <option value="PROPIETARIO">CSD Propio</option>
            <option value="PROVEEDOR">CSD Proveedor</option>
          </select>
          {(s.filterEstatus || s.filterTipo || s.searchQ) && (
            <button
              onClick={() => { dispatch({ type: "SET_FILTER_ESTATUS", payload: "" }); dispatch({ type: "SET_FILTER_TIPO", payload: "" }); dispatch({ type: "SET_SEARCH", payload: "" }); }}
              className="inline-flex min-h-[42px] items-center justify-center gap-1 rounded-xl border border-blue-100 bg-white px-3 text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              <X className="h-3 w-3" /> Limpiar filtros
            </button>
          )}
        </div>
        </div>

        {/* Cards */}
        {filtered.length === 0 ? (
          <InlineEmptyState
            icon={<CheckCircle className="h-6 w-6" />}
            title={s.alertas.length === 0 ? "Sin contingencias registradas" : "Sin resultados"}
            description={s.alertas.length === 0
              ? "No hay bloqueos de CSD en esta empresa. La bitácora legal está limpia por ahora."
              : "Ajusta los filtros para volver a ver contingencias relevantes."
            }
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((a) => (
              <div
                key={a.id}
                className={`rounded-2xl border p-4 transition hover:shadow-md ${
                  a.estatus === "ACTIVA" ? "border-red-200 bg-red-50/40" :
                  a.estatus === "REVOCADO" ? "border-slate-300 bg-slate-50" :
                  a.estatus === "ACLARACION" ? "border-amber-200 bg-amber-50/30" :
                  "border-slate-100 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge estatus={a.estatus} />
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {a.tipo_alerta === "PROPIETARIO" ? "CSD Propio" : "CSD Proveedor"}
                      </span>
                      {a.oficio_sat && (
                        <span className="text-xs font-mono text-slate-500">
                          Oficio: {a.oficio_sat}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex items-center gap-4 text-sm">
                      <span className="font-semibold text-slate-800">
                        {a.tipo_alerta === "PROPIETARIO" ? a.empresa_nombre : (a.proveedor_nombre || "—")}
                      </span>
                      <span className="text-xs text-slate-400">
                        Detectada: {a.fecha_deteccion}
                        {a.fecha_resolucion && ` · Resuelta: ${a.fecha_resolucion}`}
                      </span>
                    </div>

                    {a.motivo_presuncion && (
                      <p className="mt-1.5 text-sm text-slate-600 line-clamp-2">{a.motivo_presuncion}</p>
                    )}
                    {a.acciones_tomadas && (
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                        <span className="font-semibold">Acciones:</span> {a.acciones_tomadas}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => dispatch({ type: "OPEN_EDIT", alerta: a })}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      disabled={deletingId === a.id}
                      aria-disabled={deletingId === a.id}
                      aria-busy={deletingId === a.id}
                      className="rounded-lg p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-50"
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
    </div>
    </DashboardShell>
  );
}
