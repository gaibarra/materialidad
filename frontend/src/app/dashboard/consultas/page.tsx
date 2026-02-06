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
  const { isAuthenticated } = useAuthContext();

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
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

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

  return (
    <DashboardShell>
      <div className="space-y-6 text-white">
        {/* Header */}
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/40 to-emerald-900/30 p-6 shadow-2xl shadow-emerald-500/20">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Despacho Conversacional</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Consulta Legal Inteligente</h1>
          <p className="mt-2 text-sm text-slate-200">Análisis legal y fiscal con inteligencia de precisión basado en tu compendio normativo.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Panel Lateral - Formulario */}
          <div className="lg:col-span-4 flex flex-col gap-8">
            <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/40 to-emerald-900/30 p-6 shadow-2xl shadow-emerald-500/20 text-white">
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Nueva Consulta</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Configurar Parametría</h3>
              <p className="mt-1 text-sm text-slate-200">Define tu hipótesis legal y contexto operativo.</p>

              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-xs text-slate-300">Planteamiento Técnico</p>
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Ej. ¿Cómo acreditar materialidad en servicios de consultoría 2026?"
                    className="mt-1 w-full min-h-[120px] rounded-2xl border border-white/20 bg-slate-900/60 px-4 py-3 text-white placeholder:text-slate-500"
                  />
                </div>

                <div>
                  <p className="text-xs text-slate-300">Contexto de la Operación</p>
                  <input
                    value={contexto}
                    onChange={(e) => setContexto(e.target.value)}
                    placeholder="Giro, situación o monto..."
                    className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-900/60 px-4 py-3 text-white placeholder:text-slate-500"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs text-slate-300">Base de Datos</p>
                    <select
                      value={ley}
                      onChange={(e) => setLey(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-900/60 px-4 py-3 text-white"
                    >
                      <option value="">Todas las Leyes</option>
                      {formattedLaws.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-xs text-slate-300">Profundidad</p>
                    <select
                      value={maxRefs}
                      onChange={(e) => setMaxRefs(Number(e.target.value))}
                      className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-900/60 px-4 py-3 text-white"
                    >
                      {MAX_REFERENCIAS_OPTIONS.map(v => <option key={v} value={v}>{v} Referencias</option>)}
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => void handleSend()}
                  disabled={isSending || !question.trim()}
                  className="mt-4 w-full rounded-2xl border border-emerald-400/60 bg-emerald-500/15 px-4 py-4 text-base font-semibold text-emerald-200 hover:border-emerald-200 hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60 transition-all"
                >
                  {isSending ? (
                    <span className="flex items-center justify-center gap-2"><RefreshCw className="animate-spin" size={20} /> Analizando...</span>
                  ) : (
                    <span className="flex items-center justify-center gap-2"><Send size={18} /> ANALIZAR PROTOCOLO</span>
                  )}
                </button>
              </div>
            </section>

            {/* Historial */}
            <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-6 flex flex-col flex-1 min-h-[400px]">
              <div className="flex items-center gap-2 mb-6">
                <History size={18} className="text-slate-400" />
                <h3 className="text-xs uppercase tracking-[0.35em] text-slate-300">Consultas Recientes</h3>
              </div>
              <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
                {consultations.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all group ${selectedId === item.id
                      ? "border-emerald-400/60 bg-emerald-500/10"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                      }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold text-slate-400">{formatDate(item.created_at)}</span>
                      {selectedId === item.id && <div className="h-2 w-2 rounded-full bg-emerald-400" />}
                    </div>
                    <div className="flex justify-between items-start mb-2">
                      <p className={`text-sm font-bold line-clamp-2 pr-4 ${selectedId === item.id ? "text-emerald-200" : "text-slate-200"}`}>
                        {item.pregunta}
                      </p>
                      <button
                        onClick={(e) => handleDelete(item.id, e)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                        title="Eliminar consulta"
                      >
                        <Trash2 size={14} />
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
                <main id="response-doc" className="rounded-3xl border border-white/10 bg-white/5 flex flex-col overflow-hidden">
                  {/* Header de la Respuesta */}
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-6 m-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Diagnóstico Autorizado</p>
                        <h2 className="mt-2 text-2xl font-semibold text-white">
                          {selectedConsultation.pregunta}
                        </h2>
                      </div>
                      <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 transition-all font-medium text-xs no-print"
                      >
                        <Printer size={16} />
                        Imprimir
                      </button>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
                        <Clock size={14} className="text-slate-400" />
                        <span className="text-xs font-medium text-slate-300">{formatDate(selectedConsultation.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
                        <Layers size={14} className="text-slate-400" />
                        <span className="text-xs font-medium text-slate-300">ID: {selectedConsultation.id}</span>
                      </div>
                      <div className="flex items-center gap-2 bg-emerald-500/15 border border-emerald-400/30 px-3 py-1.5 rounded-xl">
                        <div className="h-2 w-2 rounded-full bg-emerald-400" />
                        <span className="text-xs font-semibold text-emerald-200">Respuesta Verificada</span>
                      </div>
                    </div>
                  </div>

                  {/* Cuerpo de la Respuesta */}
                  <div className="flex-1 p-6 bg-white rounded-2xl m-4">
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
                      <article className="prose prose-lg prose-slate max-w-none 
                        prose-headings:text-slate-900 prose-headings:font-semibold
                        prose-p:text-slate-700 prose-p:leading-relaxed
                        prose-strong:text-emerald-600 prose-strong:font-semibold
                        prose-li:text-slate-700
                        prose-code:bg-slate-100 prose-code:text-emerald-600 prose-code:px-2 prose-code:rounded-lg prose-code:font-mono
                        prose-blockquote:border-emerald-500 prose-blockquote:bg-emerald-50 prose-blockquote:rounded-xl prose-blockquote:p-4
                      ">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {selectedConsultation.respuesta}
                        </ReactMarkdown>
                      </article>
                    )}
                  </div>

                  {/* Footer Informativo */}
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 m-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Algoritmo Utilizado</span>
                        <span className="text-sm font-medium text-slate-200">{selectedConsultation.modelo || 'Engine 1.0 (Compendio)'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-emerald-500/15 border border-emerald-400/30 px-4 py-2 rounded-xl">
                      <div className="h-2 w-2 rounded-full bg-emerald-400" />
                      <span className="text-xs font-semibold text-emerald-200">Sustentado en Ley Vigente</span>
                    </div>
                  </div>
                </main>

                {/* Sección de Fuentes */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 px-2">
                    <div className="h-8 w-8 bg-sky-500/20 text-sky-400 rounded-xl flex items-center justify-center">
                      <BookOpen size={18} strokeWidth={2.5} />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Fuentes de la Biblioteca</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {references.length === 0 ? (
                      <div className="col-span-full border border-dashed border-white/20 rounded-2xl p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                        <Info size={32} className="opacity-40" />
                        <span className="font-medium">Sin referencias adicionales indexadas</span>
                      </div>
                    ) : (
                      references.map((ref, idx) => (
                        <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 transition-all">
                          <div className="flex justify-between items-start mb-4">
                            <span className="bg-sky-500/20 text-sky-300 px-3 py-1 rounded-lg text-xs font-semibold">Referencia {idx + 1}</span>
                            {ref.fuente_url && (
                              <a href={ref.fuente_url} target="_blank" className="p-2 rounded-lg text-slate-500 hover:text-sky-400 hover:bg-sky-500/10 transition-colors">
                                <ExternalLink size={16} />
                              </a>
                            )}
                          </div>
                          <h4 className="text-lg font-semibold text-white mb-2">{ref.ley}</h4>
                          <div className="flex gap-2 mb-4">
                            {ref.articulo && <span className="bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-lg text-xs font-medium">Art. {ref.articulo}</span>}
                            {ref.fraccion && <span className="bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-lg text-xs font-medium">Fracción {ref.fraccion}</span>}
                          </div>
                          <div className="bg-slate-950/40 rounded-xl p-4 border border-white/10">
                            <p className="text-slate-300 text-sm leading-relaxed">
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
              <div className="rounded-3xl border border-dashed border-white/20 min-h-[500px] flex flex-col items-center justify-center p-12 text-center">
                <div className="h-20 w-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                  <MessageSquare size={36} className="text-slate-500" />
                </div>
                <h3 className="text-2xl font-semibold text-slate-300">Esperando parámetros</h3>
                <p className="text-slate-400 max-w-sm mt-3 text-base">Define tu planteamiento fiscal para desplegar el diagnóstico legal estructurado.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.2);
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
