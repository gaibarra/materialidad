"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import type { KeyboardEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Swal from "sweetalert2";
import {
  AlertCircle,
  BookOpen,
  ChevronDown,
  Clock,
  Download,
  ExternalLink,
  History,
  Loader2,
  MessageSquare,
  Printer,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";

import { DashboardShell } from "../../../components/DashboardShell";
import { useAuthContext } from "../../../context/AuthContext";
import { SOURCE_TYPE_OPTIONS, fetchAvailableLaws } from "../../../lib/legal";
import {
  createLegalConsultation,
  exportLegalConsultationPdf,
  fetchLegalConsultations,
  deleteLegalConsultation,
  type LegalConsultation,
} from "../../../lib/consultations";
import HelpGuide from "../../../components/HelpGuide";

/* ═══════════════════════════════════════════════════════════
   Design-system tokens
   ═══════════════════════════════════════════════════════════ */

const inputCls =
  "w-full rounded-xl border border-[rgba(200,192,177,0.72)] bg-[rgba(255,255,255,0.82)] px-3 py-2 text-sm text-[var(--fiscal-ink)] placeholder:text-[var(--fiscal-muted)] focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)] transition";

const textareaCls =
  "w-full min-h-[110px] resize-y rounded-xl border border-[rgba(200,192,177,0.72)] bg-[rgba(255,255,255,0.82)] px-3 py-2.5 text-sm text-[var(--fiscal-ink)] placeholder:text-[var(--fiscal-muted)] focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)] transition";

const KPI_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  green: { bg: "bg-[var(--fiscal-success-soft)]/80", text: "text-[var(--fiscal-success)]", dot: "bg-[var(--fiscal-success)]" },
  blue:  { bg: "bg-[var(--fiscal-accent-soft)]/80", text: "text-[var(--fiscal-accent)]", dot: "bg-[var(--fiscal-accent)]" },
  amber: { bg: "bg-[var(--fiscal-warning-soft)]/80", text: "text-[var(--fiscal-warning)]", dot: "bg-[var(--fiscal-warning)]" },
  red:   { bg: "bg-[var(--fiscal-danger-soft)]/80", text: "text-[var(--fiscal-danger)]", dot: "bg-[var(--fiscal-danger)]" },
  gray:  { bg: "bg-[rgba(255,255,255,0.78)]", text: "text-[var(--fiscal-muted)]", dot: "bg-[var(--fiscal-muted)]" },
};

const MAX_REFERENCIAS_OPTIONS = [1, 2, 3, 4, 5, 6]; // Backend MaxValueValidator(6)

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
}: {
  badge?: string;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="surface-panel overflow-hidden rounded-[1.75rem] shadow-fiscal">
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
              <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--fiscal-accent)]">
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

/* ═══════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════ */

const formatDate = (value: string) => {
  try {
    return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
};

const isTechnicalIncidentResponse = (consultation?: Pick<LegalConsultation, "estado" | "respuesta"> | null) => {
  if (!consultation) return false;
  if (consultation.estado) return consultation.estado === "error";
  return consultation.respuesta.trimStart().toUpperCase().startsWith("ERROR:");
};

const compactDate = (value?: string) => {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
};

const sectionLabelMap: Record<string, string> = {
  ARTICULO: "Artículo",
  REGLA: "Regla",
  CRITERIO: "Criterio",
  TESIS: "Tesis",
  PRECEDENTE: "Precedente",
  CHUNK: "Fragmento",
};

const vigencyTone = (status?: string) => {
  if (status === "VIGENTE") return "bg-[var(--fiscal-success-soft)] text-[var(--fiscal-success)] ring-[rgba(31,122,90,0.18)]";
  if (status === "HISTORICA" || status === "DEROGADA" || status === "ABROGADA") return "bg-[var(--fiscal-warning-soft)] text-[var(--fiscal-warning)] ring-[rgba(176,113,24,0.18)]";
  return "bg-[rgba(244,242,237,0.88)] text-[var(--fiscal-muted)] ring-[rgba(200,192,177,0.42)]";
};

const isReferenceCurrent = (ref: LegalConsultation["referencias"][number]) => ref.es_vigente || ref.estatus_vigencia === "VIGENTE";
const isFallbackConsultation = (consultation?: Pick<LegalConsultation, "modelo"> | null) => Boolean(consultation?.modelo && consultation.modelo.toLowerCase().includes("fallback"));

const consultationTypeTone = (code?: string) => {
  if (!code) return "bg-[rgba(244,242,237,0.88)] text-[var(--fiscal-muted)] ring-[rgba(200,192,177,0.42)]";
  if (code === "69b_definitivo") return "bg-[var(--fiscal-danger-soft)] text-[var(--fiscal-danger)] ring-[rgba(160,67,61,0.22)]";
  if (code === "69b_presunto" || code === "69b") return "bg-[var(--fiscal-warning-soft)] text-[var(--fiscal-warning)] ring-[rgba(176,113,24,0.18)]";
  if (code.startsWith("materialidad")) return "bg-[var(--fiscal-success-soft)] text-[var(--fiscal-success)] ring-[rgba(31,122,90,0.18)]";
  if (code === "deducibilidad") return "bg-[var(--fiscal-accent-soft)] text-[var(--fiscal-accent)] ring-[rgba(45,91,136,0.18)]";
  if (code === "intercompany") return "bg-[rgba(184,137,70,0.10)] text-[var(--fiscal-gold)] ring-[rgba(184,137,70,0.20)]";
  return "bg-[rgba(244,242,237,0.88)] text-[var(--fiscal-muted)] ring-[rgba(200,192,177,0.42)]";
};

const supportTone = ({ hasCurrentSupport, hasIndexedSupport }: { hasCurrentSupport: boolean; hasIndexedSupport: boolean }) => {
  if (hasCurrentSupport) return "Sustento vigente verificado";
  if (hasIndexedSupport) return "Soporte histórico o por validar";
  return "Sin sustento indexado";
};

const printDocumentTitle = (consultation?: LegalConsultation | null) => {
  if (!consultation) return "Opinión legal preliminar";
  return consultation.tipo_consulta?.label
    ? `Opinión legal preliminar · ${consultation.tipo_consulta.label}`
    : "Opinión legal preliminar";
};

const getSignatoryRole = (isStaff?: boolean, isSuperuser?: boolean) => {
  if (isSuperuser || isStaff) return "Socio responsable del despacho";
  return "Responsable de criterio fiscal";
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const highlightReferenceText = (text: string, phrases?: string[], terms?: string[]) => {
  const normalizedText = text?.trim();
  if (!normalizedText) return text;

  const preferredMatches = [
    ...(phrases ?? []),
    ...(terms ?? []).filter((term) => !(phrases ?? []).some((phrase) => phrase.toLowerCase() === term.toLowerCase())),
  ];

  const uniqueTerms = [...new Set(preferredMatches.map((term) => term.trim()).filter(Boolean))]
    .sort((left, right) => right.length - left.length);

  if (!uniqueTerms.length) return normalizedText;

  const pattern = uniqueTerms.map(escapeRegExp).join("|");
  if (!pattern) return normalizedText;

  const matcher = new RegExp(`(${pattern})`, "ig");
  const segments = normalizedText.split(matcher);

  return segments.map((segment, index) => {
    if (!segment) return null;
    const isMatch = uniqueTerms.some((term) => segment.toLowerCase() === term.toLowerCase());
    if (!isMatch) {
      return <span key={`${segment}-${index}`}>{segment}</span>;
    }
    return (
      <mark
        key={`${segment}-${index}`}
        className="rounded-md bg-[rgba(184,137,70,0.18)] px-1 py-0.5 font-semibold text-[var(--fiscal-ink)]"
      >
        {segment}
      </mark>
    );
  });
};

/* ═══════════════════════════════════════════════════════════
   Reducer
   ═══════════════════════════════════════════════════════════ */

type State = {
  consultations: LegalConsultation[];
  selectedId: number | null;
  loading: boolean;
  sending: boolean;
  laws: string[];
  question: string;
  contexto: string;
  ley: string;
  tipoFuente: string;
  maxRefs: number;
};

const init: State = {
  consultations: [],
  selectedId: null,
  loading: true,
  sending: false,
  laws: [],
  question: "",
  contexto: "",
  ley: "",
  tipoFuente: "",
  maxRefs: 3,
};

type Action =
  | { type: "SET_CONSULTATIONS"; payload: LegalConsultation[] }
  | { type: "ADD_CONSULTATION"; payload: LegalConsultation }
  | { type: "REMOVE_CONSULTATION"; id: number }
  | { type: "SELECT"; id: number | null }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_SENDING"; payload: boolean }
  | { type: "SET_LAWS"; payload: string[] }
  | { type: "SET_FIELD"; field: "question" | "contexto" | "ley" | "tipoFuente"; value: string }
  | { type: "SET_MAX_REFS"; payload: number }
  | { type: "CLEAR_FORM" };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "SET_CONSULTATIONS":
      return { ...s, consultations: a.payload, loading: false, selectedId: s.selectedId ?? (a.payload[0]?.id ?? null) };
    case "ADD_CONSULTATION":
      return { ...s, consultations: [a.payload, ...s.consultations], selectedId: a.payload.id, sending: false, question: "", contexto: "" };
    case "REMOVE_CONSULTATION": {
      const next = s.consultations.filter((c) => c.id !== a.id);
      return { ...s, consultations: next, selectedId: s.selectedId === a.id ? (next[0]?.id ?? null) : s.selectedId };
    }
    case "SELECT":
      return { ...s, selectedId: a.id };
    case "SET_LOADING":
      return { ...s, loading: a.payload };
    case "SET_SENDING":
      return { ...s, sending: a.payload };
    case "SET_LAWS":
      return { ...s, laws: a.payload };
    case "SET_FIELD":
      return { ...s, [a.field]: a.value };
    case "SET_MAX_REFS":
      return { ...s, maxRefs: a.payload };
    case "CLEAR_FORM":
      return { ...s, question: "", contexto: "", ley: "", tipoFuente: "", maxRefs: 3 };
    default:
      return s;
  }
}

/* ═══════════════════════════════════════════════════════════
   Page component
   ═══════════════════════════════════════════════════════════ */

export default function LegalConsultationPage() {
  const router = useRouter();
  const { isAuthenticated, isProfileLoaded, user } = useAuthContext();
  const [s, dispatch] = useReducer(reducer, init);
  const [liveFeedback, setLiveFeedback] = useState<{ tone: "success" | "error" | "info"; message: string } | null>(null);

  /* ── Auth guard ── */
  useEffect(() => {
    if (isProfileLoaded && !isAuthenticated) router.replace("/login");
  }, [isAuthenticated, isProfileLoaded, router]);

  /* ── Load data ── */
  const loadConsultations = useCallback(async () => {
    if (!isAuthenticated) return;
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const payload = await fetchLegalConsultations();
      dispatch({ type: "SET_CONSULTATIONS", payload: payload.results });
    } catch {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [isAuthenticated]);

  const loadLaws = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const options = await fetchAvailableLaws();
      dispatch({ type: "SET_LAWS", payload: options });
    } catch { /* silently fail — laws dropdown stays empty */ }
  }, [isAuthenticated]);

  useEffect(() => { void loadConsultations(); }, [loadConsultations]);
  useEffect(() => { void loadLaws(); }, [loadLaws]);

  /* ── Derived ── */
  const selectedConsultation = useMemo(() => {
    if (!s.consultations.length) return null;
    if (s.selectedId) return s.consultations.find((c) => c.id === s.selectedId) ?? s.consultations[0];
    return s.consultations[0];
  }, [s.consultations, s.selectedId]);

  const references = selectedConsultation?.referencias ?? [];
  const currentReferences = references.filter(isReferenceCurrent);
  const historicalReferences = references.filter((ref) => !isReferenceCurrent(ref));
  const hasCurrentSupport = currentReferences.length > 0;
  const hasIndexedSupport = references.length > 0;
  const isFallbackResult = isFallbackConsultation(selectedConsultation);
  const supportLabel = supportTone({ hasCurrentSupport, hasIndexedSupport });
  const signatoryRole = getSignatoryRole(user?.is_staff, user?.is_superuser);
  const signatoryOrgLabel = user?.despacho_slug
    ? `${user?.despacho_tipo === "corporativo" ? "Corporativo" : "Despacho"} ${user.despacho_slug}`
    : "Despacho / corporativo del expediente";

  const getReferenceTitle = (ref: LegalConsultation["referencias"][number]) => {
    if (ref.rubro) return ref.rubro;
    if (ref.identifier && ref.section_type) return `${sectionLabelMap[ref.section_type] ?? ref.section_type} ${ref.identifier}`;
    if (ref.registro_digital) return `Registro digital ${ref.registro_digital}`;
    if (ref.articulo) return `Artículo ${ref.articulo}`;
    return ref.ley;
  };

  const getReferenceMeta = (ref: LegalConsultation["referencias"][number]) => {
    return [
      ref.autoridad_emisora,
      ref.section_type ? sectionLabelMap[ref.section_type] ?? ref.section_type : "",
      ref.identifier,
      ref.registro_digital ? `Registro ${ref.registro_digital}` : "",
      ref.tesis,
    ]
      .filter(Boolean)
      .join(" · ");
  };

  const formattedLaws = useMemo(() => {
    if (!s.laws.length) return [];
    return [...new Set(s.laws)].sort((a, b) => a.localeCompare(b));
  }, [s.laws]);

  /* ── Metrics ── */
  const totalConsultas = s.consultations.length;
  const totalRefs = s.consultations.reduce((sum, c) => sum + (c.referencias?.length ?? 0), 0);
  const avgRefs = totalConsultas > 0 ? (totalRefs / totalConsultas).toFixed(1) : "0";
  const lastModel = s.consultations[0]?.modelo || "—";

  /* ── Handlers ── */
  const handleSend = useCallback(async () => {
    if (!s.question.trim()) {
      Swal.fire({ icon: "warning", title: "Falta la pregunta", text: "Describe la duda o hipótesis legal a validar.", confirmButtonColor: "#2563eb" });
      return;
    }
    dispatch({ type: "SET_SENDING", payload: true });
    try {
      const payload = await createLegalConsultation({
        pregunta: s.question.trim(),
        contexto: s.contexto.trim() || undefined,
        ley: s.ley.trim() || undefined,
        tipo_fuente: s.tipoFuente.trim() || undefined,
        max_referencias: s.maxRefs,
      });
      dispatch({ type: "ADD_CONSULTATION", payload });
      setLiveFeedback({ tone: "success", message: "Consulta generada y guardada en historial." });
      Swal.fire({ icon: "success", title: "Consulta lista", text: "Análisis generado con éxito.", timer: 2000, showConfirmButton: false });
    } catch (e) {
      dispatch({ type: "SET_SENDING", payload: false });
      setLiveFeedback({ tone: "error", message: `No se pudo generar la consulta: ${(e as Error).message}` });
      Swal.fire({ icon: "error", title: "Error", text: (e as Error).message, confirmButtonColor: "#2563eb" });
    }
  }, [s.question, s.contexto, s.ley, s.tipoFuente, s.maxRefs]);

  const handleDelete = useCallback(async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await Swal.fire({
      title: "¿Eliminar esta consulta?",
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!res.isConfirmed) return;
    try {
      await deleteLegalConsultation(id);
      dispatch({ type: "REMOVE_CONSULTATION", id });
      setLiveFeedback({ tone: "success", message: "Consulta eliminada del historial." });
      Swal.fire({ icon: "success", title: "Eliminada", timer: 1200, showConfirmButton: false });
    } catch (e) {
      setLiveFeedback({ tone: "error", message: `No se pudo eliminar la consulta: ${(e as Error).message}` });
      Swal.fire({ icon: "error", title: "Error al eliminar", text: (e as Error).message, confirmButtonColor: "#2563eb" });
    }
  }, []);

  const handleExportPdf = useCallback(async () => {
    if (!selectedConsultation) return;
    try {
      await exportLegalConsultationPdf(selectedConsultation.id);
      setLiveFeedback({ tone: "success", message: "PDF de la consulta generado." });
    } catch (e) {
      setLiveFeedback({ tone: "error", message: `No se pudo exportar el PDF: ${(e as Error).message}` });
      Swal.fire({ icon: "error", title: "Error al exportar PDF", text: (e as Error).message, confirmButtonColor: "#2563eb" });
    }
  }, [selectedConsultation]);

  const handleKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && event.metaKey) void handleSend();
  };

  /* ── Loading skeleton ── */
  if (s.loading) {
    return (
      <DashboardShell>
        <div className="space-y-4 p-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-3xl bg-slate-100" />
          ))}
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
      {/* ── Header ── */}
      <div className="surface-panel-strong rounded-[1.75rem] p-6 shadow-fiscal">
        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div>
            <span className="kicker-label">
              Despacho Conversacional
            </span>
            <h1 className="mt-3 flex items-center gap-2 font-display text-4xl font-semibold text-[var(--fiscal-ink)]">
              Consulta Legal Inteligente
              <Sparkles className="h-5 w-5 text-[var(--fiscal-muted)]" />
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--fiscal-muted)] sm:text-base">
              Análisis legal y fiscal con IA de precisión basado en tu compendio normativo.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <div className="rounded-full border border-[rgba(45,91,136,0.18)] bg-[var(--fiscal-accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--fiscal-accent)]">
                Diagnóstico argumentado con referencias
              </div>
              <div className="rounded-full border border-[rgba(184,137,70,0.18)] bg-[rgba(184,137,70,0.10)] px-3 py-2 text-xs font-semibold text-[var(--fiscal-gold)]">
                Lectura operativa para decisiones fiscales
              </div>
            </div>
          </div>
          <div className="surface-shell rounded-[1.5rem] p-5 text-white">
            <p className="eyebrow-shell">Mesa de criterio</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-white">La respuesta debe sonar a dictamen de trabajo, no a chat casual</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-[rgba(216,211,200,0.78)]">
              Este módulo convierte preguntas técnicas en un documento argumentado con ley vigente, criterio y referencias accionables para el despacho.
            </p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <HelpGuide
                steps={[
                  "Formula tu pregunta con precisión: incluye el artículo, ley o situación específica que quieres validar.",
                  "Agrega contexto operativo (giro, monto, tipo de operación) para que la IA personalice la respuesta.",
                  "Selecciona la base de datos y tipo de fuente para acotar la búsqueda a las normas más relevantes.",
                  "Revisa las referencias legales citadas — cada fuente incluye artículo, fracción y extracto de ley vigente.",
                ]}
                concepts={[
                  { term: "RAG (Retrieval-Augmented Generation)", definition: "Técnica que busca primero en tu compendio normativo las fuentes más relevantes y luego genera la respuesta con ese contexto. Reduce alucinaciones." },
                  { term: "Compendio normativo", definition: "Base de datos indexada con leyes, reglamentos, NOMs, criterios SAT y resoluciones. Se actualiza desde el módulo de Fuentes." },
                  { term: "Max referencias", definition: "Número máximo de fuentes legales que el sistema citará en su respuesta. Más referencias = análisis más exhaustivo pero más lento." },
                  { term: "Tipo de fuente", definition: "Filtra la búsqueda por categoría: Ley, Reglamento, NOM, Criterio SAT o Resolución." },
                ]}
                tips={[
                  "Sé específico: 'materialidad en servicios de consultoría > $500K' da mejor resultado que 'materialidad'.",
                  "El contexto operativo reduce alucinaciones — incluye giro, régimen fiscal y tipo de operación.",
                  "Si la respuesta inicia con 'ERROR:', verifica la configuración de API keys o la cuota del proveedor IA en el servidor.",
                  "Puedes imprimir el diagnóstico completo con el botón de imprimir para anexarlo como documento de trabajo.",
                  "Usa ⌘+Enter (Mac) o Ctrl+Enter para enviar rápidamente sin hacer clic.",
                ]}
              />
              <button
                onClick={() => void loadConsultations()}
                className="button-institutional inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition"
              >
                <RefreshCw className="h-4 w-4" /> Actualizar
              </button>
            </div>
          </div>
        </div>
      </div>

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
      {totalConsultas > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi
            label="Total consultas"
            value={totalConsultas}
            sub="en tu historial"
            color="blue"
          />
          <Kpi
            label="Referencias totales"
            value={totalRefs}
            sub={`${avgRefs} promedio por consulta`}
            color="green"
          />
          <Kpi
            label="Modelo IA"
            value={lastModel.length > 16 ? lastModel.slice(0, 16) + "…" : lastModel}
            sub="último utilizado"
            color="gray"
          />
          <Kpi
            label="Fuentes"
            value={formattedLaws.length}
            sub="leyes en catálogo"
            color="amber"
          />
        </div>
      )}

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── Left Panel: Form + History ── */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* ── Form Section ── */}
          <Section badge="Nueva consulta" title="Configurar parámetros" defaultOpen>
            <div className="space-y-4 rounded-[1.5rem] border border-[rgba(200,192,177,0.55)] bg-[rgba(244,242,237,0.62)] p-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--fiscal-muted)]">Planteamiento técnico</label>
                <textarea
                  value={s.question}
                  onChange={(e) => dispatch({ type: "SET_FIELD", field: "question", value: e.target.value })}
                  onKeyDown={handleKey}
                  placeholder="Ej. ¿Cómo acreditar materialidad en servicios de consultoría 2026?"
                  className={textareaCls}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--fiscal-muted)]">Contexto de la operación</label>
                <input
                  value={s.contexto}
                  onChange={(e) => dispatch({ type: "SET_FIELD", field: "contexto", value: e.target.value })}
                  placeholder="Giro, situación, monto, régimen fiscal…"
                  className={inputCls}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--fiscal-muted)]">Base de datos</label>
                  <select
                    value={s.ley}
                    onChange={(e) => dispatch({ type: "SET_FIELD", field: "ley", value: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">Todas las leyes</option>
                    {formattedLaws.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--fiscal-muted)]">Tipo de fuente</label>
                  <select
                    value={s.tipoFuente}
                    onChange={(e) => dispatch({ type: "SET_FIELD", field: "tipoFuente", value: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">Todos los tipos</option>
                    {SOURCE_TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--fiscal-muted)]">Max. referencias</label>
                <select
                  value={s.maxRefs}
                  onChange={(e) => dispatch({ type: "SET_MAX_REFS", payload: Number(e.target.value) })}
                  className={inputCls}
                >
                  {MAX_REFERENCIAS_OPTIONS.map((v) => <option key={v} value={v}>{v} referencia{v > 1 ? "s" : ""}</option>)}
                </select>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => void handleSend()}
                  disabled={s.sending || !s.question.trim()}
                  className="button-institutional flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {s.sending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Analizando…</>
                  ) : (
                    <><Send className="h-4 w-4" /> Analizar</>
                  )}
                </button>
                {(s.question || s.contexto || s.ley || s.tipoFuente) && (
                  <button
                    onClick={() => dispatch({ type: "CLEAR_FORM" })}
                    disabled={s.sending}
                    className="rounded-xl border border-[rgba(200,192,177,0.72)] px-3 py-2.5 text-sm text-[var(--fiscal-muted)] hover:bg-[rgba(244,242,237,0.88)] transition"
                    title="Limpiar formulario"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </Section>

          {/* ── History Section ── */}
          <Section
            badge="Historial"
            title="Consultas recientes"
            defaultOpen
            right={
              <span className="rounded-full bg-[var(--fiscal-accent-soft)] px-2.5 py-0.5 text-xs font-bold text-[var(--fiscal-accent)]">
                {s.consultations.length}
              </span>
            }
          >
            {s.consultations.length === 0 ? (
              <div className="text-center py-8">
                <History className="mx-auto h-10 w-10 text-[var(--fiscal-muted)]/35" />
                <p className="mt-3 text-sm text-[var(--fiscal-muted)]">Aún no hay consultas. Haz tu primera pregunta legal.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {s.consultations.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => dispatch({ type: "SELECT", id: item.id })}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all group ${
                      s.selectedId === item.id
                        ? "border-[rgba(45,91,136,0.22)] bg-[var(--fiscal-accent-soft)]/55 shadow-panel"
                        : "border-[rgba(200,192,177,0.72)] bg-white hover:border-[rgba(200,192,177,0.92)] hover:bg-[rgba(244,242,237,0.48)]"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <span className="text-[10px] font-semibold text-[var(--fiscal-muted)]">{formatDate(item.created_at)}</span>
                      {s.selectedId === item.id && <div className="h-2 w-2 rounded-full bg-[var(--fiscal-accent)]" />}
                    </div>
                    <div className="flex justify-between items-start">
                      <p className={`text-sm font-medium line-clamp-2 pr-3 ${s.selectedId === item.id ? "text-[var(--fiscal-ink)]" : "text-[var(--fiscal-muted)]"}`}>
                        {item.pregunta}
                      </p>
                      <button
                        onClick={(e) => handleDelete(item.id, e)}
                        className="p-1.5 text-[var(--fiscal-muted)]/45 hover:text-[var(--fiscal-danger)] hover:bg-[var(--fiscal-danger-soft)] rounded-lg transition shrink-0"
                        title="Eliminar consulta"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {item.tipo_consulta?.label && (
                      <span className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${consultationTypeTone(item.tipo_consulta.code)}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                        {item.tipo_consulta.label}
                      </span>
                    )}
                    {item.referencias?.length > 0 && (
                      <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-[var(--fiscal-muted)]">
                        <BookOpen className="h-3 w-3" /> {item.referencias.length} ref.
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* ── Right Panel: Selected Consultation ── */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {selectedConsultation ? (
            <>
              {/* ── Response Document ── */}
              <div id="response-doc" className="overflow-hidden rounded-[1.75rem] border border-[rgba(200,192,177,0.72)] bg-white shadow-fiscal">
                <div className="print-only print-running-header">
                  <div>
                    <span className="print-running-kicker">Materialidad Legal Fiscal</span>
                    <strong>{printDocumentTitle(selectedConsultation)}</strong>
                  </div>
                  <div className="print-running-meta">
                    <span>{selectedConsultation.tipo_consulta?.label || "Consulta general"}</span>
                    <span>{supportLabel}</span>
                  </div>
                </div>

                <div className="print-only print-running-footer">
                  <span>Confidencial · Uso interno del despacho y del Consejo de Administración</span>
                  <span>Emitido por {user?.full_name || user?.email || "Dirección de Criterio Fiscal"}</span>
                  <span className="print-page-counter">Página <span className="print-page-number" /></span>
                </div>

                <div className="print-only print-doc-shell">
                  <div className="print-executive-header">
                    <div>
                      <div className="print-brand-row">
                        <Image src="/icon-192x192.png" alt="Materialidad Legal Fiscal" width={56} height={56} className="print-brand-mark" />
                        <div>
                          <p className="print-kicker">Materialidad Legal Fiscal</p>
                          <p className="print-brand-caption">Documento emitido por la plataforma</p>
                        </div>
                      </div>
                      <h1 className="print-title">Opinión legal preliminar</h1>
                      <p className="print-subtitle">Resumen para revisión. El análisis técnico inicia en esta misma hoja.</p>
                    </div>
                    <div className="print-cover-meta">
                      <div>
                        <span>Tipo de consulta</span>
                        <strong>{selectedConsultation.tipo_consulta?.label || "Consulta general"}</strong>
                      </div>
                      <div>
                        <span>Fecha de emisión</span>
                        <strong>{formatDate(selectedConsultation.created_at)}</strong>
                      </div>
                      <div>
                        <span>Folio interno</span>
                        <strong>CL-{selectedConsultation.id}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="print-summary-grid">
                    <div className="print-summary-card">
                      <span>Nivel de sustento</span>
                      <strong>{supportLabel}</strong>
                    </div>
                    <div className="print-summary-card">
                      <span>Referencias analizadas</span>
                      <strong>{references.length}</strong>
                    </div>
                    <div className="print-summary-card">
                      <span>Clasificación</span>
                      <strong>Confidencial · Uso interno</strong>
                    </div>
                    <div className="print-summary-card">
                      <span>Modelo / motor</span>
                      <strong>{selectedConsultation.modelo || "Engine 1.0 (Compendio)"}</strong>
                    </div>
                  </div>

                  <div className="print-panel">
                    <p className="print-panel-label">Planteamiento sometido a revisión</p>
                    <p className="print-panel-text">{selectedConsultation.pregunta}</p>
                  </div>

                  {selectedConsultation.contexto && (
                    <div className="print-panel">
                      <p className="print-panel-label">Contexto operativo relevante</p>
                      <p className="print-panel-text">{selectedConsultation.contexto}</p>
                    </div>
                  )}

                  <div className="print-info-grid">
                    <div className="print-panel print-panel-note">
                      <p className="print-panel-label">Alcance del documento</p>
                      <p className="print-panel-text">
                        Esta opinión se presenta como insumo para toma de decisiones. Debe leerse junto con las referencias citadas,
                        la validación de vigencia normativa y la revisión profesional final del expediente.
                      </p>
                    </div>

                    <div className="print-panel print-approval-panel">
                      <p className="print-panel-label">Datos de aprobación</p>
                      <div className="print-approval-grid">
                        <div>
                          <span>Firmante</span>
                          <strong>{user?.full_name || user?.email || "Dirección de Criterio Fiscal"}</strong>
                        </div>
                        <div>
                          <span>Cargo</span>
                          <strong>{signatoryRole}</strong>
                        </div>
                        <div>
                          <span>Despacho / corporativo</span>
                          <strong>{signatoryOrgLabel}</strong>
                        </div>
                        <div>
                          <span>Firma electrónica</span>
                          <strong>Emitida electrónicamente por Materialidad Legal Fiscal</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Response Header */}
                <div className="border-b border-[rgba(200,192,177,0.55)] bg-[rgba(244,242,237,0.62)] p-6">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--fiscal-accent)]">
                        Diagnóstico
                      </span>
                      <h2 className="mt-1 text-xl font-bold text-[var(--fiscal-ink)] leading-snug">
                        {selectedConsultation.pregunta}
                      </h2>
                    </div>
                    <button
                      onClick={() => window.print()}
                      className="no-print shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-[rgba(200,192,177,0.72)] bg-white px-3 py-2 text-xs font-semibold text-[var(--fiscal-muted)] hover:bg-[rgba(244,242,237,0.56)] transition shadow-sm"
                    >
                      <Printer className="h-3.5 w-3.5" /> Imprimir
                    </button>
                    <button
                      onClick={() => void handleExportPdf()}
                      className="no-print shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-[rgba(45,91,136,0.18)] bg-[var(--fiscal-accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--fiscal-accent)] hover:bg-[rgba(45,91,136,0.14)] transition shadow-sm"
                    >
                      <Download className="h-3.5 w-3.5" /> PDF
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[rgba(200,192,177,0.72)] px-2.5 py-1 text-xs font-medium text-[var(--fiscal-muted)] shadow-sm">
                      <Clock className="h-3 w-3 text-[var(--fiscal-muted)]" />
                      {formatDate(selectedConsultation.created_at)}
                    </span>
                    {selectedConsultation.tipo_consulta?.label && (
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${consultationTypeTone(selectedConsultation.tipo_consulta.code)}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                        {selectedConsultation.tipo_consulta.label}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[rgba(200,192,177,0.72)] px-2.5 py-1 text-xs font-medium text-[var(--fiscal-muted)] shadow-sm">
                      <Sparkles className="h-3 w-3 text-[var(--fiscal-muted)]" />
                      {selectedConsultation.modelo || "Engine 1.0"}
                    </span>
                    {isFallbackResult && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fiscal-accent-soft)] ring-1 ring-inset ring-[rgba(45,91,136,0.18)] px-2.5 py-1 text-xs font-semibold text-[var(--fiscal-accent)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--fiscal-accent)]" />
                        Criterio preliminar automatizado
                      </span>
                    )}
                    {hasCurrentSupport ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fiscal-success-soft)] ring-1 ring-inset ring-[rgba(31,122,90,0.18)] px-2.5 py-1 text-xs font-semibold text-[var(--fiscal-success)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--fiscal-success)]" />
                        Sustento vigente verificado
                      </span>
                    ) : hasIndexedSupport ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fiscal-warning-soft)] ring-1 ring-inset ring-[rgba(176,113,24,0.18)] px-2.5 py-1 text-xs font-semibold text-[var(--fiscal-warning)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--fiscal-warning)]" />
                        Soporte histórico o por validar
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(244,242,237,0.88)] ring-1 ring-inset ring-[rgba(200,192,177,0.42)] px-2.5 py-1 text-xs font-semibold text-[var(--fiscal-muted)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--fiscal-muted)]" />
                        Sin sustento indexado
                      </span>
                    )}
                  </div>
                </div>

                {/* Response Body */}
                <div className="px-8 py-6">
                  {isTechnicalIncidentResponse(selectedConsultation) ? (
                    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[rgba(160,67,61,0.22)] bg-[var(--fiscal-danger-soft)] py-10 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(160,67,61,0.12)] text-[var(--fiscal-danger)]">
                        <AlertCircle className="h-7 w-7" />
                      </div>
                      <h3 className="text-base font-bold text-[var(--fiscal-ink)]">Incidencia técnica</h3>
                      <div className="max-w-xl rounded-xl border border-[rgba(160,67,61,0.22)] bg-white p-4">
                        <p className="break-words font-mono text-xs text-[var(--fiscal-danger)]">
                          {selectedConsultation.respuesta}
                        </p>
                      </div>
                      <p className="max-w-sm text-sm text-[var(--fiscal-muted)]">
                        Verifica las API keys en .env o los límites de cuota de tu proveedor IA.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {isFallbackResult && (
                        <div className="rounded-2xl border border-[rgba(45,91,136,0.18)] bg-[var(--fiscal-accent-soft)]/80 px-4 py-3">
                          <p className="text-sm font-semibold text-[var(--fiscal-ink)]">Resultado emitido en modo preliminar.</p>
                          <p className="mt-1 text-sm text-[var(--fiscal-muted)]">Se construyó automáticamente con el compendio recuperado. Úsalo como borrador de criterio y no como cierre definitivo sin revisión profesional.</p>
                        </div>
                      )}
                      {!hasIndexedSupport && (
                        <div className="rounded-2xl border border-[rgba(176,113,24,0.18)] bg-[var(--fiscal-warning-soft)]/80 px-4 py-3">
                          <p className="text-sm font-semibold text-[var(--fiscal-ink)]">La respuesta no tiene soporte indexado suficiente.</p>
                          <p className="mt-1 text-sm text-[var(--fiscal-muted)]">Úsala como criterio preliminar y valida con texto vigente antes de convertirla en posición formal del despacho.</p>
                        </div>
                      )}
                      {hasIndexedSupport && !hasCurrentSupport && (
                        <div className="rounded-2xl border border-[rgba(176,113,24,0.18)] bg-[var(--fiscal-warning-soft)]/80 px-4 py-3">
                          <p className="text-sm font-semibold text-[var(--fiscal-ink)]">Las referencias recuperadas no están marcadas como vigentes.</p>
                          <p className="mt-1 text-sm text-[var(--fiscal-muted)]">Se muestran como apoyo contextual. Confirma reforma, vigencia y texto oficial antes de sostener la conclusión.</p>
                        </div>
                      )}
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-[rgba(200,192,177,0.55)] bg-[rgba(244,242,237,0.48)] px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--fiscal-muted)]">Referencias</p>
                          <p className="mt-1 text-2xl font-bold text-[var(--fiscal-ink)]">{references.length}</p>
                        </div>
                        <div className="rounded-2xl border border-[rgba(31,122,90,0.18)] bg-[var(--fiscal-success-soft)]/75 px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--fiscal-success)]">Vigentes</p>
                          <p className="mt-1 text-2xl font-bold text-[var(--fiscal-success)]">{currentReferences.length}</p>
                        </div>
                        <div className="rounded-2xl border border-[rgba(176,113,24,0.18)] bg-[var(--fiscal-warning-soft)]/75 px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--fiscal-warning)]">Históricas / por validar</p>
                          <p className="mt-1 text-2xl font-bold text-[var(--fiscal-warning)]">{historicalReferences.length}</p>
                        </div>
                      </div>
                      <article className="prose prose-lg max-w-none
                        print-article
                        prose-headings:text-[var(--fiscal-ink)] prose-headings:font-bold prose-headings:tracking-tight
                        prose-h1:text-2xl prose-h1:mt-8 prose-h1:mb-4 prose-h1:border-b prose-h1:border-[rgba(200,192,177,0.72)] prose-h1:pb-3
                        prose-h2:text-xl prose-h2:mt-6 prose-h2:mb-3
                        prose-h3:text-lg prose-h3:mt-5 prose-h3:mb-2
                        prose-p:text-[var(--fiscal-muted)] prose-p:leading-[1.8] prose-p:text-[15px]
                        prose-strong:text-[var(--fiscal-ink)] prose-strong:font-bold
                        prose-li:text-[var(--fiscal-muted)] prose-li:leading-[1.8] prose-li:text-[15px]
                        prose-ul:space-y-1
                        prose-ol:space-y-1
                        prose-code:bg-[var(--fiscal-accent-soft)] prose-code:text-[var(--fiscal-accent)] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:font-mono prose-code:text-sm
                        prose-blockquote:border-l-4 prose-blockquote:border-[var(--fiscal-accent)] prose-blockquote:bg-[var(--fiscal-accent-soft)]/60 prose-blockquote:rounded-r-xl prose-blockquote:py-3 prose-blockquote:px-5 prose-blockquote:not-italic
                        prose-a:text-[var(--fiscal-accent)] prose-a:underline prose-a:decoration-[rgba(45,91,136,0.3)] hover:prose-a:text-[var(--fiscal-accent)]
                        prose-table:border-collapse prose-th:bg-[rgba(244,242,237,0.88)] prose-th:text-[var(--fiscal-ink)] prose-td:border-[rgba(200,192,177,0.72)]
                      ">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {selectedConsultation.respuesta}
                        </ReactMarkdown>
                      </article>

                      <div className="print-only print-appendix">
                        <div className="print-appendix-header">
                          <p className="print-kicker">Anexo documental</p>
                          <h3>Referencias normativas y jurisprudenciales consideradas</h3>
                          <p>
                            Se enlistan las fuentes utilizadas para sustentar la opinión, con su vigencia, identificación y razón de pertinencia.
                          </p>
                        </div>

                        {references.length === 0 ? (
                          <div className="print-reference-card">
                            <p className="print-reference-empty">No se localizaron referencias indexadas suficientes para documentar un anexo normativo.</p>
                          </div>
                        ) : (
                          <div className="print-reference-list">
                            {references.map((ref, idx) => (
                              <div key={`print-ref-${idx}`} className="print-reference-card">
                                <div className="print-reference-head">
                                  <div>
                                    <p className="print-reference-index">Referencia {idx + 1}</p>
                                    <h4>{getReferenceTitle(ref)}</h4>
                                    <p className="print-reference-law">{ref.ordenamiento || ref.ley}</p>
                                  </div>
                                  <div className="print-reference-status">{ref.estatus_vigencia || "Sin etiqueta de vigencia"}</div>
                                </div>
                                <div className="print-reference-meta">
                                  {ref.articulo && <span>Artículo {ref.articulo}</span>}
                                  {ref.fraccion && <span>Fracción {ref.fraccion}</span>}
                                  {ref.parrafo && <span>Párrafo {ref.parrafo}</span>}
                                  {ref.registro_digital && <span>Registro {ref.registro_digital}</span>}
                                  {ref.autoridad_emisora && <span>{ref.autoridad_emisora}</span>}
                                  {ref.tipo_fuente && <span>{ref.tipo_fuente}</span>}
                                </div>
                                {ref.match_reason && <p className="print-reference-reason"><strong>Pertinencia:</strong> {ref.match_reason}</p>}
                                <p className="print-reference-excerpt">{ref.extracto || ref.resumen}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Response Footer */}
                <div className="border-t border-[rgba(200,192,177,0.55)] bg-[rgba(244,242,237,0.62)] px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="mb-0.5 text-[10px] uppercase tracking-widest text-[var(--fiscal-muted)]">Modelo</span>
                    <span className="text-sm font-medium text-[var(--fiscal-muted)]">{selectedConsultation.modelo || "Engine 1.0 (Compendio)"}</span>
                  </div>
                  <span className="text-[10px] text-[var(--fiscal-muted)]">
                    ID: {selectedConsultation.id} · {references.length} referencia{references.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="print-only print-footer">
                  Documento confidencial para uso interno del despacho y del Consejo de Administración. Su circulación externa requiere validación jurídica final.
                </div>
              </div>

              {/* ── References ── */}
              <Section
                badge="Fuentes"
                title="Referencias legales citadas"
                defaultOpen
                right={
                  <span className="rounded-full bg-[var(--fiscal-success-soft)] px-2.5 py-0.5 text-xs font-bold text-[var(--fiscal-success)]">
                    {references.length}
                  </span>
                }
              >
                {references.length === 0 ? (
                  <div className="text-center py-10">
                    <BookOpen className="mx-auto h-10 w-10 text-[var(--fiscal-muted)]/35" />
                    <p className="mt-3 text-sm text-[var(--fiscal-muted)]">Sin referencias adicionales indexadas.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {references.map((ref, idx) => (
                      <div key={idx} className="rounded-2xl border border-[rgba(200,192,177,0.72)] bg-white p-5 shadow-panel hover:shadow-fiscal transition">
                        <div className="flex justify-between items-start mb-3">
                          <span className="rounded-lg bg-[var(--fiscal-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--fiscal-accent)]">
                            Ref. {idx + 1}
                          </span>
                          {ref.fuente_url && (
                            <a href={ref.fuente_url} target="_blank" rel="noopener noreferrer"
                              className="rounded-lg p-1.5 text-[var(--fiscal-muted)] hover:text-[var(--fiscal-accent)] hover:bg-[var(--fiscal-accent-soft)] transition">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--fiscal-accent)]">
                          {ref.ordenamiento || ref.ley}
                        </p>
                        <h4 className="mb-1 text-sm font-bold text-[var(--fiscal-ink)]">{getReferenceTitle(ref)}</h4>
                        {getReferenceMeta(ref) && (
                          <p className="mb-2 text-xs text-[var(--fiscal-muted)]">{getReferenceMeta(ref)}</p>
                        )}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {ref.articulo && (
                            <span className="rounded-md bg-[var(--fiscal-success-soft)] px-2 py-0.5 text-xs font-medium text-[var(--fiscal-success)] ring-1 ring-inset ring-[rgba(31,122,90,0.18)]">
                              Art. {ref.articulo}
                            </span>
                          )}
                          {ref.fraccion && (
                            <span className="rounded-md bg-[var(--fiscal-success-soft)] px-2 py-0.5 text-xs font-medium text-[var(--fiscal-success)] ring-1 ring-inset ring-[rgba(31,122,90,0.18)]">
                              Frac. {ref.fraccion}
                            </span>
                          )}
                          {ref.parrafo && (
                            <span className="rounded-md bg-[var(--fiscal-success-soft)] px-2 py-0.5 text-xs font-medium text-[var(--fiscal-success)] ring-1 ring-inset ring-[rgba(31,122,90,0.18)]">
                              Párr. {ref.parrafo}
                            </span>
                          )}
                          {ref.identifier && !ref.articulo && (
                            <span className="rounded-md bg-[var(--fiscal-accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--fiscal-accent)] ring-1 ring-inset ring-[rgba(45,91,136,0.18)]">
                              {ref.identifier}
                            </span>
                          )}
                          {ref.registro_digital && (
                            <span className="rounded-md bg-[var(--fiscal-accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--fiscal-accent)] ring-1 ring-inset ring-[rgba(45,91,136,0.18)]">
                              Registro {ref.registro_digital}
                            </span>
                          )}
                          {ref.estatus_vigencia && (
                            <span className={`rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${vigencyTone(ref.estatus_vigencia)}`}>
                              {ref.estatus_vigencia}
                            </span>
                          )}
                          {ref.autoridad_emisora && (
                            <span className="rounded-md bg-[rgba(244,242,237,0.88)] px-2 py-0.5 text-xs font-medium text-[var(--fiscal-muted)]">
                              {ref.autoridad_emisora}
                            </span>
                          )}
                          {ref.tipo_fuente && (
                            <span className="rounded-md bg-[rgba(244,242,237,0.88)] px-2 py-0.5 text-xs font-medium text-[var(--fiscal-muted)]">
                              {ref.tipo_fuente}
                            </span>
                          )}
                        </div>
                        {(ref.fuente_documento || ref.fecha_ultima_revision || ref.vigencia) && (
                          <div className="mb-3 rounded-xl border border-[rgba(200,192,177,0.55)] bg-[rgba(255,255,255,0.75)] px-3.5 py-2.5">
                            <div className="space-y-1 text-[11px] text-[var(--fiscal-muted)]">
                              {ref.fuente_documento && <p><span className="font-semibold text-[var(--fiscal-ink)]">Fuente:</span> {ref.fuente_documento}</p>}
                              {ref.vigencia && <p><span className="font-semibold text-[var(--fiscal-ink)]">Vigencia:</span> {ref.vigencia}</p>}
                              {ref.fecha_ultima_revision && <p><span className="font-semibold text-[var(--fiscal-ink)]">Revisión:</span> {compactDate(ref.fecha_ultima_revision)}</p>}
                            </div>
                          </div>
                        )}
                        {ref.match_reason && (
                          <div className="mb-3 rounded-xl border border-[rgba(184,137,70,0.16)] bg-[rgba(184,137,70,0.08)] px-3.5 py-2.5">
                            <p className="text-[11px] leading-relaxed text-[var(--fiscal-ink)]">
                              <span className="font-semibold text-[var(--fiscal-gold)]">Por qué aplica:</span> {ref.match_reason}
                            </p>
                          </div>
                        )}
                        {((ref.matched_phrases && ref.matched_phrases.length > 0) || (ref.matched_terms && ref.matched_terms.length > 0)) && (
                          <div className="mb-3 flex flex-wrap gap-1.5">
                            {(ref.matched_phrases ?? []).map((phrase) => (
                              <span
                                key={`phrase-${phrase}`}
                                className="rounded-md bg-[rgba(45,91,136,0.10)] px-2 py-0.5 text-[11px] font-semibold text-[var(--fiscal-accent)] ring-1 ring-inset ring-[rgba(45,91,136,0.18)]"
                              >
                                Frase clave: {phrase}
                              </span>
                            ))}
                            {(ref.matched_terms ?? []).map((term) => (
                              <span
                                key={`term-${term}`}
                                className="rounded-md bg-[rgba(184,137,70,0.10)] px-2 py-0.5 text-[11px] font-semibold text-[var(--fiscal-gold)] ring-1 ring-inset ring-[rgba(184,137,70,0.18)]"
                              >
                                Relacionado: {term}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="rounded-xl border border-[rgba(200,192,177,0.55)] bg-[rgba(244,242,237,0.62)] p-3.5">
                          <p className="text-[var(--fiscal-muted)] text-xs leading-relaxed">
                            {highlightReferenceText(ref.extracto || ref.resumen, ref.matched_phrases, ref.matched_terms)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </>
          ) : (
            /* ── Empty state ── */
            <div className="surface-panel min-h-[500px] flex flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-[rgba(200,192,177,0.72)] p-12 text-center shadow-fiscal">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--fiscal-accent-soft)]">
                <MessageSquare className="h-9 w-9 text-[var(--fiscal-accent)]/50" />
              </div>
              <h3 className="text-xl font-bold text-[var(--fiscal-ink)]">Esperando planteamiento</h3>
              <p className="mt-3 max-w-sm text-sm text-[var(--fiscal-muted)]">
                Define tu hipótesis fiscal para desplegar el diagnóstico legal estructurado con referencias de ley vigente.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>

    <style jsx global>{`
      .print-only {
        display: none;
      }

      @media print {
        @page {
          size: A4;
          margin: 18mm 16mm 18mm 16mm;
        }

        html, body {
          background: #ffffff !important;
          color: #1f2937 !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        body * {
          visibility: hidden;
        }

        #response-doc,
        #response-doc * {
          visibility: visible;
        }

        .print-only {
          display: block !important;
        }

        .no-print, nav, aside, button, footer {
          display: none !important;
        }

        #response-doc {
          border: none !important;
          box-shadow: none !important;
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          position: absolute;
          top: 0;
          left: 0;
          border-radius: 0 !important;
          overflow: visible !important;
          background: #ffffff !important;
          padding-top: 18mm !important;
          padding-bottom: 14mm !important;
        }

        #response-doc article {
          font-size: 11pt !important;
          line-height: 1.65 !important;
          color: #374151 !important;
        }

        #response-doc article h1,
        #response-doc article h2,
        #response-doc article h3,
        #response-doc article h4,
        #response-doc .print-cover,
        #response-doc .print-panel,
        #response-doc .print-summary-card,
        #response-doc .print-reference-card {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        #response-doc .border-b,
        #response-doc .border-t {
          border-color: #d1d5db !important;
        }

        #response-doc .print-doc-shell {
          display: block !important;
          padding: 0 2mm 6mm 2mm;
        }

        #response-doc .print-running-header,
        #response-doc .print-running-footer {
          display: flex !important;
          position: fixed;
          left: 16mm;
          right: 16mm;
          z-index: 20;
          color: #475569;
          font-size: 8.5pt;
        }

        #response-doc .print-running-header {
          top: 7mm;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 1px solid #d1d5db;
          padding-bottom: 4mm;
          background: #ffffff;
        }

        #response-doc .print-running-footer {
          bottom: 6mm;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid #d1d5db;
          padding-top: 3mm;
          background: #ffffff;
        }

        #response-doc .print-running-header strong {
          display: block;
          margin-top: 2px;
          color: #0f172a;
          font-size: 10pt;
        }

        #response-doc .print-running-kicker {
          display: block;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          color: #8a6a2f;
          font-size: 7.5pt;
          font-weight: 700;
        }

        #response-doc .print-running-meta {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: flex-end;
          text-align: right;
        }

        #response-doc .print-page-number::after {
          content: counter(page);
        }

        #response-doc .print-executive-header {
          display: grid;
          grid-template-columns: 1.45fr 0.95fr;
          gap: 12px;
          padding: 4mm 0 10px 0;
          border-bottom: 1.5px solid #cbd5e1;
          margin-bottom: 10px;
        }

        #response-doc .print-kicker {
          margin: 0 0 8px 0;
          font-size: 9pt;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: #8a6a2f;
          font-weight: 700;
        }

        #response-doc .print-brand-row {
          display: flex;
          gap: 8px;
          align-items: center;
          margin-bottom: 8px;
        }

        #response-doc .print-brand-mark {
          width: 14mm;
          height: 14mm;
          object-fit: contain;
        }

        #response-doc .print-brand-caption {
          margin: 0;
          font-size: 8.5pt;
          color: #64748b;
        }

        #response-doc .print-title {
          margin: 0;
          font-size: 18pt;
          line-height: 1.15;
          color: #0f172a;
          font-weight: 800;
        }

        #response-doc .print-subtitle {
          margin: 6px 0 0 0;
          font-size: 9.5pt;
          line-height: 1.5;
          color: #475569;
        }

        #response-doc .print-cover-meta {
          border: 1px solid #dbe2ea;
          border-radius: 14px;
          padding: 12px;
          background: #f8fafc;
          display: grid;
          gap: 8px;
          align-content: start;
        }

        #response-doc .print-cover-meta span,
        #response-doc .print-summary-card span,
        #response-doc .print-panel-label {
          display: block;
          margin-bottom: 4px;
          font-size: 8.5pt;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #64748b;
          font-weight: 700;
        }

        #response-doc .print-cover-meta strong,
        #response-doc .print-summary-card strong {
          display: block;
          font-size: 10.5pt;
          line-height: 1.4;
          color: #0f172a;
        }

        #response-doc .print-summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 10px;
        }

        #response-doc .print-summary-card,
        #response-doc .print-panel,
        #response-doc .print-reference-card {
          border: 1px solid #dbe2ea;
          border-radius: 14px;
          background: #ffffff;
        }

        #response-doc .print-summary-card {
          padding: 10px 12px;
        }

        #response-doc .print-panel {
          padding: 10px 12px;
          margin-bottom: 8px;
        }

        #response-doc .print-info-grid {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 8px;
        }

        #response-doc .print-panel-note {
          background: #f8fafc;
        }

        #response-doc .print-approval-panel {
          background: #f8fafc;
        }

        #response-doc .print-approval-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        #response-doc .print-approval-grid span {
          display: block;
          margin-bottom: 3px;
          font-size: 8.2pt;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #64748b;
          font-weight: 700;
        }

        #response-doc .print-approval-grid strong {
          display: block;
          font-size: 10pt;
          line-height: 1.45;
          color: #0f172a;
        }

        #response-doc .print-panel-text {
          margin: 0;
          font-size: 10.5pt;
          line-height: 1.55;
          color: #334155;
        }

        #response-doc .print-article {
          margin-top: 1mm;
        }

        #response-doc .print-appendix {
          margin-top: 6mm;
          padding-top: 4mm;
          border-top: 1.5px solid #cbd5e1;
        }

        #response-doc .print-appendix-header h3 {
          margin: 4px 0 6px 0;
          font-size: 15pt;
          color: #0f172a;
        }

        #response-doc .print-appendix-header p {
          margin: 0 0 12px 0;
          font-size: 10pt;
          color: #475569;
          line-height: 1.5;
        }

        #response-doc .print-reference-list {
          display: grid;
          gap: 10px;
        }

        #response-doc .print-reference-card {
          padding: 12px 14px;
        }

        #response-doc .print-reference-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 8px;
        }

        #response-doc .print-reference-index {
          margin: 0 0 2px 0;
          font-size: 8.5pt;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #8a6a2f;
          font-weight: 700;
        }

        #response-doc .print-reference-head h4 {
          margin: 0;
          font-size: 11pt;
          color: #0f172a;
        }

        #response-doc .print-reference-law {
          margin: 2px 0 0 0;
          font-size: 9.5pt;
          color: #475569;
        }

        #response-doc .print-reference-status {
          white-space: nowrap;
          border: 1px solid #d1d5db;
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 8.5pt;
          color: #334155;
          background: #f8fafc;
        }

        #response-doc .print-reference-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 8px;
        }

        #response-doc .print-reference-meta span {
          font-size: 8.5pt;
          color: #475569;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 999px;
          padding: 3px 8px;
        }

        #response-doc .print-reference-reason,
        #response-doc .print-reference-excerpt,
        #response-doc .print-reference-empty {
          margin: 0;
          font-size: 9.5pt;
          line-height: 1.55;
          color: #334155;
        }

        #response-doc .print-reference-reason {
          margin-bottom: 8px;
        }

        #response-doc .print-footer {
          display: block !important;
          margin-top: 10mm;
          padding-top: 4mm;
          border-top: 1px solid #d1d5db;
          font-size: 8.5pt;
          line-height: 1.45;
          color: #64748b;
          text-align: center;
        }
      }
    `}</style>
    </DashboardShell>
  );
}
