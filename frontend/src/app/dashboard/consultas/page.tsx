"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  History,
  BookOpen,
  Scale,
  Sparkles,
  Clock,
  Layers,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  FileText,
  AlertCircle,
  ChevronRight,
  Info,
  Trash2,
  Printer
} from "lucide-react";

import { DashboardShell } from "../../../components/DashboardShell";
import { useAuthContext } from "../../../context/AuthContext";
import { alertError, alertSuccess, confirmAction } from "../../../lib/alerts";
import { SOURCE_TYPE_OPTIONS, fetchAvailableLaws } from "../../../lib/legal";
import {
  createLegalConsultation,
  fetchLegalConsultations,
  deleteLegalConsultation,
  type LegalConsultation,
} from "../../../lib/consultations";

const MAX_REFERENCIAS_OPTIONS = [3, 5, 10, 15, 20];

export default function LegalConsultationPage() {
  const router = useRouter();
  const { isAuthenticated, isProfileLoaded } = useAuthContext();

  const [consultations, setConsultations] = useState<LegalConsultation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [laws, setLaws] = useState<string[]>([]);
  const [isLawsLoading, setIsLawsLoading] = useState(false);

  const [question, setQuestion] = useState("");
  const [contexto, setContexto] = useState("");
  const [ley, setLey] = useState("");
  const [tipoFuente, setTipoFuente] = useState("");
  const [maxRefs, setMaxRefs] = useState(3);

  useEffect(() => {
    if (isProfileLoaded && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isProfileLoaded, router]);

  const loadConsultations = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const payload = await fetchLegalConsultations();
      setConsultations(payload.results);
      setSelectedId((current) => current ?? (payload.results[0]?.id ?? null));
    } catch (error) {
      void alertError("No pudimos recuperar las consultas", (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const loadLaws = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLawsLoading(true);
    try {
      const options = await fetchAvailableLaws();
      setLaws(options);
    } catch (error) {
      void alertError("No pudimos cargar el catálogo de leyes", (error as Error).message);
    } finally {
      setIsLawsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void loadConsultations();
  }, [loadConsultations]);

  useEffect(() => {
    void loadLaws();
  }, [loadLaws]);

  const selectedConsultation = useMemo(() => {
    if (!consultations.length) return null;
    if (selectedId) {
      return consultations.find((item) => item.id === selectedId) ?? consultations[0];
    }
    return consultations[0];
  }, [consultations, selectedId]);

  const references = selectedConsultation?.referencias ?? [];

  const handleSend = async () => {
    if (!question.trim()) {
      await alertError("Necesitamos una pregunta", "Describe la duda o hipótesis a validar");
      return;
    }
    setIsSending(true);
    try {
      const payload = await createLegalConsultation({
        pregunta: question.trim(),
        contexto: contexto.trim() || undefined,
        ley: ley.trim() || undefined,
        tipo_fuente: tipoFuente.trim() || undefined,
        max_referencias: maxRefs,
      });
      setConsultations((prev) => [payload, ...prev]);
      setSelectedId(payload.id);
      setQuestion("");
      setContexto("");
      await alertSuccess("Consulta Lista", "Análisis generado con éxito.");
    } catch (error) {
      void alertError("Error", (error as Error).message);
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await confirmAction({
      title: "¿Estás seguro?",
      text: "¿Deseas eliminar esta consulta del historial? Esta acción no se puede deshacer.",
      icon: "warning",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "No, mantener"
    });

    if (!confirmed.isConfirmed) return;

    try {
      await deleteLegalConsultation(id);
      setConsultations(prev => prev.filter(c => c.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
      }
      void alertSuccess("Eliminado", "La consulta ha sido removida del historial.");
    } catch (error) {
      void alertError("Error al eliminar", (error as Error).message);
    }
  };

  const handleKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && event.metaKey) {
      void handleSend();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formattedLaws = useMemo(() => {
    if (!laws.length) return [];
    return [...new Set(laws)].sort((a, b) => a.localeCompare(b));
  }, [laws]);

  const formatDate = (value: string) => {
    try {
      return new Intl.DateTimeFormat("es-MX", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value));
    } catch {
      return value;
    }
  };

  const handleClear = () => {
    setQuestion("");
    setContexto("");
    setLey("");
    setTipoFuente("");
    setMaxRefs(3);
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <header>
          <p className="text-xs uppercase tracking-[0.35em] text-sky-500">Despacho Conversacional</p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-900">Consulta Legal Inteligente</h1>
          <p className="mt-2 text-sm text-slate-500">Análisis legal y fiscal con inteligencia de precisión basado en tu compendio normativo.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Panel Lateral - Formulario */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.35em] text-sky-500">Nueva Consulta</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">Configurar Parametría</h3>
              <p className="mt-1 text-sm text-slate-500">Define tu hipótesis legal y contexto operativo.</p>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-600">Planteamiento Técnico</label>
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Ej. ¿Cómo acreditar materialidad en servicios de consultoría 2026?"
                    className="mt-1 w-full min-h-[120px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none transition"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600">Contexto de la Operación</label>
                  <input
                    value={contexto}
                    onChange={(e) => setContexto(e.target.value)}
                    placeholder="Giro, situación o monto..."
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none transition"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-slate-600">Base de Datos</label>
                    <select
                      value={ley}
                      onChange={(e) => setLey(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none transition"
                    >
                      <option value="">Todas las Leyes</option>
                      {formattedLaws.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Profundidad</label>
                    <select
                      value={maxRefs}
                      onChange={(e) => setMaxRefs(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none transition"
                    >
                      {MAX_REFERENCIAS_OPTIONS.map(v => <option key={v} value={v}>{v} Referencias</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => void handleSend()}
                    disabled={isSending || !question.trim()}
                    className="flex-1 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-400 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-200/50 hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                  >
                    {isSending ? (
                      <span className="flex items-center justify-center gap-2"><RefreshCw className="animate-spin" size={18} /> Analizando...</span>
                    ) : (
                      <span className="flex items-center justify-center gap-2"><Send size={16} /> Analizar</span>
                    )}
                  </button>
                  <button
                    onClick={handleClear}
                    disabled={isSending}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-all"
                    title="Limpiar formulario"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
              </div>
            </section>

            {/* Historial */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col flex-1 min-h-[350px]">
              <div className="flex items-center gap-2 mb-4">
                <History size={16} className="text-slate-400" />
                <h3 className="text-xs uppercase tracking-[0.35em] text-slate-400 font-semibold">Consultas Recientes</h3>
              </div>
              <div className="space-y-2 overflow-y-auto pr-1 custom-scrollbar flex-1">
                {consultations.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all group ${selectedId === item.id
                      ? "border-sky-300 bg-sky-50 shadow-sm"
                      : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50"
                      }`}
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <span className="text-[10px] font-semibold text-slate-400">{formatDate(item.created_at)}</span>
                      {selectedId === item.id && <div className="h-2 w-2 rounded-full bg-sky-500" />}
                    </div>
                    <div className="flex justify-between items-start">
                      <p className={`text-sm font-medium line-clamp-2 pr-3 ${selectedId === item.id ? "text-slate-900" : "text-slate-700"}`}>
                        {item.pregunta}
                      </p>
                      <button
                        onClick={(e) => handleDelete(item.id, e)}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0"
                        title="Eliminar consulta"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>

          {/* Área Principal - El Diagnóstico */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {selectedConsultation ? (
              <>
                <main id="response-doc" className="rounded-2xl border border-slate-200 bg-white flex flex-col overflow-hidden shadow-sm">
                  {/* Header de la Respuesta */}
                  <div className="border-b border-slate-200 bg-gradient-to-r from-sky-50 to-emerald-50 p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs uppercase tracking-[0.35em] text-sky-500 font-medium">Diagnóstico Autorizado</p>
                        <h2 className="mt-2 text-xl sm:text-2xl font-semibold text-slate-900">
                          {selectedConsultation.pregunta}
                        </h2>
                      </div>
                      <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 transition-all font-medium text-xs no-print shadow-sm"
                      >
                        <Printer size={16} />
                        Imprimir
                      </button>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
                        <Clock size={13} className="text-slate-400" />
                        <span className="text-xs font-medium text-slate-600">{formatDate(selectedConsultation.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
                        <Layers size={13} className="text-slate-400" />
                        <span className="text-xs font-medium text-slate-600">ID: {selectedConsultation.id}</span>
                      </div>
                      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="text-xs font-semibold text-emerald-700">Respuesta Verificada</span>
                      </div>
                    </div>
                  </div>

                  {/* Cuerpo de la Respuesta */}
                  <div className="flex-1 px-8 py-6">
                    {selectedConsultation.respuesta?.toLowerCase().includes("error") ? (
                      <div className="flex flex-col items-center justify-center py-12 bg-red-50 rounded-2xl border border-red-200 text-center gap-4">
                        <div className="h-16 w-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center">
                          <AlertCircle size={32} />
                        </div>
                        <div className="space-y-3">
                          <h3 className="text-xl font-semibold text-slate-800">Incidencia Técnica Detectada</h3>
                          <div className="bg-red-50 p-4 rounded-xl border border-red-200 text-left max-w-xl mx-auto">
                            <p className="text-red-600 font-mono text-xs break-words">
                              {selectedConsultation.respuesta}
                            </p>
                          </div>
                          <p className="text-slate-500 max-w-sm mx-auto text-sm">
                            El motor no pudo procesar la IA. Verifique las llaves API en el archivo .env o los límites de cuota de su proveedor.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <article className="prose prose-lg max-w-none
                        prose-headings:text-slate-900 prose-headings:font-bold prose-headings:tracking-tight
                        prose-h1:text-2xl prose-h1:mt-8 prose-h1:mb-4 prose-h1:border-b prose-h1:border-slate-200 prose-h1:pb-3
                        prose-h2:text-xl prose-h2:mt-6 prose-h2:mb-3
                        prose-h3:text-lg prose-h3:mt-5 prose-h3:mb-2
                        prose-p:text-slate-700 prose-p:leading-[1.8] prose-p:text-[15px]
                        prose-strong:text-slate-900 prose-strong:font-bold
                        prose-li:text-slate-700 prose-li:leading-[1.8] prose-li:text-[15px]
                        prose-ul:space-y-1
                        prose-ol:space-y-1
                        prose-code:bg-sky-50 prose-code:text-sky-700 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:font-mono prose-code:text-sm
                        prose-blockquote:border-l-4 prose-blockquote:border-sky-400 prose-blockquote:bg-sky-50/60 prose-blockquote:rounded-r-xl prose-blockquote:py-3 prose-blockquote:px-5 prose-blockquote:not-italic
                        prose-a:text-sky-600 prose-a:underline prose-a:decoration-sky-300 hover:prose-a:text-sky-700
                        prose-table:border-collapse prose-th:bg-slate-50 prose-th:text-slate-700 prose-td:border-slate-200
                      ">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {selectedConsultation.respuesta}
                        </ReactMarkdown>
                      </article>
                    )}
                  </div>

                  {/* Footer Informativo */}
                  <div className="border-t border-slate-100 bg-slate-50/50 px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Algoritmo Utilizado</span>
                        <span className="text-sm font-medium text-slate-600">{selectedConsultation.modelo || 'Engine 1.0 (Compendio)'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-semibold text-emerald-700">Sustentado en Ley Vigente</span>
                    </div>
                  </div>
                </main>

                {/* Sección de Fuentes */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 px-1">
                    <div className="h-8 w-8 bg-sky-100 text-sky-600 rounded-xl flex items-center justify-center">
                      <BookOpen size={16} strokeWidth={2.5} />
                    </div>
                    <h3 className="text-base font-semibold text-slate-900">Fuentes de la Biblioteca</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {references.length === 0 ? (
                      <div className="col-span-full border border-dashed border-slate-200 rounded-2xl p-12 text-center text-slate-400 bg-white flex flex-col items-center gap-3">
                        <Info size={32} className="opacity-40" />
                        <span className="font-medium">Sin referencias adicionales indexadas</span>
                      </div>
                    ) : (
                      references.map((ref, idx) => (
                        <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-md transition-all shadow-sm">
                          <div className="flex justify-between items-start mb-3">
                            <span className="bg-sky-100 text-sky-700 px-3 py-1 rounded-lg text-xs font-semibold">Referencia {idx + 1}</span>
                            {ref.fuente_url && (
                              <a href={ref.fuente_url} target="_blank" className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors">
                                <ExternalLink size={15} />
                              </a>
                            )}
                          </div>
                          <h4 className="text-base font-semibold text-slate-900 mb-2">{ref.ley}</h4>
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {ref.articulo && <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md text-xs font-medium">Art. {ref.articulo}</span>}
                            {ref.fraccion && <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md text-xs font-medium">Fracción {ref.fraccion}</span>}
                          </div>
                          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                            <p className="text-slate-600 text-sm leading-relaxed">
                              {ref.extracto || ref.resumen}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 min-h-[500px] flex flex-col items-center justify-center p-12 text-center bg-white">
                <div className="h-20 w-20 bg-sky-50 rounded-full flex items-center justify-center mb-6">
                  <MessageSquare size={36} className="text-sky-300" />
                </div>
                <h3 className="text-xl sm:text-2xl font-semibold text-slate-700">Esperando parámetros</h3>
                <p className="text-slate-400 max-w-sm mt-3 text-base">Define tu planteamiento fiscal para desplegar el diagnóstico legal estructurado.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }

        @media print {
          .no-print, nav, aside, button, footer {
            display: none !important;
          }
          body, html {
            background: white !important;
          }
          main#response-doc {
            border: none !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            position: absolute;
            top: 0;
            left: 0;
          }
          #response-doc article {
            font-size: 11pt !important;
            line-height: 1.5 !important;
          }
          .DashboardShell_main {
            padding: 0 !important;
          }
        }
      `}</style>
    </DashboardShell>
  );
}
