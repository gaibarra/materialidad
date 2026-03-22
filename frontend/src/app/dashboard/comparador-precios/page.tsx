"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, ShieldCheck, UploadCloud } from "lucide-react";

import { DataCardsSkeleton, InlineEmptyState } from "../../../components/DataState";
import { DashboardShell } from "../../../components/DashboardShell";
import { GuiaContador } from "../../../components/GuiaContador";
import { MobileDataList } from "../../../components/MobileDataList";
import { alertError, alertSuccess } from "../../../lib/alerts";
import { fetchEmpresas, Empresa } from "../../../lib/empresas";
import {
  ComparativoPDFResponse,
  CotizacionPDF,
  compararCotizacionesPDF,
  fetchCotizacionesPDF,
  uploadCotizacionPDF,
} from "../../../lib/precios";

type UploadItem = {
  id: string;
  file: File;
  proveedor: string;
  status: "PENDING" | "UPLOADING" | "DONE" | "ERROR";
  error?: string;
};

const formatCurrency = (value: number, currency = "MXN") =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(value);

export default function ComparadorPreciosPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState<number | null>(null);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [cotizaciones, setCotizaciones] = useState<CotizacionPDF[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [comparativo, setComparativo] = useState<ComparativoPDFResponse | null>(null);
  const [search, setSearch] = useState("");

  const loadEmpresas = useCallback(async () => {
    try {
      const data = await fetchEmpresas();
      setEmpresas(data);
      if (data.length && !selectedEmpresa) {
        setSelectedEmpresa(data[0].id);
      }
    } catch (err) {
      await alertError("No pudimos cargar empresas", (err as Error).message);
    }
  }, [selectedEmpresa]);

  const loadCotizaciones = useCallback(async (empresaId: number) => {
    setLoading(true);
    try {
      const data = await fetchCotizacionesPDF(empresaId);
      setCotizaciones(data);
    } catch (err) {
      await alertError("No pudimos cargar cotizaciones", (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEmpresas();
  }, [loadEmpresas]);

  useEffect(() => {
    if (selectedEmpresa) {
      void loadCotizaciones(selectedEmpresa);
    }
  }, [selectedEmpresa, loadCotizaciones]);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const nextItems = Array.from(files)
      .filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))
      .map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        proveedor: file.name.replace(/\.pdf$/i, ""),
        status: "PENDING" as const,
      }));
    if (!nextItems.length) {
      void alertError("Formato inválido", "Solo se permiten archivos PDF");
      return;
    }
    setUploadItems((prev) => [...prev, ...nextItems]);
  };

  const updateUploadItem = (id: string, data: Partial<UploadItem>) => {
    setUploadItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...data } : item)));
  };

  const handleUpload = async () => {
    if (!selectedEmpresa) {
      await alertError("Selecciona empresa", "Debes elegir una empresa antes de subir PDF");
      return;
    }
    if (!uploadItems.length) {
      await alertError("Sin archivos", "Agrega al menos un PDF");
      return;
    }
    setUploading(true);
    try {
      for (const item of uploadItems) {
        updateUploadItem(item.id, { status: "UPLOADING" });
        try {
          await uploadCotizacionPDF({
            empresa: selectedEmpresa,
            archivo: item.file,
            proveedor_nombre: item.proveedor,
          });
          updateUploadItem(item.id, { status: "DONE" });
        } catch (err) {
          updateUploadItem(item.id, { status: "ERROR", error: (err as Error).message });
        }
      }
      await loadCotizaciones(selectedEmpresa);
      await alertSuccess("Procesadas", "Las cotizaciones se han subido y procesado");
    } finally {
      setUploading(false);
    }
  };

  const filteredCotizaciones = useMemo(() => {
    if (!search.trim()) return cotizaciones;
    const q = search.toLowerCase();
    return cotizaciones.filter(
      (c) => c.proveedor_nombre.toLowerCase().includes(q) || c.archivo_nombre.toLowerCase().includes(q),
    );
  }, [cotizaciones, search]);

  const totalConceptos = useMemo(
    () => cotizaciones.reduce((sum, c) => sum + (c.conceptos_count || 0), 0),
    [cotizaciones],
  );

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleCompare = async () => {
    if (selectedIds.length < 2) {
      await alertError("Selecciona cotizaciones", "Elige al menos dos para comparar");
      return;
    }
    setLoading(true);
    try {
      const res = await compararCotizacionesPDF(selectedIds);
      setComparativo(res);
    } catch (err) {
      await alertError("No pudimos comparar", (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6 text-slate-900">
        <header className="surface-panel-strong rounded-[1.85rem] p-6 shadow-fiscal">
          <div className="grid gap-5 lg:grid-cols-[1.06fr_0.94fr] lg:items-start">
            <div>
              <p className="kicker-label">Compras</p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--fiscal-ink)] sm:text-[2.8rem]">Comparador de cotizaciones PDF</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--fiscal-muted)] sm:text-base">Sube cotizaciones, extrae conceptos automáticamente y compara cientos de líneas entre proveedores.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <div className="rounded-full border border-[rgba(45,91,136,0.18)] bg-[var(--fiscal-accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--fiscal-accent)]">
                  Selección objetiva con respaldo documental
                </div>
                <div className="rounded-full border border-[rgba(184,137,70,0.18)] bg-[rgba(184,137,70,0.10)] px-3 py-2 text-xs font-semibold text-[var(--fiscal-gold)]">
                  Trazabilidad de ahorro y mejor proveedor
                </div>
              </div>
            </div>
            <GuiaContador
              section="Comparador PDF — Compras responsables"
              steps={[
                { title: "1. Selecciona la empresa", description: "El comparativo se guarda por <strong>empresa</strong> para mantener evidencia fiscal organizada." },
                { title: "2. Sube PDFs", description: "Arrastra varias <strong>cotizaciones PDF</strong> y el sistema extrae conceptos automáticamente." },
                { title: "3. Elige proveedores", description: "Selecciona al menos 2 cotizaciones para comparar precios línea por línea." },
                { title: "4. Documenta el ahorro", description: "El resultado muestra <strong>mejor proveedor</strong>, ahorro global y diferencia por concepto." },
              ]}
              concepts={[
                { term: "Comparativo técnico", definition: "Matriz que compara conceptos iguales entre proveedores para evidenciar una selección objetiva." },
                { term: "Ahorro total", definition: "Diferencia entre el total más bajo y el promedio de los proveedores comparados." },
                { term: "Trazabilidad", definition: "Toda cotización PDF queda vinculada para justificar decisiones ante auditoría." },
              ]}
              tips={[
                "Sube PDFs con tablas claras (concepto, cantidad, precio unitario, importe).",
                "Si hay diferencias enormes, documenta la razón en el expediente de compra.",
                "Usa el mismo estándar de moneda para evitar comparaciones injustas.",
              ]}
            />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-[rgba(200,192,177,0.72)] bg-[rgba(244,242,237,0.62)] px-4 py-3 text-center">
              <p className="text-2xl font-bold text-[var(--fiscal-ink)]">{cotizaciones.length}</p>
              <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--fiscal-muted)]">PDFs</p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-blue-700">{totalConceptos}</p>
              <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-blue-500">Conceptos</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-emerald-700">{comparativo?.summary.proveedores.length ?? 0}</p>
              <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-emerald-500">Comparados</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-slate-900">{comparativo?.summary.monedas.join(", ") || "MXN"}</p>
              <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">Monedas</p>
            </div>
          </div>
        </header>

        <section className="surface-panel rounded-[1.75rem] p-4 shadow-fiscal sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="kicker-label">Empresa</p>
              <h2 className="font-display text-xl font-semibold text-[var(--fiscal-ink)]">Selecciona la empresa</h2>
            </div>
            <select
              value={selectedEmpresa ?? ""}
              onChange={(e) => setSelectedEmpresa(e.target.value ? Number(e.target.value) : null)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">Selecciona empresa</option>
              {empresas.map((empresa) => (
                <option key={empresa.id} value={empresa.id}>{empresa.razon_social}</option>
              ))}
            </select>
          </div>
        </section>

        <section className="surface-panel rounded-[1.75rem] p-4 shadow-fiscal sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="kicker-label">Carga</p>
              <h2 className="font-display text-xl font-semibold text-[var(--fiscal-ink)]">Subir cotizaciones PDF</h2>
              <p className="text-sm text-[var(--fiscal-muted)]">Arrastra los PDFs o selecciona archivos. Se extraen conceptos automáticamente.</p>
            </div>
            <button
              type="button"
              onClick={() => void handleUpload()}
              disabled={uploading || !uploadItems.length}
              aria-disabled={uploading || !uploadItems.length}
              aria-busy={uploading}
              className="button-institutional rounded-full px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              <UploadCloud className={`mr-2 inline h-4 w-4 ${uploading ? "animate-pulse" : ""}`} />
              {uploading ? "Procesando…" : "Procesar PDFs"}
            </button>
          </div>

          <div
            aria-busy={uploading}
            className="mt-4 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[rgba(200,192,177,0.72)] bg-[rgba(244,242,237,0.55)] px-6 py-8 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFiles(e.dataTransfer.files);
            }}
          >
            <UploadCloud className="h-10 w-10 text-[var(--fiscal-muted)]/55" />
            <p className="mt-2 text-sm font-semibold text-[var(--fiscal-ink)]">Suelta PDFs aquí</p>
            <p className="text-xs text-[var(--fiscal-muted)]">o</p>
            <label className="mt-2 inline-flex cursor-pointer rounded-full bg-white px-4 py-2 text-xs font-semibold text-blue-600 shadow-sm">
              Seleccionar archivos
              <input
                type="file"
                accept="application/pdf"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </label>
          </div>

          {uploadItems.length > 0 && (
            <div className="mt-4 space-y-2">
              {uploadItems.map((item) => (
                <div key={item.id} className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-3 shadow-sm sm:flex-row sm:items-center sm:px-4">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{item.file.name}</p>
                    <p className="text-xs text-slate-500">{(item.file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <input
                    value={item.proveedor}
                    onChange={(e) => updateUploadItem(item.id, { proveedor: e.target.value })}
                    placeholder="Proveedor"
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:bg-white focus:outline-none"
                  />
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === "DONE" ? "bg-emerald-50 text-emerald-700" : item.status === "ERROR" ? "bg-red-50 text-red-700" : item.status === "UPLOADING" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                    {item.status === "UPLOADING" && <UploadCloud className="mr-1 h-3.5 w-3.5 animate-pulse" />}
                    {item.status === "PENDING" && "Pendiente"}
                    {item.status === "UPLOADING" && "Procesando…"}
                    {item.status === "DONE" && "Listo"}
                    {item.status === "ERROR" && "Error"}
                  </span>
                  {item.error && <span className="text-xs text-red-600">{item.error}</span>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="surface-panel rounded-[1.75rem] p-4 shadow-fiscal sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="kicker-label">Biblioteca</p>
              <h2 className="font-display text-xl font-semibold text-[var(--fiscal-ink)]">Cotizaciones cargadas</h2>
              <p className="text-sm text-[var(--fiscal-muted)]">Selecciona al menos 2 cotizaciones para comparar conceptos.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fiscal-muted)]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar proveedor…"
                  className="rounded-xl border border-[rgba(200,192,177,0.8)] bg-white py-2 pl-10 pr-3 text-sm text-[var(--fiscal-ink)] focus:border-[var(--fiscal-accent)] focus:bg-white focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => void handleCompare()}
                disabled={loading || selectedIds.length < 2}
                aria-disabled={loading || selectedIds.length < 2}
                aria-busy={loading}
                className="rounded-full bg-[var(--fiscal-success)] px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:brightness-95 disabled:opacity-60"
              >
                <ShieldCheck className={`mr-2 inline h-4 w-4 ${loading ? "animate-pulse" : ""}`} />
                {loading ? "Comparando…" : "Comparar seleccionadas"}
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {loading && !cotizaciones.length ? (
              <DataCardsSkeleton cards={3} />
            ) : null}
            {filteredCotizaciones.map((c) => (
              <div key={c.id} className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-3 shadow-sm sm:flex-row sm:items-center sm:px-4">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(c.id)}
                  onChange={() => toggleSelect(c.id)}
                  className="h-4 w-4 text-blue-600"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">{c.proveedor_nombre || c.archivo_nombre}</p>
                  <p className="text-xs text-slate-500">{c.archivo_nombre}</p>
                </div>
                <div className="text-xs text-slate-500">{c.conceptos_count} conceptos</div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${c.estatus === "PROCESADO" ? "bg-emerald-50 text-emerald-700" : c.estatus === "ERROR" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                  {c.estatus}
                </span>
              </div>
            ))}
            {!loading && !filteredCotizaciones.length && (
              <InlineEmptyState
                icon={<UploadCloud className="h-6 w-6" />}
                title={search ? "No hubo coincidencias en la biblioteca" : "Aún no hay cotizaciones para comparar"}
                description={search
                  ? "Limpia la búsqueda o sube nuevas cotizaciones para volver a poblar la biblioteca."
                  : "Sube al menos un PDF y asigna proveedor para abrir el comparativo desde móvil."
                }
              />
            )}
          </div>
        </section>

        <section className="surface-panel rounded-[1.75rem] p-6 shadow-fiscal">
          <p className="kicker-label">Comparativo</p>
          {!comparativo && <p className="mt-3 text-sm text-[var(--fiscal-muted)]">Selecciona cotizaciones y ejecuta la comparación para abrir la matriz de decisión.</p>}
          {comparativo && (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                {comparativo.summary.mejor_total && (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Mejor total: {comparativo.summary.mejor_total.proveedor} ({formatCurrency(comparativo.summary.mejor_total.total)})
                  </span>
                )}
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                  Conceptos comparados: {comparativo.summary.conceptos}
                </span>
              </div>

              <MobileDataList
                items={comparativo.concepts}
                getKey={(concepto, index) => `${concepto.descripcion}-${index}`}
                renderItem={(concepto) => (
                  <article className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{concepto.descripcion}</p>
                      <div className="text-right text-xs">
                        <p className="font-semibold text-emerald-700">Min {formatCurrency(concepto.min)}</p>
                        <p className="mt-1 text-slate-500">Avg {formatCurrency(concepto.avg)}</p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      {comparativo.summary.proveedores.map((proveedor) => (
                        <div key={proveedor.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2">
                          <p className="text-xs font-semibold text-slate-600">{proveedor.nombre}</p>
                          <p className="text-sm font-semibold text-slate-900">
                            {concepto.valores[String(proveedor.id)] ? formatCurrency(concepto.valores[String(proveedor.id)]) : "—"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </article>
                )}
              />

              <div className="overflow-x-auto rounded-2xl border border-slate-100 hidden lg:block">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50/80">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Concepto</th>
                      {comparativo.summary.proveedores.map((p) => (
                        <th key={p.id} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {p.nombre}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Min</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Avg</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {comparativo.concepts.map((c, idx) => (
                      <tr key={`${c.descripcion}-${idx}`} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-medium text-slate-900">{c.descripcion}</td>
                        {comparativo.summary.proveedores.map((p) => (
                          <td key={p.id} className="px-4 py-3 text-slate-700">
                            {c.valores[String(p.id)] ? formatCurrency(c.valores[String(p.id)]) : "—"}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-emerald-700 font-semibold">{formatCurrency(c.min)}</td>
                        <td className="px-4 py-3 text-slate-600">{formatCurrency(c.avg)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50/80">
                      <td className="px-4 py-3 font-semibold text-slate-900">Total</td>
                      {comparativo.summary.proveedores.map((p) => (
                        <td key={p.id} className="px-4 py-3 font-semibold text-slate-900">
                          {comparativo.summary.totales[String(p.id)] ? formatCurrency(comparativo.summary.totales[String(p.id)]) : "—"}
                        </td>
                      ))}
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3" />
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-4 lg:hidden">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Totales por proveedor</p>
                <div className="mt-3 space-y-2">
                  {comparativo.summary.proveedores.map((proveedor) => (
                    <div key={proveedor.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2">
                      <p className="text-sm font-semibold text-slate-700">{proveedor.nombre}</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {comparativo.summary.totales[String(proveedor.id)] ? formatCurrency(comparativo.summary.totales[String(proveedor.id)]) : "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
