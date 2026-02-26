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
  createOperacion,
  OperacionPayload,
} from "../../../lib/operaciones";
import { apiFetch } from "../../../lib/api";
import { type Proveedor } from "../../../lib/providers";
import { DeliverableRequirement, fetchDeliverableRequirements } from "../../../lib/checklists";
import { RequisitoCombobox } from "../../../components/RequisitoCombobox";

const ESTADO_STYLES: Record<OperacionEntregable["estado"], string> = {
  PENDIENTE: "bg-slate-700/80 text-slate-200 border border-slate-500/50",
  EN_PROCESO: "bg-amber-500/20 text-amber-300 border border-amber-400/40",
  ENTREGADO: "bg-blue-500/20 text-blue-300 border border-blue-400/40",
  RECIBIDO: "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40",
  FACTURADO: "bg-indigo-500/20 text-indigo-300 border border-indigo-400/40",
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
  const hasWarn = checks.some((c) => c.warn);
  return (
    <div className="mt-2.5">
      <div className="flex flex-wrap gap-1.5">
        {checks.map((c) => (
          <span
            key={c.label}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide ${
              c.ok
                ? "bg-emerald-500/25 text-emerald-300"
                : c.warn
                ? "bg-red-500/25 text-red-300"
                : "bg-white/8 text-slate-400"
            }`}
          >
            {c.ok ? "✓" : c.warn ? "✗" : "·"} {c.label}
          </span>
        ))}
      </div>
      {hasWarn && (
        <p className="mt-1.5 text-[10px] font-semibold text-red-400">⛔ Riesgo alto — revisa CFDI/SPEI</p>
      )}
    </div>
  );
}

export default function OperacionesPage() {
  const { isAuthenticated } = useAuthContext();
  const [operaciones, setOperaciones] = useState<Operacion[]>([]);
  const [empresas, setEmpresas] = useState<Array<{ id: number; razon_social: string }>>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [contratos, setContratos] = useState<{ id: number, nombre: string }[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [creatingOp, setCreatingOp] = useState(false);
  const [newOpForm, setNewOpForm] = useState<OperacionPayload>({
    empresa: 0,
    proveedor: 0,
    contrato: null,
    uuid_cfdi: "",
    monto: "",
    moneda: "MXN",
    fecha_operacion: today(),
    tipo_operacion: "COMPRA",
    concepto: "",
  });

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
      const [ops, reqs, empresasData, provsData, contsData] = await Promise.all([
        fetchOperaciones(),
        fetchDeliverableRequirements(),
        apiFetch<any>("/api/materialidad/empresas/"),
        apiFetch<any>("/api/materialidad/proveedores/"),
        apiFetch<any>("/api/materialidad/contratos/"),
      ]);
      const empresasList = Array.isArray(empresasData) ? empresasData : empresasData?.results ?? [];
      setOperaciones(ops);
      setRequisitos(reqs);
      setEmpresas(empresasList);
      setProveedores(Array.isArray(provsData) ? provsData : provsData?.results ?? []);
      setContratos(Array.isArray(contsData) ? contsData : contsData?.results ?? []);
      if (empresasList[0]?.id) {
        setNewOpForm((prev) => ({
          ...prev,
          empresa: prev.empresa || empresasList[0].id,
        }));
      }
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

  const handleCreateOperacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOpForm.empresa) {
      await alertError("Falta empresa", "Selecciona una empresa válida");
      return;
    }
    if (!newOpForm.proveedor) {
      await alertError("Falta proveedor", "Selecciona un proveedor válido");
      return;
    }
    setCreatingOp(true);
    try {
      const allowedTipos = new Set(["COMPRA", "SERVICIO", "ARRENDAMIENTO", "OTRO"]);
      const tipoNormalizado = String(newOpForm.tipo_operacion ?? "COMPRA").replace(/^"+|"+$/g, "");
      const payload: OperacionPayload = {
        ...newOpForm,
        tipo_operacion: allowedTipos.has(tipoNormalizado) ? tipoNormalizado : "COMPRA",
      };
      const op = await createOperacion(payload);
      await alertSuccess("Operación creada", "Se registró exitosamente");
      setOperaciones((prev) => [op, ...prev]);
      setSelectedOperacionId(op.id);
      setShowModal(false);
      setNewOpForm({
        ...payload,
        empresa: payload.empresa,
        proveedor: 0,
        contrato: null,
        uuid_cfdi: "",
        monto: "",
        concepto: "",
      });
      await loadEntregables(op.id);
    } catch (err) {
      void alertError("Error al registrar", (err as Error).message);
    } finally {
      setCreatingOp(false);
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
        {/* ── Header ── */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-emerald-400">Ejecución / Inteligencia fiscal</p>
            <h1 className="mt-1 text-2xl font-bold text-white tracking-tight">Operaciones &amp; Entregables</h1>
            <p className="mt-0.5 text-sm text-slate-400">
              Gestiona operaciones, liga evidencia y cierra cada entregable con materialidad probada.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/30 transition hover:from-emerald-400 hover:to-teal-400 hover:shadow-emerald-400/40"
            >
              <span className="text-base leading-none">＋</span> Nueva Operación
            </button>
            <GuiaContador
              section="Operaciones y entregables — Reforma 2026"
              steps={[
                {
                  title: "1. Selecciona la operación",
                  description: "Elige la <strong>operación</strong> en el panel izquierdo. El semáforo indica el nivel de materialidad: CFDI ✓, SPEI ✓, Contrato ✓, NIF ✓. Empieza siempre por la operación con más riesgo (semáforo rojo).",
                },
                {
                  title: "2. Requisito sugerido",
                  description: "Selecciona una <strong>plantilla predefinida</strong> para cargar automáticamente el título, descripción, código y tipo de gasto. Las plantillas se crean y administran en <strong>Checklists → Catálogo de Entregables</strong> (menú lateral). Ahí defines: tipo de gasto, código identificador, título, pilar y si es obligatorio. Una vez guardadas, aparecen aquí para reutilizarlas en cualquier operación.",
                },
                {
                  title: "3. Título del entregable",
                  description: "Nombre <strong>específico y descriptivo</strong> del documento o evidencia: «Informe de avance semana 3», «Evidencia fotográfica instalación», «Minuta de reunión 2026-02-20». Evita términos genéricos como «Documento» o «Archivo».",
                },
                {
                  title: "4. Descripción",
                  description: "Explica el <strong>contenido y alcance</strong> del entregable: qué demuestra, a qué etapa del contrato corresponde y qué actividad específica acredita. Esta narrativa es la que lee el auditor del SAT.",
                },
                {
                  title: "5. Código y Tipo de gasto",
                  description: "El <strong>código</strong> (ej. C-01, D-3) vincula el entregable con la cláusula contractual correspondiente. El <strong>tipo de gasto</strong> (CapEx, OpEx, viáticos) define el tratamiento contable correcto bajo NIF y es requerido en auditorías metodológicas.",
                },
                {
                  title: "6. Orden de compra y Fecha OC",
                  description: "Registra el <strong>número de orden de compra</strong> que autorizó el gasto internamente. La <strong>fecha de la OC</strong> debe ser anterior a la factura y al servicio prestado — esto demuestra que existió proceso de aprobación previo, clave para acreditar sustancia económica.",
                },
                {
                  title: "7. URL de evidencia",
                  description: "Liga el <strong>documento de soporte</strong> en Drive, SharePoint o cualquier repositorio accesible (URL pública o con permisos). Esta URL se sella con timestamp cuando se guarda. El SAT puede solicitar acceso directo al archivo en una visita domiciliaria (Art. 48 CFF).",
                },
                {
                  title: "8. Fecha compromiso y Requerido",
                  description: "La <strong>fecha compromiso</strong> define el plazo máximo de entrega; el sistema la usa para alertar vencimientos. Marca como <strong>Requerido</strong> los entregables cuya ausencia impide acreditar la operación ante el SAT; los opcionales son refuerzo adicional.",
                },
                {
                  title: "9. Comentarios",
                  description: "Agrega <strong>contexto adicional</strong>: instrucciones para el equipo, advertencias legales, referencia a cláusulas contractuales o aclaraciones para el expediente. Este campo es visible en el Dossier SAT exportado.",
                },
                {
                  title: "10. Marcar Entregado → Recibido",
                  description: "Avanza el estado a <strong>Entregado</strong> cuando el proveedor entregue la evidencia (requiere URL). Cambia a <strong>Recibido</strong> capturando nombre y correo de quien firma la recepción — esto cierra el ciclo de materialidad y sella el timestamp de recepción.",
                },
              ]}
              concepts={[
                { term: "Semáforo de materialidad", definition: "Indicador por operación que muestra si CFDI, SPEI, Contrato y NIF están validados. Si alguno falla, la operación tiene riesgo de ser considerada simulación fiscal." },
                { term: "Reforma 2026 — Art. 69-B CFF", definition: "Sanciones severas por CFDI sin operación real demostrable. Ya NO basta el contrato + CFDI + pago: se requieren entregables con evidencia documental robusta que acredite sustancia económica." },
                { term: "Sustancia económica (NIF)", definition: "Principio de las NIF que obliga a demostrar que el activo o servicio tiene uso real en el negocio y genera beneficios económicos futuros, independientemente del aspecto legal del contrato." },
                { term: "Timestamp de evidencia", definition: "Sello de fecha y hora que el sistema registra automáticamente cuando se guarda la URL de evidencia. Es admisible como prueba ante el SAT para demostrar que el documento existía antes de la revisión." },
                { term: "Dossier SAT", definition: "Expediente estructurado (ZIP/PDF) que agrupa todos los entregables, evidencias y firmas de una operación. Úsalo para responder requerimientos, visitas domiciliarias o revisiones electrónicas de gabinete." },
                { term: "Art. 48 CFF reformado", definition: "El SAT puede usar fotografías, videos y grabaciones en visitas domiciliarias como evidencia. Documenta tus instalaciones, equipos y procesos proactivamente." },
              ]}
              tips={[
                "<strong>⚠️ Riesgo 2026:</strong> Un CFDI válido sin evidencias de materialidad es suficiente para que el SAT presuma simulación y bloquee tu CSD.",
                "Sube la evidencia <strong>el mismo día</strong> que se presta el servicio o se entrega el bien — el timestamp lo confirma ante cualquier auditoría.",
                "El <strong>Código</strong> del entregable debe coincidir con la cláusula del contrato que obliga al proveedor a entregarlo. Facilita la trazabilidad documental.",
                "Para la recepción, usa el <strong>correo corporativo</strong> con asunto descriptivo — los correos electrónicos son evidencia admisible ante el SAT.",
                "Marca como <strong>Requerido</strong> todo entregable que esté mencionado explícitamente en el contrato; lo opcional es evidencia de refuerzo.",
                "Exporta el <strong>Expediente SAT (Dossier)</strong> inmediatamente al cerrar todos los entregables como Recibidos — tenlo listo antes de que llegue cualquier requerimiento.",
              ]}
            />
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* ── Panel izquierdo: lista de operaciones ── */}
          <div className="rounded-2xl border border-white/10 bg-slate-800/60 backdrop-blur-sm shadow-2xl shadow-black/30 lg:col-span-1 overflow-hidden">
            {/* Header del panel */}
            <div className="flex items-center justify-between border-b border-white/10 bg-slate-700/40 px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-emerald-400">Lista</p>
                <h2 className="text-base font-bold text-white">Operaciones</h2>
              </div>
              <span className="rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 text-sm font-bold text-emerald-300">
                {operaciones.length}
              </span>
            </div>
            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {loading && (
                <div className="flex items-center gap-2 py-4 px-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                  <p className="text-sm text-slate-400">Cargando operaciones…</p>
                </div>
              )}
              {!loading && operaciones.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/15 bg-white/3 py-8 text-center">
                  <p className="text-sm font-medium text-slate-400">Sin operaciones registradas</p>
                  <p className="mt-1 text-xs text-slate-500">Crea la primera con &quot;+ Nueva Operación&quot;</p>
                </div>
              )}
              {!loading &&
                operaciones.map((op) => {
                  const isActive = op.id === selectedOperacionId;
                  const cfdiSinContrato = op.cfdi_estatus === "VALIDO" && !op.contrato_nombre;
                  const tipoColors: Record<string, string> = {
                    COMPRA: "text-blue-300",
                    SERVICIO: "text-purple-300",
                    ARRENDAMIENTO: "text-amber-300",
                    OTRO: "text-slate-300",
                  };
                  const tipoColor = tipoColors[op.tipo_operacion] ?? "text-slate-300";
                  return (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => { void handleSelectOperacion(op.id); }}
                      className={`group w-full rounded-xl border text-left transition-all duration-150 ${
                        isActive
                          ? "border-emerald-400/60 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 shadow-lg shadow-emerald-500/10"
                          : cfdiSinContrato
                          ? "border-red-500/40 bg-red-500/8 hover:border-red-400/60 hover:bg-red-500/12"
                          : "border-white/8 bg-white/4 hover:border-white/20 hover:bg-white/8"
                      }`}
                    >
                      {/* Card header */}
                      <div className={`rounded-t-xl px-4 py-3 ${isActive ? "bg-emerald-500/10" : "bg-white/3"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-bold text-white leading-tight">{op.proveedor_nombre}</p>
                          <span className="shrink-0 text-[10px] text-slate-400 mt-0.5">{op.fecha_operacion}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <p className="text-base font-extrabold text-emerald-300">
                            {formatCurrency(op.monto, op.moneda)}
                          </p>
                          <span className={`text-[10px] font-bold uppercase tracking-wide ${tipoColor}`}>
                            · {op.tipo_operacion}
                          </span>
                        </div>
                      </div>
                      {/* Card body */}
                      <div className="px-4 py-3 space-y-2">
                        {cfdiSinContrato && (
                          <div className="rounded-lg bg-red-500/20 border border-red-400/30 px-3 py-1.5 text-[10px] font-bold text-red-300">
                            ⛔ Sin contrato — Riesgo Reforma 2026
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-500">Contrato:</span>
                          {op.contrato_nombre
                            ? <span className="text-[11px] font-medium text-slate-200 truncate">{op.contrato_nombre}</span>
                            : <span className="text-[11px] font-semibold text-red-400">Sin contrato</span>
                          }
                        </div>
                        {/* Semáforo */}
                        <MaterialidadSemaforo op={op} />
                        {/* Concepto */}
                        <div className="border-t border-white/8 pt-2">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-0.5">Concepto CFDI</p>
                          <p className="text-[11px] text-slate-300 leading-snug line-clamp-2">{op.concepto || <span className="italic text-slate-500">sin concepto</span>}</p>
                        </div>
                        {op.concepto_generico && (
                          <div className="space-y-2">
                            <span className="inline-flex items-center rounded-md bg-amber-500/15 border border-amber-400/30 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                              ⚠ Concepto genérico
                            </span>
                            {op.concepto_sugerido && (
                              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-3 py-2">
                                <p className="text-[10px] text-slate-400 mb-1">Sugerencia IA:</p>
                                <p className="text-[11px] text-slate-200 leading-snug">{op.concepto_sugerido}</p>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); void aplicarSugerenciaConcepto(op); }}
                                  disabled={updatingConceptId === op.id}
                                  className="mt-2 w-full rounded-lg bg-emerald-500 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-400 disabled:opacity-60 transition"
                                >
                                  {updatingConceptId === op.id ? "Aplicando…" : "Aplicar sugerencia"}
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
            {/* ── Panel: Nuevo entregable ── */}
            <div className="rounded-2xl border border-white/10 bg-slate-800/60 backdrop-blur-sm shadow-2xl shadow-black/30 overflow-hidden">
              {/* Header */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 bg-slate-700/40 px-6 py-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-emerald-400">Captura</p>
                  <h3 className="text-base font-bold text-white">Nuevo entregable</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Usa una plantilla sugerida o captura un entregable manual con fecha compromiso.
                  </p>
                </div>
                {selectedOperacion && (
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-slate-400">
                      Operación: <span className="font-bold text-white">{selectedOperacion.proveedor_nombre}</span>
                    </p>
                    <p className="text-sm font-bold text-emerald-300">
                      {formatCurrency(selectedOperacion.monto, selectedOperacion.moneda)}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleExportDossier(selectedOperacion.id)}
                      disabled={exportingId === selectedOperacion.id}
                      title="Descarga el expediente estructurado (PDF/ZIP) para revisiones del SAT."
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition"
                    >
                      <span>🗂️</span>
                      {exportingId === selectedOperacion.id ? "Generando ZIP…" : "Exportar Expediente SAT"}
                    </button>
                  </div>
                )}
              </div>

              {/* Form body */}
              <div className="p-6">
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Columna izquierda */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wide text-slate-300 mb-1.5">
                        Requisito sugerido
                        <span className="ml-2 normal-case font-normal text-slate-500 tracking-normal">
                          ({requisitos.length} plantillas)
                        </span>
                      </label>
                      <RequisitoCombobox
                        requisitos={requisitos}
                        value={form.requirement ?? null}
                        onChange={handleRequirementChange}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wide text-slate-300 mb-1.5">
                        Título <span className="text-red-400">*</span>
                      </label>
                      <input
                        value={form.titulo}
                        onChange={(e) => handleFormChange("titulo", e.target.value)}
                        className="w-full rounded-xl border border-white/15 bg-slate-700/60 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none transition"
                        placeholder="Ej. Informe de avance, evidencia fotográfica…"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wide text-slate-300 mb-1.5">
                        Descripción
                      </label>
                      <textarea
                        value={form.descripcion}
                        onChange={(e) => handleFormChange("descripcion", e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-white/15 bg-slate-700/60 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none transition resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-300 mb-1.5">
                          Fecha compromiso
                        </label>
                        <input
                          type="date"
                          value={form.fecha_compromiso ?? ""}
                          onChange={(e) => handleFormChange("fecha_compromiso", e.target.value)}
                          className="w-full rounded-xl border border-white/15 bg-slate-700/60 px-3 py-2.5 text-sm text-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none transition"
                          style={{ colorScheme: "dark" }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-300 mb-1.5">
                          Requerido
                        </label>
                        <select
                          value={form.requerido ? "1" : "0"}
                          onChange={(e) => handleFormChange("requerido", e.target.value === "1")}
                          className="w-full rounded-xl border border-white/15 bg-slate-700/60 px-3 py-2.5 text-sm text-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none transition"
                        >
                          <option value="1" className="bg-slate-800">Sí, requerido</option>
                          <option value="0" className="bg-slate-800">Opcional</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Columna derecha */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-300 mb-1.5">
                          Código
                        </label>
                        <input
                          value={form.codigo ?? ""}
                          onChange={(e) => handleFormChange("codigo", e.target.value)}
                          className="w-full rounded-xl border border-white/15 bg-slate-700/60 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none transition"
                          placeholder="C-01"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-300 mb-1.5">
                          Tipo de gasto
                        </label>
                        <input
                          value={form.tipo_gasto ?? ""}
                          onChange={(e) => handleFormChange("tipo_gasto", e.target.value)}
                          className="w-full rounded-xl border border-white/15 bg-slate-700/60 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none transition"
                          placeholder="CapEx, OpEx…"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-300 mb-1.5">
                          Orden de compra
                        </label>
                        <input
                          value={form.oc_numero ?? ""}
                          onChange={(e) => handleFormChange("oc_numero", e.target.value)}
                          className="w-full rounded-xl border border-white/15 bg-slate-700/60 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none transition"
                          placeholder="OC-1234"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-300 mb-1.5">
                          Fecha OC
                        </label>
                        <input
                          type="date"
                          value={form.oc_fecha ?? ""}
                          onChange={(e) => handleFormChange("oc_fecha", e.target.value)}
                          className="w-full rounded-xl border border-white/15 bg-slate-700/60 px-3 py-2.5 text-sm text-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none transition"
                          style={{ colorScheme: "dark" }}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wide text-slate-300 mb-1.5">
                        URL de evidencia
                      </label>
                      <input
                        type="url"
                        value={form.oc_archivo_url ?? ""}
                        onChange={(e) => handleFormChange("oc_archivo_url", e.target.value)}
                        className="w-full rounded-xl border border-white/15 bg-slate-700/60 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none transition"
                        placeholder="https://drive.google.com/…"
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        Drive, SharePoint o cualquier URL pública accesible.
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wide text-slate-300 mb-1.5">
                        Comentarios
                      </label>
                      <textarea
                        value={form.comentarios ?? ""}
                        onChange={(e) => handleFormChange("comentarios", e.target.value)}
                        rows={2}
                        className="w-full rounded-xl border border-white/15 bg-slate-700/60 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none transition resize-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                  {!selectedOperacion && (
                    <p className="text-xs text-amber-400">⚠ Selecciona una operación para habilitar el registro.</p>
                  )}
                  {selectedOperacion && <span />}
                  <button
                    type="button"
                    onClick={() => { void submitEntregable(); }}
                    disabled={saving || !selectedOperacion}
                    className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? "Guardando…" : "Agregar entregable"}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Panel: Entregables de la operación ── */}
            <div className="rounded-2xl border border-white/10 bg-slate-800/60 backdrop-blur-sm shadow-2xl shadow-black/30 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 bg-slate-700/40 px-6 py-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-emerald-400">Seguimiento</p>
                  <h3 className="text-base font-bold text-white">Entregables de la operación</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Sube la evidencia y avanza el estado a Entregado / Recibido.</p>
                </div>
                <span className="rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 text-sm font-bold text-emerald-300">
                  {entregables.length}
                </span>
              </div>

              {entregables.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6">
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/3 px-8 py-10 text-center max-w-sm">
                    <p className="text-2xl mb-3">📋</p>
                    <p className="text-sm font-bold text-slate-300">Sin entregables aún</p>
                    <p className="mt-1 text-xs text-slate-500">Registra el primer entregable en el formulario de arriba.</p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-white/8">
                  {entregables
                    .sort((a, b) => estadosOrden.indexOf(a.estado) - estadosOrden.indexOf(b.estado))
                    .map((item, idx) => (
                      <div key={item.id} className={`px-6 py-5 ${idx % 2 === 0 ? "bg-slate-800/30" : "bg-slate-900/20"}`}>
                        <div className="grid gap-5 lg:grid-cols-3">
                          {/* Columna 1: Identificación */}
                          <div className="space-y-2">
                            <div className="flex items-start gap-2">
                              <div className="shrink-0 mt-0.5 h-2 w-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                              <div>
                                <p className="text-sm font-bold text-white leading-tight">{item.titulo}</p>
                                {(item.codigo || item.tipo_gasto) && (
                                  <p className="mt-0.5 text-[11px] font-medium text-slate-400">
                                    {[item.codigo, item.tipo_gasto].filter(Boolean).join(" · ")}
                                  </p>
                                )}
                                {item.descripcion && (
                                  <p className="mt-1 text-[11px] text-slate-400 leading-snug">{item.descripcion}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-bold ${ESTADO_STYLES[item.estado]}`}>
                                {item.estado}
                              </span>
                              {item.vencido && (
                                <span className="inline-flex items-center rounded-md bg-red-500/20 border border-red-400/30 px-2 py-0.5 text-[10px] font-bold text-red-300">
                                  ⚠ Vencido +{item.dias_atraso}d
                                </span>
                              )}
                            </div>
                            {item.fecha_compromiso && (
                              <p className="text-[11px] text-slate-400">
                                <span className="text-slate-500">Compromiso:</span>{" "}
                                <span className="text-slate-200 font-medium">{item.fecha_compromiso}</span>
                              </p>
                            )}
                            {/* Timestamps */}
                            <div className="space-y-0.5">
                              {item.fecha_entregado && (
                                <p className="text-[10px] text-slate-500">✓ Entregado: <span className="text-slate-400">{item.fecha_entregado}</span></p>
                              )}
                              {item.fecha_recepcion && (
                                <p className="text-[10px] text-slate-500">✓ Recibido: <span className="text-slate-400">{item.fecha_recepcion}</span></p>
                              )}
                              {item.recepcion_firmado_por && (
                                <p className="text-[10px] text-slate-500">✍ Firmó: <span className="text-slate-300 font-medium">{item.recepcion_firmado_por}</span></p>
                              )}
                            </div>
                          </div>

                          {/* Columna 2: Evidencia y firma */}
                          <div className="space-y-3">
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                                URL de evidencia
                              </label>
                              <input
                                type="url"
                                value={evidencias[item.id] ?? ""}
                                onChange={(e) => handleEvidenciaChange(item.id, e.target.value)}
                                className="w-full rounded-lg border border-white/15 bg-slate-700/60 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none transition"
                                placeholder="https://drive.google.com/…"
                              />
                              {item.oc_archivo_url && (
                                <a
                                  href={item.oc_archivo_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300"
                                >
                                  ↗ Ver evidencia actual
                                </a>
                              )}
                              {item.evidencia_cargada_en && (
                                <p className="mt-0.5 text-[10px] text-slate-500">🕐 Sellado: {item.evidencia_cargada_en}</p>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                                  Recibido por
                                </label>
                                <input
                                  type="text"
                                  value={firmas[item.id]?.por ?? ""}
                                  onChange={(e) => handleFirmaChange(item.id, "por", e.target.value)}
                                  className="w-full rounded-lg border border-white/15 bg-slate-700/60 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none transition"
                                  placeholder="Nombre completo"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                                  Correo
                                </label>
                                <input
                                  type="email"
                                  value={firmas[item.id]?.email ?? ""}
                                  onChange={(e) => handleFirmaChange(item.id, "email", e.target.value)}
                                  className="w-full rounded-lg border border-white/15 bg-slate-700/60 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none transition"
                                  placeholder="correo@empresa.mx"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Columna 3: Acciones */}
                          <div className="flex flex-col gap-2 justify-center">
                            <button
                              type="button"
                              onClick={() => { void avanzarEstado(item, "ENTREGADO"); }}
                              className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2.5 text-xs font-bold text-amber-300 hover:bg-amber-500/20 hover:border-amber-400/60 transition"
                            >
                              <span>📦</span> Marcar Entregado
                            </button>
                            <button
                              type="button"
                              onClick={() => { void avanzarEstado(item, "RECIBIDO"); }}
                              className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400/60 transition"
                            >
                              <span>✅</span> Marcar Recibido
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal Nueva Operación ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-2xl border border-white/12 bg-slate-800 shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-white/10 bg-slate-700/60 px-6 py-5">
              <div>
                <h3 className="text-lg font-bold text-white">Registrar Operación</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Alta manual de una operación de compra, servicio o gasto.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition text-xl leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={(e) => void handleCreateOperacion(e)} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Empresa */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-300 mb-1.5">
                  Empresa <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  value={newOpForm.empresa || ""}
                  onChange={(e) => setNewOpForm({ ...newOpForm, empresa: Number(e.target.value) })}
                  className="w-full rounded-xl border border-white/15 bg-slate-700/60 px-3 py-3 text-sm text-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none transition"
                >
                  <option value="" className="bg-slate-800 text-slate-300">Selecciona una empresa</option>
                  {empresas.map((empresa) => (
                    <option key={empresa.id} value={empresa.id} className="bg-slate-800 text-white">{empresa.razon_social}</option>
                  ))}
                </select>
              </div>

              {/* Proveedor */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-300 mb-1.5">
                  Proveedor <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  value={newOpForm.proveedor || ""}
                  onChange={(e) => setNewOpForm({ ...newOpForm, proveedor: Number(e.target.value) })}
                  className="w-full rounded-xl border border-white/15 bg-slate-700/60 px-3 py-3 text-sm text-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none transition"
                >
                  <option value="" className="bg-slate-800 text-slate-300">Selecciona un proveedor</option>
                  {proveedores.map((p) => (
                    <option key={p.id} value={p.id} className="bg-slate-800 text-white">{p.razon_social}</option>
                  ))}
                </select>
              </div>

              {/* Tipo + Contrato */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-300 mb-1.5">
                    Tipo de operación <span className="text-red-400">*</span>
                  </label>
                  <select
                    required
                    value={newOpForm.tipo_operacion || "COMPRA"}
                    onChange={(e) => setNewOpForm({ ...newOpForm, tipo_operacion: e.target.value })}
                    className="w-full rounded-xl border border-white/15 bg-slate-700/60 px-3 py-3 text-sm text-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none transition"
                  >
                    <option value="COMPRA" className="bg-slate-800">Compra</option>
                    <option value="SERVICIO" className="bg-slate-800">Servicio</option>
                    <option value="ARRENDAMIENTO" className="bg-slate-800">Arrendamiento</option>
                    <option value="OTRO" className="bg-slate-800">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-300 mb-1.5">
                    Contrato vinculado
                  </label>
                  <select
                    value={newOpForm.contrato || ""}
                    onChange={(e) => setNewOpForm({ ...newOpForm, contrato: e.target.value ? Number(e.target.value) : null })}
                    className="w-full rounded-xl border border-white/15 bg-slate-700/60 px-3 py-3 text-sm text-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none transition"
                  >
                    <option value="" className="bg-slate-800">Sin contrato</option>
                    {contratos.map((c) => (
                      <option key={c.id} value={c.id} className="bg-slate-800">{c.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fecha + Monto */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-300 mb-1.5">
                    Fecha operación <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={newOpForm.fecha_operacion || ""}
                    onChange={(e) => setNewOpForm({ ...newOpForm, fecha_operacion: e.target.value })}
                    className="w-full rounded-xl border border-white/15 bg-slate-700/60 px-3 py-3 text-sm text-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none transition"
                    style={{ colorScheme: "dark" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-300 mb-1.5">
                    Monto sin IVA <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-sm font-bold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={newOpForm.monto || ""}
                      onChange={(e) => setNewOpForm({ ...newOpForm, monto: e.target.value })}
                      className="w-full rounded-xl border border-white/15 bg-slate-700/60 pl-7 pr-3 py-3 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none transition"
                    />
                  </div>
                </div>
              </div>

              {/* UUID CFDI */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-300 mb-1.5">
                  Folio fiscal / UUID CFDI <span className="text-slate-500 font-normal">(Opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="ABCD-1234-EFGH-5678-..."
                  value={newOpForm.uuid_cfdi || ""}
                  onChange={(e) => setNewOpForm({ ...newOpForm, uuid_cfdi: e.target.value })}
                  className="w-full rounded-xl border border-white/15 bg-slate-700/60 px-3 py-3 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none transition font-mono"
                />
              </div>

              {/* Concepto */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-300 mb-1.5">
                  Concepto de la operación <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={newOpForm.concepto || ""}
                  onChange={(e) => setNewOpForm({ ...newOpForm, concepto: e.target.value })}
                  placeholder="Descripción de los servicios o bienes contratados…"
                  className="w-full rounded-xl border border-white/15 bg-slate-700/60 px-3 py-3 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none transition resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 border-t border-white/10 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-400 hover:bg-white/8 hover:text-white transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingOp}
                  className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50"
                >
                  {creatingOp ? "Guardando…" : "Crear Operación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
