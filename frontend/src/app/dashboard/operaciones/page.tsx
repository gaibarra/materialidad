"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { DashboardShell } from "../../../components/DashboardShell";
import { GuiaContador } from "../../../components/GuiaContador";
import { useAuthContext } from "../../../context/AuthContext";
import { alertError, alertSuccess } from "../../../lib/alerts";
import {
  createOperacionEntregable,
  fetchOperacionEntregables,
  fetchOperaciones,
  mapRequirementToEntregable,
  Operacion,
  OperacionEntregable,
  OperacionEntregablePayload,
  updateOperacionEntregable,
  updateOperacion,
  exportOperacionDossier,
} from "../../../lib/operaciones";
import { DeliverableRequirement, fetchDeliverableRequirements } from "../../../lib/checklists";

const ESTADO_STYLES: Record<OperacionEntregable["estado"], string> = {
  PENDIENTE: "bg-slate-200 text-slate-700",
  EN_PROCESO: "bg-amber-100 text-amber-700",
  ENTREGADO: "bg-blue-100 text-blue-700",
  RECIBIDO: "bg-emerald-100 text-emerald-700",
  FACTURADO: "bg-indigo-100 text-indigo-700",
};

const estadosOrden = ["PENDIENTE", "EN_PROCESO", "ENTREGADO", "RECIBIDO", "FACTURADO"] as const;

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

// ── Semáforo de materialidad ───────────────────────────────────────────────
function MaterialidadSemaforo({ op }: { op: Operacion }) {
  const checks = [
    { label: "CFDI", ok: op.cfdi_estatus === "VALIDO", warn: op.cfdi_estatus === "INVALIDO" },
    { label: "SPEI", ok: op.spei_estatus === "VALIDADO", warn: op.spei_estatus === "NO_ENCONTRADO" },
    { label: "Contrato", ok: Boolean(op.contrato_nombre), warn: false },
    { label: "NIF", ok: Boolean(op.nif_aplicable), warn: false },
  ];
  const allOk = checks.every((c) => c.ok);
  const hasWarn = checks.some((c) => c.warn);
  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-1">
        {checks.map((c) => (
          <span
            key={c.label}
            title={c.label}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${c.ok
              ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-300"
              : c.warn
                ? "bg-red-500/15 border-red-400/40 text-red-300"
                : "bg-white/5 border-white/10 text-slate-400"
              }`}
          >
            {c.ok ? "✓" : c.warn ? "✗" : "○"} {c.label}
          </span>
        ))}
      </div>
      {!allOk && !hasWarn && (
        <p className="mt-1 text-[10px] text-amber-300">⚠ Materialidad incompleta</p>
      )}
      {hasWarn && (
        <p className="mt-1 text-[10px] text-red-300">⛔ Riesgo alto — revisa CFDI/SPEI</p>
      )}
    </div>
  );
}

export default function OperacionesPage() {
  const { isAuthenticated } = useAuthContext();
  const [operaciones, setOperaciones] = useState<Operacion[]>([]);
  const [requisitos, setRequisitos] = useState<DeliverableRequirement[]>([]);
  const [entregables, setEntregables] = useState<OperacionEntregable[]>([]);
  const [selectedOperacionId, setSelectedOperacionId] = useState<number | null>(null);
  const [form, setForm] = useState<OperacionEntregablePayload>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [evidencias, setEvidencias] = useState<Record<number, string>>({});
  const [firmas, setFirmas] = useState<Record<number, { por: string; email: string }>>({});
  const [updatingConceptId, setUpdatingConceptId] = useState<number | null>(null);

  const selectedOperacion = useMemo(
    () => operaciones.find((op) => op.id === selectedOperacionId) ?? null,
    [operaciones, selectedOperacionId]
  );

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [ops, reqs] = await Promise.all([fetchOperaciones(), fetchDeliverableRequirements()]);
      setOperaciones(ops);
      setRequisitos(reqs);
      const primera = ops[0]?.id ?? null;
      setSelectedOperacionId(primera);
      if (primera) {
        setForm((prev) => ({ ...prev, operacion: primera }));
        await loadEntregables(primera);
      }
    } catch (err) {
      void alertError("No pudimos cargar operaciones", (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadInitialData();
  }, [isAuthenticated, loadInitialData]);

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
          acc[item.id] = {
            por: item.recepcion_firmado_por || "",
            email: item.recepcion_firmado_email || "",
          };
          return acc;
        }, {})
      );
    } catch (err) {
      void alertError("No pudimos cargar entregables", (err as Error).message);
    }
  };

  const handleSelectOperacion = async (operacionId: number) => {
    setSelectedOperacionId(operacionId);
    setForm((prev) => ({ ...prev, operacion: operacionId }));
    await loadEntregables(operacionId);
  };

  const handleExportDossier = async (operacionId: number) => {
    setExportingId(operacionId);
    try {
      await exportOperacionDossier(operacionId);
    } catch (err) {
      void alertError("Error al exportar", "No se pudo generar el expediente ZIP: " + (err as Error).message);
    } finally {
      setExportingId(null);
    }
  };

  const handleRequirementChange = (id: string) => {
    if (!id) {
      setForm((prev) => ({ ...prev, requirement: null, titulo: "", descripcion: "", tipo_gasto: "", codigo: "", pillar: "ENTREGABLES", requerido: true }));
      return;
    }
    const req = requisitos.find((item) => String(item.id) === id);
    if (!req) return;
    const mapped = mapRequirementToEntregable(req);
    setForm((prev) => ({ ...prev, ...mapped, operacion: prev.operacion }));
  };

  const handleFormChange = (field: keyof OperacionEntregablePayload, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const submitEntregable = async () => {
    if (!form.operacion) {
      await alertError("Selecciona una operación", "Necesitas elegir una operación para agregar entregables");
      return;
    }
    if (!form.titulo) {
      await alertError("Título requerido", "Agrega un título para identificar el entregable");
      return;
    }
    setSaving(true);
    try {
      const payload: OperacionEntregablePayload = {
        ...form,
        requirement: form.requirement || null,
        oc_fecha: form.oc_fecha || null,
        fecha_compromiso: form.fecha_compromiso || null,
      };
      await createOperacionEntregable(payload);
      await alertSuccess("Entregable creado", "Liga evidencia y marca como Entregado/Recibido cuando esté listo");
      setForm((prev) => ({ ...emptyForm, operacion: prev.operacion }));
      await loadEntregables(form.operacion);
    } catch (err) {
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
      await alertSuccess("Concepto actualizado", "Se aplicó la descripción sugerida");
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
      await alertError("Datos de recepción", "Captura nombre y correo de quien firma la recepción");
      return;
    }
    const payload: Partial<OperacionEntregablePayload> = {
      estado,
      oc_archivo_url: evidenciaUrl,
      recepcion_firmado_por: firma.por,
      recepcion_firmado_email: firma.email,
    };
    try {
      await updateOperacionEntregable(item.id, payload);
      await loadEntregables(item.operacion);
      await alertSuccess("Estado actualizado", `El entregable ahora está en estado ${estado}`);
    } catch (err) {
      void alertError("No pudimos actualizar el estado", (err as Error).message);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <DashboardShell>
      <div className="space-y-8">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Operaciones</p>
            <h1 className="text-xl sm:text-2xl font-semibold text-white">Trazabilidad de entregables</h1>
            <p className="text-sm text-slate-300">
              Lista operaciones, agrega entregables y liga evidencia para avanzar a Entregado / Recibido.
            </p>
          </div>
          <GuiaContador
            section="Operaciones y entregables — Reforma 2026"
            steps={[
              { title: "1. Selecciona la operación", description: "Elige la <strong>operación</strong> en el panel izquierdo. El semáforo de color muestra qué tan completa está su materialidad: CFDI ✓, SPEI ✓, Contrato ✓, NIF ✓." },
              { title: "2. Registra todos los entregables", description: "<strong>Reforma 2026:</strong> ya no basta el CFDI + pago. Debes tener entregables con evidencia (bitácora, correo, fotografía, informe) para evitar sanciones de 2-9 años de prisión." },
              { title: "3. Liga evidencia irrefutable", description: "Sube la URL del entregable (Drive, SharePoint) <strong>antes</strong> de marcarlo como Entregado. El sistema sella timestamp. El SAT puede pedir fotos/video en visitas (art. 48 CFF reformado)." },
              { title: "4. Firma la recepción con NIF", description: "Captura nombre y correo de quien firma la recepción. Registra la <strong>NIF aplicable</strong> (C-6, C-8, D-1...) y sube la póliza contable para demostrar sustancia económica." },
            ]}
            concepts={[
              { term: "Semáforo de materialidad", definition: "Indicador por operación que muestra si CFDI, SPEI, Contrato y NIF están validados. Si alguno falla, la operación tiene riesgo de ser considerada simulación." },
              { term: "Reforma 2026 — Art. 69-B CFF", definition: "Sanciones de 2-9 años de prisión por CFDI sin operación real. Ya NO basta el contrato + CFDI + pago: se requieren entregables con evidencia documental robusta." },
              { term: "Sustancia económica (NIF)", definition: "Principio de las NIF que obliga a demostrar que el activo o servicio tiene uso real en el negocio y genera beneficios económicos futuros, independiente del aspecto legal." },
              { term: "Art. 48 CFF reformado", definition: "El SAT ahora puede usar fotografías, videos y grabaciones en visitas domiciliarias como evidencia en tu contra. Documenta tus instalaciones y procesos proactivamente." },
            ]}
            tips={[
              "<strong>⚠️ Riesgo 2026:</strong> Un CFDI válido sin evidencias de materialidad es suficiente para que el SAT presuma simulación y bloquee tu CSD.",
              "Sube evidencias fotográficas y bitácoras <strong>el mismo día</strong> que se presta el servicio o entrega el bien.",
              "Para la recepción, usa el <strong>correo corporativo</strong> con asunto descriptivo — los correos son evidencia admisible ante el SAT.",
              "Registra la <strong>NIF aplicable</strong> en cada operación para demostrar el tratamiento contable correcto ante una auditoría metodológica (Art. 48 CFF).",
            ]}
          />
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20 lg:col-span-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Operaciones</p>
                <h2 className="text-lg font-semibold text-white">Selecciona una operación</h2>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-100">{operaciones.length}</span>
            </div>
            <div className="mt-4 space-y-3">
              {loading && <p className="text-sm text-slate-300">Cargando operaciones...</p>}
              {!loading && operaciones.length === 0 && (
                <p className="text-sm text-slate-300">Aún no hay operaciones registradas.</p>
              )}
              {!loading &&
                operaciones.map((op) => {
                  const isActive = op.id === selectedOperacionId;
                  // Detectar riesgo: CFDI válido sin contrato (posible simulación)
                  const cfdiSinContrato = op.cfdi_estatus === "VALIDO" && !op.contrato_nombre;
                  return (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => {
                        void handleSelectOperacion(op.id);
                      }}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${isActive
                        ? "border-emerald-300/60 bg-emerald-500/10 text-white"
                        : cfdiSinContrato
                          ? "border-red-400/50 bg-red-500/10 text-white hover:border-red-300"
                          : "border-white/10 bg-white/5 text-slate-200 hover:border-emerald-300/40"
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">{op.proveedor_nombre}</p>
                        <span className="text-xs text-slate-300">{op.fecha_operacion}</span>
                      </div>
                      {cfdiSinContrato && (
                        <div className="mt-1 rounded-lg bg-red-500/20 px-2 py-1 text-[11px] font-semibold text-red-300">
                          ⛔ CFDI sin materialidad — Riesgo Reforma 2026
                        </div>
                      )}
                      <p className="text-xs text-slate-300">{op.contrato_nombre || <span className="text-red-400">Sin contrato</span>}</p>
                      <p className="text-sm font-medium text-emerald-300">
                        {formatCurrency(op.monto, op.moneda)} · {op.tipo_operacion}
                      </p>
                      {/* Semáforo de materialidad */}
                      <MaterialidadSemaforo op={op} />
                      <div className="mt-2 text-xs text-slate-200">
                        <p className="font-semibold text-white">Concepto CFDI</p>
                        <p className="text-slate-200">{op.concepto || "(sin concepto)"}</p>
                        {op.concepto_generico && (
                          <div className="mt-1 space-y-1">
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">
                              Concepto genérico
                            </span>
                            {op.concepto_sugerido && (
                              <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-[11px] text-slate-200">
                                <p className="text-slate-100">Sugerencia: {op.concepto_sugerido}</p>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    void aplicarSugerenciaConcepto(op);
                                  }}
                                  disabled={updatingConceptId === op.id}
                                  className="mt-1 rounded-full bg-emerald-500 px-3 py-1 min-h-[44px] text-[11px] font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                                >
                                  {updatingConceptId === op.id ? "Aplicando..." : "Aplicar sugerencia"}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Nuevo entregable</p>
                  <h3 className="text-lg font-semibold text-white">Programar entregable</h3>
                  <p className="text-sm text-slate-300">
                    Usa un requisito sugerido o captura un entregable manual con fecha compromiso.
                  </p>
                </div>
                {selectedOperacion && (
                  <div className="text-right text-xs text-slate-300">
                    <p>Proveedor: <span className="font-semibold text-white">{selectedOperacion.proveedor_nombre}</span></p>
                    <p>Monto: <span className="font-semibold text-emerald-300">{formatCurrency(selectedOperacion.monto, selectedOperacion.moneda)}</span></p>

                    <button
                      type="button"
                      onClick={() => handleExportDossier(selectedOperacion.id)}
                      disabled={exportingId === selectedOperacion.id}
                      title="Descarga el expediente estructurado con todas las evidencias (PDF/ZIP) para revisiones del SAT (Gabinete/Domiciliarias)."
                      className="mt-3 flex items-center justify-end gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-semibold text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      <span>🗂️</span>
                      {exportingId === selectedOperacion.id ? "Generando ZIP..." : "Exportar Expediente SAT (Dossier)"}
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-200">Requisito sugerido</label>
                    <select
                      value={form.requirement ?? ""}
                      onChange={(e) => handleRequirementChange(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-300 focus:outline-none"
                    >
                      <option value="">Sin plantilla</option>
                      {requisitos.map((req) => (
                        <option key={req.id} value={req.id}>
                          {req.codigo} · {req.titulo}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-200">Título</label>
                    <input
                      value={form.titulo}
                      onChange={(e) => handleFormChange("titulo", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-300 focus:outline-none"
                      placeholder="Entregable: informe, evidencia fotográfica, minuta..."
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-200">Descripción</label>
                    <textarea
                      value={form.descripcion}
                      onChange={(e) => handleFormChange("descripcion", e.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-300 focus:outline-none"
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-200">Fecha compromiso</label>
                      <input
                        type="date"
                        value={form.fecha_compromiso ?? ""}
                        onChange={(e) => handleFormChange("fecha_compromiso", e.target.value)}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-300 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-200">Requerido</label>
                      <select
                        value={form.requerido ? "1" : "0"}
                        onChange={(e) => handleFormChange("requerido", e.target.value === "1")}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-300 focus:outline-none"
                      >
                        <option value="1">Sí</option>
                        <option value="0">Opcional</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-200">Código</label>
                      <input
                        value={form.codigo ?? ""}
                        onChange={(e) => handleFormChange("codigo", e.target.value)}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-300 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-200">Tipo de gasto</label>
                      <input
                        value={form.tipo_gasto ?? ""}
                        onChange={(e) => handleFormChange("tipo_gasto", e.target.value)}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-300 focus:outline-none"
                        placeholder="CapEx, OpEx, viáticos..."
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-200">Orden de compra</label>
                      <input
                        value={form.oc_numero ?? ""}
                        onChange={(e) => handleFormChange("oc_numero", e.target.value)}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-300 focus:outline-none"
                        placeholder="OC-1234"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-200">Fecha OC</label>
                      <input
                        type="date"
                        value={form.oc_fecha ?? ""}
                        onChange={(e) => handleFormChange("oc_fecha", e.target.value)}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-300 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-200">URL de evidencia</label>
                    <input
                      type="url"
                      value={form.oc_archivo_url ?? ""}
                      onChange={(e) => handleFormChange("oc_archivo_url", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-300 focus:outline-none"
                      placeholder="https://drive..."
                    />
                    <p className="mt-1 text-xs text-slate-300">Enlaza carpeta o archivo que se usará para marcar como entregado/recibido.</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-200">Comentarios</label>
                    <textarea
                      value={form.comentarios ?? ""}
                      onChange={(e) => handleFormChange("comentarios", e.target.value)}
                      rows={2}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-300 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    void submitEntregable();
                  }}
                  disabled={saving || !selectedOperacion}
                  className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"
                >
                  {saving ? "Guardando..." : "Agregar entregable"}
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Seguimiento</p>
                  <h3 className="text-lg font-semibold text-white">Entregables de la operación</h3>
                  <p className="text-sm text-slate-300">Sube la evidencia y marca el estado a Entregado / Recibido.</p>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-100">{entregables.length}</span>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-sm text-slate-100">
                  <thead className="text-xs uppercase tracking-wide text-slate-300">
                    <tr>
                      <th className="px-3 py-2 text-left">Título</th>
                      <th className="px-3 py-2 text-left">Compromiso</th>
                      <th className="px-3 py-2 text-left">Evidencia / firma</th>
                      <th className="px-3 py-2 text-left">Estado</th>
                      <th className="px-3 py-2 text-left">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {entregables.length === 0 && (
                      <tr>
                        <td className="px-3 py-4 text-center text-slate-300" colSpan={5}>
                          No hay entregables para esta operación.
                        </td>
                      </tr>
                    )}
                    {entregables
                      .sort((a, b) => estadosOrden.indexOf(a.estado) - estadosOrden.indexOf(b.estado))
                      .map((item) => (
                        <tr key={item.id}>
                          <td className="px-3 py-3">
                            <p className="font-semibold text-white">{item.titulo}</p>
                            <p className="text-xs text-slate-300">{item.codigo || item.tipo_gasto}</p>
                            {item.descripcion && <p className="text-xs text-slate-400">{item.descripcion}</p>}
                          </td>
                          <td className="px-3 py-3 text-slate-200">
                            <div className="flex flex-wrap items-center gap-2">
                              <span>{item.fecha_compromiso || "-"}</span>
                              {item.vencido && (
                                <span className="rounded-full bg-flame-100 px-2 py-1 text-[11px] font-semibold text-flame-800">
                                  Vencido · {item.dias_atraso}d
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="space-y-2">
                              <input
                                type="url"
                                value={evidencias[item.id] ?? ""}
                                onChange={(e) => handleEvidenciaChange(item.id, e.target.value)}
                                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-emerald-300 focus:outline-none"
                                placeholder="https://drive..."
                              />
                              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                <input
                                  type="text"
                                  value={firmas[item.id]?.por ?? ""}
                                  onChange={(e) => handleFirmaChange(item.id, "por", e.target.value)}
                                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-emerald-300 focus:outline-none"
                                  placeholder="Recibido por (nombre)"
                                />
                                <input
                                  type="email"
                                  value={firmas[item.id]?.email ?? ""}
                                  onChange={(e) => handleFirmaChange(item.id, "email", e.target.value)}
                                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-emerald-300 focus:outline-none"
                                  placeholder="Correo quien recibe"
                                />
                              </div>
                              {item.oc_archivo_url && (
                                <a
                                  href={item.oc_archivo_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-emerald-200 hover:text-emerald-100"
                                >
                                  Ver evidencia
                                </a>
                              )}
                              {item.evidencia_cargada_en && (
                                <p className="text-[11px] text-slate-400">Sellado: {item.evidencia_cargada_en}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${ESTADO_STYLES[item.estado]}`}>
                              {item.estado}
                            </span>
                            <div className="mt-1 text-[11px] text-slate-300">
                              {item.fecha_entregado && <p>Entregado: {item.fecha_entregado}</p>}
                              {item.fecha_recepcion && <p>Recibido: {item.fecha_recepcion}</p>}
                              {item.recepcion_firmada_en && <p>Recepción firmada: {item.recepcion_firmada_en}</p>}
                              {item.recepcion_firmado_por && <p className="text-slate-200">Firmó: {item.recepcion_firmado_por}</p>}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="rounded-full border border-amber-300/50 px-3 py-1 min-h-[44px] text-xs font-semibold text-amber-200 hover:bg-amber-300/10"
                                onClick={() => {
                                  void avanzarEstado(item, "ENTREGADO");
                                }}
                              >
                                Marcar entregado
                              </button>
                              <button
                                type="button"
                                className="rounded-full border border-emerald-300/50 px-3 py-1 min-h-[44px] text-xs font-semibold text-emerald-200 hover:bg-emerald-300/10"
                                onClick={() => {
                                  void avanzarEstado(item, "RECIBIDO");
                                }}
                              >
                                Marcar recibido
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
