"use client";

import {
  ChangeEvent,
  FormEvent,
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { DashboardShell } from "components/DashboardShell";
import { useAuthContext } from "context/AuthContext";
import { apiFetch } from "lib/api";
import {
  generateContract,
  ContractGenerationResponse,
  exportContractDocx,
  LegalCitation,
  CitationCacheMetadata,
  uploadContractDocument,
  correctContractDocument,
  ClauseSuggestion,
  fetchClauseSuggestions,
  analyzeRedlines,
  RedlineAnalysis,
  DiffSegment,
} from "lib/contracts";
import { alertError, alertInfo, alertSuccess } from "lib/alerts";

type Empresa = {
  id: number;
  razon_social: string;
  rfc: string;
};

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
  template: string;
  resumen_necesidades: string;
  clausulas: string;
  idioma: "es" | "en";
  tono: "formal" | "neutral";
};

const MATERIALITY_TIPS = [
  "Validamos que las cláusulas de confidencialidad estén alineadas al régimen fiscal de tu empresa.",
  "Buscando precedentes SAT y criterios PRODECON para reforzar tus referencias legales.",
  "Agregando recordatorios de obligaciones de retenciones e impuestos indirectos.",
  "Ajustando el tono para mantener la voz corporativa sin perder firmeza legal.",
];

const initialForm: ContractFormState = {
  empresa: "",
  template: "",
  resumen_necesidades: "",
  clausulas: "",
  idioma: "es",
  tono: "formal",
};

export default function ContratosPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthContext();

  const [formState, setFormState] = useState<ContractFormState>(initialForm);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
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
  const [uploadContratoId, setUploadContratoId] = useState<string>("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const selectedTemplate = useMemo(
    () => templates.find((template) => String(template.id) === formState.template) ?? null,
    [templates, formState.template]
  );

  const hasCitations = Boolean(result?.citas_legales?.length);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let mounted = true;
    const loadOptions = async () => {
      setIsLoadingOptions(true);
      try {
        const [empresasRes, templatesRes] = await Promise.all([
          apiFetch<PaginatedResponse<Empresa>>("/api/materialidad/empresas/"),
          apiFetch<ContratoTemplate[]>("/api/materialidad/contrato-templates/"),
        ]);

        if (!mounted) return;
        setEmpresas(empresasRes.results ?? []);
        setTemplates(templatesRes ?? []);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Intenta de nuevo en unos minutos.";
        alertError("No pudimos cargar los catálogos", message);
        setOptionsErrorHint("Revisa que iniciaste sesión con el cliente correcto y que el slug se envía en el login.");
      } finally {
        if (mounted) {
          setIsLoadingOptions(false);
        }
      }
    };

    void loadOptions();
    return () => {
      mounted = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    let mounted = true;
    const loadContratos = async () => {
      setIsLoadingContratos(true);
      try {
        const payload = await apiFetch<PaginatedResponse<ContratoLite> | ContratoLite[]>(
          "/api/materialidad/contratos/?ordering=-created_at"
        );
        const list = Array.isArray(payload) ? payload : payload.results ?? [];
        if (mounted) {
          setContratos(list);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Intenta de nuevo en unos minutos.";
        alertError("No pudimos cargar contratos", message);
      } finally {
        if (mounted) {
          setIsLoadingContratos(false);
        }
      }
    };
    void loadContratos();
    return () => {
      mounted = false;
    };
  }, [isAuthenticated]);

  const refreshClauseSuggestions = useCallback(
    async (queryOverride?: string) => {
      if (!formState.empresa) {
        setClauseSuggestions([]);
        return;
      }
      setIsLoadingClauses(true);
      try {
        const suggestions = await fetchClauseSuggestions({
          idioma: formState.idioma,
          resumen_necesidades: formState.resumen_necesidades || undefined,
          template: formState.template ? Number(formState.template) : undefined,
          query: queryOverride && queryOverride.trim().length ? queryOverride.trim() : undefined,
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
    [formState.empresa, formState.idioma, formState.resumen_necesidades, formState.template]
  );

  useEffect(() => {
    if (!formState.empresa) {
      setClauseSuggestions([]);
      return;
    }
    const timeout = setTimeout(() => {
      void refreshClauseSuggestions();
    }, 500);
    return () => {
      clearTimeout(timeout);
    };
  }, [formState.empresa, formState.idioma, formState.template, formState.resumen_necesidades, refreshClauseSuggestions]);

  useEffect(() => {
    if (!shouldShowTips) {
      if (tipIntervalRef.current) {
        clearInterval(tipIntervalRef.current);
      }
      setActiveTipIndex(0);
      return;
    }
    tipIntervalRef.current = setInterval(() => {
      setActiveTipIndex((prev) => (prev + 1) % MATERIALITY_TIPS.length);
    }, 3200);
    return () => {
      if (tipIntervalRef.current) {
        clearInterval(tipIntervalRef.current);
      }
    };
  }, [shouldShowTips]);

  const handleChange = (
    event: ChangeEvent<HTMLSelectElement | HTMLTextAreaElement | HTMLInputElement>
  ) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.empresa) {
      alertInfo("Selecciona una empresa", "Necesitamos saber para quién generaremos el borrador.");
      return;
    }
    if (!empresas.length) {
      alertInfo(
        "Sin empresas disponibles",
        "Inicia sesión con un usuario del cliente y verifica el slug en el login."
      );
      return;
    }

    setIsGenerating(true);
    setShouldShowTips(true);
    setResult(null);

    const clausulas = formState.clausulas
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    try {
      const payload = {
        contrato: contratoId ? Number(contratoId) : undefined,
        empresa: Number(formState.empresa),
        template: formState.template ? Number(formState.template) : undefined,
        idioma: formState.idioma,
        tono: formState.tono,
        resumen_necesidades: formState.resumen_necesidades || undefined,
        clausulas_especiales: clausulas.length ? clausulas : undefined,
      };

      const response = await generateContract(payload);
      setResult(response);
      setRedlineBase(response.documento_markdown);
      alertSuccess("Contrato generado", "Revisa la vista previa y personaliza lo necesario.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Intenta nuevamente";
      alertError("No pudimos generar el contrato", message);
    } finally {
      setIsGenerating(false);
      setShouldShowTips(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.documento_markdown);
      alertSuccess("Contenido copiado", "Pega el borrador en tu herramienta favorita");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo copiar";
      alertError("No pudimos copiar el texto", message);
    }
  };

  const handleImportExternal = async () => {
    const contratoSeleccionado = uploadContratoId || contratoId;
    if (!contratoSeleccionado) {
      alertInfo("Falta contrato", "Selecciona el contrato al que quieres asociar el documento.");
      return;
    }
    if (!uploadFile) {
      alertInfo("Falta archivo", "Adjunta un PDF, DOCX o texto para analizar.");
      return;
    }

    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append("archivo", uploadFile);
      formData.append("kind", "SUBIDO");
      formData.append("source", "UPLOAD");
      formData.append("idioma", formState.idioma);
      formData.append("tono", formState.tono);

      const documento = await uploadContractDocument(Number(contratoSeleccionado), formData);
      const corrected = await correctContractDocument(
        Number(contratoSeleccionado),
        documento.id,
        formState.idioma
      );
      setResult(corrected);
      setRedlineBase(corrected.documento_markdown);
      alertSuccess("Contrato corregido", "Revisa el borrador actualizado y expórtalo si es necesario.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Intenta nuevamente";
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
    if (!result) {
      alertInfo("Genera un contrato primero");
      return;
    }
    const blob = new Blob([result.documento_markdown], {
      type: "text/markdown;charset=utf-8",
    });
    triggerDownload(blob, `contrato-materialidad-${Date.now()}.md`);
  };

  const handleDocxDownload = async () => {
    if (!result) {
      alertInfo("Genera un contrato para exportarlo");
      return;
    }
    setIsExportingDocx(true);
    try {
      const exportResult = await exportContractDocx({
        documento_markdown: result.documento_markdown,
        idioma: result.idioma,
      });

      triggerDownload(exportResult.blob, exportResult.filename);
      if (exportResult.citas_legales?.length) {
        setResult((prev) =>
          prev
            ? {
                ...prev,
                citas_legales: exportResult.citas_legales,
                citas_legales_metadata:
                  exportResult.citas_legales_metadata ?? prev.citas_legales_metadata,
              }
            : prev
        );
      }
      alertSuccess("Documento .docx listo");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Revisa tu conexión e intenta nuevamente.";
      alertError("No pudimos exportar el contrato", message);
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleClauseInsert = (clause: ClauseSuggestion) => {
    setFormState((prev) => {
      const existing = prev.clausulas.trim();
      const clauseText = clause.texto.trim();
      const updated = existing ? `${existing}\n${clauseText}` : clauseText;
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
    setRedlineBase(result.documento_markdown);
    alertSuccess("Listo", "Usaremos el borrador actual como base para el análisis");
  };

  const handleAnalyzeRedlines = async () => {
    if (!redlineBase.trim() || !redlineCandidate.trim()) {
      alertInfo("Carga ambas versiones", "Necesitamos el texto base y el revisado");
      return;
    }
    setIsAnalyzingRedlines(true);
    try {
      const analysis = await analyzeRedlines({
        texto_original: redlineBase,
        texto_revisado: redlineCandidate,
        idioma: formState.idioma,
      });
      setRedlineResult(analysis);
      alertSuccess("Redlines procesados", analysis.alerta_global);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Intenta nuevamente";
      alertError("No pudimos analizar los redlines", message);
    } finally {
      setIsAnalyzingRedlines(false);
    }
  };

  const handleResetRedlines = () => {
    setRedlineBase("");
    setRedlineCandidate("");
    setRedlineResult(null);
  };

  return (
    <DashboardShell>
      <div className="space-y-10 text-slate-900">
        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-sky-50 to-emerald-50 p-10 shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_60%)]" />
          <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-5">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-emerald-700">Suite contractual · Beta privada</p>
              <h1 className="text-4xl font-semibold text-slate-900">Crea borradores blindados en minutos</h1>
              <p className="text-base text-slate-700">
                Indica los datos clave y deja que GPT-5 mini prepare un borrador personalizable con cláusulas auditadas por el equipo fiscal.
              </p>
              <div className="flex flex-wrap gap-4 text-sm text-slate-700">
                <span className="flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-4 py-2 shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  95% ajustes aprobados sin retrabajos
                </span>
                <span className="flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-4 py-2 shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-sky-500" />
                  Biblioteca viva de cláusulas SAT-ready
                </span>
              </div>
            </div>
            <div className="grid gap-4 text-sm text-slate-700">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Tiempo estimado</p>
                <p className="text-2xl font-semibold text-slate-900">2 min</p>
                <p className="text-xs text-slate-500">para obtener un borrador usable</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Cobertura</p>
                <p className="text-2xl font-semibold text-slate-900">+200 plantillas</p>
                <p className="text-xs text-slate-500">curadas para operaciones MX</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <section className="space-y-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Configura el contexto</p>
                <h2 className="text-2xl font-semibold text-slate-900">Datos para el borrador</h2>
              </div>
              {isLoadingOptions && <p className="text-sm text-slate-500">Cargando catálogos…</p>}
            </div>

            {!isLoadingOptions && !empresas.length && (
              <div className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
                <p className="font-semibold text-amber-800">Sin empresas disponibles</p>
                <p>
                  Inicia sesión con un usuario del cliente (no corporativo) y usa el slug correcto en el login para ver las empresas y generar contratos.
                </p>
                <p>Si ya iniciaste sesión, refresca o vuelve a entrar indicando el slug del cliente.</p>
                {optionsErrorHint && <p className="text-amber-800/80">Detalle: {optionsErrorHint}</p>}
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Empresa</label>
                <select
                  name="empresa"
                  value={formState.empresa}
                  onChange={handleChange}
                  required
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">Selecciona la razón social</option>
                  {empresas.map((empresa) => (
                    <option key={empresa.id} value={empresa.id}>
                      {empresa.razon_social} ({empresa.rfc})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Contrato asociado (opcional)</label>
                <select
                  value={contratoId}
                  onChange={(event) => setContratoId(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">Guardar como nuevo contrato automático</option>
                  {isLoadingContratos && <option value="">Cargando contratos...</option>}
                  {!isLoadingContratos && contratos.length === 0 && (
                    <option value="">Sin contratos registrados</option>
                  )}
                  {contratos.map((contrato) => (
                    <option key={contrato.id} value={String(contrato.id)}>
                      #{contrato.id} · {contrato.nombre}
                      {contrato.proveedor_nombre ? ` · ${contrato.proveedor_nombre}` : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Si eliges un contrato, el borrador quedará guardado en su expediente.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Plantilla base (opcional)</label>
                  <select
                    name="template"
                    value={formState.template}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="">Sin plantilla</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.nombre} · {template.categoria}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
                  <p>Idioma y tono orientan el prompt con la voz de tu despacho.</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    <select
                      name="idioma"
                      value={formState.idioma}
                      onChange={handleChange}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    >
                      <option value="es">Español</option>
                      <option value="en">Inglés</option>
                    </select>
                    <select
                      name="tono"
                      value={formState.tono}
                      onChange={handleChange}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    >
                      <option value="formal">Formal</option>
                      <option value="neutral">Neutral</option>
                    </select>
                  </div>
                </div>
              </div>

              {selectedTemplate && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800 shadow-sm">
                  <p className="font-semibold text-slate-900">{selectedTemplate.nombre}</p>
                  <p className="mt-1 text-slate-700">Clave: {selectedTemplate.clave}</p>
                  <p className="mt-1 text-slate-700">Proceso: {selectedTemplate.proceso}</p>
                  <p className="mt-1 text-slate-600">{selectedTemplate.descripcion || "Sin descripción"}</p>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Resumen de necesidades</label>
                <textarea
                  name="resumen_necesidades"
                  value={formState.resumen_necesidades}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Describe objetivo, servicios, montos o condiciones relevantes"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Cláusulas o requisitos especiales</label>
                <textarea
                  name="clausulas"
                  value={formState.clausulas}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Una cláusula por línea (confidencialidad, penalizaciones, renovaciones, etc.)"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div className="flex flex-col gap-3 md:flex-row">
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="flex-1 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-60"
                >
                  {isGenerating ? "Generando..." : "Generar contrato"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormState(initialForm);
                    setResult(null);
                  }}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:border-slate-300"
                >
                  Limpiar formulario
                </button>
              </div>
            </form>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Contratos externos</p>
                <h3 className="text-lg font-semibold text-slate-900">Cargar contrato vigente y corregirlo</h3>
                <p className="text-sm text-slate-600">
                  Sube un contrato externo (PDF/DOCX/TXT) para revisarlo y generar una versión que cumpla con materialidad.
                </p>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Contrato destino</label>
                  <select
                    value={uploadContratoId}
                    onChange={(event) => setUploadContratoId(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="">Selecciona un contrato</option>
                    {isLoadingContratos && <option value="">Cargando contratos...</option>}
                    {!isLoadingContratos && contratos.length === 0 && (
                      <option value="">Sin contratos registrados</option>
                    )}
                    {contratos.map((contrato) => (
                      <option key={contrato.id} value={String(contrato.id)}>
                        #{contrato.id} · {contrato.nombre}
                        {contrato.proveedor_nombre ? ` · ${contrato.proveedor_nombre}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Archivo</label>
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.md"
                    onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3 md:flex-row">
                <button
                  type="button"
                  onClick={handleImportExternal}
                  disabled={isImporting}
                  className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {isImporting ? "Procesando..." : "Analizar y corregir contrato"}
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-inner shadow-slate-200/60">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.35em] text-sky-700">Biblioteca viva</p>
                  <h3 className="text-xl font-semibold text-slate-900">Cláusulas sugeridas</h3>
                  <p className="text-sm text-slate-700">
                    Afinamos las instrucciones para la IA con fragmentos probados por el equipo legal.
                  </p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={clauseQuery}
                    onChange={(event) => setClauseQuery(event.target.value)}
                    placeholder="Buscar por palabra clave"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  />
                  <button
                    type="button"
                    onClick={() => void refreshClauseSuggestions(clauseQuery)}
                    disabled={isLoadingClauses || !formState.empresa}
                    className="rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:opacity-60"
                  >
                    {isLoadingClauses ? "Actualizando..." : "Refrescar"}
                  </button>
                </div>
              </div>

              {!formState.empresa ? (
                <p className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-700">
                  Selecciona primero una empresa para personalizar las cláusulas sugeridas.
                </p>
              ) : clauseSuggestions.length ? (
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {clauseSuggestions.map((clause) => (
                    <ClauseSuggestionCard
                      key={clause.slug}
                      clause={clause}
                      onInsert={handleClauseInsert}
                      onCopy={handleClauseCopy}
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-700">
                  {isLoadingClauses
                    ? "Buscando coincidencias con tu brief..."
                    : "No encontramos coincidencias directas. Ajusta el resumen o usa otras palabras clave."}
                </p>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-inner shadow-slate-200/60">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.35em] text-slate-500">Panel de redlines</p>
                  <h3 className="text-xl font-semibold text-slate-900">Compara versiones y resalta riesgos</h3>
                </div>
                <button
                  type="button"
                  onClick={handleUseCurrentDraft}
                  disabled={!result}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-emerald-300 disabled:opacity-40"
                >
                  Usar borrador actual
                </button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Texto original (base)</label>
                  <textarea
                    value={redlineBase}
                    onChange={(event) => setRedlineBase(event.target.value)}
                    rows={8}
                    placeholder="Pega aquí el contrato original o la versión generada"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Versión con comentarios / contraparte</label>
                  <textarea
                    value={redlineCandidate}
                    onChange={(event) => setRedlineCandidate(event.target.value)}
                    rows={8}
                    placeholder="Pega aquí la versión con cambios o notas de la contraparte"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleAnalyzeRedlines}
                  disabled={isAnalyzingRedlines}
                  className="rounded-2xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {isAnalyzingRedlines ? "Analizando..." : "Analizar redlines"}
                </button>
                <button
                  type="button"
                  onClick={handleResetRedlines}
                  className="rounded-2xl border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
                >
                  Limpiar panel
                </button>
              </div>

              <div className="mt-4">
                {redlineResult ? (
                  <RedlineInsights analysis={redlineResult} />
                ) : (
                  <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
                    Aún no procesamos redlines. Carga ambas versiones y presiona &quot;Analizar&quot; para diffs, riesgos y oportunidades resumidas.
                  </p>
                )}
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Estado del generador</p>
                  <h3 className="text-2xl font-semibold text-slate-900">
                    {isGenerating ? "Generando borrador" : result ? "Borrador listo" : "Aún sin generación"}
                  </h3>
                  <p className="text-sm text-slate-600">Seguimiento en tiempo real de cada iteración.</p>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700">
                  {(formState.idioma || "es").toUpperCase()} · {formState.tono}
                </span>
              </div>
              {shouldShowTips ? (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  <p className="text-xs uppercase tracking-[0.35em] text-emerald-600">Optimizando materialidad</p>
                  <p className="mt-2 text-base">{MATERIALITY_TIPS[activeTipIndex]}</p>
                </div>
              ) : (
                <ul className="mt-5 space-y-2 text-sm text-slate-700">
                  <li className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Guardamos bitácora de prompts y resultados para auditoría interna.
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-sky-500" />
                    Puedes rehacer el borrador cambiando plantilla o tono sin perder historial.
                  </li>
                </ul>
              )}
            </div>

            <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-md">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!result}
                  className="flex-1 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:border-emerald-300 disabled:opacity-40"
                >
                  Copiar borrador
                </button>
                <button
                  type="button"
                  onClick={handleMarkdownDownload}
                  disabled={!result}
                  className="flex-1 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:border-emerald-300 disabled:opacity-40"
                >
                  Descargar .md
                </button>
                <button
                  type="button"
                  onClick={handleDocxDownload}
                  disabled={!result || isExportingDocx}
                  className="flex-1 rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                >
                  {isExportingDocx ? "Exportando..." : "Exportar .docx"}
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                {result ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.35em] text-slate-500">
                      <span>Vista previa · {(result.idioma || formState.idioma || "es").toUpperCase()}</span>
                      <span>{selectedTemplate ? selectedTemplate.nombre : "Sin plantilla"}</span>
                    </div>
                    <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-2xl bg-white p-4 text-xs text-slate-800">
                      {result.documento_markdown}
                    </pre>
                  </>
                ) : (
                  <p className="text-sm text-slate-600">
                    Genera un contrato para visualizar el borrador y habilitar las acciones de exportación.
                  </p>
                )}
              </div>
            </div>

            {hasCitations && result?.citas_legales ? (
              <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Referencias legales</p>
                    <h3 className="text-xl font-semibold text-slate-900">Citas generadas para sustentar el borrador</h3>
                  </div>
                  {result.citas_legales_metadata && (
                    <CitationMetadataBadge metadata={result.citas_legales_metadata} />
                  )}
                </div>
                <LegalCitationsPanel citations={result.citas_legales} />
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </DashboardShell>
  );
}

type ClauseSuggestionCardProps = {
  clause: ClauseSuggestion;
  onInsert: (clause: ClauseSuggestion) => void;
  onCopy: (clause: ClauseSuggestion) => void;
};

function ClauseSuggestionCard({ clause, onInsert, onCopy }: ClauseSuggestionCardProps) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">{clause.nivel_riesgo}</p>
          <h4 className="text-lg font-semibold text-slate-900">{clause.titulo}</h4>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700">
          {Math.round(clause.relevancia * 100)}%
        </span>
      </div>
      <p className="text-sm text-slate-700 line-clamp-4">{clause.texto}</p>
      {clause.tips_redline.length > 0 && (
        <ul className="space-y-1 text-xs text-slate-600">
          {clause.tips_redline.slice(0, 3).map((tip) => (
            <li key={tip} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              {tip}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        {clause.palabras_clave.slice(0, 4).map((keyword) => (
          <span key={keyword} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700">
            {keyword}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-2 pt-2 sm:flex-row">
        <button
          type="button"
          onClick={() => onInsert(clause)}
          className="flex-1 rounded-2xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400"
        >
          Insertar en brief
        </button>
        <button
          type="button"
          onClick={() => onCopy(clause)}
          className="flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:border-emerald-300"
        >
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
      {citations.map((citation) => (
        <article
          key={`${citation.ley}-${citation.articulo}-${citation.referencia}`}
          className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.3em] text-slate-500">
            <span>{citation.tipo_fuente}</span>
            <span>{citation.vigencia ?? "Sin vigencia"}</span>
          </div>
          <h4 className="mt-2 text-base font-semibold text-slate-900">
            {citation.ley} · Art. {citation.articulo}
            {citation.fraccion ? ` · Frac. ${citation.fraccion}` : ""}
          </h4>
          <p className="mt-1 text-slate-700">{citation.referencia}</p>
          {citation.resumen && <p className="mt-2 text-slate-600">{citation.resumen}</p>}
          {citation.criterios_sat?.length ? (
            <div className="mt-3 space-y-1 text-xs text-amber-700">
              {citation.criterios_sat.slice(0, 2).map((criterion) => (
                <p key={criterion.referencia}>{criterion.referencia} · {criterion.riesgo}</p>
              ))}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function CitationMetadataBadge({ metadata }: { metadata: CitationCacheMetadata }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-800">
      <span className="font-semibold uppercase tracking-[0.4em]">
        {metadata.cache_hit ? "CACHE HIT" : "CACHE REFRESH"}
      </span>
      {metadata.cache_updated_at && <span>Actualizado: {metadata.cache_updated_at}</span>}
      {metadata.regenerations !== undefined && <span>Regeneraciones: {metadata.regenerations}</span>}
    </div>
  );
}

function RedlineInsights({ analysis }: { analysis: RedlineAnalysis }) {
  const changePercent = Math.round(analysis.change_ratio * 100);
  return (
    <div className="space-y-4" aria-live="polite">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Alerta global</p>
            <p className="text-lg font-semibold text-slate-900">{analysis.alerta_global}</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
            {changePercent}% de cambio
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-700">{analysis.resumen}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.35em] text-amber-700">Riesgos clave</p>
          <ul className="mt-2 space-y-2 text-sm text-slate-800">
            {analysis.riesgos.map((risk) => (
              <li key={risk.titulo} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-semibold text-amber-900">{risk.titulo}</p>
                <p className="text-xs text-slate-700">Impacto: {risk.impacto}</p>
                {risk.detalle && <p className="text-xs text-slate-700">{risk.detalle}</p>}
                {risk.accion && <p className="text-xs text-amber-900">Acción sugerida: {risk.accion}</p>}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-700">Oportunidades</p>
          <ul className="mt-2 space-y-2 text-sm text-slate-800">
            {analysis.oportunidades.map((opportunity) => (
              <li key={opportunity.titulo} className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-sm font-semibold text-emerald-900">{opportunity.titulo}</p>
                <p className="text-xs text-emerald-800">{opportunity.descripcion}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Diff inteligente</p>
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
    insert: { label: "Insertado", color: "text-emerald-600" },
    delete: { label: "Eliminado", color: "text-rose-600" },
    replace: { label: "Modificado", color: "text-amber-600" },
  };

  const preview = (lines: string[]) => {
    const text = lines.join("\n").trim();
    if (!text) return "—";
    return text.length > 420 ? `${text.slice(0, 420)}…` : text;
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em]">
        <span className={labelMap[segment.type].color}>{labelMap[segment.type].label}</span>
        <span className="text-slate-500">#{index + 1}</span>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <DiffColumn title="Original" color="text-slate-700" lines={segment.original} />
        <DiffColumn title="Revisado" color="text-slate-900" lines={segment.revisado} />
      </div>
      <p className="sr-only">{preview(segment.original)} → {preview(segment.revisado)}</p>
    </article>
  );
}

function DiffColumn({
  title,
  color,
  lines,
}: {
  title: string;
  color: string;
  lines: string[];
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{title}</p>
      {lines.length ? (
        <pre className={`mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs ${color}`}>
          {lines.map((line, index) => (
            <Fragment key={`${title}-${index}`}>
              {line}
              {index < lines.length - 1 ? "\n" : ""}
            </Fragment>
          ))}
        </pre>
      ) : (
        <p className="mt-2 text-xs text-slate-500">Sin contenido</p>
      )}
    </div>
  );
}
