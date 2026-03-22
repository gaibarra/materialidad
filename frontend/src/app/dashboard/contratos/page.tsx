"use client";

import {
  ChangeEvent,
  FormEvent,
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { FileText, Landmark, LibraryBig, Scale, ShieldCheck } from "lucide-react";

import { DashboardShell } from "../../../components/DashboardShell";
import { GuiaContador } from "../../../components/GuiaContador";
import { useAuthContext } from "../../../context/AuthContext";
import { apiFetch } from "../../../lib/api";
import {
  generateContract,
  ContractGenerationResponse,
  exportContractDocx,
  LegalCitation,
  CitationCacheMetadata,
  uploadContractDocument,
  importExternalContract,
  fetchContractDocuments,
  ClauseSuggestion,
  fetchClauseSuggestions,
  analyzeRedlines,
  RedlineAnalysis,
  DiffSegment,
  optimizeClause,
} from "../../../lib/contracts";
import { alertError, alertInfo, alertSuccess } from "../../../lib/alerts";
import {
  ContractEditor,
  type ContractEditorHandle,
  type OptimizeRequest,
} from "../../../components/ContractEditor";

/* ═══════════════ tipos locales ═══════════════ */

type Empresa = { id: number; razon_social: string; rfc: string };
type Proveedor = { id: number; razon_social: string; rfc: string };
type ContratoTemplate = {
  id: number;
  clave: string;
  nombre: string;
  categoria: string;
  proceso: string;
  descripcion?: string | null;
};
type ContratoLite = {
  id: number;
  nombre: string;
  proveedor_nombre?: string | null;
};
type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};
type ContractFormState = {
  empresa: string;
  proveedor: string;
  template: string;
  resumen_necesidades: string;
  clausulas: string;
  idioma: "es" | "en";
  tono: "formal" | "neutral";
};

/* ═══════════════ constantes ═══════════════ */

const MATERIALITY_TIPS = [
  "Validamos que las cláusulas de confidencialidad estén alineadas al régimen fiscal de tu empresa.",
  "Buscando precedentes SAT y criterios PRODECON para reforzar tus referencias legales.",
  "Agregando recordatorios de obligaciones de retenciones e impuestos indirectos.",
  "Ajustando el tono para mantener la voz corporativa sin perder firmeza legal.",
];

const initialForm: ContractFormState = {
  empresa: "",
  proveedor: "",
  template: "",
  resumen_necesidades: "",
  clausulas: "",
  idioma: "es",
  tono: "formal",
};

/* ───────── clase compartida de input ───────── */
const inputCls =
  "w-full rounded-xl border border-[rgba(200,192,177,0.72)] bg-[rgba(255,255,255,0.82)] px-3 py-2 text-sm text-[var(--fiscal-ink)] placeholder:text-[var(--fiscal-muted)] focus:border-[var(--fiscal-accent)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)] transition";

/* ───────── sección colapsable ───────── */
function Section({
  title,
  tag,
  badge,
  defaultOpen = true,
  actions,
  children,
}: {
  title: string;
  tag: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="surface-panel overflow-hidden rounded-[1.75rem] shadow-fiscal">
      <div className="flex w-full flex-col items-start gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpen((p) => !p)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setOpen((p) => !p);
          }}
          className="flex flex-1 cursor-pointer items-center gap-3 text-left"
        >
          <div>
            <p className="kicker-label">{tag}</p>
            <h2 className="text-lg font-bold text-[var(--fiscal-ink)]">{title}</h2>
          </div>
          {badge}
          <span className={`ml-auto text-[var(--fiscal-muted)] transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
        </div>
        {actions && <div className="w-full sm:w-auto sm:flex-shrink-0">{actions}</div>}
      </div>
      {open && <div className="border-t border-[rgba(200,192,177,0.55)] px-6 pb-6 pt-4">{children}</div>}
    </section>
  );
}

/* ───────── KPI card ───────── */
function KPI({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon?: ReactNode }) {
  return (
    <div className="surface-panel rounded-panel px-5 py-4 shadow-panel">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[rgba(255,255,255,0.72)] shadow-panel">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.35em] text-[var(--fiscal-muted)]">{label}</p>
          <p className="mt-1 font-display text-3xl font-semibold text-[var(--fiscal-ink)]">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-[var(--fiscal-muted)]">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════ PÁGINA ═══════════════════════════════════════════ */

export default function ContratosPage() {
  const router = useRouter();
  const { isAuthenticated, isProfileLoaded } = useAuthContext();
  const editorRef = useRef<ContractEditorHandle>(null);

  /* ── estado del formulario ── */
  const [formState, setFormState] = useState<ContractFormState>(initialForm);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [templates, setTemplates] = useState<ContratoTemplate[]>([]);
  const [contratos, setContratos] = useState<ContratoLite[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isLoadingContratos, setIsLoadingContratos] = useState(false);
  const [contratoId, setContratoId] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ContractGenerationResponse | null>(null);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [clauseSuggestions, setClauseSuggestions] = useState<ClauseSuggestion[]>([]);
  const [isLoadingClauses, setIsLoadingClauses] = useState(false);
  const [clauseQuery, setClauseQuery] = useState("");
  const [shouldShowTips, setShouldShowTips] = useState(false);
  const [activeTipIndex, setActiveTipIndex] = useState(0);
  const tipIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [redlineBase, setRedlineBase] = useState("");
  const [redlineCandidate, setRedlineCandidate] = useState("");
  const [isAnalyzingRedlines, setIsAnalyzingRedlines] = useState(false);
  const [redlineResult, setRedlineResult] = useState<RedlineAnalysis | null>(null);
  const [optionsErrorHint, setOptionsErrorHint] = useState<string | null>(null);
  const [uploadEmpresaId, setUploadEmpresaId] = useState<string>("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isLoadingContrato, setIsLoadingContrato] = useState(false);
  const [isDeletingContrato, setIsDeletingContrato] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editableMarkdown, setEditableMarkdown] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [liveFeedback, setLiveFeedback] = useState<{ tone: "success" | "error" | "info"; message: string } | null>(null);
  const [contractValidationRequested, setContractValidationRequested] = useState(false);

  const selectedTemplate = useMemo(
    () => templates.find((t) => String(t.id) === formState.template) ?? null,
    [templates, formState.template],
  );

  const hasCitations = Boolean(result?.citas_legales?.length);
  const empresaMissing = contractValidationRequested && !formState.empresa;
  const contractInputCls = (hasError = false) =>
    `${inputCls} ${hasError ? "border-[rgba(160,67,61,0.35)] bg-[var(--fiscal-danger-soft)]/60 focus:border-[var(--fiscal-danger)] focus:ring-[rgba(160,67,61,0.16)]" : ""}`;

  /* ── auth guard ── */
  useEffect(() => {
    if (isProfileLoaded && !isAuthenticated) router.replace("/login");
  }, [isAuthenticated, isProfileLoaded, router]);

  /* ── cargar catálogos ── */
  useEffect(() => {
    if (!isAuthenticated) return;
    let mounted = true;
    const loadOptions = async () => {
      setIsLoadingOptions(true);
      try {
        const [empresasRes, proveedoresRes, templatesRes] = await Promise.all([
          apiFetch<PaginatedResponse<Empresa>>("/api/materialidad/empresas/"),
          apiFetch<PaginatedResponse<Proveedor>>("/api/materialidad/proveedores/"),
          apiFetch<ContratoTemplate[]>("/api/materialidad/contrato-templates/"),
        ]);
        if (!mounted) return;
        setEmpresas(empresasRes.results ?? []);
        setProveedores(proveedoresRes.results ?? []);
        setTemplates(templatesRes ?? []);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Intenta de nuevo en unos minutos.";
        alertError("No pudimos cargar los catálogos", message);
        setOptionsErrorHint("Revisa que iniciaste sesión con el cliente correcto y que el código de empresa se envía en el inicio de sesión.");
      } finally {
        if (mounted) setIsLoadingOptions(false);
      }
    };
    void loadOptions();
    return () => { mounted = false; };
  }, [isAuthenticated]);

  /* ── cargar contratos ── */
  useEffect(() => {
    if (!isAuthenticated) return;
    let mounted = true;
    const loadContratos = async () => {
      setIsLoadingContratos(true);
      try {
        const payload = await apiFetch<PaginatedResponse<ContratoLite> | ContratoLite[]>(
          "/api/materialidad/contratos/?ordering=-created_at",
        );
        const list = Array.isArray(payload) ? payload : payload.results ?? [];
        if (mounted) setContratos(list);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Intenta de nuevo en unos minutos.";
        alertError("No pudimos cargar contratos", message);
      } finally {
        if (mounted) setIsLoadingContratos(false);
      }
    };
    void loadContratos();
    return () => { mounted = false; };
  }, [isAuthenticated]);

  /* ── cláusulas sugeridas ── */
  const refreshClauseSuggestions = useCallback(
    async (queryOverride?: string) => {
      if (!formState.empresa) { setClauseSuggestions([]); return; }
      setIsLoadingClauses(true);
      try {
        const suggestions = await fetchClauseSuggestions({
          idioma: formState.idioma,
          resumen_necesidades: formState.resumen_necesidades || undefined,
          template: formState.template ? Number(formState.template) : undefined,
          query: queryOverride?.trim() || undefined,
          limit: 6,
        });
        setClauseSuggestions(suggestions);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Intenta con otros filtros";
        alertError("No pudimos obtener cláusulas sugeridas", message);
      } finally {
        setIsLoadingClauses(false);
      }
    },
    [formState.empresa, formState.idioma, formState.resumen_necesidades, formState.template],
  );

  useEffect(() => {
    if (!formState.empresa) { setClauseSuggestions([]); return; }
    const timeout = setTimeout(() => { void refreshClauseSuggestions(); }, 500);
    return () => clearTimeout(timeout);
  }, [formState.empresa, formState.idioma, formState.template, formState.resumen_necesidades, refreshClauseSuggestions]);

  /* ── tips animados ── */
  useEffect(() => {
    if (!shouldShowTips) {
      if (tipIntervalRef.current) clearInterval(tipIntervalRef.current);
      setActiveTipIndex(0);
      return;
    }
    tipIntervalRef.current = setInterval(() => {
      setActiveTipIndex((prev) => (prev + 1) % MATERIALITY_TIPS.length);
    }, 3200);
    return () => { if (tipIntervalRef.current) clearInterval(tipIntervalRef.current); };
  }, [shouldShowTips]);

  /* ── handlers ── */
  const handleChange = (e: ChangeEvent<HTMLSelectElement | HTMLTextAreaElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "empresa" && value) {
      setContractValidationRequested(false);
    }
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setContractValidationRequested(true);
    if (!formState.empresa) {
      setLiveFeedback({ tone: "error", message: "Selecciona la empresa obligatoria antes de generar el borrador contractual." });
      alertInfo("Selecciona una empresa", "Necesitamos saber para quién generaremos el borrador.");
      return;
    }
    if (!empresas.length) {
      alertInfo("Sin empresas disponibles", "Inicia sesión con un usuario del cliente y verifica el código de empresa en el inicio de sesión.");
      return;
    }
    setIsGenerating(true);
    setShouldShowTips(true);
    setResult(null);

    const clausulas = formState.clausulas.split("\n").map((l) => l.trim()).filter(Boolean);
    try {
      const payload = {
        contrato: contratoId ? Number(contratoId) : undefined,
        empresa: Number(formState.empresa),
        proveedor: formState.proveedor ? Number(formState.proveedor) : undefined,
        template: formState.template ? Number(formState.template) : undefined,
        idioma: formState.idioma,
        tono: formState.tono,
        resumen_necesidades: formState.resumen_necesidades || undefined,
        clausulas_especiales: clausulas.length ? clausulas : undefined,
      };
      const response = await generateContract(payload);
      setResult(response);
      setEditableMarkdown(response.documento_markdown);
      setRedlineBase(response.documento_markdown);
      if (response.contrato_id && !contratoId) setContratoId(String(response.contrato_id));
      setLiveFeedback({ tone: "success", message: "El borrador contractual fue generado y está listo para revisión." });
      alertSuccess("Contrato generado", "Revisa la vista previa y personaliza lo necesario.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Intenta nuevamente";
      setLiveFeedback({ tone: "error", message: `No se pudo generar el contrato: ${message}` });
      alertError("No pudimos generar el contrato", message);
    } finally {
      setIsGenerating(false);
      setShouldShowTips(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      const textToCopy = editableMarkdown || result.documento_markdown;
      await navigator.clipboard.writeText(textToCopy);
      alertSuccess("Contenido copiado", "Pega el borrador en tu herramienta favorita");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo copiar";
      alertError("No pudimos copiar el texto", message);
    }
  };

  const handleImportExternal = async () => {
    if (!uploadEmpresaId) { alertInfo("Falta empresa", "Selecciona la empresa a la que pertenece el contrato."); return; }
    if (!uploadFile) { alertInfo("Falta archivo", "Adjunta un PDF, DOCX o texto para analizar."); return; }
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append("empresa", uploadEmpresaId);
      formData.append("archivo", uploadFile);
      formData.append("idioma", formState.idioma);
      formData.append("tono", formState.tono);
      const corrected = await importExternalContract(formData);
      setResult(corrected);
      setEditableMarkdown(corrected.documento_markdown);
      setRedlineBase(corrected.documento_markdown);
      if (corrected.contrato_id) setContratoId(String(corrected.contrato_id));
      setLiveFeedback({ tone: "success", message: "El contrato externo fue importado y corregido con IA." });
      alertSuccess("Contrato importado y corregido", "Se creó un nuevo expediente con la versión corregida por IA. Revisa el borrador y expórtalo.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Intenta nuevamente";
      setLiveFeedback({ tone: "error", message: `No se pudo importar el contrato externo: ${message}` });
      alertError("No pudimos procesar el contrato externo", message);
    } finally {
      setIsImporting(false);
    }
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleMarkdownDownload = () => {
    if (!result) { alertInfo("Genera un contrato primero"); return; }
    const md = editableMarkdown || result.documento_markdown;
    triggerDownload(new Blob([md], { type: "text/markdown;charset=utf-8" }), `contrato-materialidad-${Date.now()}.md`);
  };

  const handleDocxDownload = async () => {
    if (!result) { alertInfo("Genera un contrato para exportarlo"); return; }
    setIsExportingDocx(true);
    try {
      const exportResult = await exportContractDocx({
        documento_markdown: editableMarkdown || result.documento_markdown,
        idioma: result.idioma,
      });
      triggerDownload(exportResult.blob, exportResult.filename);
      if (exportResult.citas_legales?.length) {
        setResult((prev) =>
          prev ? { ...prev, citas_legales: exportResult.citas_legales, citas_legales_metadata: exportResult.citas_legales_metadata ?? prev.citas_legales_metadata } : prev,
        );
      }
      setLiveFeedback({ tone: "success", message: "El documento Word fue exportado correctamente." });
      alertSuccess("Documento Word listo");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Revisa tu conexión e intenta nuevamente.";
      setLiveFeedback({ tone: "error", message: `No se pudo exportar el contrato: ${message}` });
      alertError("No pudimos exportar el contrato", message);
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleClauseInsert = (clause: ClauseSuggestion) => {
    setFormState((prev) => {
      const existing = prev.clausulas.trim();
      const updated = existing ? `${existing}\n${clause.texto.trim()}` : clause.texto.trim();
      return { ...prev, clausulas: updated };
    });
    alertSuccess("Cláusula agregada", clause.titulo);
  };

  const handleClauseCopy = async (clause: ClauseSuggestion) => {
    try {
      await navigator.clipboard.writeText(clause.texto);
      alertSuccess("Cláusula copiada", clause.titulo);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo copiar";
      alertError("No pudimos copiar la cláusula", message);
    }
  };

  const handleUseCurrentDraft = () => {
    if (!result?.documento_markdown) {
      alertInfo("No hay borrador disponible", "Genera un contrato y luego reutilízalo aquí.");
      return;
    }
    setRedlineBase(editableMarkdown || result.documento_markdown);
    alertSuccess("Listo", "Usaremos el borrador actual como base para el comparativo.");
  };

  const handleOptimizeClause = useCallback(
    async (request: OptimizeRequest) => {
      setIsOptimizing(true);
      try {
        const response = await optimizeClause({
          texto_clausula: request.selectedText,
          contexto_contrato: request.fullContext,
          idioma: formState.idioma,
          objetivo: "mejorar_fiscal",
        });
        editorRef.current?.insertOptimizedText(response.texto_mejorado);
        alertSuccess(
          "Cláusula optimizada",
          response.justificacion.length > 120 ? response.justificacion.slice(0, 120) + "…" : response.justificacion,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Intenta nuevamente";
        alertError("No pudimos optimizar la cláusula", message);
      } finally {
        setIsOptimizing(false);
      }
    },
    [formState.idioma],
  );

  const handleAnalyzeRedlines = async () => {
    if (!redlineBase.trim() || !redlineCandidate.trim()) {
      alertInfo("Carga ambas versiones", "Necesitamos el texto base y el revisado.");
      return;
    }
    setIsAnalyzingRedlines(true);
    try {
      const analysis = await analyzeRedlines({ texto_original: redlineBase, texto_revisado: redlineCandidate, idioma: formState.idioma });
      setRedlineResult(analysis);
      setLiveFeedback({ tone: "success", message: "El comparativo de versiones quedó listo para revisión." });
      alertSuccess("Comparativo procesado", analysis.alerta_global);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Intenta nuevamente";
      setLiveFeedback({ tone: "error", message: `No se pudo analizar el comparativo: ${message}` });
      alertError("No pudimos analizar el comparativo", message);
    } finally {
      setIsAnalyzingRedlines(false);
    }
  };

  const handleResetRedlines = () => {
    setRedlineBase("");
    setRedlineCandidate("");
    setRedlineResult(null);
  };

  const handleResetAll = () => {
    setFormState(initialForm);
    setContratoId("");
    setResult(null);
    setEditableMarkdown("");
    setRedlineBase("");
    setRedlineCandidate("");
    setRedlineResult(null);
    setUploadEmpresaId("");
    setUploadFile(null);
  };

  /* ═══════════════════════════════════════════ JSX ═══════════════════════════════════════════ */

  return (
    <DashboardShell>
      <div className="mx-auto max-w-6xl space-y-8 text-slate-900">
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

        {/* ── encabezado + guía ── */}
        <div className="surface-panel-strong rounded-[1.75rem] p-6 shadow-fiscal">
          <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div>
              <p className="kicker-label">Generador de contratos con IA</p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--fiscal-ink)] sm:text-[2.8rem]">Contratos</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--fiscal-muted)] sm:text-base">
                Genera, revisa, compara y exporta contratos que soporten materialidad fiscal con una narrativa contractual más precisa y defendible.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <div className="rounded-full border border-[rgba(45,91,136,0.18)] bg-[var(--fiscal-accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--fiscal-accent)]">
                  Contrato como pieza probatoria
                </div>
                <div className="rounded-full border border-[rgba(184,137,70,0.18)] bg-[rgba(184,137,70,0.10)] px-3 py-2 text-xs font-semibold text-[var(--fiscal-gold)]">
                  Razonamiento jurídico y fiscal integrado
                </div>
              </div>
            </div>
            <div className="surface-shell rounded-[1.5rem] p-5 text-white">
              <p className="eyebrow-shell">Mesa contractual</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-white">El contrato debe describir sustancia, entregables y control probatorio</h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-[rgba(216,211,200,0.78)]">
                La pantalla debe sentirse como una mesa de construcción contractual para blindaje fiscal, no solo como un generador de texto.
              </p>
              <div className="mt-4 flex justify-end">
                <GuiaContador
                  section="Generador de contratos — Reforma 2026"
                  steps={[
                    { title: "1. Configura el contexto", description: "Selecciona la <strong>empresa</strong>, el <strong>proveedor validado 69-B</strong> y el tipo de contrato. <strong>Reforma 2026:</strong> solo contrata con proveedores que hayan pasado la diligencia debida completa." },
                    { title: "2. Genera con cláusulas de materialidad", description: "El sistema genera un contrato con IA que incluye automáticamente cláusulas de <strong>razón de negocio</strong>, <strong>entregables específicos</strong>, <strong>penalidades por incumplimiento</strong> y <strong>evidencia documental</strong> obligatorias por la Reforma 2026." },
                    { title: "3. Optimiza con comparativo y IA", description: "Usa el <strong>comparativo de versiones</strong> para detectar diferencias y la <strong>optimización de cláusulas por IA</strong> para mejorar la protección fiscal. El sistema puede identificar cláusulas que el SAT considera 'genéricas'." },
                    { title: "4. Exporta y vincula al expediente", description: "Una vez aprobado, exporta el contrato en Word y vincúlalo al expediente del proveedor. El contrato debe estar en el expediente <strong>antes de la primera operación</strong> para soportar materialidad." },
                  ]}
                  concepts={[
                    { term: "Cláusula de materialidad (Reforma 2026)", definition: "Disposición contractual que obliga al proveedor a entregar evidencia documental de la prestación real del servicio. Ya no basta con indicar el objeto del contrato — debe especificar QUÉ, CUÁNDO y CÓMO se entregarán los bienes/servicios." },
                    { term: "Comparativo de versiones", definition: "Comparación párrafo a párrafo de dos versiones de un contrato. Permite detectar cláusulas genéricas, riesgos fiscales y cambios que debiliten la posición ante el SAT." },
                    { term: "Razón de negocio contractual", definition: "La Reforma 2026 exige que el propio contrato enuncie la razón de negocio (beneficio económico esperado, independiente del ahorro fiscal) en una cláusula explícita." },
                    { term: "Generación IA + NIF", definition: "El sistema incorpora automáticamente referencias a las NIF aplicables (C-6 bienes, C-8 activos, D-1 ingreso, D-2 costo) para dar sustancia contable al contrato alineada con la reforma." },
                  ]}
                  tips={[
                    "<strong>Reforma 2026:</strong> Incluye siempre cláusulas de entregables <em>específicas</em>: qué documentos entregará, en qué fechas y quién lo recibirá. Sin esto, el contrato no soporta materialidad.",
                    "Usa la función de <strong>optimización de cláusulas</strong> para mejorar automáticamente las descripciones genéricas que el SAT cuestiona.",
                    "Guarda el historial de <strong>versiones del contrato</strong> — demostrar que el contrato existió <em>antes</em> de la operación es clave en auditorías.",
                    "Vincula el contrato al <strong>proveedor con diligencia debida completa</strong>. Un contrato sin expediente del proveedor no soporta materialidad por sí solo.",
                  ]}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KPI label="Contratos registrados" value={contratos.length} sub={isLoadingContratos ? "Cargando…" : "En el sistema"} icon={<FileText className="h-5 w-5 text-[var(--fiscal-accent)]" />} />
          <KPI label="Borrador activo" value={result ? "Sí" : "—"} sub={result ? `Contrato #${result.contrato_id ?? "nuevo"}` : "Genera uno abajo"} icon={<ShieldCheck className="h-5 w-5 text-[var(--fiscal-success)]" />} />
          <KPI label="Citas legales" value={result?.citas_legales?.length ?? 0} sub={hasCitations ? "Generadas con IA" : "Sin citas aún"} icon={<Landmark className="h-5 w-5 text-[var(--fiscal-gold)]" />} />
          <KPI label="Modelo IA" value={result?.modelo?.split("/").pop() ?? "—"} sub="Motor de generación" icon={<Scale className="h-5 w-5 text-[var(--fiscal-muted)]" />} />
        </div>

        {/* ─────── SECCIÓN 1 · DATOS DEL CONTRATO ─────── */}
        <Section title="Datos del contrato" tag="Paso 1 · Configura el contexto" defaultOpen={true}
          actions={isLoadingOptions ? <span className="text-xs text-slate-400">Cargando catálogos…</span> : undefined}
        >
          {!isLoadingOptions && !empresas.length && (
            <div className="mb-5 flex flex-col gap-2 rounded-2xl border border-[rgba(166,103,31,0.22)] bg-[var(--fiscal-warning-soft)] p-4 text-sm text-[var(--fiscal-warning)]">
              <p className="font-semibold text-[var(--fiscal-warning)]">Sin empresas disponibles</p>
              <p>Inicia sesión con un usuario del cliente (no corporativo) y usa el código de empresa correcto para ver las empresas y generar contratos.</p>
              {optionsErrorHint && <p className="text-[var(--fiscal-warning)]/80">Detalle: {optionsErrorHint}</p>}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit} aria-busy={isGenerating}>
            <div className="grid gap-1 rounded-2xl border border-[rgba(200,192,177,0.65)] bg-[rgba(255,255,255,0.72)] px-4 py-3 text-xs text-[var(--fiscal-muted)]">
              <p>Los campos con <span className="font-semibold text-[var(--fiscal-danger)]">*</span> son obligatorios.</p>
              <p>Obligatorio en este formulario: <span className="font-semibold text-[var(--fiscal-ink)]">Empresa</span>.</p>
            </div>
            {/* fila empresa + proveedor */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={`text-xs font-semibold uppercase tracking-[0.2em] ${empresaMissing ? "text-[var(--fiscal-danger)]" : "text-[var(--fiscal-muted)]"}`}>Empresa <span className="text-[var(--fiscal-danger)]">*</span></label>
                <select name="empresa" value={formState.empresa} onChange={handleChange} required className={`mt-2 ${contractInputCls(empresaMissing)}`}>
                  <option value="">Selecciona la razón social</option>
                  {empresas.map((e) => <option key={e.id} value={e.id}>{e.razon_social} ({e.rfc})</option>)}
                </select>
                {empresaMissing && <p className="mt-1 text-[11px] font-medium text-[var(--fiscal-danger)]">Selecciona la empresa para generar un contrato trazable.</p>}
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--fiscal-muted)]">Proveedor</label>
                <select name="proveedor" value={formState.proveedor} onChange={handleChange} className={`mt-2 ${contractInputCls()}`}>
                  <option value="">(Sin proveedor asociado)</option>
                  {proveedores.map((p) => <option key={p.id} value={p.id}>{p.razon_social} ({p.rfc})</option>)}
                </select>
              </div>
            </div>

            {/* contrato asociado */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--fiscal-muted)]">Contrato asociado (opcional)</label>
              <div className="mt-2 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto] lg:items-center">
                <select value={contratoId} onChange={(e) => setContratoId(e.target.value)} className={inputCls}>
                  <option value="">Guardar como nuevo contrato automático</option>
                  {isLoadingContratos && <option value="">Cargando contratos…</option>}
                  {!isLoadingContratos && contratos.length === 0 && <option value="">Sin contratos registrados</option>}
                  {contratos.map((c) => (
                    <option key={c.id} value={String(c.id)}>#{c.id} · {c.nombre}{c.proveedor_nombre ? ` · ${c.proveedor_nombre}` : ""}</option>
                  ))}
                </select>
                <button type="button" disabled={!contratoId || isLoadingContrato} aria-disabled={!contratoId || isLoadingContrato} aria-busy={isLoadingContrato}
                  onClick={async () => {
                    if (!contratoId) return;
                    setIsLoadingContrato(true);
                    try {
                      const docs = await fetchContractDocuments(Number(contratoId));
                      const latest = docs.find((d) => d.markdown_text && (d.kind === "CORREGIDO" || d.kind === "BORRADOR_AI" || d.kind === "DEFINITIVO_AI"));
                      if (latest?.markdown_text) {
                        const citas = latest.metadata?.citas_legales ?? [];
                        const citasMeta = latest.metadata?.citas_legales_metadata ?? null;
                        setResult({ documento_markdown: latest.markdown_text, idioma: (latest.idioma as "es" | "en") || "es", tono: (latest.tono as "formal" | "neutral") || "formal", modelo: latest.modelo || "", citas_legales: citas, citas_legales_metadata: citasMeta, contrato_id: Number(contratoId), documento_id: latest.id });
                        setEditableMarkdown(latest.markdown_text);
                        setRedlineBase(latest.markdown_text);
                        setLiveFeedback({ tone: "success", message: `Se cargó el documento ${latest.id} del expediente contractual.` });
                        alertSuccess("Contrato cargado", `Se cargó el documento #${latest.id} (${latest.kind})`);
                      } else {
                        setLiveFeedback({ tone: "info", message: "El expediente no tiene un borrador reutilizable todavía." });
                        alertInfo("Sin borrador", "Este contrato no tiene documentos con texto generado.");
                      }
                    } catch (error) {
                      setLiveFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo cargar el contrato." });
                      alertError("No pudimos cargar el contrato", error instanceof Error ? error.message : "Error al cargar");
                    } finally { setIsLoadingContrato(false); }
                  }}
                  className="inline-flex min-h-[40px] w-full items-center justify-center rounded-xl border border-[rgba(45,91,136,0.22)] bg-[var(--fiscal-accent-soft)] px-4 py-2 text-sm font-semibold text-[var(--fiscal-accent)] transition hover:bg-[var(--fiscal-accent-soft)]/80 disabled:opacity-50 lg:w-auto"
                >
                  {isLoadingContrato ? "Cargando…" : "Recargar"}
                </button>
                <button type="button" disabled={!contratoId || isDeletingContrato} aria-disabled={!contratoId || isDeletingContrato} aria-busy={isDeletingContrato}
                  onClick={async () => {
                    if (!contratoId) return;
                    const sel = contratos.find((c) => String(c.id) === contratoId);
                    const label = sel ? `#${sel.id} · ${sel.nombre}` : `#${contratoId}`;
                    if (!window.confirm(`¿Eliminar el contrato ${label}? Esta acción no se puede deshacer.`)) return;
                    setIsDeletingContrato(true);
                    try {
                      await apiFetch(`/api/materialidad/contratos/${contratoId}/`, { method: "DELETE" });
                      setContratos((prev) => prev.filter((c) => String(c.id) !== contratoId));
                      setContratoId("");
                      if (result?.contrato_id === Number(contratoId)) { setResult(null); setEditableMarkdown(""); }
                      setLiveFeedback({ tone: "success", message: `Se eliminó el contrato ${label}.` });
                      alertSuccess("Contrato eliminado", `Se eliminó ${label}`);
                    } catch (error) {
                      const message = error instanceof Error ? error.message : "Intenta nuevamente";
                      setLiveFeedback({ tone: "error", message: `No se pudo eliminar el contrato: ${message}` });
                      alertError("No pudimos eliminar el contrato", message);
                    }
                    finally { setIsDeletingContrato(false); }
                  }}
                  className="inline-flex min-h-[40px] w-full items-center justify-center rounded-xl border border-[rgba(160,67,61,0.22)] bg-[var(--fiscal-danger-soft)] px-3 py-2 text-sm font-semibold text-[var(--fiscal-danger)] transition hover:bg-[var(--fiscal-danger-soft)]/80 disabled:opacity-50 lg:w-auto"
                >
                  {isDeletingContrato ? "Eliminando…" : "Eliminar"}
                </button>
                <button type="button" disabled={!contratoId}
                  onClick={async () => {
                    if (!contratoId) return;
                    const current = contratos.find((c) => String(c.id) === contratoId);
                    const nuevoNombre = window.prompt("Nuevo nombre del contrato:", current?.nombre || "");
                    if (!nuevoNombre || !nuevoNombre.trim() || nuevoNombre.trim() === current?.nombre) return;
                    try {
                      await apiFetch(`/api/materialidad/contratos/${contratoId}/`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: nuevoNombre.trim() }) });
                      setContratos((prev) => prev.map((c) => String(c.id) === contratoId ? { ...c, nombre: nuevoNombre.trim() } : c));
                      setLiveFeedback({ tone: "success", message: `El contrato fue renombrado a ${nuevoNombre.trim()}.` });
                      alertSuccess("Nombre actualizado", nuevoNombre.trim());
                    } catch (error) {
                      const message = error instanceof Error ? error.message : "Intenta nuevamente";
                      setLiveFeedback({ tone: "error", message: `No se pudo renombrar el contrato: ${message}` });
                      alertError("No pudimos renombrar", message);
                    }
                  }}
                  className="inline-flex min-h-[40px] w-full items-center justify-center rounded-xl border border-[rgba(200,192,177,0.72)] bg-white px-3 py-2 text-sm font-semibold text-[var(--fiscal-ink)] transition hover:bg-[rgba(244,242,237,0.56)] disabled:opacity-50 lg:w-auto"
                >
                  Renombrar
                </button>
              </div>
              <p className="mt-1 text-xs text-[var(--fiscal-muted)]">Elige un contrato para asociar el borrador, o haz clic en Recargar para ver su último documento.</p>
            </div>

            {/* plantilla + idioma/tono */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--fiscal-muted)]">Plantilla base (opcional)</label>
                <select name="template" value={formState.template} onChange={handleChange} className={`mt-2 ${inputCls}`}>
                  <option value="">Sin plantilla</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.nombre} · {t.categoria}</option>)}
                </select>
              </div>
              <div className="grid gap-2 rounded-2xl border border-[rgba(200,192,177,0.55)] bg-[rgba(244,242,237,0.62)] p-4 text-xs text-[var(--fiscal-muted)]">
                <p>Idioma y tono orientan las instrucciones con la voz de tu despacho.</p>
                <div className="grid gap-2 md:grid-cols-2">
                  <select name="idioma" value={formState.idioma} onChange={handleChange} className={inputCls}>
                    <option value="es">Español</option>
                    <option value="en">Inglés</option>
                  </select>
                  <select name="tono" value={formState.tono} onChange={handleChange} className={inputCls}>
                    <option value="formal">Formal</option>
                    <option value="neutral">Neutral</option>
                  </select>
                </div>
              </div>
            </div>

            {selectedTemplate && (
              <div className="rounded-2xl border border-[rgba(200,192,177,0.72)] bg-[rgba(255,255,255,0.78)] p-4 text-sm text-[var(--fiscal-ink)] shadow-panel">
                <p className="font-semibold text-[var(--fiscal-ink)]">{selectedTemplate.nombre}</p>
                <p className="mt-1 text-[var(--fiscal-muted)]">Clave: {selectedTemplate.clave}</p>
                <p className="mt-1 text-[var(--fiscal-muted)]">Proceso: {selectedTemplate.proceso}</p>
                <p className="mt-1 text-[var(--fiscal-muted)]">{selectedTemplate.descripcion || "Sin descripción"}</p>
              </div>
            )}

            {/* textareas */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--fiscal-muted)]">Resumen de necesidades</label>
              <textarea name="resumen_necesidades" value={formState.resumen_necesidades} onChange={handleChange} rows={4}
                placeholder="Describe objetivo, servicios, montos o condiciones relevantes"
                className={`mt-2 ${inputCls} min-h-[88px]`} />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--fiscal-muted)]">Cláusulas o requisitos especiales</label>
              <textarea name="clausulas" value={formState.clausulas} onChange={handleChange} rows={4}
                placeholder="Una cláusula por línea (confidencialidad, penalizaciones, renovaciones, etc.)"
                className={`mt-2 ${inputCls} min-h-[88px]`} />
            </div>

            {/* botones de generación + tip animado */}
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                <button type="submit" disabled={isGenerating} aria-disabled={isGenerating} aria-busy={isGenerating}
                  className="button-institutional flex-1 rounded-2xl px-4 py-3 text-sm font-bold text-white transition disabled:opacity-60">
                  {isGenerating ? "Generando…" : "✦ Generar contrato con IA"}
                </button>
                <button type="button" onClick={handleResetAll}
                  className="rounded-2xl border border-[rgba(200,192,177,0.72)] px-4 py-3 text-sm font-medium text-[var(--fiscal-ink)] hover:border-[rgba(200,192,177,0.92)] hover:bg-[rgba(244,242,237,0.56)]">
                  Limpiar todo
                </button>
              </div>
              {shouldShowTips && (
                <div className="flex items-start gap-3 rounded-2xl border border-[rgba(45,91,136,0.22)] bg-[var(--fiscal-accent-soft)] p-4 text-sm text-[var(--fiscal-accent)] animate-pulse">
                  <span className="mt-0.5 inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--fiscal-accent)] border-t-transparent" />
                  <p>{MATERIALITY_TIPS[activeTipIndex]}</p>
                </div>
              )}
            </div>
          </form>
        </Section>

        {/* ─────── SECCIÓN 2 · BIBLIOTECA DE CLÁUSULAS ─────── */}
        <Section title="Biblioteca de cláusulas" tag="Cláusulas sugeridas por plantilla" defaultOpen={true}
          actions={
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input type="text" value={clauseQuery} onChange={(e) => setClauseQuery(e.target.value)}
                placeholder="Buscar por palabra clave" className={inputCls} />
              <button type="button" onClick={() => void refreshClauseSuggestions(clauseQuery)} disabled={isLoadingClauses || !formState.empresa} aria-disabled={isLoadingClauses || !formState.empresa} aria-busy={isLoadingClauses}
                className="button-institutional w-full rounded-xl px-3 py-2 text-xs font-semibold text-white transition disabled:opacity-60 sm:w-auto">
                {isLoadingClauses ? "Buscando…" : "Buscar"}
              </button>
            </div>
          }
        >
          {!formState.empresa ? (
            <p className="rounded-2xl border border-dashed border-[rgba(200,192,177,0.72)] bg-[rgba(255,255,255,0.56)] p-4 text-sm text-[var(--fiscal-muted)]">
              Selecciona primero una empresa para personalizar las cláusulas sugeridas.
            </p>
          ) : clauseSuggestions.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {clauseSuggestions.map((clause) => (
                <ClauseSuggestionCard key={clause.slug} clause={clause} onInsert={handleClauseInsert} onCopy={handleClauseCopy} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-[rgba(200,192,177,0.72)] bg-[rgba(255,255,255,0.56)] p-4 text-sm text-[var(--fiscal-muted)]">
              {isLoadingClauses ? "Buscando coincidencias con tus instrucciones…" : "No encontramos coincidencias directas. Ajusta el resumen o usa otras palabras clave."}
            </p>
          )}
        </Section>

        {/* ─────── SECCIÓN 3 · EDITOR DE BORRADOR (ANCHO COMPLETO) ─────── */}
        <Section title="Editor del borrador" tag="Paso 2 · Revisa y edita" defaultOpen={!!result}
          badge={result ? <span className="animate-pulse rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-800 shadow-lg shadow-emerald-200">✦ Borrador listo — revísalo aquí</span> : undefined}
          actions={
            result ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={handleCopy} className="rounded-xl border border-[rgba(200,192,177,0.72)] px-3 py-1.5 text-xs font-semibold text-[var(--fiscal-ink)] hover:bg-[rgba(244,242,237,0.56)]">
                  Copiar
                </button>
                <button type="button" onClick={handleMarkdownDownload} className="rounded-xl border border-[rgba(200,192,177,0.72)] px-3 py-1.5 text-xs font-semibold text-[var(--fiscal-ink)] hover:bg-[rgba(244,242,237,0.56)]">
                  Descargar texto
                </button>
                <button type="button" onClick={handleDocxDownload} disabled={isExportingDocx} aria-disabled={isExportingDocx} aria-busy={isExportingDocx}
                  className="button-institutional rounded-xl px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                  {isExportingDocx ? "Exportando…" : "Exportar a Word"}
                </button>
                <button type="button" disabled={!result || !contratoId || isSaving} aria-disabled={!result || !contratoId || isSaving} aria-busy={isSaving}
                  onClick={async () => {
                    if (!result || !contratoId) { alertInfo("Sin contrato", "Selecciona un contrato asociado para guardar el borrador."); return; }
                    setIsSaving(true);
                    try {
                      const md = editableMarkdown || result.documento_markdown;
                      const fd = new FormData();
                      fd.append("markdown_text", md);
                      fd.append("kind", "DEFINITIVO_AI");
                      fd.append("source", "MANUAL");
                      fd.append("idioma", result.idioma || "es");
                      fd.append("tono", result.tono || "formal");
                      await uploadContractDocument(Number(contratoId), fd);
                      setLiveFeedback({ tone: "success", message: "El borrador editado fue guardado en el expediente del contrato." });
                      alertSuccess("Borrador guardado", "El documento editado se guardó en el expediente del contrato.");
                    } catch (error) {
                      const message = error instanceof Error ? error.message : "Intenta nuevamente";
                      setLiveFeedback({ tone: "error", message: `No se pudo guardar el borrador: ${message}` });
                      alertError("No pudimos guardar", message);
                    }
                    finally { setIsSaving(false); }
                  }}
                  className="rounded-xl bg-[var(--fiscal-success)] px-3 py-1.5 text-xs font-bold text-white hover:bg-[var(--fiscal-success)]/90 disabled:opacity-50">
                  {isSaving ? "Guardando…" : "Guardar en expediente"}
                </button>
              </div>
            ) : undefined
          }
        >
          {result ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--fiscal-muted)]">
                <span className="uppercase tracking-[0.2em]">{(result.idioma || formState.idioma || "es").toUpperCase()} · {formState.tono}</span>
                <span>·</span>
                <span>{selectedTemplate ? selectedTemplate.nombre : "Sin plantilla"}</span>
              </div>
              <ContractEditor
                ref={editorRef}
                content={result.documento_markdown}
                onUpdate={(md) => setEditableMarkdown(md)}
                onOptimizeRequest={handleOptimizeClause}
                isOptimizing={isOptimizing}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[rgba(200,192,177,0.72)] bg-[rgba(255,255,255,0.56)] p-8 text-center">
              <p className="text-sm text-[var(--fiscal-muted)]">Genera un contrato para visualizar el borrador y habilitar las herramientas de edición.</p>
            </div>
          )}
        </Section>

        {/* ─────── SECCIÓN 3 · CITAS LEGALES ─────── */}
        {hasCitations && result?.citas_legales && (
          <Section title="Referencias legales" tag="Sustento normativo" defaultOpen={false}
            badge={
              result.citas_legales_metadata ? (
                <CitationMetadataBadge metadata={result.citas_legales_metadata} />
              ) : undefined
            }
          >
            <LegalCitationsPanel citations={result.citas_legales} />
          </Section>
        )}

        {/* ─────── SECCIÓN 4 · IMPORTAR CONTRATO EXTERNO ─────── */}
        <Section title="Importar contrato externo" tag="Contratos existentes" defaultOpen={false}>
          <p className="mb-4 text-sm text-[var(--fiscal-muted)]">
            Sube un contrato externo (PDF, Word o texto) y crearemos automáticamente un nuevo expediente con la versión corregida por IA.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--fiscal-muted)]">Empresa</label>
              <select value={uploadEmpresaId} onChange={(e) => setUploadEmpresaId(e.target.value)} className={`mt-2 ${inputCls}`}>
                <option value="">Selecciona una empresa</option>
                {empresas.map((e) => <option key={e.id} value={String(e.id)}>{e.razon_social} ({e.rfc})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--fiscal-muted)]">Archivo</label>
              <input type="file" accept=".pdf,.docx,.txt,.md" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} className={`mt-2 ${inputCls}`} />
            </div>
          </div>
          <div className="mt-4">
            <button type="button" onClick={handleImportExternal} disabled={isImporting} aria-disabled={isImporting} aria-busy={isImporting}
              className="button-institutional w-full rounded-2xl px-5 py-3 text-sm font-semibold text-white transition disabled:opacity-60 sm:w-auto">
              {isImporting ? "Importando y corrigiendo…" : "Importar y corregir contrato"}
            </button>
          </div>
        </Section>

        {/* ─────── SECCIÓN 6 · COMPARATIVO DE VERSIONES ─────── */}
        <Section title="Comparativo de versiones" tag="Cotejo inteligente" defaultOpen={false}>

          {/* ── Guía paso a paso ── */}
          <div className="mb-5 rounded-2xl border border-[rgba(45,91,136,0.18)] bg-[var(--fiscal-accent-soft)]/60 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-[var(--fiscal-accent)]">¿Cómo funciona?</p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-[var(--fiscal-ink)]">
              <li><strong>Carga la versión base</strong> — usa el botón de abajo para copiar tu borrador generado, o pega manualmente un contrato existente.</li>
              <li><strong>Carga la versión revisada</strong> — pega el texto con cambios de la contraparte, del área legal o tu propia revisión.</li>
              <li><strong>Presiona &quot;Analizar comparativo&quot;</strong> — la IA identificará diferencias cláusula por cláusula, riesgos fiscales y oportunidades de mejora.</li>
            </ol>
          </div>

          {/* ── Botón para cargar borrador como base ── */}
          <div className="mb-4">
            <button type="button" onClick={handleUseCurrentDraft} disabled={!result}
              className="button-institutional w-full rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-40 disabled:cursor-not-allowed sm:w-auto">
              {redlineBase ? "↻ Actualizar base con borrador actual" : "▼ Cargar borrador generado como base"}
            </button>
            {!result && (
              <p className="mt-1.5 text-xs text-[var(--fiscal-muted)]">Primero genera un contrato en la sección superior para poder usarlo aquí.</p>
            )}
            {redlineBase && (
              <p className="mt-1.5 text-xs text-[var(--fiscal-success)]">✓ Versión base cargada ({redlineBase.split(/\s+/).length} palabras)</p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--fiscal-muted)]">
                Versión base (original)
                {redlineBase && <span className="ml-2 text-[var(--fiscal-success)] normal-case tracking-normal">✓ cargada</span>}
              </label>
              <textarea value={redlineBase} onChange={(e) => setRedlineBase(e.target.value)} rows={10}
                placeholder="Pega aquí el contrato original, o usa el botón de arriba para cargar el borrador generado."
                className={`mt-2 ${inputCls} min-h-[200px] font-mono text-xs`} />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--fiscal-muted)]">
                Versión revisada (contraparte)
                {redlineCandidate && <span className="ml-2 text-[var(--fiscal-accent)] normal-case tracking-normal">✓ cargada</span>}
              </label>
              <textarea value={redlineCandidate} onChange={(e) => setRedlineCandidate(e.target.value)} rows={10}
                placeholder="Pega aquí la versión con cambios, correcciones o comentarios de la contraparte o del área legal."
                className={`mt-2 ${inputCls} min-h-[200px] font-mono text-xs`} />
            </div>
          </div>

          {/* ── Estado de preparación ── */}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--fiscal-muted)]">
            <span className={`h-2 w-2 rounded-full ${redlineBase ? "bg-green-500" : "bg-slate-300"}`} />
            <span>Base {redlineBase ? `(${redlineBase.split(/\s+/).length} palabras)` : "(vacía)"}</span>
            <span className="text-[rgba(200,192,177,0.72)]">|</span>
            <span className={`h-2 w-2 rounded-full ${redlineCandidate ? "bg-green-500" : "bg-slate-300"}`} />
            <span>Revisada {redlineCandidate ? `(${redlineCandidate.split(/\s+/).length} palabras)` : "(vacía)"}</span>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={handleAnalyzeRedlines}
              disabled={isAnalyzingRedlines || !redlineBase.trim() || !redlineCandidate.trim()}
              aria-disabled={isAnalyzingRedlines || !redlineBase.trim() || !redlineCandidate.trim()}
              aria-busy={isAnalyzingRedlines}
              className="button-institutional rounded-2xl px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed">
              {isAnalyzingRedlines ? "Analizando diferencias…" : "🔍 Analizar comparativo"}
            </button>
            <button type="button" onClick={handleResetRedlines}
              className="rounded-2xl border border-[rgba(200,192,177,0.72)] px-5 py-2.5 text-sm font-semibold text-[var(--fiscal-ink)] hover:border-[rgba(200,192,177,0.92)] hover:bg-[rgba(244,242,237,0.56)]">
              Limpiar panel
            </button>
          </div>
          <div className="mt-4">
            {redlineResult ? (
              <RedlineInsights analysis={redlineResult} />
            ) : (
              !redlineBase && !redlineCandidate ? (
                <p className="rounded-2xl border border-dashed border-[rgba(200,192,177,0.72)] bg-[rgba(255,255,255,0.56)] p-4 text-sm text-[var(--fiscal-muted)]">
                  Sigue los 3 pasos de arriba para comparar versiones de tu contrato. La IA analizará las diferencias y señalará riesgos fiscales.
                </p>
              ) : (
                <p className="rounded-2xl border border-dashed border-[rgba(166,103,31,0.22)] bg-[var(--fiscal-warning-soft)] p-4 text-sm text-[var(--fiscal-warning)]">
                  {!redlineBase.trim() ? "⬆ Falta cargar la versión base." : !redlineCandidate.trim() ? "⬆ Falta pegar la versión revisada por la contraparte." : "Presiona \"Analizar comparativo\" cuando estés listo."}
                </p>
              )
            )}
          </div>
        </Section>

      </div>
    </DashboardShell>
  );
}

/* ═══════════════════════════════════════════ SUBCOMPONENTES ═══════════════════════════════════════════ */

function ClauseSuggestionCard({ clause, onInsert, onCopy }: { clause: ClauseSuggestion; onInsert: (c: ClauseSuggestion) => void; onCopy: (c: ClauseSuggestion) => void }) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-[rgba(200,192,177,0.72)] bg-white p-4 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--fiscal-muted)]">{clause.nivel_riesgo}</p>
          <h4 className="text-base font-semibold text-[var(--fiscal-ink)]">{clause.titulo}</h4>
        </div>
        <span className="rounded-full bg-[var(--fiscal-accent-soft)] px-3 py-1 text-xs font-bold text-[var(--fiscal-accent)]">
          {Math.round(clause.relevancia * 100)}%
        </span>
      </div>
      <p className="text-sm text-[var(--fiscal-muted)] line-clamp-4">{clause.texto}</p>
      {clause.tips_redline.length > 0 && (
        <ul className="space-y-1 text-xs text-[var(--fiscal-muted)]">
          {clause.tips_redline.slice(0, 3).map((tip) => (
            <li key={tip} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--fiscal-accent)]" />
              {tip}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-1.5">
        {clause.palabras_clave.slice(0, 4).map((kw) => (
          <span key={kw} className="rounded-full bg-[rgba(244,242,237,0.88)] px-2 py-0.5 text-[11px] text-[var(--fiscal-muted)]">{kw}</span>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={() => onInsert(clause)}
          className="button-institutional flex-1 rounded-xl px-3 py-2 text-sm font-semibold text-white transition">
          Agregar al contrato
        </button>
        <button type="button" onClick={() => onCopy(clause)}
          className="flex-1 rounded-xl border border-[rgba(200,192,177,0.72)] px-3 py-2 text-sm font-semibold text-[var(--fiscal-ink)] hover:bg-[rgba(244,242,237,0.56)]">
          Copiar texto
        </button>
      </div>
    </article>
  );
}

function LegalCitationsPanel({ citations }: { citations: LegalCitation[] }) {
  if (!citations.length) return null;
  return (
    <div className="space-y-3">
      {citations.map((c) => (
        <article key={`${c.ley}-${c.articulo}-${c.referencia}`}
          className="rounded-2xl border border-[rgba(200,192,177,0.72)] bg-[rgba(255,255,255,0.82)] p-4 text-sm text-[var(--fiscal-ink)] shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.3em] text-[var(--fiscal-muted)]">
            <span>{c.tipo_fuente}</span>
            <span>{c.vigencia ?? "Sin vigencia"}</span>
          </div>
          <h4 className="mt-2 text-base font-semibold text-[var(--fiscal-ink)]">
            {c.ley} · Art. {c.articulo}{c.fraccion ? ` · Frac. ${c.fraccion}` : ""}
          </h4>
          <p className="mt-1 text-[var(--fiscal-muted)]">{c.referencia}</p>
          {c.resumen && <p className="mt-2 text-[var(--fiscal-muted)]">{c.resumen}</p>}
          {c.criterios_sat?.length ? (
            <div className="mt-3 space-y-1 text-xs text-[var(--fiscal-warning)]">
              {c.criterios_sat.slice(0, 2).map((cr) => <p key={cr.referencia}>{cr.referencia} · {cr.riesgo}</p>)}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function CitationMetadataBadge({ metadata }: { metadata: CitationCacheMetadata }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-[var(--fiscal-accent-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--fiscal-accent)]">
      {metadata.cache_hit ? "Citas en caché" : "Citas actualizadas"}
      {metadata.cache_updated_at && <span className="text-[var(--fiscal-accent)]/70">· {metadata.cache_updated_at}</span>}
      {metadata.regenerations !== undefined && <span className="text-[var(--fiscal-accent)]/70">· {metadata.regenerations} reg.</span>}
    </span>
  );
}

function RedlineInsights({ analysis }: { analysis: RedlineAnalysis }) {
  const changePercent = Math.round(analysis.change_ratio * 100);
  return (
    <div className="space-y-4" aria-live="polite">
      <div className="rounded-2xl border border-[rgba(200,192,177,0.72)] bg-[rgba(244,242,237,0.62)] p-4 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-[var(--fiscal-muted)]">Alerta global</p>
            <p className="text-lg font-semibold text-[var(--fiscal-ink)]">{analysis.alerta_global}</p>
          </div>
          <span className="rounded-full bg-[var(--fiscal-warning-soft)] px-3 py-1 text-xs font-bold text-[var(--fiscal-warning)]">
            {changePercent}% de cambio
          </span>
        </div>
        <p className="mt-2 text-sm text-[var(--fiscal-muted)]">{analysis.resumen}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[rgba(200,192,177,0.72)] bg-white p-4 shadow-panel">
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--fiscal-warning)]">Riesgos clave</p>
          <ul className="mt-2 space-y-2 text-sm text-[var(--fiscal-ink)]">
            {analysis.riesgos.map((r) => (
              <li key={r.titulo} className="rounded-xl border border-[rgba(166,103,31,0.22)] bg-[var(--fiscal-warning-soft)] p-3">
                <p className="text-sm font-semibold text-[var(--fiscal-warning)]">{r.titulo}</p>
                <p className="text-xs text-[var(--fiscal-ink)]">Impacto: {r.impacto}</p>
                {r.detalle && <p className="text-xs text-[var(--fiscal-ink)]">{r.detalle}</p>}
                {r.accion && <p className="text-xs text-[var(--fiscal-warning)]">Acción sugerida: {r.accion}</p>}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-[rgba(200,192,177,0.72)] bg-white p-4 shadow-panel">
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--fiscal-success)]">Oportunidades</p>
          <ul className="mt-2 space-y-2 text-sm text-[var(--fiscal-ink)]">
            {analysis.oportunidades.map((o) => (
              <li key={o.titulo} className="rounded-xl border border-[rgba(31,122,90,0.22)] bg-[var(--fiscal-success-soft)] p-3">
                <p className="text-sm font-semibold text-[var(--fiscal-success)]">{o.titulo}</p>
                <p className="text-xs text-[var(--fiscal-success)]">{o.descripcion}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.35em] text-[var(--fiscal-muted)]">Diferencias detectadas</p>
        {analysis.diff.slice(0, 20).map((segment, index) => (
          <DiffSegmentBlock key={`${segment.type}-${index}`} segment={segment} index={index} />
        ))}
      </div>
    </div>
  );
}

function DiffSegmentBlock({ segment, index }: { segment: DiffSegment; index: number }) {
  const labelMap: Record<DiffSegment["type"], { label: string; color: string }> = {
    equal: { label: "Sin cambios", color: "text-slate-600" },
    insert: { label: "Insertado", color: "text-blue-600" },
    delete: { label: "Eliminado", color: "text-rose-600" },
    replace: { label: "Modificado", color: "text-amber-600" },
  };
  return (
    <article className="rounded-2xl border border-[rgba(200,192,177,0.72)] bg-white p-4 shadow-panel">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em]">
        <span className={labelMap[segment.type].color}>{labelMap[segment.type].label}</span>
        <span className="text-[var(--fiscal-muted)]">#{index + 1}</span>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <DiffColumn title="Original" color="text-slate-700" lines={segment.original} />
        <DiffColumn title="Revisado" color="text-slate-900" lines={segment.revisado} />
      </div>
    </article>
  );
}

function DiffColumn({ title, color, lines }: { title: string; color: string; lines: string[] }) {
  return (
    <div className="rounded-xl border border-[rgba(200,192,177,0.55)] bg-[rgba(244,242,237,0.62)] p-3">
      <p className="text-xs uppercase tracking-[0.3em] text-[var(--fiscal-muted)]">{title}</p>
      {lines.length ? (
        <pre className={`mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs ${color}`}>
          {lines.map((line, i) => (
            <Fragment key={`${title}-${i}`}>{line}{i < lines.length - 1 ? "\n" : ""}</Fragment>
          ))}
        </pre>
      ) : (
        <p className="mt-2 text-xs text-[var(--fiscal-muted)]">Sin contenido</p>
      )}
    </div>
  );
}
