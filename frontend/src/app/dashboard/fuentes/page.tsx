"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { DashboardShell } from "../../../components/DashboardShell";
import { useAuthContext } from "../../../context/AuthContext";
import { alertError, alertSuccess } from "../../../lib/alerts";
import {
  SOURCE_TYPE_OPTIONS,
  type LegalReferencePayload,
  type LegalReferenceSource,
  type LegalSourceType,
  fetchAvailableLaws,
  fetchLegalSources,
  createLegalSource,
} from "../../../lib/legal";

const DEFAULT_FORM: LegalReferencePayload = {
  ley: "",
  tipo_fuente: "LEY",
  articulo: "",
  fraccion: "",
  parrafo: "",
  contenido: "",
  resumen: "",
  fuente_documento: "",
  fuente_url: "",
  vigencia: "",
  sat_categoria: "",
};

type FilterState = {
  search: string;
  ley: string;
  tipo: string;
  page: number;
};

const PAGE_SIZE = 12;

export default function LegalLibraryPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthContext();

  const [filters, setFilters] = useState<FilterState>({ search: "", ley: "todas", tipo: "todas", page: 1 });
  const [searchDraft, setSearchDraft] = useState("");
  const [sources, setSources] = useState<LegalReferenceSource[]>([]);
  const [stats, setStats] = useState({ count: 0, next: false, previous: false });
  const [laws, setLaws] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLawsLoading, setIsLawsLoading] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ ...DEFAULT_FORM });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchDraft, page: 1 }));
    }, 350);
    return () => clearTimeout(timer);
  }, [searchDraft]);

  const loadSources = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const response = await fetchLegalSources({
        search: filters.search || undefined,
        ley: filters.ley !== "todas" ? filters.ley : undefined,
        tipo_fuente: filters.tipo !== "todas" ? (filters.tipo as LegalSourceType) : undefined,
        page: filters.page,
        page_size: PAGE_SIZE,
        ordering: "ley,articulo",
      });
      setSources(response.results);
      setStats({
        count: response.count,
        next: Boolean(response.next),
        previous: Boolean(response.previous),
      });
    } catch (error) {
      void alertError("No pudimos cargar la biblioteca legal", (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [filters.ley, filters.page, filters.search, filters.tipo, isAuthenticated]);

  const loadLaws = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLawsLoading(true);
    try {
      const payload = await fetchAvailableLaws();
      setLaws(payload);
    } catch (error) {
      void alertError("No pudimos listar las leyes registradas", (error as Error).message);
    } finally {
      setIsLawsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  useEffect(() => {
    void loadLaws();
  }, [loadLaws]);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchDraft(event.target.value);
  };

  const handleFilterChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value, page: 1 }));
  };

  const handlePageChange = (direction: "next" | "prev") => {
    setFilters((prev) => ({
      ...prev,
      page: Math.max(1, prev.page + (direction === "next" ? 1 : -1)),
    }));
  };

  const toggleSource = (id: number) => {
    setSelectedSourceId((current) => (current === id ? null : id));
  };

  const handleCopy = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      await alertSuccess("Fragmento copiado", "Listo para reutilizar en tus contratos");
    } catch (error) {
      void alertError("No pudimos copiar el texto", (error as Error).message);
    }
  };

  const handleFormChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formData.ley.trim() || !formData.contenido.trim()) {
      await alertError("Campos obligatorios", "Incluye al menos el nombre de la ley y el contenido");
      return;
    }
    setIsSaving(true);
    try {
      await createLegalSource({
        ...formData,
        ley: formData.ley.trim(),
        articulo: formData.articulo?.trim() || undefined,
        fraccion: formData.fraccion?.trim() || undefined,
        parrafo: formData.parrafo?.trim() || undefined,
        resumen: formData.resumen?.trim() || undefined,
        contenido: formData.contenido.trim(),
        fuente_documento: formData.fuente_documento?.trim() || undefined,
        fuente_url: formData.fuente_url?.trim() || undefined,
        vigencia: formData.vigencia?.trim() || undefined,
        sat_categoria: formData.sat_categoria?.trim() || undefined,
      });
      await alertSuccess("Fragmento registrado", "La biblioteca se actualizó correctamente");
      setFormData({ ...DEFAULT_FORM });
      setFilters((prev) => ({ ...prev, page: 1 }));
      await Promise.all([loadSources(), loadLaws()]);
    } catch (error) {
      void alertError("No pudimos guardar la referencia", (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const lawOptions = useMemo(() => {
    if (!laws.length) return [];
    return [...new Set(laws)].sort((a, b) => a.localeCompare(b));
  }, [laws]);

  const summaryText = useMemo(() => {
    const total = stats.count;
    const leyLabel = filters.ley !== "todas" ? filters.ley : "todas las leyes";
    return `${total} fragmentos activos en ${leyLabel}`;
  }, [filters.ley, stats.count]);

  const canCreate = Boolean(user?.is_staff);

  return (
    <DashboardShell>
      <div className="space-y-8">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/60 to-emerald-900/20 p-6 shadow-2xl shadow-emerald-500/20">
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-300">Biblioteca legal</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Repositorio de respaldo normativo</h1>
          <p className="mt-2 text-sm text-slate-300">
            Consulta artículos de la LISR y agrega nuevas leyes para respaldar tus contratos y análisis fiscales.
          </p>
          <div className="mt-4 grid gap-4 text-sm text-white sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Fragmentos indexados</p>
              <p className="mt-2 text-2xl font-semibold">{stats.count}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Cobertura actual</p>
              <p className="mt-2 text-2xl font-semibold">{lawOptions.length || 1} leyes</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Descripción</p>
              <p className="mt-2 text-sm text-slate-200">{summaryText}</p>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white shadow-inner shadow-black/20">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[240px]">
              <label className="text-slate-300">Buscar en contenido, artículos o fracciones</label>
              <input
                type="search"
                value={searchDraft}
                onChange={handleSearchChange}
                placeholder="Ej. artículo 27 deducciones"
                className="mt-2 w-full rounded-2xl border border-white/20 bg-slate-950/40 px-4 py-2 text-white focus:border-emerald-300 focus:outline-none"
              />
            </div>
            <div className="w-full sm:w-48">
              <label className="text-slate-300">Leyes</label>
              <select
                name="ley"
                value={filters.ley}
                onChange={handleFilterChange}
                className="mt-2 w-full rounded-2xl border border-white/20 bg-slate-950/40 px-4 py-2 text-white focus:border-emerald-300 focus:outline-none"
              >
                <option value="todas">Todas</option>
                {lawOptions.map((law) => (
                  <option key={law} value={law} className="bg-slate-900">
                    {law}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-48">
              <label className="text-slate-300">Tipo de fuente</label>
              <select
                name="tipo"
                value={filters.tipo}
                onChange={handleFilterChange}
                className="mt-2 w-full rounded-2xl border border-white/20 bg-slate-950/40 px-4 py-2 text-white focus:border-emerald-300 focus:outline-none"
              >
                <option value="todas">Todas</option>
                {SOURCE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-slate-900">
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-300">
            <p>{isLawsLoading ? "Actualizando catálogo..." : summaryText}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handlePageChange("prev")}
                disabled={!stats.previous || filters.page === 1 || isLoading}
                className="rounded-full border border-white/20 px-3 py-1 text-white transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ← Anteriores
              </button>
              <button
                type="button"
                onClick={() => handlePageChange("next")}
                disabled={!stats.next || isLoading}
                className="rounded-full border border-white/20 px-3 py-1 text-white transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Siguientes →
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.5fr,1fr]">
          <div className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-slate-400">Recuperando referencias oficiales…</p>
            ) : sources.length === 0 ? (
              <p className="text-sm text-slate-400">No encontramos resultados con los filtros actuales.</p>
            ) : (
              sources.map((source) => {
                const isOpen = selectedSourceId === source.id;
                return (
                  <article
                    key={source.id}
                    className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/70 via-slate-900/30 to-slate-900/10 p-5 text-sm text-slate-100 shadow-2xl shadow-black/30"
                  >
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="flex-1">
                        <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">{source.tipo_fuente}</p>
                        <h3 className="mt-1 text-lg font-semibold text-white">{source.ley}</h3>
                        <p className="text-slate-300">
                          {source.articulo ? `Artículo ${source.articulo}` : "Artículo general"}
                          {source.fraccion ? ` · Fracción ${source.fraccion}` : ""}
                          {source.parrafo ? ` · Párrafo ${source.parrafo}` : ""}
                        </p>
                      </div>
                      <div className="flex gap-2 text-xs">
                        {source.vigencia && (
                          <span className="rounded-full border border-white/20 px-3 py-1 text-slate-200">
                            Vigente: {source.vigencia}
                          </span>
                        )}
                        {source.sat_categoria && (
                          <span className="rounded-full border border-amber-400/40 px-3 py-1 text-amber-100">
                            {source.sat_categoria}
                          </span>
                        )}
                      </div>
                    </div>
                    {source.resumen && (
                      <p className="mt-3 text-slate-300">{source.resumen}</p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-3 text-xs">
                      {source.fuente_documento && (
                        <span className="rounded-full border border-white/20 px-3 py-1 text-slate-200">
                          {source.fuente_documento}
                        </span>
                      )}
                      {source.fuente_url && (
                        <a
                          href={source.fuente_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-emerald-400/40 px-3 py-1 text-emerald-200 transition hover:border-emerald-200"
                        >
                          Ver DOF
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleSource(source.id)}
                        className="rounded-full border border-white/20 px-3 py-1 text-white transition hover:border-emerald-300"
                      >
                        {isOpen ? "Ocultar texto" : "Ver texto completo"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCopy(source.contenido)}
                        className="rounded-full border border-white/20 px-3 py-1 text-white transition hover:border-emerald-300"
                      >
                        Copiar
                      </button>
                    </div>
                    {isOpen && (
                      <div className="mt-4 rounded-2xl border border-white/15 bg-slate-950/60 p-4 text-slate-200">
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Contenido oficial</p>
                        <pre className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{source.contenido}</pre>
                        <p className="mt-4 text-[11px] text-slate-500">Hash: {source.hash_contenido}</p>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>

          <div className="space-y-4">
            {canCreate ? (
              <form
                onSubmit={handleFormSubmit}
                className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white shadow-inner shadow-black/30"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Agregar ley</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">Registrar nuevo fragmento</h3>
                  <p className="text-slate-300">Comparte artículos relevantes para acelerar la generación de citas.</p>
                </div>
                <label className="block">
                  <span className="text-slate-300">Nombre de la ley</span>
                  <input
                    type="text"
                    name="ley"
                    value={formData.ley}
                    onChange={handleFormChange}
                    required
                    className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-950/40 px-4 py-2 text-white focus:border-emerald-300 focus:outline-none"
                  />
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="text-slate-300">Tipo</span>
                    <select
                      name="tipo_fuente"
                      value={formData.tipo_fuente}
                      onChange={handleFormChange}
                      className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-950/40 px-4 py-2 text-white focus:border-emerald-300 focus:outline-none"
                    >
                      {SOURCE_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value} className="bg-slate-900">
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-slate-300">Artículo</span>
                    <input
                      type="text"
                      name="articulo"
                      value={formData.articulo}
                      onChange={handleFormChange}
                      className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-950/40 px-4 py-2 text-white focus:border-emerald-300 focus:outline-none"
                    />
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="text-slate-300">Fracción</span>
                    <input
                      type="text"
                      name="fraccion"
                      value={formData.fraccion}
                      onChange={handleFormChange}
                      className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-950/40 px-4 py-2 text-white focus:border-emerald-300 focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="text-slate-300">Párrafo</span>
                    <input
                      type="text"
                      name="parrafo"
                      value={formData.parrafo}
                      onChange={handleFormChange}
                      className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-950/40 px-4 py-2 text-white focus:border-emerald-300 focus:outline-none"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-slate-300">Resumen ejecutivo</span>
                  <textarea
                    name="resumen"
                    value={formData.resumen}
                    onChange={handleFormChange}
                    rows={3}
                    className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-950/40 px-4 py-2 text-white focus:border-emerald-300 focus:outline-none"
                    placeholder="Breve descripción del alcance del artículo"
                  />
                </label>
                <label className="block">
                  <span className="text-slate-300">Contenido oficial</span>
                  <textarea
                    name="contenido"
                    value={formData.contenido}
                    onChange={handleFormChange}
                    rows={6}
                    required
                    className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-950/40 px-4 py-2 text-white focus:border-emerald-300 focus:outline-none"
                    placeholder="Pega aquí el texto íntegro del artículo"
                  />
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="text-slate-300">Vigencia</span>
                    <input
                      type="text"
                      name="vigencia"
                      value={formData.vigencia}
                      onChange={handleFormChange}
                      className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-950/40 px-4 py-2 text-white focus:border-emerald-300 focus:outline-none"
                      placeholder="Ej. DOF 12/12/2023"
                    />
                  </label>
                  <label className="block">
                    <span className="text-slate-300">Etiqueta SAT / categoría</span>
                    <input
                      type="text"
                      name="sat_categoria"
                      value={formData.sat_categoria}
                      onChange={handleFormChange}
                      className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-950/40 px-4 py-2 text-white focus:border-emerald-300 focus:outline-none"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-slate-300">Fuente documental</span>
                  <input
                    type="text"
                    name="fuente_documento"
                    value={formData.fuente_documento}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-950/40 px-4 py-2 text-white focus:border-emerald-300 focus:outline-none"
                    placeholder="Ej. DOF 2023, decreto de reformas"
                  />
                </label>
                <label className="block">
                  <span className="text-slate-300">URL oficial (opcional)</span>
                  <input
                    type="url"
                    name="fuente_url"
                    value={formData.fuente_url}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-950/40 px-4 py-2 text-white focus:border-emerald-300 focus:outline-none"
                    placeholder="https://www.dof.gob.mx/..."
                  />
                </label>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full rounded-full bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSaving ? "Guardando..." : "Registrar fragmento"}
                </button>
              </form>
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white">
                <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Acceso restringido</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Solo administradores pueden cargar leyes</h3>
                <p className="mt-2 text-slate-300">
                  Solicita privilegios de administración para enriquecer la biblioteca legal o comparte tus archivos con el equipo jurídico para su ingesta automática.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
