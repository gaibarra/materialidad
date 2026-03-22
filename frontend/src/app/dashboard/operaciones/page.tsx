"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { DashboardShell } from "../../../components/DashboardShell";
import { GuiaContador } from "../../../components/GuiaContador";
import { SemaforoMaterialidad } from "../../../components/SemaforoMaterialidad";
import { RiskBadge } from "../../../components/RiskBadge";
import { CadenaDocumental } from "../../../components/CadenaDocumental";
import { RequisitoCombobox } from "../../../components/RequisitoCombobox";
import { PasteUrlField } from "../../../components/PasteUrlField";
import { useAuthContext } from "../../../context/AuthContext";
import { alertError, alertSuccess } from "../../../lib/alerts";
import {
  AlertTriangle,
  Bell,
  ClipboardList,
  Landmark,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Wallet,
} from "lucide-react";
import Swal from "sweetalert2";
import {
  createOperacionEntregable,
  fetchOperacionEntregables,
  fetchOperacionChecklists,
  fetchOperaciones,
  fetchAlertasOperacion,
  fetchMatrizMaterialidad,
  fetchBandejaRevision,
  mapRequirementToEntregable,
  Operacion,
  OperacionChecklist,
  OperacionEntregable,
  OperacionEntregablePayload,
  updateOperacionEntregable,
  updateOperacionChecklistItem,
  updateOperacion,
  deleteOperacion,
  cambiarOperacionEstatus,
  exportOperacionDossier,
  exportOperacionDefensaPdf,
  createOperacion,
  OperacionPayload,
  AlertaOperacion,
  MatrizMaterialidadItem,
  BandejaRevisionItem,
} from "../../../lib/operaciones";
import { apiFetch } from "../../../lib/api";
import { type Proveedor } from "../../../lib/providers";
import { DeliverableRequirement, fetchDeliverableRequirements } from "../../../lib/checklists";

/* ──────────────────────── Constants & Helpers ──────────────────────── */

const ESTADO_STYLES: Record<OperacionEntregable["estado"], string> = {
  PENDIENTE: "bg-slate-100 text-slate-600 border-slate-200",
  EN_PROCESO: "bg-amber-50 text-amber-700 border-amber-200",
  ENTREGADO: "bg-blue-50 text-blue-700 border-blue-200",
  RECIBIDO: "bg-emerald-50 text-emerald-700 border-emerald-200",
  FACTURADO: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

const VALIDACION_STYLES: Record<string, string> = {
  PENDIENTE: "bg-slate-100 text-slate-600 border-slate-200",
  EN_PROCESO: "bg-amber-50 text-amber-700 border-amber-200",
  COMPLETO: "bg-emerald-50 text-emerald-700 border-emerald-200",
  VALIDADO: "bg-emerald-50 text-emerald-700 border-emerald-200",
  RECHAZADO: "bg-red-50 text-red-700 border-red-200",
};

const TIPO_STYLES: Record<string, string> = {
  COMPRA: "bg-blue-50 text-blue-700",
  SERVICIO: "bg-purple-50 text-purple-700",
  ARRENDAMIENTO: "bg-amber-50 text-amber-700",
  OTRO: "bg-slate-100 text-slate-600",
};

const estadosOrden = ["PENDIENTE", "EN_PROCESO", "ENTREGADO", "RECIBIDO", "FACTURADO"] as const;

type ViewTab = "operaciones" | "bandeja";
type OperacionPanelTab = "detalle" | "cumplimiento" | "entregable";

const emptyForm: OperacionEntregablePayload = {
  operacion: 0,
  requirement: null,
  titulo: "",
  descripcion: "",
  tipo_gasto: "",
  codigo: "",
  pillar: "ENTREGABLES",
  requerido: true,
  fecha_compromiso: "",
  oc_numero: "",
  oc_fecha: "",
  oc_archivo_url: "",
  comentarios: "",
};

const formatCurrency = (value: string, currency: string) =>
  Number(value).toLocaleString("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });

const today = () => new Date().toISOString().slice(0, 10);

function formatDate(value?: string | null) {
  if (!value) return "Sin registro";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric" });
}

/* ──────────────────────── Inline Components ──────────────────────── */

function Badge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] ${className || "bg-slate-100 text-slate-600 border-slate-200"}`}>
      {label}
    </span>
  );
}

function KpiCard({
  label,
  value,
  icon,
  accent,
  surface,
  valueClassName,
  className,
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
  accent?: string;
  surface?: string;
  valueClassName?: string;
  className?: string;
}) {
  return (
    <div className={`surface-panel rounded-panel p-4 ${surface || ""} ${className || ""}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[rgba(255,255,255,0.72)] text-[var(--fiscal-accent)] shadow-panel">
          {icon}
        </div>
        <div className="min-w-0">
          <p className={`font-display text-3xl font-semibold leading-none tracking-tight tabular-nums ${accent || "text-[var(--fiscal-ink)]"} ${valueClassName || ""}`}>{value}</p>
          <p className="truncate text-xs text-[var(--fiscal-muted)]">{label}</p>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────── Main Page ──────────────────────── */

export default function OperacionesPage() {
  const { isAuthenticated, user } = useAuthContext();

  /* ── Core state ── */
  const [operaciones, setOperaciones] = useState<Operacion[]>([]);
  const [empresas, setEmpresas] = useState<Array<{ id: number; razon_social: string }>>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [contratos, setContratos] = useState<{ id: number; nombre: string }[]>([]);
  const [requisitos, setRequisitos] = useState<DeliverableRequirement[]>([]);
  const [loading, setLoading] = useState(false);

  /* ── Selection & UI state ── */
  const [selectedOperacionId, setSelectedOperacionId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("TODOS");
  const [filterEstatus, setFilterEstatus] = useState<string>("TODOS");
  const [activeTab, setActiveTab] = useState<ViewTab>("operaciones");
  const [operacionPanelTab, setOperacionPanelTab] = useState<OperacionPanelTab>("detalle");

  /* ── Entregables ── */
  const [entregables, setEntregables] = useState<OperacionEntregable[]>([]);
  const [operacionChecklists, setOperacionChecklists] = useState<OperacionChecklist[]>([]);
  const [form, setForm] = useState<OperacionEntregablePayload>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [changingStatusId, setChangingStatusId] = useState<number | null>(null);
  const [updatingChecklistItemId, setUpdatingChecklistItemId] = useState<number | null>(null);
  const [advancingEntregableId, setAdvancingEntregableId] = useState<number | null>(null);
  const [liveFeedback, setLiveFeedback] = useState<{ tone: "success" | "error" | "info"; message: string } | null>(null);
  const [evidencias, setEvidencias] = useState<Record<number, string>>({});
  const [firmas, setFirmas] = useState<Record<number, { por: string; email: string }>>({});

  /* ── Modal ── */
  const [showModal, setShowModal] = useState(false);
  const [creatingOp, setCreatingOp] = useState(false);
  const [editingOperacionId, setEditingOperacionId] = useState<number | null>(null);
  const [opFieldErrors, setOpFieldErrors] = useState<Record<string, string>>({});
  const [newOpForm, setNewOpForm] = useState<OperacionPayload>({
    empresa: 0,
    proveedor: 0,
    contrato: null,
    uuid_cfdi: "",
    monto: "",
    moneda: "MXN",
    fecha_operacion: today(),
    tipo_operacion: "COMPRA",
    concepto: "",
  });

  /* ── Export ── */
  const [exportingId, setExportingId] = useState<number | null>(null);

  /* ── Concept suggestions ── */
  const [updatingConceptId, setUpdatingConceptId] = useState<number | null>(null);

  /* ── Alertas ── */
  const [alertas, setAlertas] = useState<AlertaOperacion[]>([]);

  /* ── Bandeja de revision ── */
  const [bandejaItems, setBandejaItems] = useState<BandejaRevisionItem[]>([]);
  const [bandejaRol, setBandejaRol] = useState<string>("TODOS");
  const [bandejaRiesgo, setBandejaRiesgo] = useState<string>("TODOS");
  const [bandejaSearchQuery, setBandejaSearchQuery] = useState("");

  /* ── Cadena documental ── */
  const [matrizItems, setMatrizItems] = useState<MatrizMaterialidadItem[]>([]);

  /* ── Derived data ── */
  const selectedOperacion = useMemo(
    () => operaciones.find((op) => op.id === selectedOperacionId) ?? null,
    [operaciones, selectedOperacionId]
  );

  const filteredOperaciones = useMemo(() => {
    return operaciones.filter((op) => {
      if (filterTipo !== "TODOS" && op.tipo_operacion !== filterTipo) return false;
      if (filterEstatus !== "TODOS" && op.estatus_validacion !== filterEstatus) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match =
          op.proveedor_nombre?.toLowerCase().includes(q) ||
          op.empresa_nombre?.toLowerCase().includes(q) ||
          op.concepto?.toLowerCase().includes(q) ||
          op.cfdi_estatus?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [operaciones, filterTipo, filterEstatus, searchQuery]);

  const kpis = useMemo(() => {
    const total = operaciones.length;
    const pendientes = operaciones.filter((o) => o.estatus_validacion === "PENDIENTE").length;
    const alertasActivas = alertas.filter((a) => a.estatus === "ACTIVA").length;
    const riesgoAlto = operaciones.filter((o) => o.riesgo_nivel === "ALTO").length;
    const montoTotal = operaciones.reduce((sum, o) => sum + Number(o.monto || 0), 0);
    return { total, pendientes, alertasActivas, riesgoAlto, montoTotal };
  }, [operaciones, alertas]);

  const selectedMatriz = useMemo(
    () => matrizItems.find((m) => m.id === selectedOperacionId) ?? null,
    [matrizItems, selectedOperacionId]
  );

  const selectedAlertas = useMemo(
    () => alertas.filter((a) => a.operacion === selectedOperacionId),
    [alertas, selectedOperacionId]
  );

  const filteredBandejaItems = useMemo(() => {
    if (!bandejaSearchQuery.trim()) return bandejaItems;
    const query = bandejaSearchQuery.toLowerCase();
    return bandejaItems.filter((item) => {
      return (
        item.proveedor_nombre?.toLowerCase().includes(query) ||
        item.empresa_nombre?.toLowerCase().includes(query) ||
        item.concepto?.toLowerCase().includes(query) ||
        item.proveedor_rfc?.toLowerCase().includes(query) ||
        item.empresa_rfc?.toLowerCase().includes(query)
      );
    });
  }, [bandejaItems, bandejaSearchQuery]);

  const isAdmin = Boolean(user?.is_staff || user?.is_superuser);

  /* ── Data loading ── */
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [ops, reqs, empresasData, provsData, contsData] = await Promise.all([
        fetchOperaciones(),
        fetchDeliverableRequirements(),
        apiFetch<any>("/api/materialidad/empresas/"),
        apiFetch<any>("/api/materialidad/proveedores/"),
        apiFetch<any>("/api/materialidad/contratos/"),
      ]);
      const empresasList = Array.isArray(empresasData) ? empresasData : empresasData?.results ?? [];
      setOperaciones(ops);
      setRequisitos(reqs);
      setEmpresas(empresasList);
      setProveedores(Array.isArray(provsData) ? provsData : provsData?.results ?? []);
      setContratos(Array.isArray(contsData) ? contsData : contsData?.results ?? []);
      if (empresasList[0]?.id) {
        setNewOpForm((prev) => ({ ...prev, empresa: prev.empresa || empresasList[0].id }));
      }

      // Load secondary data in parallel (non-blocking)
      const [alertasRes, matrizRes] = await Promise.all([
        fetchAlertasOperacion({ estatus: "ACTIVA" }).catch(() => ({ results: [] as AlertaOperacion[], count: 0, next: null, previous: null })),
        fetchMatrizMaterialidad().catch(() => ({ results: [] as MatrizMaterialidadItem[], count: 0, next: null, previous: null })),
      ]);
      setAlertas(alertasRes.results ?? []);
      setMatrizItems(matrizRes.results ?? []);

      const primera = ops[0]?.id ?? null;
      setSelectedOperacionId(primera);
      if (primera) {
        setForm((prev) => ({ ...prev, operacion: primera }));
        await loadEntregables(primera);
        await loadOperacionChecklists(primera);
      }
    } catch (err) {
      void alertError("No pudimos cargar operaciones", (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBandeja = useCallback(async () => {
    try {
      const params: any = {};
      if (bandejaRol !== "TODOS") params.rol = bandejaRol;
      if (bandejaRiesgo !== "TODOS") params.riesgo = bandejaRiesgo;
      const res = await fetchBandejaRevision(params);
      setBandejaItems(res.results ?? []);
    } catch {
      setBandejaItems([]);
    }
  }, [bandejaRol, bandejaRiesgo]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadInitialData();
  }, [isAuthenticated, loadInitialData]);

  useEffect(() => {
    if (activeTab === "bandeja") void loadBandeja();
  }, [activeTab, loadBandeja]);

  /* ── Entregables helpers ── */
  const loadEntregables = async (operacionId: number) => {
    try {
      const data = await fetchOperacionEntregables(operacionId);
      setEntregables(data);
      setEvidencias(
        data.reduce<Record<number, string>>((acc, item) => {
          acc[item.id] = item.oc_archivo_url || "";
          return acc;
        }, {})
      );
      setFirmas(
        data.reduce<Record<number, { por: string; email: string }>>((acc, item) => {
          acc[item.id] = { por: item.recepcion_firmado_por || "", email: item.recepcion_firmado_email || "" };
          return acc;
        }, {})
      );
    } catch (err) {
      void alertError("No pudimos cargar entregables", (err as Error).message);
    }
  };

  const loadOperacionChecklists = async (operacionId: number) => {
    try {
      const data = await fetchOperacionChecklists(operacionId);
      setOperacionChecklists(data);
    } catch (err) {
      setOperacionChecklists([]);
      void alertError("No pudimos cargar checklists", (err as Error).message);
    }
  };

  /* ── Handlers ── */
  const handleCreateOperacion = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!newOpForm.empresa) nextErrors.empresa = "Selecciona la empresa que registra la operación.";
    if (!newOpForm.proveedor) nextErrors.proveedor = "Selecciona el proveedor relacionado.";
    if (!String(newOpForm.tipo_operacion || "").trim()) nextErrors.tipo_operacion = "Define el tipo de operación.";
    if (!String(newOpForm.fecha_operacion || "").trim()) nextErrors.fecha_operacion = "Indica la fecha de la operación.";
    if (!String(newOpForm.monto || "").trim()) nextErrors.monto = "Captura el monto sin IVA.";
    if (!String(newOpForm.concepto || "").trim()) nextErrors.concepto = "Describe el concepto de la operación.";
    setOpFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setLiveFeedback({ tone: "error", message: "Completa los campos obligatorios marcados antes de crear la operación." });
      return;
    }
    setCreatingOp(true);
    try {
      const allowedTipos = new Set(["COMPRA", "SERVICIO", "ARRENDAMIENTO", "OTRO"]);
      const tipoNormalizado = String(newOpForm.tipo_operacion ?? "COMPRA").replace(/^"+|"+$/g, "");
      const payload: OperacionPayload = { ...newOpForm, tipo_operacion: allowedTipos.has(tipoNormalizado) ? tipoNormalizado : "COMPRA" };
      if (editingOperacionId) {
        const updatePayload: Partial<Operacion> = {
          empresa: payload.empresa,
          proveedor: payload.proveedor,
          contrato: payload.contrato ?? null,
          monto: payload.monto == null ? undefined : String(payload.monto),
          moneda: payload.moneda,
          fecha_operacion: payload.fecha_operacion ?? undefined,
          tipo_operacion: payload.tipo_operacion,
          concepto: payload.concepto ?? "",
        };
        const op = await updateOperacion(editingOperacionId, updatePayload);
        setLiveFeedback({ tone: "success", message: "La operación se actualizó correctamente." });
        await alertSuccess("Operacion actualizada", "Los cambios quedaron guardados");
        setOperaciones((prev) => prev.map((item) => (item.id === op.id ? { ...item, ...op } : item)));
        setSelectedOperacionId(op.id);
      } else {
        const op = await createOperacion(payload);
        setLiveFeedback({ tone: "success", message: "La operación se registró y quedó lista para capturar entregables." });
        await alertSuccess("Operacion creada", "Se registro exitosamente");
        setOperaciones((prev) => [op, ...prev]);
        setSelectedOperacionId(op.id);
        await loadEntregables(op.id);
        await loadOperacionChecklists(op.id);
      }
      setShowModal(false);
      setEditingOperacionId(null);
      setOpFieldErrors({});
      setNewOpForm({ ...payload, empresa: payload.empresa, proveedor: 0, contrato: null, uuid_cfdi: "", monto: "", concepto: "" });
    } catch (err) {
      setLiveFeedback({ tone: "error", message: `No se pudo registrar la operación: ${(err as Error).message}` });
      void alertError("Error al registrar", (err as Error).message);
    } finally {
      setCreatingOp(false);
    }
  };

  const opInputClass = (fieldName: string) =>
    `w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 ${
      opFieldErrors[fieldName]
        ? "border-rose-400 bg-rose-50/70 focus:border-rose-500 focus:ring-rose-200/70"
        : "border-slate-200 focus:border-blue-400 focus:ring-blue-200/60"
    }`;

  const updateNewOpField = <K extends keyof OperacionPayload>(field: K, value: OperacionPayload[K]) => {
    setNewOpForm((prev) => ({ ...prev, [field]: value }));
    setOpFieldErrors((prev) => {
      if (!prev[field as string]) return prev;
      const next = { ...prev };
      delete next[field as string];
      return next;
    });
  };

  const openCreateOperacionModal = () => {
    setEditingOperacionId(null);
    setOpFieldErrors({});
    setNewOpForm({
      empresa: empresas[0]?.id ?? 0,
      proveedor: 0,
      contrato: null,
      uuid_cfdi: "",
      monto: "",
      moneda: "MXN",
      fecha_operacion: today(),
      tipo_operacion: "COMPRA",
      concepto: "",
    });
    setShowModal(true);
  };

  const openEditOperacionModal = (op: Operacion) => {
    setEditingOperacionId(op.id);
    setOpFieldErrors({});
    setNewOpForm({
      empresa: op.empresa,
      proveedor: op.proveedor,
      contrato: op.contrato,
      uuid_cfdi: "",
      monto: op.monto,
      moneda: op.moneda,
      fecha_operacion: op.fecha_operacion,
      tipo_operacion: op.tipo_operacion,
      concepto: op.concepto,
    });
    setShowModal(true);
  };

  const handleDeleteOperacion = async (op: Operacion) => {
    const result = await Swal.fire({
      title: "Eliminar operación",
      text: `Se eliminará ${op.proveedor_nombre} por ${formatCurrency(op.monto, op.moneda)}. Esta acción no se puede deshacer.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#a0433d",
    });
    if (!result.isConfirmed) return;
    try {
      await deleteOperacion(op.id);
      setLiveFeedback({ tone: "success", message: "La operación se eliminó correctamente." });
      await alertSuccess("Operacion eliminada", "El registro ya no aparece en la mesa de control");
      const remaining = operaciones.filter((item) => item.id !== op.id);
      setOperaciones(remaining);
      if (selectedOperacionId === op.id) {
        const siguiente = remaining[0]?.id ?? null;
        setSelectedOperacionId(siguiente);
        if (siguiente) {
          setForm((prev) => ({ ...prev, operacion: siguiente }));
          await loadEntregables(siguiente);
          await loadOperacionChecklists(siguiente);
        } else {
          setEntregables([]);
          setOperacionChecklists([]);
        }
      }
    } catch (err) {
      void alertError("No se pudo eliminar", (err as Error).message);
    }
  };

  const handleSelectOperacion = async (operacionId: number) => {
    setSelectedOperacionId(operacionId);
    setOperacionPanelTab("detalle");
    setForm((prev) => ({ ...prev, operacion: operacionId }));
    await loadEntregables(operacionId);
    await loadOperacionChecklists(operacionId);
  };

  const handleGoToOperacion = async (item: BandejaRevisionItem) => {
    setActiveTab("operaciones");
    setFilterTipo("TODOS");
    setFilterEstatus("TODOS");
    setSearchQuery(item.empresa_nombre || item.proveedor_nombre || "");
    await handleSelectOperacion(item.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleExportDossier = async (operacionId: number) => {
    setExportingId(operacionId);
    try {
      await exportOperacionDossier(operacionId);
      setLiveFeedback({ tone: "success", message: "El expediente ZIP comenzó a generarse para la operación seleccionada." });
    }
    catch (err) {
      setLiveFeedback({ tone: "error", message: `No se pudo generar el ZIP: ${(err as Error).message}` });
      void alertError("Error al exportar", "No se pudo generar el expediente ZIP: " + (err as Error).message);
    }
    finally { setExportingId(null); }
  };

  const handleExportDefensaPdf = async (operacionId: number) => {
    setExportingId(operacionId);
    try {
      await exportOperacionDefensaPdf(operacionId);
      setLiveFeedback({ tone: "success", message: "El PDF de defensa comenzó a generarse para la operación seleccionada." });
    }
    catch (err) {
      setLiveFeedback({ tone: "error", message: `No se pudo generar el PDF de defensa: ${(err as Error).message}` });
      void alertError("Error al exportar", "No se pudo generar el PDF de defensa: " + (err as Error).message);
    }
    finally { setExportingId(null); }
  };

  const handleRequirementChange = (id: string) => {
    if (!id) { setForm((prev) => ({ ...prev, requirement: null, titulo: "", descripcion: "", tipo_gasto: "", codigo: "", pillar: "ENTREGABLES", requerido: true })); return; }
    const req = requisitos.find((item) => String(item.id) === id);
    if (!req) return;
    const mapped = mapRequirementToEntregable(req);
    setForm((prev) => ({ ...prev, ...mapped, operacion: prev.operacion }));
  };

  const handleFormChange = (field: keyof OperacionEntregablePayload, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const submitEntregable = async () => {
    if (!form.operacion) { await alertError("Selecciona una operacion", "Necesitas elegir una operacion para agregar entregables"); return; }
    if (!form.titulo) { await alertError("Titulo requerido", "Agrega un titulo para identificar el entregable"); return; }
    setSaving(true);
    try {
      const payload: OperacionEntregablePayload = { ...form, requirement: form.requirement || null, oc_fecha: form.oc_fecha || null, fecha_compromiso: form.fecha_compromiso || null };
      await createOperacionEntregable(payload);
      setLiveFeedback({ tone: "success", message: "El entregable fue agregado al expediente operativo." });
      await alertSuccess("Entregable creado", "Liga evidencia y marca como Entregado/Recibido cuando este listo");
      setForm((prev) => ({ ...emptyForm, operacion: prev.operacion }));
      await loadEntregables(form.operacion);
    } catch (err) {
      setLiveFeedback({ tone: "error", message: `No se pudo crear el entregable: ${(err as Error).message}` });
      void alertError("No pudimos crear el entregable", (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleEvidenciaChange = (id: number, value: string) => {
    setEvidencias((prev) => ({ ...prev, [id]: value }));
  };

  const handleFirmaChange = (id: number, field: "por" | "email", value: string) => {
    setFirmas((prev) => {
      const current = prev[id] || { por: "", email: "" };
      return { ...prev, [id]: { ...current, [field]: value } };
    });
  };

  const aplicarSugerenciaConcepto = async (op: Operacion) => {
    if (!op.concepto_sugerido) return;
    setUpdatingConceptId(op.id);
    try {
      await updateOperacion(op.id, { concepto: op.concepto_sugerido });
      await alertSuccess("Concepto actualizado", "Se aplico la descripcion sugerida");
      await loadInitialData();
    } catch (err) {
      void alertError("No pudimos actualizar el concepto", (err as Error).message);
    } finally {
      setUpdatingConceptId(null);
    }
  };

  const avanzarEstado = async (item: OperacionEntregable, estado: OperacionEntregable["estado"]) => {
    const evidenciaUrl = evidencias[item.id] || item.oc_archivo_url;
    if ((estado === "ENTREGADO" || estado === "RECIBIDO") && !evidenciaUrl) {
      await alertError("Evidencia requerida", "Agrega la URL de evidencia para marcar como entregado/recibido");
      return;
    }
    const firma = firmas[item.id] || { por: item.recepcion_firmado_por || "", email: item.recepcion_firmado_email || "" };
    if (estado === "RECIBIDO" && (!firma.por.trim() || !firma.email.trim())) {
      await alertError("Datos de recepcion", "Captura nombre y correo de quien firma la recepcion");
      return;
    }
    const payload: Partial<OperacionEntregablePayload> = {
      estado,
      oc_archivo_url: evidenciaUrl,
      recepcion_firmado_por: firma.por,
      recepcion_firmado_email: firma.email,
    };
    setAdvancingEntregableId(item.id);
    try {
      await updateOperacionEntregable(item.id, payload);
      await loadEntregables(item.operacion);
      setLiveFeedback({ tone: "success", message: `El entregable ${item.titulo} quedó en estado ${estado}.` });
      await alertSuccess("Estado actualizado", `El entregable ahora esta en estado ${estado}`);
    } catch (err) {
      setLiveFeedback({ tone: "error", message: `No se pudo actualizar el entregable ${item.titulo}.` });
      void alertError("No pudimos actualizar el estado", (err as Error).message);
    } finally {
      setAdvancingEntregableId(null);
    }
  };

  const actualizarChecklistItem = async (itemId: number, estado: "PENDIENTE" | "EN_PROCESO" | "COMPLETO") => {
    if (!selectedOperacionId) return;
    setUpdatingChecklistItemId(itemId);
    try {
      await updateOperacionChecklistItem(itemId, { estado });
      await loadOperacionChecklists(selectedOperacionId);
      await loadInitialData();
      setLiveFeedback({ tone: "success", message: `El checklist se actualizó a ${estado}.` });
    } catch (err) {
      setLiveFeedback({ tone: "error", message: "No se pudo actualizar el checklist de la operación." });
      void alertError("No pudimos actualizar el checklist", (err as Error).message);
    } finally {
      setUpdatingChecklistItemId(null);
    }
  };

  const handleCambiarEstatus = async (op: Operacion, nuevoEstatus: "PENDIENTE" | "EN_PROCESO" | "VALIDADO" | "RECHAZADO") => {
    setChangingStatusId(op.id);
    try {
      await cambiarOperacionEstatus(op.id, { estatus_validacion: nuevoEstatus });
      setLiveFeedback({ tone: "success", message: `La operación ahora está en estatus ${nuevoEstatus}.` });
      await alertSuccess("Estatus actualizado", `La operacion ahora esta ${nuevoEstatus}`);
      await loadInitialData();
    } catch (err) {
      setLiveFeedback({ tone: "error", message: `No se pudo cambiar el estatus de ${op.proveedor_nombre}.` });
      void alertError("No se pudo cambiar estatus", (err as Error).message);
    } finally {
      setChangingStatusId(null);
    }
  };

  if (!isAuthenticated) return null;

  /* ════════════════════════════ RENDER ═══════════════════════════ */
  return (
    <DashboardShell>
      <div className="space-y-6 text-slate-900">
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

        {/* ═══════════ HEADER ═══════════ */}
        <header className="surface-panel-strong rounded-[1.75rem] p-4 shadow-fiscal sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
            <div>
              <p className="kicker-label">Registro de transacciones</p>
              <h1 className="mt-1 font-display text-[1.55rem] font-semibold leading-tight text-[var(--fiscal-ink)] sm:text-[1.75rem] xl:text-[1.9rem]">
                Operaciones y entregables con enfoque de defensa.
              </h1>
            </div>
            <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                <button
                  onClick={openCreateOperacionModal}
                  className="button-institutional inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                >
                  <Plus className="mr-2 h-4 w-4" /> Nueva operación
                </button>
                <GuiaContador
                  variant="modal"
                  section="Operaciones y entregables — Reforma 2026"
                  steps={[
                    { title: "1. Selecciona la operacion", description: "Elige la <strong>operacion</strong> en el panel. El semaforo indica el nivel de materialidad: CFDI, SPEI, Contrato, NIF." },
                    { title: "2. Requisito sugerido", description: "Selecciona una <strong>plantilla predefinida</strong> del catalogo para cargar automaticamente titulo, descripcion, codigo y tipo de gasto." },
                    { title: "3. Titulo y descripcion", description: "Nombre <strong>especifico</strong> del documento o evidencia. La descripcion es la narrativa que lee el auditor del SAT." },
                    { title: "4. Codigo y Tipo de gasto", description: "Vincula con la clausula contractual. El tipo de gasto define el tratamiento contable bajo NIF." },
                    { title: "5. OC y URL de evidencia", description: "Registra la <strong>orden de compra</strong> y liga el documento de soporte. Se sella con timestamp al guardar." },
                    { title: "6. Marcar Entregado → Recibido", description: "Avanza el estado con nombre y correo de quien firma. Esto cierra el ciclo de materialidad." },
                    { title: "7. Exportar PDF de Defensa Fiscal", description: "Genera el <strong>reporte profesional en PDF</strong> con caratula, datos de la operacion, entregables, evidencias, validaciones, fundamento legal e indice de anexos." },
                    { title: "8. Exportar ZIP Dossier SAT", description: "Genera el <strong>expediente ZIP</strong> con todos los archivos probatorios, un indice estructurado y un <strong>manifiesto SHA-256</strong> que garantiza la integridad de cada documento." },
                  ]}
                  concepts={[
                    { term: "Semaforo de materialidad", definition: "Indicador por operacion: CFDI, SPEI, Contrato y NIF validados. Si alguno falla, riesgo de simulacion fiscal." },
                    { term: "Cadena documental", definition: "Secuencia CFDI → Contrato → Pago → Evidencia que acredita la materialidad completa de la operacion." },
                    { term: "Art. 69-B CFF (Reforma 2026)", definition: "Sanciones severas por CFDI sin operacion real demostrable. Se requieren entregables con evidencia documental robusta." },
                    { term: "PDF Defensa Fiscal vs. ZIP Dossier", definition: "El <strong>PDF</strong> es el reporte ejecutivo de defensa (para lectura humana y presentacion ante autoridad). El <strong>ZIP Dossier</strong> es el paquete probatorio completo con archivos originales y sello de integridad SHA-256." },
                    { term: "Hash SHA-256", definition: "Huella digital criptografica de 256 bits. Cualquier alteracion —incluso un solo byte— produce un hash completamente distinto, lo que permite detectar manipulacion de documentos." },
                    { term: "Manifiesto de integridad", definition: "Archivo dentro del ZIP que lista cada documento con su hash SHA-256 y fecha de generacion. Funciona como acta notarial digital: demuestra que los archivos no fueron modificados despues de su emision." },
                    { term: "Validez legal del SHA-256", definition: "Reconocido por la NOM-151-SCFI-2016 para conservacion de mensajes de datos. Los tribunales federales aceptan hashes criptograficos como evidencia de integridad documental en juicios fiscales." },
                  ]}
                  tips={[
                    "<strong>Riesgo 2026:</strong> Un CFDI valido sin evidencias de materialidad es suficiente para que el SAT presuma simulacion.",
                    "Sube la evidencia <strong>el mismo dia</strong> que se presta el servicio — el timestamp lo confirma ante auditoria.",
                    "Exporta el <strong>Dossier SAT</strong> inmediatamente al cerrar todos los entregables como Recibidos.",
                    "Usa el <strong>PDF de Defensa</strong> para presentar ante el auditor y el <strong>ZIP Dossier</strong> como respaldo tecnico con prueba criptografica.",
                    "Conserva el ZIP junto con su hash SHA-256 — en caso de controversia, la autoridad puede verificar que ningun archivo fue alterado.",
                  ]}
                />
            </div>
          </div>

          {/* KPI Grid */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <KpiCard label="Total operaciones" value={kpis.total} icon={<ClipboardList className="h-5 w-5" />} />
            <KpiCard label="Pendientes validación" value={kpis.pendientes} icon={<ShieldCheck className="h-5 w-5" />} accent="text-[var(--fiscal-warning)]" surface="bg-[var(--fiscal-warning-soft)]/70" />
            <KpiCard label="Alertas activas" value={kpis.alertasActivas} icon={<Bell className="h-5 w-5" />} accent="text-[var(--fiscal-danger)]" surface="bg-[var(--fiscal-danger-soft)]/70" />
            <KpiCard label="Riesgo alto" value={kpis.riesgoAlto} icon={<AlertTriangle className="h-5 w-5" />} accent="text-[var(--fiscal-danger)]" surface="bg-[var(--fiscal-danger-soft)]/70" />
            <KpiCard
              className="lg:col-span-2"
              label="Monto total (MXN)"
              value={formatCurrency(String(kpis.montoTotal), "MXN")}
              icon={<Wallet className="h-5 w-5" />}
              accent="text-[var(--fiscal-success)]"
              surface="bg-[var(--fiscal-success-soft)]/70"
              valueClassName="whitespace-nowrap text-[clamp(1.5rem,1.75vw,2rem)] sm:text-[clamp(1.6rem,1.8vw,2.1rem)]"
            />
          </div>

          {/* Tab switch */}
          <div className="mt-4 flex justify-center">
            <div className="flex w-fit items-center gap-1 rounded-full border border-[rgba(200,192,177,0.75)] bg-[rgba(255,255,255,0.7)] p-1 shadow-panel">
            {([
              { key: "operaciones" as ViewTab, label: "Operaciones" },
              { key: "bandeja" as ViewTab, label: "Bandeja de revisión" },
            ]).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={`rounded-full px-5 py-2 text-xs font-semibold transition ${
                  activeTab === t.key ? "bg-[var(--fiscal-ink)] text-white shadow-panel" : "text-[var(--fiscal-muted)] hover:text-[var(--fiscal-ink)]"
                }`}
              >
                {t.label}
              </button>
            ))}
            </div>
          </div>
        </header>

        {/* ═══════════ BANDEJA DE REVISION ═══════════ */}
        {activeTab === "bandeja" && (
          <section className="space-y-4">
            {/* Filters */}
            <div className="surface-panel rounded-panel p-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px_auto] lg:items-center">
                <div className="relative min-w-0">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fiscal-muted)]" />
                  <input
                    type="search"
                    placeholder="Buscar proveedor, empresa, concepto o RFC"
                    value={bandejaSearchQuery}
                    onChange={(e) => setBandejaSearchQuery(e.target.value)}
                    className="w-full rounded-full border border-[rgba(200,192,177,0.8)] bg-white py-2 pl-11 pr-4 text-sm text-[var(--fiscal-ink)] shadow-sm focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.12)]"
                  />
                </div>
              <select
                value={bandejaRol}
                onChange={(e) => setBandejaRol(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200/60"
              >
                <option value="TODOS">Todos los roles</option>
                <option value="SERVICIOS">Servicios</option>
                <option value="COMPRAS">Compras</option>
                <option value="PARTES_RELACIONADAS">Partes relacionadas</option>
                <option value="GENERAL">General</option>
              </select>
              <select
                value={bandejaRiesgo}
                onChange={(e) => setBandejaRiesgo(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200/60"
              >
                <option value="TODOS">Todos los riesgos</option>
                <option value="ALTO">🔴 Alto</option>
                <option value="MEDIO">🟡 Medio</option>
                <option value="BAJO">🟢 Bajo</option>
              </select>
                <span className="text-xs text-slate-500 lg:justify-self-end">{filteredBandejaItems.length} elementos</span>
              </div>
            </div>

            {/* Bandeja cards */}
            {filteredBandejaItems.length === 0 ? (
              <div className="rounded-3xl border border-slate-100 bg-white p-10 text-center shadow-sm">
                <p className="text-sm text-slate-500">No hay operaciones en la bandeja con los filtros o búsqueda seleccionados.</p>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {filteredBandejaItems.map((item) => (
                  <article key={item.id} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xl shadow-slate-200/60">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{item.proveedor_nombre}</p>
                        <p className="text-xs text-slate-500">{item.empresa_nombre} · {item.fecha_operacion}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <RiskBadge level={item.riesgo_nivel} score={item.riesgo_score} />
                        <Badge label={item.perfil_validacion} className="bg-purple-50 text-purple-700 border-purple-200" />
                      </div>
                    </div>
                    <p className="mt-2 text-lg font-bold text-slate-900">{formatCurrency(item.monto, item.moneda)}</p>
                    <p className="mt-1 text-xs text-slate-600 line-clamp-2">{item.concepto}</p>
                    {item.faltantes.length > 0 && (
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase text-amber-700">Faltantes</p>
                        <ul className="mt-1 space-y-0.5 text-xs text-amber-700">
                          {item.faltantes.map((f: string, i: number) => <li key={i}>• {f}</li>)}
                        </ul>
                      </div>
                    )}
                    {item.alertas_activas.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.alertas_activas.map((a: any) => (
                          <Badge
                            key={a.id}
                            label={a.tipo_alerta.replace(/_/g, " ")}
                            className="bg-red-50 text-red-700 border-red-200"
                          />
                        ))}
                      </div>
                    )}
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => { void handleGoToOperacion(item); }}
                        className="rounded-full border border-[rgba(45,91,136,0.18)] bg-[var(--fiscal-accent-soft)] px-4 py-2 text-xs font-semibold text-[var(--fiscal-accent)] transition hover:border-[rgba(45,91,136,0.28)] hover:bg-[rgba(45,91,136,0.12)]"
                      >
                        Ir a la operación
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ═══════════ OPERACIONES TAB ═══════════ */}
        {activeTab === "operaciones" && (
          <>
            {/* Filters bar */}
            <div className="surface-panel rounded-panel p-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px_auto] lg:items-center">
                <div className="relative min-w-0">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fiscal-muted)]" />
                  <input
                    type="search"
                    placeholder="Buscar proveedor, empresa, concepto o UUID"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-full border border-[rgba(200,192,177,0.8)] bg-white py-2 pl-11 pr-4 text-sm text-[var(--fiscal-ink)] shadow-sm focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.12)]"
                  />
                </div>
                <select
                  value={filterTipo}
                  onChange={(e) => setFilterTipo(e.target.value)}
                  className="w-full rounded-xl border border-[rgba(200,192,177,0.8)] bg-white px-3 py-2 text-sm text-[var(--fiscal-ink)] shadow-sm focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.12)]"
                >
                  <option value="TODOS">Todos los tipos</option>
                  <option value="COMPRA">Compra</option>
                  <option value="SERVICIO">Servicio</option>
                  <option value="ARRENDAMIENTO">Arrendamiento</option>
                  <option value="OTRO">Otro</option>
                </select>
                <select
                  value={filterEstatus}
                  onChange={(e) => setFilterEstatus(e.target.value)}
                  className="w-full rounded-xl border border-[rgba(200,192,177,0.8)] bg-white px-3 py-2 text-sm text-[var(--fiscal-ink)] shadow-sm focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.12)]"
                >
                  <option value="TODOS">Todos los estatus</option>
                  <option value="PENDIENTE">Pendiente</option>
                  <option value="EN_PROCESO">En proceso</option>
                  <option value="VALIDADO">Validado</option>
                  <option value="RECHAZADO">Rechazado</option>
                </select>
              <p className="text-sm text-[var(--fiscal-muted)] lg:justify-self-end">
                {loading ? "Cargando..." : `${filteredOperaciones.length} operaciones`}
              </p>
            </div>
            </div>

            {/* Main grid: table + detail */}
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.95fr)]">

              {/* ──── Left: Operations Table ──── */}
              <section className="surface-panel overflow-hidden rounded-[1.75rem] shadow-fiscal">
                <div className="flex items-center justify-between gap-3 border-b border-[rgba(200,192,177,0.55)] px-5 py-4">
                  <div>
                    <p className="kicker-label">Operaciones registradas</p>
                    {/* <h3 className="text-base font-bold text-[var(--fiscal-ink)]">Vista tabular con selección</h3> */}
                  </div>
                  <span className="rounded-full border border-[rgba(45,91,136,0.22)] bg-[var(--fiscal-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--fiscal-accent)]">
                    {loading ? "..." : `${filteredOperaciones.length} filas`}
                  </span>
                </div>
                {loading && (
                  <div className="flex items-center gap-2 p-6">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--fiscal-accent)] border-t-transparent" />
                    <p className="text-sm text-[var(--fiscal-muted)]">Cargando operaciones...</p>
                  </div>
                )}
                {!loading && filteredOperaciones.length === 0 && (
                  <div className="p-8 text-center">
                    <p className="text-sm text-[var(--fiscal-muted)]">No encontramos operaciones para esta lectura. Ajusta filtros o abre un nuevo expediente operativo.</p>
                    <button onClick={openCreateOperacionModal} className="mt-3 text-sm font-semibold text-[var(--fiscal-accent)] hover:text-[var(--fiscal-ink)]">
                      + Abrir nueva operación
                    </button>
                  </div>
                )}
                {!loading && filteredOperaciones.length > 0 && (
                  <div className="max-h-[72vh] overflow-auto">
                    <table className="min-w-[700px] w-full border-collapse">
                      <thead className="text-left">
                        <tr className="text-[10px] uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">
                          <th className="sticky left-0 top-0 z-30 bg-[rgba(247,244,238,0.98)] px-3 py-3 font-semibold backdrop-blur shadow-[10px_0_18px_rgba(15,23,42,0.04)]">Operación</th>
                          <th className="sticky top-0 z-20 min-w-[190px] bg-[rgba(247,244,238,0.96)] px-3 py-3 font-semibold backdrop-blur">Empresa</th>
                          <th className="sticky top-0 z-20 w-[126px] bg-[rgba(247,244,238,0.96)] px-2 py-3 font-semibold backdrop-blur">Estatus / Riesgo</th>
                          <th className="sticky right-0 top-0 z-30 w-[78px] bg-[rgba(247,244,238,0.98)] px-2 py-3 font-semibold text-right backdrop-blur">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOperaciones.map((op) => {
                          const isActive = op.id === selectedOperacionId;
                          const cfdiSinContrato = op.cfdi_estatus === "VALIDO" && !op.contrato_nombre;
                          const rowTone = isActive
                            ? "bg-[rgba(219,230,240,0.38)]"
                            : cfdiSinContrato
                            ? "bg-[rgba(248,234,231,0.55)] hover:bg-[rgba(248,234,231,0.8)]"
                            : "hover:bg-[rgba(247,244,238,0.7)]";
                          const stickyActionTone = isActive
                            ? "bg-[rgba(219,230,240,0.92)]"
                            : cfdiSinContrato
                            ? "bg-[rgba(248,234,231,0.92)]"
                            : "bg-[rgba(255,255,255,0.96)]";
                          const stickyFirstTone = isActive
                            ? "bg-[rgba(219,230,240,0.92)]"
                            : cfdiSinContrato
                            ? "bg-[rgba(248,234,231,0.92)]"
                            : "bg-[rgba(255,255,255,0.98)]";
                          return (
                            <tr
                              key={op.id}
                              className={`border-t border-[rgba(200,192,177,0.45)] transition ${rowTone}`}
                            >
                              <td className={`sticky left-0 z-10 px-3 py-3 align-top shadow-[10px_0_18px_rgba(15,23,42,0.04)] ${stickyFirstTone}`}>
                                <button
                                  type="button"
                                  onClick={() => { void handleSelectOperacion(op.id); }}
                                  className="w-full text-left"
                                >
                                  <div className="flex items-start gap-2.5">
                                    <span className={`mt-1 h-2.5 w-2.5 rounded-full ${isActive ? "bg-[var(--fiscal-accent)]" : cfdiSinContrato ? "bg-[var(--fiscal-danger)]" : "bg-slate-300"}`} />
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold text-[var(--fiscal-ink)]">{op.proveedor_nombre}</p>
                                      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[var(--fiscal-muted)]">
                                        {op.concepto || "Sin concepto capturado"}
                                      </p>
                                      <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <Badge label={op.tipo_operacion} className={TIPO_STYLES[op.tipo_operacion] || "bg-slate-100 text-slate-600"} />
                                        <span className="font-display text-sm font-semibold tabular-nums text-[var(--fiscal-ink)]">
                                          {formatCurrency(op.monto, op.moneda)}
                                        </span>
                                        <span className="text-[11px] text-[var(--fiscal-muted)]">
                                          {formatDate(op.fecha_operacion)}
                                        </span>
                                      </div>
                                      {op.concepto_generico && op.concepto_sugerido && (
                                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              void aplicarSugerenciaConcepto(op);
                                            }}
                                            disabled={updatingConceptId === op.id}
                                            className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                                          >
                                            {updatingConceptId === op.id ? "Aplicando..." : "Aplicar IA"}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              </td>
                              <td className="min-w-[190px] px-3 py-3 align-top text-[11px] text-[var(--fiscal-muted)]">{op.empresa_nombre}</td>
                              <td className="w-[126px] px-2 py-3 align-top">
                                <div className="flex flex-col items-start gap-1 origin-left scale-[0.88]">
                                  <Badge label={op.estatus_validacion} className={VALIDACION_STYLES[op.estatus_validacion] || ""} />
                                  {op.riesgo_nivel ? (
                                    <RiskBadge level={op.riesgo_nivel} score={op.riesgo_score} />
                                  ) : (
                                    <span className="text-[11px] text-[var(--fiscal-muted)]">Sin señal</span>
                                  )}
                                  {cfdiSinContrato && <Badge label="Sin contrato" className="bg-red-50 text-red-700 border-red-200" />}
                                </div>
                              </td>
                              <td className={`sticky right-0 w-[78px] px-2 py-3 align-top text-right shadow-[-10px_0_18px_rgba(15,23,42,0.04)] ${stickyActionTone}`}>
                                {isAdmin ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() => openEditOperacionModal(op)}
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(166,103,31,0.18)] bg-[rgba(166,103,31,0.08)] text-[var(--fiscal-warning)] transition hover:border-[rgba(166,103,31,0.3)] hover:bg-[rgba(166,103,31,0.12)]"
                                      aria-label="Editar operación"
                                      title="Editar operación"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { void handleDeleteOperacion(op); }}
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(160,67,61,0.2)] bg-[rgba(160,67,61,0.08)] text-[var(--fiscal-danger)] transition hover:bg-[rgba(160,67,61,0.14)]"
                                      aria-label="Eliminar operación"
                                      title="Eliminar operación"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ) : null}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* ──── Right: Detail Panel ──── */}
              <div className="space-y-5">

                {!selectedOperacion ? (
                  <div className="surface-panel rounded-[1.5rem] p-10 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--fiscal-accent-soft)] text-[var(--fiscal-accent)]">
                      <Landmark className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-semibold text-[var(--fiscal-ink)]">Selecciona una operación</p>
                    <p className="mt-1 text-xs text-[var(--fiscal-muted)]">Selecciona una fila para revisar su detalle, cumplimiento y captura de entregables desde el panel derecho.</p>
                  </div>
                ) : (
                  <>
                    {/* ── Operation detail header ── */}
                    <div className="surface-panel-strong rounded-[1.75rem] p-6 shadow-fiscal">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                          <p className="kicker-label">Detalle de operación</p>
                            <h2 className="mt-1 font-display text-[1.15rem] font-semibold leading-tight text-[var(--fiscal-ink)] sm:text-[1.3rem]">{selectedOperacion.proveedor_nombre}</h2>
                            <p className="text-xs text-[var(--fiscal-muted)]">{selectedOperacion.empresa_nombre} · {formatDate(selectedOperacion.fecha_operacion)}</p>
                            <p className="mt-2 break-words font-display text-[clamp(1.45rem,2vw,1.9rem)] font-semibold leading-none text-[var(--fiscal-ink)]">
                            {formatCurrency(selectedOperacion.monto, selectedOperacion.moneda)}
                          </p>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-center">
                          {/* Status transition buttons */}
                          {selectedOperacion.estatus_validacion === "PENDIENTE" && (
                            <button
                              onClick={() => void handleCambiarEstatus(selectedOperacion, "EN_PROCESO")}
                              disabled={changingStatusId === selectedOperacion.id}
                              aria-disabled={changingStatusId === selectedOperacion.id}
                              aria-busy={changingStatusId === selectedOperacion.id}
                              className="rounded-full border border-[rgba(166,103,31,0.22)] bg-[var(--fiscal-warning-soft)] px-4 py-2 text-xs font-semibold text-[var(--fiscal-warning)] transition hover:bg-[var(--fiscal-warning-soft)]/80"
                            >
                              {changingStatusId === selectedOperacion.id ? "Actualizando…" : "Iniciar revisión"}
                            </button>
                          )}
                          {selectedOperacion.estatus_validacion === "EN_PROCESO" && (
                            <>
                              <button
                                onClick={() => void handleCambiarEstatus(selectedOperacion, "VALIDADO")}
                                disabled={changingStatusId === selectedOperacion.id}
                                aria-disabled={changingStatusId === selectedOperacion.id}
                                aria-busy={changingStatusId === selectedOperacion.id}
                                className="rounded-full border border-[rgba(31,122,90,0.22)] bg-[var(--fiscal-success-soft)] px-4 py-2 text-xs font-semibold text-[var(--fiscal-success)] transition hover:bg-[var(--fiscal-success-soft)]/80"
                              >
                                {changingStatusId === selectedOperacion.id ? "Actualizando…" : "Validar"}
                              </button>
                              <button
                                onClick={() => void handleCambiarEstatus(selectedOperacion, "RECHAZADO")}
                                disabled={changingStatusId === selectedOperacion.id}
                                aria-disabled={changingStatusId === selectedOperacion.id}
                                aria-busy={changingStatusId === selectedOperacion.id}
                                className="rounded-full border border-[rgba(160,67,61,0.22)] bg-[var(--fiscal-danger-soft)] px-4 py-2 text-xs font-semibold text-[var(--fiscal-danger)] transition hover:bg-[var(--fiscal-danger-soft)]/80"
                              >
                                {changingStatusId === selectedOperacion.id ? "Actualizando…" : "Rechazar"}
                              </button>
                            </>
                          )}
                          {/* Export buttons */}
                          <button
                            onClick={() => void handleExportDefensaPdf(selectedOperacion.id)}
                            disabled={exportingId === selectedOperacion.id}
                            aria-disabled={exportingId === selectedOperacion.id}
                            aria-busy={exportingId === selectedOperacion.id}
                            className="rounded-full border border-[rgba(45,91,136,0.22)] bg-[var(--fiscal-accent-soft)] px-4 py-2 text-xs font-semibold text-[var(--fiscal-accent)] transition hover:bg-[var(--fiscal-accent-soft)]/80 disabled:opacity-50"
                          >
                            {exportingId === selectedOperacion.id ? "Generando..." : "PDF Defensa"}
                          </button>
                          <button
                            onClick={() => void handleExportDossier(selectedOperacion.id)}
                            disabled={exportingId === selectedOperacion.id}
                            aria-disabled={exportingId === selectedOperacion.id}
                            aria-busy={exportingId === selectedOperacion.id}
                            className="rounded-full border border-[rgba(31,122,90,0.22)] bg-[var(--fiscal-success-soft)] px-4 py-2 text-xs font-semibold text-[var(--fiscal-success)] transition hover:bg-[var(--fiscal-success-soft)]/80 disabled:opacity-50"
                          >
                            {exportingId === selectedOperacion.id ? "Generando..." : "ZIP Dossier"}
                          </button>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap items-center gap-2">
                        {([
                          { key: "detalle" as OperacionPanelTab, label: "Detalle" },
                          { key: "cumplimiento" as OperacionPanelTab, label: "Cumplimiento" },
                          { key: "entregable" as OperacionPanelTab, label: "Nuevo entregable" },
                        ]).map((tab) => (
                          <button
                            key={tab.key}
                            type="button"
                            onClick={() => setOperacionPanelTab(tab.key)}
                            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                              operacionPanelTab === tab.key
                                ? "bg-[var(--fiscal-ink)] text-white shadow-panel"
                                : "border border-[rgba(25,36,52,0.12)] bg-white/85 text-[var(--fiscal-muted)] hover:text-[var(--fiscal-ink)]"
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {/* Badges row */}
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Badge label={selectedOperacion.tipo_operacion} className={TIPO_STYLES[selectedOperacion.tipo_operacion] || ""} />
                        <Badge label={selectedOperacion.estatus_validacion} className={VALIDACION_STYLES[selectedOperacion.estatus_validacion] || ""} />
                        {selectedOperacion.riesgo_nivel && (
                          <RiskBadge level={selectedOperacion.riesgo_nivel} score={selectedOperacion.riesgo_score} motivos={selectedOperacion.riesgo_motivos} />
                        )}
                        {selectedOperacion.contrato_nombre ? (
                          <Badge label={`📋 ${selectedOperacion.contrato_nombre}`} className="bg-blue-50 text-blue-700 border-blue-200" />
                        ) : (
                          <Badge label="Sin contrato" className="bg-red-50 text-red-700 border-red-200" />
                        )}
                      </div>

                    </div>

                    {operacionPanelTab === "detalle" && (
                      <>
                        <div className="surface-panel rounded-[1.75rem] p-6 shadow-fiscal">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                              <SemaforoMaterialidad op={selectedOperacion} variant="full" />
                            </div>
                            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                              {selectedMatriz?.cadena_documental ? (
                                <CadenaDocumental data={selectedMatriz.cadena_documental} />
                              ) : (
                                <div className="flex h-full items-center justify-center text-center text-sm text-[var(--fiscal-muted)]">
                                  La cadena documental aún no tiene trazabilidad generada para esta operación.
                                </div>
                              )}
                            </div>
                          </div>

                          {selectedAlertas.length > 0 && (
                            <div className="mt-4 rounded-2xl border border-[rgba(160,67,61,0.22)] bg-[var(--fiscal-danger-soft)] p-4">
                              <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[var(--fiscal-danger)]">
                                <Bell className="h-3.5 w-3.5" /> Alertas activas ({selectedAlertas.length})
                              </p>
                              <div className="space-y-1.5">
                                {selectedAlertas.map((a) => (
                                  <div key={a.id} className="flex items-start gap-2 text-xs text-[var(--fiscal-danger)]">
                                    <span className="mt-0.5">•</span>
                                    <div>
                                      <span className="font-semibold">{a.tipo_alerta.replace(/_/g, " ")}:</span>{" "}
                                      {a.motivo}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {selectedOperacion.riesgo_nivel === "ALTO" && selectedOperacion.riesgo_motivos && (
                            <div className="mt-4">
                              <RiskBadge
                                level={selectedOperacion.riesgo_nivel}
                                score={selectedOperacion.riesgo_score}
                                motivos={selectedOperacion.riesgo_motivos}
                                variant="card"
                              />
                            </div>
                          )}
                        </div>

                        <div className="surface-panel overflow-hidden rounded-[1.75rem] shadow-fiscal">
                          <div className="flex items-center justify-between border-b border-[rgba(200,192,177,0.55)] px-6 py-4">
                            <div>
                              <p className="kicker-label">Seguimiento</p>
                              <h3 className="text-lg font-bold text-[var(--fiscal-ink)]">Entregables de la operación</h3>
                            </div>
                            <span className="rounded-full border border-[rgba(45,91,136,0.22)] bg-[var(--fiscal-accent-soft)] px-3 py-1 text-sm font-bold text-[var(--fiscal-accent)]">
                              {entregables.length}
                            </span>
                          </div>

                          {entregables.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 px-6">
                              <p className="text-2xl mb-3">📋</p>
                              <p className="text-sm font-semibold text-slate-600">Sin entregables aun</p>
                              <p className="mt-1 text-xs text-slate-500">Usa la acción Nuevo entregable para capturar el primero.</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-slate-100">
                              {entregables
                                .sort((a, b) => estadosOrden.indexOf(a.estado) - estadosOrden.indexOf(b.estado))
                                .map((item) => (
                                  <div key={item.id} className="p-5 hover:bg-slate-50/50 transition">
                                    <div className="grid gap-5 lg:grid-cols-3">
                                      <div className="space-y-2">
                                        <div className="flex items-start gap-2">
                                          <div className="shrink-0 mt-1 h-2 w-2 rounded-full bg-blue-500" />
                                          <div>
                                            <p className="text-sm font-bold text-slate-900">{item.titulo}</p>
                                            {(item.codigo || item.tipo_gasto) && (
                                              <p className="mt-0.5 text-xs text-slate-500">
                                                {[item.codigo, item.tipo_gasto].filter(Boolean).join(" · ")}
                                              </p>
                                            )}
                                            {item.descripcion && (
                                              <p className="mt-1 text-xs text-slate-500 leading-snug">{item.descripcion}</p>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${ESTADO_STYLES[item.estado]}`}>
                                            {item.estado}
                                          </span>
                                          {item.requerido && <Badge label="Requerido" className="bg-blue-50 text-blue-700 border-blue-200" />}
                                          {item.vencido && (
                                            <Badge label={`⚠ Vencido +${item.dias_atraso}d`} className="bg-red-50 text-red-700 border-red-200" />
                                          )}
                                        </div>
                                        {item.fecha_compromiso && (
                                          <p className="text-xs text-slate-500">
                                            Compromiso: <span className="font-medium text-slate-700">{formatDate(item.fecha_compromiso)}</span>
                                          </p>
                                        )}
                                        <div className="space-y-0.5 text-[11px] text-slate-400">
                                          {item.fecha_entregado && <p>✓ Entregado: {formatDate(item.fecha_entregado)}</p>}
                                          {item.fecha_recepcion && <p>✓ Recibido: {formatDate(item.fecha_recepcion)}</p>}
                                          {item.recepcion_firmado_por && <p>✍ Firmó: <span className="text-slate-600 font-medium">{item.recepcion_firmado_por}</span></p>}
                                          {item.evidencia_cargada_en && <p>🕐 Sellado: {item.evidencia_cargada_en}</p>}
                                        </div>
                                      </div>

                                      <div className="space-y-3">
                                        <div>
                                          <label className="block text-xs font-semibold text-slate-600 mb-1">URL de evidencia</label>
                                          <PasteUrlField
                                            value={evidencias[item.id] ?? ""}
                                            onChange={(v) => handleEvidenciaChange(item.id, v)}
                                            placeholder="https://drive.google.com/..."
                                            className="rounded-xl border border-slate-200 bg-white py-2 text-xs text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200/60"
                                          />
                                          {item.oc_archivo_url && (
                                            <a href={item.oc_archivo_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                                              ↗ Ver evidencia actual
                                            </a>
                                          )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                          <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Recibido por</label>
                                            <input
                                              type="text"
                                              value={firmas[item.id]?.por ?? ""}
                                              onChange={(e) => handleFirmaChange(item.id, "por", e.target.value)}
                                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200/60"
                                              placeholder="Nombre completo"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Correo</label>
                                            <input
                                              type="email"
                                              value={firmas[item.id]?.email ?? ""}
                                              onChange={(e) => handleFirmaChange(item.id, "email", e.target.value)}
                                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200/60"
                                              placeholder="correo@empresa.mx"
                                            />
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex flex-col gap-2 justify-center">
                                        <button
                                          type="button"
                                          onClick={() => { void avanzarEstado(item, "ENTREGADO"); }}
                                          disabled={advancingEntregableId === item.id}
                                          aria-disabled={advancingEntregableId === item.id}
                                          aria-busy={advancingEntregableId === item.id}
                                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 hover:border-amber-300 transition"
                                        >
                                          {advancingEntregableId === item.id ? "Actualizando…" : "📦 Marcar Entregado"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => { void avanzarEstado(item, "RECIBIDO"); }}
                                          disabled={advancingEntregableId === item.id}
                                          aria-disabled={advancingEntregableId === item.id}
                                          aria-busy={advancingEntregableId === item.id}
                                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition"
                                        >
                                          {advancingEntregableId === item.id ? "Actualizando…" : "✅ Marcar Recibido"}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {operacionPanelTab === "cumplimiento" && (
                      <div aria-busy={saving} className="surface-panel rounded-[1.75rem] p-6 shadow-fiscal">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="kicker-label">Cumplimiento</p>
                          <h3 className="text-lg font-bold text-[var(--fiscal-ink)]">Checklist operativo asociado</h3>
                          <p className="mt-0.5 text-xs text-[var(--fiscal-muted)]">Seguimiento no bloqueante para asegurar sustancia y trazabilidad por operación.</p>
                        </div>
                        <span className="rounded-full border border-[rgba(45,91,136,0.22)] bg-[var(--fiscal-accent-soft)] px-3 py-1 text-sm font-bold text-[var(--fiscal-accent)]">
                          {operacionChecklists.length}
                        </span>
                      </div>

                      {operacionChecklists.length === 0 ? (
                        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-sm text-slate-500">
                          Esta operación aún no tiene checklist base asignado automáticamente.
                        </div>
                      ) : (
                        <div className="mt-5 space-y-4">
                          {operacionChecklists.map((checklist) => (
                            <div key={checklist.id} className="rounded-[1.5rem] border border-[rgba(200,192,177,0.55)] bg-white/90 p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-[var(--fiscal-ink)]">{checklist.nombre}</p>
                                  <p className="mt-1 text-xs text-[var(--fiscal-muted)]">
                                    {checklist.completos}/{checklist.total_items} ítems completos · {checklist.pendientes} pendientes
                                  </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge label={checklist.estado_general} className={VALIDACION_STYLES[checklist.estado_general] || ""} />
                                  <Badge label={`${checklist.progreso_porcentaje}%`} className="bg-blue-50 text-blue-700 border-blue-200" />
                                </div>
                              </div>
                              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full rounded-full bg-[var(--fiscal-accent)] transition-all" style={{ width: `${checklist.progreso_porcentaje}%` }} />
                              </div>
                              <div className="mt-4 space-y-3">
                                {checklist.items.map((item) => (
                                  <div key={item.id} className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 md:grid-cols-[1fr_auto] md:items-center">
                                    <div>
                                      <p className="text-sm font-semibold text-slate-800">{item.titulo}</p>
                                      <p className="mt-1 text-xs text-slate-500">{item.pillar.replace(/_/g, " ")} · {item.responsable || "Sin responsable"}</p>
                                      {item.descripcion && <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.descripcion}</p>}
                                    </div>
                                    <select
                                      value={item.estado}
                                      onChange={(event) => void actualizarChecklistItem(item.id, event.target.value as "PENDIENTE" | "EN_PROCESO" | "COMPLETO")}
                                      disabled={updatingChecklistItemId === item.id}
                                      aria-disabled={updatingChecklistItemId === item.id}
                                      aria-busy={updatingChecklistItemId === item.id}
                                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200/60"
                                    >
                                      <option value="PENDIENTE">Pendiente</option>
                                      <option value="EN_PROCESO">En proceso</option>
                                      <option value="COMPLETO">Completo</option>
                                    </select>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      </div>
                    )}

                    {operacionPanelTab === "entregable" && (
                      <div aria-busy={saving} className="surface-panel rounded-[1.75rem] p-6 shadow-fiscal">
                      <div className="flex items-center justify-between mb-5">
                        <div>
                          <p className="kicker-label">Captura</p>
                          <h3 className="text-lg font-bold text-[var(--fiscal-ink)]">Nuevo entregable</h3>
                          <p className="mt-0.5 text-xs text-[var(--fiscal-muted)]">Usa una plantilla o captura manualmente.</p>
                        </div>
                      </div>

                      <div className="grid gap-5 md:grid-cols-2">
                        {/* Left column */}
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                              Requisito sugerido <span className="font-normal text-slate-400">({requisitos.length} plantillas)</span>
                            </label>
                            <RequisitoCombobox requisitos={requisitos} value={form.requirement ?? null} onChange={handleRequirementChange} />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                              Titulo <span className="text-red-500">*</span>
                            </label>
                            <input
                              value={form.titulo}
                              onChange={(e) => handleFormChange("titulo", e.target.value)}
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200/60"
                              placeholder="Ej. Informe de avance, evidencia fotografica..."
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Descripcion</label>
                            <textarea
                              value={form.descripcion}
                              onChange={(e) => handleFormChange("descripcion", e.target.value)}
                              rows={3}
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200/60 resize-none"
                            />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Fecha compromiso</label>
                              <input
                                type="date"
                                value={form.fecha_compromiso ?? ""}
                                onChange={(e) => handleFormChange("fecha_compromiso", e.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200/60"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Requerido</label>
                              <select
                                value={form.requerido ? "1" : "0"}
                                onChange={(e) => handleFormChange("requerido", e.target.value === "1")}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200/60"
                              >
                                <option value="1">Si, requerido</option>
                                <option value="0">Opcional</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Right column */}
                        <div className="space-y-4">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Codigo</label>
                              <input
                                value={form.codigo ?? ""}
                                onChange={(e) => handleFormChange("codigo", e.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200/60"
                                placeholder="C-01"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tipo de gasto</label>
                              <input
                                value={form.tipo_gasto ?? ""}
                                onChange={(e) => handleFormChange("tipo_gasto", e.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200/60"
                                placeholder="CapEx, OpEx..."
                              />
                            </div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Orden de compra</label>
                              <input
                                value={form.oc_numero ?? ""}
                                onChange={(e) => handleFormChange("oc_numero", e.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200/60"
                                placeholder="OC-1234"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Fecha OC</label>
                              <input
                                type="date"
                                value={form.oc_fecha ?? ""}
                                onChange={(e) => handleFormChange("oc_fecha", e.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200/60"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">URL de evidencia</label>
                            <PasteUrlField
                              value={form.oc_archivo_url ?? ""}
                              onChange={(v) => handleFormChange("oc_archivo_url", v)}
                              placeholder="https://drive.google.com/..."
                              className="rounded-2xl border border-slate-200 bg-white py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200/60"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Comentarios</label>
                            <textarea
                              value={form.comentarios ?? ""}
                              onChange={(e) => handleFormChange("comentarios", e.target.value)}
                              rows={2}
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200/60 resize-none"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-end">
                        <button
                          type="button"
                          onClick={() => { void submitEntregable(); }}
                          disabled={saving || !selectedOperacion}
                          aria-disabled={saving || !selectedOperacion}
                          aria-busy={saving}
                          className="w-full rounded-full bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
                        >
                          {saving ? "Guardando..." : "Agregar entregable"}
                        </button>
                      </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ═══════════ MODAL: Nueva Operacion ═══════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/60 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal header */}
            <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{editingOperacionId ? "Editar Operacion" : "Registrar Operacion"}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{editingOperacionId ? "Ajusta los datos fiscales y operativos del registro." : "Alta de compra, servicio o gasto."}</p>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingOperacionId(null);
                  setOpFieldErrors({});
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition text-xl leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={(e) => void handleCreateOperacion(e)} aria-busy={creatingOp} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div role="status" aria-live="polite" className="sr-only">
                {creatingOp ? (editingOperacionId ? "Actualizando operación" : "Registrando nueva operación") : liveFeedback?.message || ""}
              </div>
              <div className="grid gap-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                <p>Los campos con <span className="font-semibold text-rose-600">*</span> son obligatorios.</p>
                <p>Obligatorios en este formulario: <span className="font-semibold text-slate-900">Empresa, Proveedor, Tipo, Fecha, Monto sin IVA y Concepto</span>.</p>
              </div>
              {Object.keys(opFieldErrors).length > 0 && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
                  Revisa los campos marcados antes de {editingOperacionId ? "guardar" : "crear"} la operación.
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Empresa <span className="text-red-500">*</span></label>
                <select required value={newOpForm.empresa || ""} onChange={(e) => updateNewOpField("empresa", Number(e.target.value))} className={opInputClass("empresa")}>
                  <option value="">Selecciona una empresa</option>
                  {empresas.map((emp) => <option key={emp.id} value={emp.id}>{emp.razon_social}</option>)}
                </select>
                {opFieldErrors.empresa && <p className="mt-1 text-[11px] font-medium text-rose-600">{opFieldErrors.empresa}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Proveedor <span className="text-red-500">*</span></label>
                <select required value={newOpForm.proveedor || ""} onChange={(e) => updateNewOpField("proveedor", Number(e.target.value))} className={opInputClass("proveedor")}>
                  <option value="">Selecciona un proveedor</option>
                  {proveedores.map((p) => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
                </select>
                {opFieldErrors.proveedor && <p className="mt-1 text-[11px] font-medium text-rose-600">{opFieldErrors.proveedor}</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tipo <span className="text-red-500">*</span></label>
                  <select required value={newOpForm.tipo_operacion || "COMPRA"} onChange={(e) => updateNewOpField("tipo_operacion", e.target.value)} className={opInputClass("tipo_operacion")}>
                    <option value="COMPRA">Compra</option>
                    <option value="SERVICIO">Servicio</option>
                    <option value="ARRENDAMIENTO">Arrendamiento</option>
                    <option value="OTRO">Otro</option>
                  </select>
                  {opFieldErrors.tipo_operacion && <p className="mt-1 text-[11px] font-medium text-rose-600">{opFieldErrors.tipo_operacion}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Contrato</label>
                  <select value={newOpForm.contrato || ""} onChange={(e) => updateNewOpField("contrato", e.target.value ? Number(e.target.value) : null)} className={opInputClass("contrato")}>
                    <option value="">Sin contrato</option>
                    {contratos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Fecha <span className="text-red-500">*</span></label>
                  <input type="date" required value={newOpForm.fecha_operacion || ""} onChange={(e) => updateNewOpField("fecha_operacion", e.target.value)} className={opInputClass("fecha_operacion")} />
                  {opFieldErrors.fecha_operacion && <p className="mt-1 text-[11px] font-medium text-rose-600">{opFieldErrors.fecha_operacion}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Monto sin IVA <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-4 flex items-center text-slate-400 text-sm font-bold">$</span>
                    <input type="number" step="0.01" required placeholder="0.00" value={newOpForm.monto || ""} onChange={(e) => updateNewOpField("monto", e.target.value)} className={`${opInputClass("monto")} pl-8 pr-4`} />
                  </div>
                  {opFieldErrors.monto && <p className="mt-1 text-[11px] font-medium text-rose-600">{opFieldErrors.monto}</p>}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">UUID CFDI <span className="font-normal text-slate-400">(Opcional)</span></label>
                <input type="text" placeholder="ABCD-1234-EFGH-5678-..." value={newOpForm.uuid_cfdi || ""} onChange={(e) => updateNewOpField("uuid_cfdi", e.target.value)} className={`${opInputClass("uuid_cfdi")} font-mono`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Concepto <span className="text-red-500">*</span></label>
                <textarea rows={2} required value={newOpForm.concepto || ""} onChange={(e) => updateNewOpField("concepto", e.target.value)} placeholder="Descripcion de los servicios o bienes contratados..." className={`${opInputClass("concepto")} resize-none`} />
                {opFieldErrors.concepto && <p className="mt-1 text-[11px] font-medium text-rose-600">{opFieldErrors.concepto}</p>}
              </div>
              <div className="mt-2 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => { setShowModal(false); setEditingOperacionId(null); setOpFieldErrors({}); }} disabled={creatingOp} aria-disabled={creatingOp} className="rounded-full px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition">
                  Cancelar
                </button>
                <button type="submit" disabled={creatingOp} aria-disabled={creatingOp} aria-busy={creatingOp} className="w-full rounded-full bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:opacity-50 sm:w-auto">
                  {creatingOp ? "Guardando..." : editingOperacionId ? "Guardar cambios" : "Crear Operacion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
