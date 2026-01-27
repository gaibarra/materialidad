"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

import { DashboardShell } from "../../../components/DashboardShell";
import { useAuthContext } from "../../../context/AuthContext";
import { alertError, alertSuccess } from "../../../lib/alerts";
import { SOURCE_TYPE_OPTIONS, fetchAvailableLaws } from "../../../lib/legal";
import {
  createLegalConsultation,
  fetchLegalConsultations,
  type LegalConsultation,
} from "../../../lib/consultations";

const MAX_REFERENCIAS_OPTIONS = [2, 3, 4, 5, 6];

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
      await alertSuccess("Consulta registrada", "El despacho virtual generó una respuesta");
    } catch (error) {
      void alertError("No pudimos generar la respuesta", (error as Error).message);
    } finally {
      setIsSending(false);
    }
  };

  const handleKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && event.metaKey) {
      void handleSend();
    }
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
      <div className="space-y-8">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/40 to-emerald-900/20 p-6 shadow-2xl shadow-emerald-500/20">
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-300">Consulta legal</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Despacho conversacional</h1>
          <p className="mt-2 text-sm text-slate-300">
            Formula preguntas fiscales, añade contexto operativo y recibe borradores citando siempre las fuentes de la biblioteca.
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-300">
            <span className="rounded-full border border-white/20 px-3 py-1">
              {isLoading ? "Cargando historial…" : `${consultations.length} consultas archivadas`}
            </span>
            <span className="rounded-full border border-emerald-400/40 px-3 py-1">
              {isLawsLoading ? "Leyendo catálogo…" : `${formattedLaws.length || 0} leyes indexadas`}
            </span>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[2fr,1fr]">
          <section className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white shadow-2xl shadow-black/30">
            <div className="space-y-3">
              <label className="text-slate-300">Describe la duda principal</label>
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={handleKey}
                placeholder="Ej. ¿Qué requisitos pide la LISR para deducir inversiones en maquinaria?"
                rows={3}
                className="w-full rounded-2xl border border-white/20 bg-slate-950/40 px-4 py-3 text-white focus:border-emerald-300 focus:outline-none"
              />
            </div>

            <div className="space-y-3">
              <label className="text-slate-300">Contexto operativo (opcional)</label>
              <textarea
                value={contexto}
                onChange={(event) => setContexto(event.target.value)}
                onKeyDown={handleKey}
                placeholder="Incluye cifras, periodos o particularidades del cliente"
                rows={2}
                className="w-full rounded-2xl border border-white/20 bg-slate-950/30 px-4 py-3 text-white focus:border-emerald-300 focus:outline-none"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-slate-300">Ley objetivo</label>
                <select
                  value={ley}
                  onChange={(event) => setLey(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/20 bg-slate-950/30 px-4 py-2 text-white focus:border-emerald-300 focus:outline-none"
                >
                  <option value="">Cualquiera</option>
                  {formattedLaws.map((item) => (
                    <option key={item} value={item} className="bg-slate-900">
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-300">Tipo de fuente</label>
                <select
                  value={tipoFuente}
                  onChange={(event) => setTipoFuente(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/20 bg-slate-950/30 px-4 py-2 text-white focus:border-emerald-300 focus:outline-none"
                >
                  <option value="">Todas</option>
                  {SOURCE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} className="bg-slate-900">
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-300">Máx. referencias</label>
                <select
                  value={maxRefs}
                  onChange={(event) => setMaxRefs(Number(event.target.value))}
                  className="mt-2 w-full rounded-2xl border border-white/20 bg-slate-950/30 px-4 py-2 text-white focus:border-emerald-300 focus:outline-none"
                >
                  {MAX_REFERENCIAS_OPTIONS.map((value) => (
                    <option key={value} value={value} className="bg-slate-900">
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={isSending}
              className="w-full rounded-2xl border border-emerald-400/60 bg-emerald-500/20 px-4 py-3 text-center text-base font-semibold text-emerald-200 transition hover:border-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSending ? "Generando diagnóstico…" : "Consultar despacho"}
            </button>

            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/30 to-transparent" />

            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <p>Historial reciente</p>
                <button
                  type="button"
                  onClick={() => void loadConsultations()}
                  className="rounded-full border border-white/10 px-3 py-1 text-white transition hover:border-emerald-300"
                >
                  Refrescar
                </button>
              </div>

              {isLoading ? (
                <p className="text-sm text-slate-400">Consultando al despacho virtual…</p>
              ) : consultations.length === 0 ? (
                <p className="text-sm text-slate-400">No hay consultas registradas aún.</p>
              ) : (
                <div className="space-y-4">
                  {consultations.map((consultation) => {
                    const isActive = consultation.id === selectedConsultation?.id;
                    return (
                      <article
                        key={consultation.id}
                        onClick={() => setSelectedId(consultation.id)}
                        className={`cursor-pointer rounded-3xl border px-4 py-4 transition ${
                          isActive
                            ? "border-emerald-400/60 bg-emerald-400/10 shadow-lg shadow-emerald-500/30"
                            : "border-white/10 bg-slate-950/30 hover:border-emerald-300/60"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                          <span>{formatDate(consultation.created_at)}</span>
                          <div className="flex flex-wrap gap-2">
                            {consultation.modelo && (
                              <span className="rounded-full border border-white/20 px-2 py-0.5">
                                {consultation.modelo}
                              </span>
                            )}
                            <span className="rounded-full border border-emerald-300/40 px-2 py-0.5 text-emerald-200">
                              {consultation.referencias.length} citas
                            </span>
                          </div>
                        </div>
                        <p className="mt-3 text-base font-semibold text-white">{consultation.pregunta}</p>
                        {consultation.contexto && (
                          <p className="mt-1 text-sm text-slate-400">Contexto: {consultation.contexto}</p>
                        )}
                        <p className="mt-3 text-sm text-slate-100 line-clamp-3">{consultation.respuesta}</p>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <aside className="rounded-3xl border border-white/10 bg-slate-950/40 p-6 text-sm text-white shadow-inner shadow-black/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Fuentes citadas</p>
                <h2 className="mt-2 text-xl font-semibold text-white">{references.length} fragmentos</h2>
              </div>
              {selectedConsultation && (
                <span className="rounded-full border border-white/20 px-3 py-1 text-xs text-slate-300">
                  #{selectedConsultation.id}
                </span>
              )}
            </div>

            {references.length === 0 ? (
              <p className="mt-6 text-sm text-slate-400">
                Selecciona una consulta para explorar los argumentos legales recuperados.
              </p>
            ) : (
              <div className="mt-6 space-y-4">
                {references.map((reference, index) => (
                  <article
                    key={`${reference.id ?? "ref"}-${index}`}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between text-xs text-slate-300">
                      <p className="uppercase tracking-[0.3em] text-emerald-300">Ref {index + 1}</p>
                      {reference.tipo_fuente && (
                        <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px]">
                          {reference.tipo_fuente}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-white">{reference.ley}</h3>
                    <p className="text-sm text-slate-300">
                      {[reference.articulo && `Art. ${reference.articulo}`, reference.fraccion && `Fr. ${reference.fraccion}`, reference.parrafo && `Pár. ${reference.parrafo}`]
                        .filter(Boolean)
                        .join(" · ") || "Artículo general"}
                    </p>
                    {reference.resumen && (
                      <p className="mt-2 text-xs text-slate-400">{reference.resumen}</p>
                    )}
                    <p className="mt-3 text-sm text-slate-100 whitespace-pre-line">{reference.extracto}</p>
                    <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-slate-300">
                      {reference.vigencia && (
                        <span className="rounded-full border border-white/15 px-2 py-0.5">
                          Vigencia: {reference.vigencia}
                        </span>
                      )}
                      {reference.sat_categoria && (
                        <span className="rounded-full border border-amber-400/40 px-2 py-0.5 text-amber-100">
                          {reference.sat_categoria}
                        </span>
                      )}
                      {reference.fuente_url && (
                        <a
                          href={reference.fuente_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-emerald-300/40 px-2 py-0.5 text-emerald-200 transition hover:border-emerald-200"
                        >
                          Ver DOF
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </DashboardShell>
  );
}
