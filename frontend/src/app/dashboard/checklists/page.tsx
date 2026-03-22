"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useReducer, useState } from "react";
import {
  AlertTriangle,
  BookMarked,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  Landmark,
  LibraryBig,
  Search,
  ShieldCheck,
  ShieldAlert,
  UserCircle2,
} from "lucide-react";
import Swal from "sweetalert2";

import { DashboardShell } from "../../../components/DashboardShell";
import { GuiaContador } from "../../../components/GuiaContador";
import { alertError, alertSuccess } from "../../../lib/alerts";
import {
  Checklist,
  ChecklistItem,
  ITEM_STATES,
  PILLARS,
  DeliverableRequirement,
  createChecklist,
  updateChecklistItem,
  fetchChecklists,
  fetchDeliverableRequirements,
  createDeliverableRequirement,
  deleteChecklist,
  deleteChecklistItem,
  deleteDeliverableRequirement,
} from "../../../lib/checklists";

/* ═══════════════  Design-system tokens  ═══════════════ */

const inputCls =
  "w-full rounded-xl border border-[rgba(200,192,177,0.72)] bg-[rgba(255,255,255,0.82)] px-3 py-2 text-sm text-[var(--fiscal-ink)] " +
  "placeholder:text-[var(--fiscal-muted)] focus:border-[var(--fiscal-accent)] focus:ring-2 focus:ring-[rgba(45,91,136,0.18)] focus:outline-none transition";

const requiredLabelCls =
  "text-xs font-semibold uppercase tracking-wider text-[var(--fiscal-muted)]";

const requiredInputCls = (invalid: boolean) =>
  invalid
    ? `${inputCls} border-[rgba(160,67,61,0.38)] bg-[var(--fiscal-danger-soft)]/45 focus:border-[var(--fiscal-danger)] focus:ring-[rgba(160,67,61,0.16)]`
    : inputCls;

const requiredHintCls = "mt-1 text-xs font-medium text-[var(--fiscal-danger)]";

const btnPrimary =
  "button-institutional rounded-xl px-5 py-2.5 text-sm font-semibold text-white " +
  "hover:-translate-y-0.5 transition disabled:opacity-50 disabled:cursor-not-allowed";

const btnDanger =
  "rounded-lg border border-[rgba(160,67,61,0.22)] bg-[var(--fiscal-danger-soft)] px-2.5 py-1.5 text-xs font-semibold text-[var(--fiscal-danger)] " +
  "hover:bg-[var(--fiscal-danger-soft)]/80 transition";

const btnOutline =
  "rounded-lg border border-[rgba(200,192,177,0.72)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--fiscal-ink)] " +
  "hover:bg-[var(--fiscal-accent-soft)] hover:text-[var(--fiscal-accent)] hover:border-[rgba(45,91,136,0.22)] transition";

/* ═══════════════  KPI colors  ═══════════════ */

const KPI_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  green:  { bg: "bg-[var(--fiscal-success-soft)]/80", text: "text-[var(--fiscal-success)]", dot: "bg-[var(--fiscal-success)]" },
  blue:   { bg: "bg-[var(--fiscal-accent-soft)]/80", text: "text-[var(--fiscal-accent)]", dot: "bg-[var(--fiscal-accent)]" },
  amber:  { bg: "bg-[var(--fiscal-warning-soft)]/80", text: "text-[var(--fiscal-warning)]", dot: "bg-[var(--fiscal-warning)]" },
  red:    { bg: "bg-[var(--fiscal-danger-soft)]/80", text: "text-[var(--fiscal-danger)]", dot: "bg-[var(--fiscal-danger)]" },
  gray:   { bg: "bg-[rgba(255,255,255,0.78)]", text: "text-[var(--fiscal-muted)]", dot: "bg-[var(--fiscal-muted)]" },
};

function Kpi({ label, value, sub, color = "gray", icon }: { label: string; value: string | number; sub?: string; color?: string; icon?: ReactNode }) {
  const c = KPI_COLORS[color] ?? KPI_COLORS.gray;
  return (
    <div className={`surface-panel rounded-panel px-5 py-4 ${c.bg}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[rgba(255,255,255,0.72)] shadow-panel">
          {icon ?? <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--fiscal-muted)]">{label}</p>
          <p className={`mt-1 font-display text-3xl font-semibold ${c.text}`}>{value}</p>
          {sub && <p className="mt-0.5 text-xs text-[var(--fiscal-muted)]">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════  Section component  ═══════════════ */

function Section({
  badge, title, children, defaultOpen = false, extra,
}: {
  badge?: string; title: string; children: React.ReactNode; defaultOpen?: boolean; extra?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="surface-panel overflow-hidden rounded-[1.75rem] shadow-fiscal">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => e.key === "Enter" && setOpen((o) => !o)}
        className="flex items-center justify-between gap-3 px-6 py-5 cursor-pointer select-none hover:bg-[rgba(244,242,237,0.52)] transition-colors"
      >
        <div>
          {badge && <p className="kicker-label mb-1">{badge}</p>}
          <h2 className="text-lg font-bold text-[var(--fiscal-ink)]">{title}</h2>
        </div>
        <div className="flex items-center gap-3">
          {extra}
          <ChevronDown className={`h-5 w-5 text-[var(--fiscal-muted)] transition-transform ${open ? "" : "-rotate-90"}`} />
        </div>
      </div>
      {open && <div className="px-6 pb-6 space-y-5">{children}</div>}
    </section>
  );
}

/* ═══════════════  State badge  ═══════════════ */

const STATE_STYLES: Record<string, string> = {
  COMPLETO:   "bg-[var(--fiscal-success-soft)] text-[var(--fiscal-success)] border-[rgba(31,122,90,0.18)]",
  EN_PROCESO: "bg-[var(--fiscal-accent-soft)] text-[var(--fiscal-accent)] border-[rgba(45,91,136,0.18)]",
  PENDIENTE:  "bg-[rgba(255,255,255,0.78)] text-[var(--fiscal-muted)] border-[rgba(200,192,177,0.72)]",
};

function StateBadge({ estado }: { estado: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${STATE_STYLES[estado] ?? STATE_STYLES.PENDIENTE}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${estado === "COMPLETO" ? "bg-emerald-500" : estado === "EN_PROCESO" ? "bg-blue-500" : "bg-slate-400"}`} />
      {ITEM_STATES.find((s) => s.value === estado)?.label ?? estado}
    </span>
  );
}

/* ═══════════════  Reducer  ═══════════════ */

type DraftItem = {
  pillar: string;
  titulo: string;
  descripcion: string;
  requerido: boolean;
  estado: string;
  vence_el: string;
  responsable: string;
};

type DraftDeliverable = {
  tipo_gasto: string;
  codigo: string;
  titulo: string;
  descripcion: string;
  pillar: string;
  requerido: boolean;
};

const EMPTY_ITEM: DraftItem = {
  pillar: "ENTREGABLES", titulo: "", descripcion: "", requerido: true,
  estado: "PENDIENTE", vence_el: "", responsable: "",
};

const EMPTY_DELIVERABLE: DraftDeliverable = {
  tipo_gasto: "", codigo: "", titulo: "", descripcion: "",
  pillar: "ENTREGABLES", requerido: true,
};

type State = {
  checklists: Checklist[];
  deliverables: DeliverableRequirement[];
  loading: boolean;
  saving: boolean;
  savingDeliverable: boolean;
  error: string | null;
  draftName: string;
  draftTipoGasto: string;
  draftItems: DraftItem[];
  deliverableDraft: DraftDeliverable;
  filter: string;
  filterPillar: string;
};

type Action =
  | { type: "SET_DATA"; checklists: Checklist[]; deliverables: DeliverableRequirement[] }
  | { type: "SET_LOADING"; value: boolean }
  | { type: "SET_SAVING"; value: boolean }
  | { type: "SET_SAVING_DELIVERABLE"; value: boolean }
  | { type: "SET_ERROR"; value: string | null }
  | { type: "SET_DRAFT_NAME"; value: string }
  | { type: "SET_DRAFT_TIPO_GASTO"; value: string }
  | { type: "SET_DRAFT_ITEMS"; items: DraftItem[] }
  | { type: "ADD_DRAFT_ITEM"; item?: DraftItem }
  | { type: "REMOVE_DRAFT_ITEM"; index: number }
  | { type: "UPDATE_DRAFT_ITEM"; index: number; patch: Partial<DraftItem> }
  | { type: "SET_DELIVERABLE_DRAFT"; patch: Partial<DraftDeliverable> }
  | { type: "RESET_DRAFT" }
  | { type: "SET_FILTER"; value: string }
  | { type: "SET_FILTER_PILLAR"; value: string };

const initialState: State = {
  checklists: [], deliverables: [], loading: false, saving: false,
  savingDeliverable: false, error: null, draftName: "", draftTipoGasto: "",
  draftItems: [{ ...EMPTY_ITEM }], deliverableDraft: { ...EMPTY_DELIVERABLE },
  filter: "", filterPillar: "",
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_DATA":
      return { ...state, checklists: action.checklists, deliverables: action.deliverables, loading: false, error: null };
    case "SET_LOADING":
      return { ...state, loading: action.value };
    case "SET_SAVING":
      return { ...state, saving: action.value };
    case "SET_SAVING_DELIVERABLE":
      return { ...state, savingDeliverable: action.value };
    case "SET_ERROR":
      return { ...state, error: action.value, loading: false };
    case "SET_DRAFT_NAME":
      return { ...state, draftName: action.value };
    case "SET_DRAFT_TIPO_GASTO":
      return { ...state, draftTipoGasto: action.value };
    case "SET_DRAFT_ITEMS":
      return { ...state, draftItems: action.items };
    case "ADD_DRAFT_ITEM":
      return { ...state, draftItems: [...state.draftItems, action.item ?? { ...EMPTY_ITEM }] };
    case "REMOVE_DRAFT_ITEM":
      return { ...state, draftItems: state.draftItems.filter((_, i) => i !== action.index) };
    case "UPDATE_DRAFT_ITEM": {
      const items = [...state.draftItems];
      items[action.index] = { ...items[action.index], ...action.patch };
      return { ...state, draftItems: items };
    }
    case "SET_DELIVERABLE_DRAFT":
      return { ...state, deliverableDraft: { ...state.deliverableDraft, ...action.patch } };
    case "RESET_DRAFT":
      return { ...state, draftName: "", draftTipoGasto: "", draftItems: [{ ...EMPTY_ITEM }] };
    case "SET_FILTER":
      return { ...state, filter: action.value };
    case "SET_FILTER_PILLAR":
      return { ...state, filterPillar: action.value };
    default:
      return state;
  }
}

/* ═══════════════  Page component  ═══════════════ */

export default function ChecklistsPage() {
  const [s, dispatch] = useReducer(reducer, initialState);
  const [liveFeedback, setLiveFeedback] = useState<{ tone: "success" | "error" | "info"; message: string } | null>(null);
  const [changingItemId, setChangingItemId] = useState<number | null>(null);
  const [deletingChecklistId, setDeletingChecklistId] = useState<number | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);
  const [deletingDeliverableId, setDeletingDeliverableId] = useState<number | null>(null);
  const [checklistValidationRequested, setChecklistValidationRequested] = useState(false);
  const [deliverableValidationRequested, setDeliverableValidationRequested] = useState(false);

  /* ── data loading ── */
  const load = useCallback(async () => {
    dispatch({ type: "SET_LOADING", value: true });
    try {
      const [cls, dels] = await Promise.all([fetchChecklists(), fetchDeliverableRequirements()]);
      dispatch({ type: "SET_DATA", checklists: cls, deliverables: dels });
    } catch {
      dispatch({ type: "SET_ERROR", value: "No pudimos cargar los checklists" });
      setLiveFeedback({ tone: "error", message: "No se pudieron cargar checklists y entregables." });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /* ── KPI metrics ── */
  const metrics = useMemo(() => {
    const allItems = s.checklists.flatMap((c) => c.items ?? []);
    const total = allItems.length;
    const done = allItems.filter((i) => i.estado === "COMPLETO").length;
    const pending = allItems.filter((i) => i.estado === "PENDIENTE").length;
    const inProgress = allItems.filter((i) => i.estado === "EN_PROCESO").length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const overdue = allItems.filter((i) => i.vence_el && i.estado !== "COMPLETO" && new Date(i.vence_el) < new Date()).length;
    return { total, done, pending, inProgress, pct, overdue, checklistCount: s.checklists.length };
  }, [s.checklists]);

  /* ── filtered checklists ── */
  const filteredChecklists = useMemo(() => {
    let result = s.checklists;
    if (s.filter) {
      const q = s.filter.toLowerCase();
      result = result.filter((c) =>
        c.nombre.toLowerCase().includes(q) ||
        (c.tipo_gasto ?? "").toLowerCase().includes(q) ||
        c.items?.some((i) => i.titulo.toLowerCase().includes(q))
      );
    }
    if (s.filterPillar) {
      result = result.filter((c) => c.items?.some((i) => i.pillar === s.filterPillar));
    }
    return result;
  }, [s.checklists, s.filter, s.filterPillar]);

  /* ── filtered deliverables for catalog ── */
  const filteredDeliverables = useMemo(() => {
    if (!s.draftTipoGasto) return s.deliverables;
    return s.deliverables.filter((d) => d.tipo_gasto.toLowerCase().includes(s.draftTipoGasto.toLowerCase()));
  }, [s.deliverables, s.draftTipoGasto]);

  const hasChecklistTaskTitle = useMemo(
    () => s.draftItems.some((item) => item.titulo.trim()),
    [s.draftItems],
  );
  const checklistNameMissing = checklistValidationRequested && !s.draftName.trim();
  const checklistTaskTitleMissing = checklistValidationRequested && !hasChecklistTaskTitle;
  const deliverableErrors = {
    tipo_gasto: deliverableValidationRequested && !s.deliverableDraft.tipo_gasto.trim(),
    codigo: deliverableValidationRequested && !s.deliverableDraft.codigo.trim(),
    titulo: deliverableValidationRequested && !s.deliverableDraft.titulo.trim(),
  };

  /* ── handlers ── */
  const handleCreate = async () => {
    setChecklistValidationRequested(true);
    if (!s.draftName.trim()) { await alertError("Falta nombre", "Asigna un nombre al checklist"); return; }
    if (s.draftItems.every((i) => !i.titulo.trim())) { await alertError("Sin tareas", "Agrega al menos una tarea con título"); return; }
    dispatch({ type: "SET_SAVING", value: true });
    try {
      await createChecklist({
        nombre: s.draftName.trim(),
        tipo_gasto: s.draftTipoGasto.trim(),
        vigente: true,
        items: s.draftItems.filter((i) => i.titulo.trim()).map((item) => ({
          ...item,
          titulo: item.titulo.trim(),
          descripcion: item.descripcion.trim(),
          responsable: item.responsable.trim(),
          vence_el: item.vence_el || undefined,
        })),
      });
      dispatch({ type: "RESET_DRAFT" });
      setChecklistValidationRequested(false);
      await alertSuccess("Checklist creado", "Actualiza el estado de cada tarea conforme avances");
      setLiveFeedback({ tone: "success", message: `Checklist creado: ${s.draftName.trim()}.` });
      void load();
    } catch (e) {
      setLiveFeedback({ tone: "error", message: `No se pudo crear el checklist: ${(e as Error).message}` });
      await alertError("No pudimos crear el checklist", (e as Error).message);
    } finally {
      dispatch({ type: "SET_SAVING", value: false });
    }
  };

  const handleStateChange = async (id: number, estado: string) => {
    setChangingItemId(id);
    try {
      await updateChecklistItem(id, { estado });
      const label = ITEM_STATES.find((item) => item.value === estado)?.label ?? estado;
      setLiveFeedback({ tone: "success", message: `Tarea actualizada a ${label}.` });
      void load();
    } catch (e) {
      setLiveFeedback({ tone: "error", message: `No se pudo actualizar la tarea: ${(e as Error).message}` });
      await alertError("Error al actualizar", (e as Error).message);
    } finally {
      setChangingItemId(null);
    }
  };

  const handleDeleteChecklist = async (id: number, nombre: string) => {
    const result = await Swal.fire({
      title: "¿Eliminar checklist?",
      text: `Se eliminará "${nombre}" y todas sus tareas.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return;
    try {
      setDeletingChecklistId(id);
      await deleteChecklist(id);
      setLiveFeedback({ tone: "success", message: `Checklist eliminado: ${nombre}.` });
      await alertSuccess("Eliminado", "El checklist fue eliminado");
      void load();
    } catch (e) {
      setLiveFeedback({ tone: "error", message: `No se pudo eliminar el checklist: ${(e as Error).message}` });
      await alertError("Error", (e as Error).message);
    } finally {
      setDeletingChecklistId(null);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    const result = await Swal.fire({
      title: "¿Eliminar tarea?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return;
    try {
      setDeletingItemId(itemId);
      await deleteChecklistItem(itemId);
      setLiveFeedback({ tone: "success", message: "Tarea eliminada del checklist." });
      void load();
    } catch (e) {
      setLiveFeedback({ tone: "error", message: `No se pudo eliminar la tarea: ${(e as Error).message}` });
      await alertError("Error", (e as Error).message);
    } finally {
      setDeletingItemId(null);
    }
  };

  const handleCreateDeliverable = async () => {
    const d = s.deliverableDraft;
    setDeliverableValidationRequested(true);
    if (!d.tipo_gasto.trim() || !d.codigo.trim() || !d.titulo.trim()) {
      await alertError("Faltan datos", "Tipo de gasto, código y título son obligatorios");
      return;
    }
    dispatch({ type: "SET_SAVING_DELIVERABLE", value: true });
    try {
      await createDeliverableRequirement({
        tipo_gasto: d.tipo_gasto.trim(), codigo: d.codigo.trim(),
        titulo: d.titulo.trim(), descripcion: d.descripcion.trim(),
        pillar: d.pillar, requerido: d.requerido,
      });
      await alertSuccess("Entregable guardado", "Se agregó al catálogo");
      setLiveFeedback({ tone: "success", message: `Entregable agregado: ${d.codigo.trim()}.` });
      dispatch({ type: "SET_DELIVERABLE_DRAFT", patch: { codigo: "", titulo: "", descripcion: "" } });
      setDeliverableValidationRequested(false);
      void load();
    } catch (e) {
      setLiveFeedback({ tone: "error", message: `No se pudo guardar el entregable: ${(e as Error).message}` });
      await alertError("Error al guardar", (e as Error).message);
    } finally {
      dispatch({ type: "SET_SAVING_DELIVERABLE", value: false });
    }
  };

  const handleDeleteDeliverable = async (id: number) => {
    const result = await Swal.fire({
      title: "¿Eliminar del catálogo?",
      icon: "warning", showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return;
    try {
      setDeletingDeliverableId(id);
      await deleteDeliverableRequirement(id);
      setLiveFeedback({ tone: "success", message: "Entregable eliminado del catálogo." });
      void load();
    } catch (e) {
      setLiveFeedback({ tone: "error", message: `No se pudo eliminar el entregable: ${(e as Error).message}` });
      await alertError("Error", (e as Error).message);
    } finally {
      setDeletingDeliverableId(null);
    }
  };

  const addDeliverableToDraft = (ent: DeliverableRequirement) => {
    dispatch({
      type: "ADD_DRAFT_ITEM",
      item: {
        pillar: ent.pillar, titulo: ent.titulo, descripcion: ent.descripcion || "",
        requerido: ent.requerido, estado: "PENDIENTE", vence_el: "", responsable: "",
      },
    });
    if (!s.draftTipoGasto && ent.tipo_gasto) dispatch({ type: "SET_DRAFT_TIPO_GASTO", value: ent.tipo_gasto });
  };

  /* ── pillar summary for each checklist ── */
  const checklistSummary = useCallback((items: ChecklistItem[]) => {
    const total = items.length;
    const done = items.filter((i) => i.estado === "COMPLETO").length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, pct };
  }, []);

  /* ═══════════════  RENDER  ═══════════════ */
  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* ── Header ── */}
        <header className="surface-panel-strong rounded-[1.75rem] p-6 shadow-fiscal">
          <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div>
              <p className="kicker-label">Pilares de cumplimiento</p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--fiscal-ink)] sm:text-[2.8rem]">Entregables y checklists</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--fiscal-muted)] sm:text-base">
                Controla la disciplina documental por tipo de gasto, asigna responsables y convierte cada checklist en una bitácora clara de cumplimiento.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <div className="rounded-full border border-[rgba(45,91,136,0.18)] bg-[var(--fiscal-accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--fiscal-accent)]">
                  Mesa de control por pilar
                </div>
                <div className="rounded-full border border-[rgba(143,240,224,0.22)] bg-[rgba(142,231,218,0.12)] px-3 py-2 text-xs font-semibold text-[var(--fiscal-gold)]">
                  Biblioteca reutilizable de entregables
                </div>
                <div className="rounded-full border border-[rgba(31,122,90,0.18)] bg-[var(--fiscal-success-soft)] px-3 py-2 text-xs font-semibold text-[var(--fiscal-success)]">
                  Cada tenant nuevo recibe plantillas base precargadas
                </div>
              </div>
            </div>
            <div className="surface-shell rounded-[1.5rem] p-5 text-white">
              <p className="eyebrow-shell">Control de seguimiento</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-white">Cada checklist debe narrar avance, responsable y evidencia pendiente</h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-[rgba(220,255,250,0.78)]">
                Aquí no solo se marcan tareas. Se construye una disciplina de cierre que debe ser visible, auditable y fácil de reasignar.
              </p>
              <div className="mt-4 flex justify-end">
                <GuiaContador
                  section="Checklists de cumplimiento"
                  steps={[
                    { title: "Crea un checklist", description: "Asigna un <strong>nombre</strong> y un <strong>tipo de gasto</strong>. Agrega las tareas requeridas por pilar." },
                    { title: "Usa el catálogo", description: "Añade entregables predefinidos del <strong>catálogo</strong> con un clic." },
                    { title: "Asigna responsable y fecha", description: "Cada tarea puede tener un <strong>responsable</strong> y <strong>fecha de vencimiento</strong>." },
                    { title: "Marca avance", description: "Cambia el estado: <strong>Pendiente → En proceso → Completo</strong>." },
                  ]}
                  concepts={[
                    { term: "Pilar de cumplimiento", definition: "Eje temático: Entregables, Razón de negocio, Capacidad del proveedor, Fecha cierta." },
                    { term: "Tipo de gasto", definition: "Clasificación del gasto: CapEx, OpEx, viáticos, honorarios, etc." },
                    { term: "Catálogo de entregables", definition: "Biblioteca reutilizable de tareas estándar por tipo de gasto." },
                    { term: "Trazabilidad", definition: "Rastreo de quién, cuándo y cómo se completó cada entregable." },
                  ]}
                  tips={[
                    "Crea un checklist por cada <strong>tipo de gasto recurrente</strong>.",
                    "Usa el catálogo para <strong>no reinventar tareas</strong>.",
                    "Revisa checklists <strong>antes del cierre mensual</strong>.",
                    "Pon fechas de vencimiento <strong>5 días antes</strong> del cierre real.",
                  ]}
                />
              </div>
            </div>
          </div>
        </header>

        {liveFeedback && (
          <div
            role={liveFeedback.tone === "error" ? "alert" : "status"}
            aria-live={liveFeedback.tone === "error" ? "assertive" : "polite"}
            className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
              liveFeedback.tone === "success"
                ? "border-[rgba(31,122,90,0.18)] bg-[var(--fiscal-success-soft)] text-[var(--fiscal-success)]"
                : liveFeedback.tone === "error"
                  ? "border-[rgba(160,67,61,0.22)] bg-[var(--fiscal-danger-soft)] text-[var(--fiscal-danger)]"
                  : "border-[rgba(45,91,136,0.18)] bg-[var(--fiscal-accent-soft)] text-[var(--fiscal-accent)]"
            }`}
          >
            {liveFeedback.message}
          </div>
        )}

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi
            label="Checklists"
            value={metrics.checklistCount}
            sub={`${metrics.total} tareas totales`}
            color={metrics.checklistCount > 0 ? "blue" : "gray"}
            icon={<ClipboardCheck className="h-5 w-5 text-[var(--fiscal-accent)]" />}
          />
          <Kpi
            label="Completadas"
            value={metrics.done}
            sub={metrics.total > 0 ? `${metrics.pct}% del total` : "Sin tareas"}
            color={metrics.pct === 100 ? "green" : metrics.pct >= 50 ? "blue" : metrics.done > 0 ? "amber" : "gray"}
            icon={<ShieldCheck className="h-5 w-5 text-[var(--fiscal-success)]" />}
          />
          <Kpi
            label="Pendientes"
            value={metrics.pending}
            sub={metrics.inProgress > 0 ? `${metrics.inProgress} en proceso` : "—"}
            color={metrics.pending === 0 && metrics.total > 0 ? "green" : metrics.pending > 5 ? "red" : metrics.pending > 0 ? "amber" : "gray"}
            icon={<ShieldAlert className="h-5 w-5 text-[var(--fiscal-warning)]" />}
          />
          <Kpi
            label="Vencidas"
            value={metrics.overdue}
            sub={metrics.overdue > 0 ? "Requieren atención" : "Al corriente"}
            color={metrics.overdue > 0 ? "red" : metrics.total > 0 ? "green" : "gray"}
            icon={<AlertTriangle className="h-5 w-5 text-[var(--fiscal-danger)]" />}
          />
        </div>

        {/* ── Section 1: Nuevo checklist ── */}
        <Section badge="Paso 1" title="Nuevo checklist" defaultOpen>
          <div aria-busy={s.saving}>
          <div className="rounded-2xl border border-[rgba(160,67,61,0.16)] bg-[var(--fiscal-danger-soft)]/45 px-4 py-3 text-sm text-[var(--fiscal-ink)]">
            <p className="font-semibold text-[var(--fiscal-danger)]">Campos obligatorios para crear</p>
            <p className="mt-1 text-xs text-[var(--fiscal-muted)]">Nombre del checklist y al menos una tarea con título. El tipo de gasto y el resto del detalle siguen siendo opcionales.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={requiredLabelCls}>Nombre <span className="font-bold text-[var(--fiscal-danger)]">*</span></label>
              <input
                className={`${requiredInputCls(checklistNameMissing)} mt-1`}
                placeholder="Ej. Checklist auditoría Q1 2026"
                value={s.draftName}
                onChange={(e) => dispatch({ type: "SET_DRAFT_NAME", value: e.target.value })}
              />
              {checklistNameMissing && (
                <p className={requiredHintCls}>Asigna un nombre antes de crear el checklist.</p>
              )}
            </div>
            <div>
              <label className={requiredLabelCls}>Tipo de gasto</label>
              <input
                className={`${inputCls} mt-1`}
                placeholder="Ej. Honorarios, CapEx, Viáticos…"
                value={s.draftTipoGasto}
                onChange={(e) => dispatch({ type: "SET_DRAFT_TIPO_GASTO", value: e.target.value })}
              />
            </div>
          </div>

          {/* ── Draft items ── */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xs font-bold text-[var(--fiscal-muted)] uppercase tracking-wider">Tareas del checklist</h3>
              <span className="rounded-full border border-[rgba(160,67,61,0.18)] bg-[var(--fiscal-danger-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--fiscal-danger)]">Al menos un título</span>
            </div>
            {checklistTaskTitleMissing && (
              <p className={requiredHintCls}>Captura el título de al menos una tarea para poder crear el checklist.</p>
            )}
            {s.draftItems.map((item, idx) => (
              <div key={idx} className="relative rounded-xl border border-[rgba(200,192,177,0.72)] bg-white p-4 space-y-3 shadow-panel">
                {s.draftItems.length > 1 && (
                  <button
                    type="button"
                    className="absolute top-3 right-3 text-[var(--fiscal-muted)] hover:text-[var(--fiscal-danger)] transition"
                    title="Quitar tarea"
                    onClick={() => dispatch({ type: "REMOVE_DRAFT_ITEM", index: idx })}
                  >
                    ✕
                  </button>
                )}
                <div className="grid gap-3 md:grid-cols-2">
                  <select
                    className={inputCls}
                    value={item.pillar}
                    onChange={(e) => dispatch({ type: "UPDATE_DRAFT_ITEM", index: idx, patch: { pillar: e.target.value } })}
                  >
                    {PILLARS.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
                  </select>
                  <div>
                    <input
                      className={requiredInputCls(checklistTaskTitleMissing && !item.titulo.trim())}
                      placeholder="Título de la tarea"
                      value={item.titulo}
                      onChange={(e) => dispatch({ type: "UPDATE_DRAFT_ITEM", index: idx, patch: { titulo: e.target.value } })}
                    />
                    {checklistTaskTitleMissing && !item.titulo.trim() && idx === 0 && (
                      <p className={requiredHintCls}>Por lo menos una tarea debe incluir título.</p>
                    )}
                  </div>
                </div>
                <textarea
                  className={inputCls}
                  placeholder="Descripción o instrucciones"
                  rows={2}
                  value={item.descripcion}
                  onChange={(e) => dispatch({ type: "UPDATE_DRAFT_ITEM", index: idx, patch: { descripcion: e.target.value } })}
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    className={inputCls}
                    placeholder="Responsable asignado"
                    value={item.responsable}
                    onChange={(e) => dispatch({ type: "UPDATE_DRAFT_ITEM", index: idx, patch: { responsable: e.target.value } })}
                  />
                  <input
                    type="date"
                    className={inputCls}
                    value={item.vence_el}
                    onChange={(e) => dispatch({ type: "UPDATE_DRAFT_ITEM", index: idx, patch: { vence_el: e.target.value } })}
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              className="text-sm font-semibold text-[var(--fiscal-accent)] hover:text-[var(--fiscal-accent)]/80 transition"
              onClick={() => dispatch({ type: "ADD_DRAFT_ITEM" })}
            >
              + Añadir otra tarea
            </button>
          </div>

          <div className="pt-4 border-t border-[rgba(200,192,177,0.55)] flex justify-end">
            <button type="button" disabled={s.saving} aria-disabled={s.saving} aria-busy={s.saving} onClick={() => void handleCreate()} className={btnPrimary}>
              {s.saving ? "Creando…" : "✦ Crear checklist"}
            </button>
          </div>
          </div>
        </Section>

        {/* ── Section 2: Catálogo de entregables ── */}
        <Section badge="Biblioteca" title="Catálogo de entregables" extra={
          <span className="rounded-full border border-[rgba(200,192,177,0.72)] bg-[rgba(255,255,255,0.72)] px-3 py-1 text-xs text-[var(--fiscal-muted)] font-medium">{s.deliverables.length} registros</span>
        }>
          <div aria-busy={s.savingDeliverable}>
          <div className="rounded-2xl border border-[rgba(160,67,61,0.16)] bg-[var(--fiscal-danger-soft)]/45 px-4 py-3 text-sm text-[var(--fiscal-ink)]">
            <p className="font-semibold text-[var(--fiscal-danger)]">Campos obligatorios para guardar</p>
            <p className="mt-1 text-xs text-[var(--fiscal-muted)]">Tipo de gasto, código y título del entregable.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div>
            <input className={requiredInputCls(deliverableErrors.tipo_gasto)} placeholder="Tipo de gasto" value={s.deliverableDraft.tipo_gasto}
              onChange={(e) => dispatch({ type: "SET_DELIVERABLE_DRAFT", patch: { tipo_gasto: e.target.value } })} />
            {deliverableErrors.tipo_gasto && <p className={requiredHintCls}>Indica a qué tipo de gasto corresponde.</p>}
            </div>
            <div>
            <input className={requiredInputCls(deliverableErrors.codigo)} placeholder="Código identificador" value={s.deliverableDraft.codigo}
              onChange={(e) => dispatch({ type: "SET_DELIVERABLE_DRAFT", patch: { codigo: e.target.value } })} />
            {deliverableErrors.codigo && <p className={requiredHintCls}>Captura el código identificador del entregable.</p>}
            </div>
            <div>
            <input className={requiredInputCls(deliverableErrors.titulo)} placeholder="Título del entregable" value={s.deliverableDraft.titulo}
              onChange={(e) => dispatch({ type: "SET_DELIVERABLE_DRAFT", patch: { titulo: e.target.value } })} />
            {deliverableErrors.titulo && <p className={requiredHintCls}>Agrega un título para guardar el entregable.</p>}
            </div>
            <select className={inputCls} value={s.deliverableDraft.pillar}
              onChange={(e) => dispatch({ type: "SET_DELIVERABLE_DRAFT", patch: { pillar: e.target.value } })}>
              {PILLARS.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
            </select>
          </div>
          <textarea className={inputCls} placeholder="Descripción general (opcional)" rows={2}
            value={s.deliverableDraft.descripcion}
            onChange={(e) => dispatch({ type: "SET_DELIVERABLE_DRAFT", patch: { descripcion: e.target.value } })} />
          <div className="flex flex-col gap-3 border-t border-[rgba(200,192,177,0.55)] pt-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-sm font-medium text-[var(--fiscal-ink)] cursor-pointer">
              <input type="checkbox" checked={s.deliverableDraft.requerido}
                onChange={(e) => dispatch({ type: "SET_DELIVERABLE_DRAFT", patch: { requerido: e.target.checked } })}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              Obligatorio
            </label>
            <button type="button" disabled={s.savingDeliverable} aria-disabled={s.savingDeliverable} aria-busy={s.savingDeliverable} onClick={() => void handleCreateDeliverable()} className={`${btnPrimary} w-full sm:w-auto`}>
              {s.savingDeliverable ? "Guardando…" : "Guardar en catálogo"}
            </button>
          </div>

          {/* ── Catalog list ── */}
          {filteredDeliverables.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[rgba(200,192,177,0.72)] bg-[rgba(255,255,255,0.56)] px-6 py-8 text-center">
              <LibraryBig className="mx-auto h-10 w-10 text-[var(--fiscal-muted)]/50" />
              <p className="mt-3 text-sm italic text-[var(--fiscal-muted)]">El catálogo aún está vacío. Registra el primer entregable para convertir este bloque en una biblioteca reutilizable.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredDeliverables.map((ent) => (
                <div key={ent.id ?? ent.codigo} className="group rounded-xl border border-[rgba(200,192,177,0.72)] bg-[rgba(255,255,255,0.82)] p-3 shadow-panel hover:border-[rgba(45,91,136,0.22)] hover:bg-white transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[var(--fiscal-ink)] text-sm truncate">{ent.codigo} · {ent.titulo}</p>
                      <p className="text-[var(--fiscal-accent)] text-[10px] font-bold uppercase tracking-wider mt-0.5">
                        {PILLARS.find((p) => p.value === ent.pillar)?.label}
                      </p>
                      {ent.descripcion && <p className="mt-1 text-[var(--fiscal-muted)] text-xs line-clamp-2">{ent.descripcion}</p>}
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button type="button" className={btnOutline} onClick={() => addDeliverableToDraft(ent)}>
                        + Añadir
                      </button>
                      {ent.id && (
                        <button type="button" className={btnDanger} onClick={() => void handleDeleteDeliverable(ent.id!)} disabled={deletingDeliverableId === ent.id} aria-disabled={deletingDeliverableId === ent.id} aria-busy={deletingDeliverableId === ent.id}>
                          {deletingDeliverableId === ent.id ? "Eliminando…" : "Eliminar"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </Section>

        {/* ── Section 3: Checklists activos ── */}
        <Section
          badge="Seguimiento"
          title={s.loading ? "Cargando checklists…" : `Checklists activos (${filteredChecklists.length})`}
          defaultOpen
          extra={s.error ? <span className="rounded-md border border-[rgba(160,67,61,0.22)] bg-[var(--fiscal-danger-soft)] px-3 py-1 text-xs font-medium text-[var(--fiscal-danger)]">{s.error}</span> : undefined}
        >
          <div aria-busy={s.loading}>
          {/* Filters */}
          <div className="grid gap-3 md:grid-cols-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fiscal-muted)]" />
              <input
                className={`${inputCls} pl-10`}
                placeholder="Buscar por nombre, gasto o tarea…"
                value={s.filter}
                onChange={(e) => dispatch({ type: "SET_FILTER", value: e.target.value })}
              />
            </div>
            <select
              className={inputCls}
              value={s.filterPillar}
              onChange={(e) => dispatch({ type: "SET_FILTER_PILLAR", value: e.target.value })}
            >
              <option value="">Todos los pilares</option>
              {PILLARS.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
            </select>
            <div className="flex items-center text-xs text-[var(--fiscal-muted)]">
              {filteredChecklists.length !== s.checklists.length && (
                <span>Mostrando {filteredChecklists.length} de {s.checklists.length}</span>
              )}
            </div>
          </div>

          {/* Checklist cards */}
          {filteredChecklists.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[rgba(200,192,177,0.72)] bg-[rgba(255,255,255,0.56)] py-12 text-center">
              <BookMarked className="mx-auto h-12 w-12 text-[var(--fiscal-muted)]/50" />
              <p className="mt-3 font-medium text-[var(--fiscal-muted)]">Todavía no hay checklists activos</p>
              <p className="mt-1 text-sm text-[var(--fiscal-muted)]">Construye el primero arriba para iniciar el seguimiento documental del flujo.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {filteredChecklists.map((c) => {
                const sum = checklistSummary(c.items ?? []);
                const pctColor = sum.pct === 100 ? "bg-emerald-500" : sum.pct >= 50 ? "bg-blue-500" : sum.pct > 0 ? "bg-amber-500" : "bg-slate-300";
                return (
                  <article key={c.id} className="overflow-hidden rounded-2xl border border-[rgba(200,192,177,0.72)] bg-white shadow-panel">
                    {/* Checklist header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(200,192,177,0.55)] bg-[rgba(244,242,237,0.62)] px-5 py-4">
                      <div>
                        <h3 className="text-lg font-bold text-[var(--fiscal-ink)]">{c.nombre}</h3>
                        <p className="mt-0.5 text-xs font-medium text-[var(--fiscal-muted)]">{c.tipo_gasto || "Gasto general"}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Progress badge */}
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-[rgba(200,192,177,0.72)]">
                            <div className={`h-full rounded-full transition-all ${pctColor}`} style={{ width: `${sum.pct}%` }} />
                          </div>
                          <span className="text-xs font-bold text-[var(--fiscal-muted)]">{sum.done}/{sum.total}</span>
                        </div>
                        {/* Delete checklist */}
                        {c.id && (
                          <button type="button" className={btnDanger} onClick={() => void handleDeleteChecklist(c.id!, c.nombre)} disabled={deletingChecklistId === c.id} aria-disabled={deletingChecklistId === c.id} aria-busy={deletingChecklistId === c.id}>
                            {deletingChecklistId === c.id ? "Eliminando…" : "Eliminar"}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Items */}
                    <div className="divide-y divide-[rgba(200,192,177,0.42)]">
                      {(c.items ?? []).map((item) => {
                        const isOverdue = item.vence_el && item.estado !== "COMPLETO" && new Date(item.vence_el) < new Date();
                        return (
                          <div key={item.id ?? item.titulo} className="flex flex-col gap-3 px-5 py-3.5 transition-colors hover:bg-[rgba(244,242,237,0.46)] md:flex-row md:items-center">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="rounded-md bg-[var(--fiscal-accent-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--fiscal-accent)]">
                                  {PILLARS.find((p) => p.value === item.pillar)?.label}
                                </span>
                                {isOverdue && (
                                  <span className="rounded-md bg-[var(--fiscal-danger-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--fiscal-danger)] animate-pulse">
                                    Vencida
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-sm font-semibold text-[var(--fiscal-ink)]">{item.titulo}</p>
                              {item.descripcion && <p className="mt-0.5 text-xs text-[var(--fiscal-muted)] line-clamp-1">{item.descripcion}</p>}
                              <div className="flex flex-wrap items-center gap-4 mt-1.5">
                                {item.responsable && (
                                  <span className="flex items-center gap-1 text-xs text-[var(--fiscal-muted)]">
                                    <UserCircle2 className="h-3.5 w-3.5" />
                                    {item.responsable}
                                  </span>
                                )}
                                {item.vence_el && (
                                  <span className={`flex items-center gap-1 text-xs ${isOverdue ? "font-semibold text-[var(--fiscal-danger)]" : "text-[var(--fiscal-muted)]"}`}>
                                    <CalendarDays className="h-3.5 w-3.5" />
                                    {item.vence_el}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {item.id && (
                                <>
                                  <select
                                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-offset-1 transition ${
                                      item.estado === "COMPLETO"   ? "bg-[var(--fiscal-success-soft)] border-[rgba(31,122,90,0.18)] text-[var(--fiscal-success)] focus:ring-[rgba(31,122,90,0.22)]" :
                                      item.estado === "EN_PROCESO" ? "bg-[var(--fiscal-accent-soft)] border-[rgba(45,91,136,0.18)] text-[var(--fiscal-accent)] focus:ring-[rgba(45,91,136,0.22)]" :
                                                                     "bg-white border-[rgba(200,192,177,0.72)] text-[var(--fiscal-muted)] focus:ring-[rgba(200,192,177,0.55)]"
                                    }`}
                                    value={item.estado}
                                    disabled={changingItemId === item.id}
                                    aria-disabled={changingItemId === item.id}
                                    aria-busy={changingItemId === item.id}
                                    onChange={(e) => void handleStateChange(item.id!, e.target.value)}
                                  >
                                    {ITEM_STATES.map((st) => (<option key={st.value} value={st.value}>{st.label}</option>))}
                                  </select>
                                  <button type="button" className="text-[var(--fiscal-muted)] hover:text-[var(--fiscal-danger)] transition text-sm disabled:opacity-50" title="Eliminar tarea"
                                    disabled={deletingItemId === item.id}
                                    aria-disabled={deletingItemId === item.id}
                                    aria-busy={deletingItemId === item.id}
                                    onClick={() => void handleDeleteItem(item.id!)}>✕</button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          </div>
        </Section>

        {/* ── Section 4: Resumen de pilares ── */}
        <Section badge="Referencia" title="Resumen de pilares">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((p) => {
              const items = s.checklists.flatMap((c) => c.items ?? []).filter((i) => i.pillar === p.value);
              const done = items.filter((i) => i.estado === "COMPLETO").length;
              const total = items.length;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <div key={p.value} className="rounded-xl border border-[rgba(200,192,177,0.72)] bg-[rgba(255,255,255,0.82)] p-4 shadow-panel">
                  <div className="flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-[var(--fiscal-accent)]" />
                    <p className="text-xs font-bold text-[var(--fiscal-accent)] uppercase tracking-wider">{p.label}</p>
                  </div>
                  <p className="mt-2 font-display text-3xl font-semibold text-[var(--fiscal-ink)]">{done}/{total}</p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[rgba(200,192,177,0.72)]">
                    <div
                      className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : pct > 0 ? "bg-blue-500" : "bg-slate-300"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-[var(--fiscal-muted)]">{pct}% completado</p>
                </div>
              );
            })}
          </div>
        </Section>
      </div>
    </DashboardShell>
  );
}
