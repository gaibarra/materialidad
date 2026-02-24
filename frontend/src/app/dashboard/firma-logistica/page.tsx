"use client";

import { useCallback, useEffect, useReducer, useState } from "react";

import { DashboardShell } from "../../../components/DashboardShell";
import { FedatarioModal } from "../../../components/FedatarioModal";
import { alertError, alertSuccess } from "../../../lib/alerts";
import { apiFetch } from "../../../lib/api";
import { fetchFedatarios, Fedatario as FedatarioType } from "../../../lib/fedatarios";
import {
  actualizarFirmaLogistica,
  obtenerFirmaLogistica,
  ContratoLogistica,
  EstadoLogistica,
  FirmaModalidad,
} from "../../../lib/firma";

/* ── Helper types ── */

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type ContratoLite = {
  id: number;
  nombre: string;
  proveedor_nombre?: string | null;
};

/* ── Constants ── */

const MODALIDADES: Array<{ value: FirmaModalidad; label: string; hint: string; icon: string }> = [
  { value: "NOTARIAL", label: "Notarial (fecha cierta)", hint: "Protocolización con fedatario público", icon: "🏛️" },
  { value: "ELECTRONICA", label: "Firma electrónica avanzada", hint: "FEA / plataformas de e-sign", icon: "🔐" },
  { value: "MANUSCRITA", label: "Manuscrita / física", hint: "Firma autógrafa con testigos", icon: "✍️" },
];

const ESTADOS: Array<{ value: EstadoLogistica; label: string }> = [
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "AGENDADA", label: "Agendada" },
  { value: "EN_PROCESO", label: "En proceso" },
  { value: "COMPLETADA", label: "Completada" },
  { value: "CANCELADA", label: "Cancelada" },
];

/* ── State management via useReducer ── */

type FormState = {
  contratoId: string;
  firmaModalidad: FirmaModalidad;
  logisticaEstado: EstadoLogistica;
  fechaCita: string;
  lugarCita: string;
  responsable: string;
  contacto: string;
  fechaCiertaRequerida: boolean;
  fechaCiertaObtenida: boolean;
  fechaRatificacion: string;
  fedatarioId: number | null;
  fedatario: string;
  numeroInstrumento: string;
  archivoNotariadoUrl: string;
  selloTiempoFecha: string;
  selloTiempoProveedor: string;
  selloTiempoAcuse: string;
  registroFolio: string;
  registroUrl: string;
  notas: string;
};

const initialState: FormState = {
  contratoId: "",
  firmaModalidad: "NOTARIAL",
  logisticaEstado: "PENDIENTE",
  fechaCita: "",
  lugarCita: "",
  responsable: "",
  contacto: "",
  fechaCiertaRequerida: true,
  fechaCiertaObtenida: false,
  fechaRatificacion: new Date().toISOString().slice(0, 10),
  fedatarioId: null,
  fedatario: "",
  numeroInstrumento: "",
  archivoNotariadoUrl: "",
  selloTiempoFecha: "",
  selloTiempoProveedor: "",
  selloTiempoAcuse: "",
  registroFolio: "",
  registroUrl: "",
  notas: "",
};

type FormAction =
  | { type: "SET_FIELD"; field: keyof FormState; value: FormState[keyof FormState] }
  | { type: "LOAD_DATA"; data: Partial<FormState> }
  | { type: "RESET" };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "LOAD_DATA":
      return { ...state, ...action.data };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

/* ── Shared input class ── */
const inputCls =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors";

/* ── Small reusable components ── */

function SectionHeader({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: string }) {
  return (
    <div className="flex items-start gap-3 pb-1">
      {icon && <span className="mt-0.5 text-lg">{icon}</span>}
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>
    </div>
  );
}

function Pill({ label, tone = "emerald" }: { label: string; tone?: "emerald" | "sky" | "amber" | "red" }) {
  const palette = {
    emerald: "border-emerald-300 bg-emerald-50 text-emerald-700",
    sky: "border-sky-300 bg-sky-50 text-sky-700",
    amber: "border-amber-300 bg-amber-50 text-amber-700",
    red: "border-red-300 bg-red-50 text-red-700",
  };
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${palette[tone]}`}>{label}</span>
  );
}

function CheckItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
        {done ? "✓" : "·"}
      </span>
      <span className={done ? "text-slate-700" : "text-slate-400"}>{label}</span>
    </div>
  );
}

/* ── Main Page ── */

export default function FirmaLogisticaPage() {
  const [form, dispatch] = useReducer(formReducer, initialState);
  const [contratos, setContratos] = useState<ContratoLite[]>([]);
  const [loadingContratos, setLoadingContratos] = useState(false);
  const [resultado, setResultado] = useState<ContratoLogistica | null>(null);
  const [loading, setLoading] = useState(false);
  const [fedatarioModalOpen, setFedatarioModalOpen] = useState(false);
  const [fedatarioCatalog, setFedatarioCatalog] = useState<FedatarioType[]>([]);

  const set = useCallback(
    <K extends keyof FormState>(field: K, value: FormState[K]) =>
      dispatch({ type: "SET_FIELD", field, value }),
    []
  );

  /* ── Selected fedatario's full record from catalog ── */
  const selectedFedatario = fedatarioCatalog.find((f) => f.id === form.fedatarioId) ?? null;

  /* ── Data loaders ── */

  const loadFedatarioCatalog = useCallback(async () => {
    try {
      const list = await fetchFedatarios();
      setFedatarioCatalog(list);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadContratos = async () => {
      setLoadingContratos(true);
      try {
        const payload = await apiFetch<PaginatedResponse<ContratoLite> | ContratoLite[]>(
          "/api/materialidad/contratos/?ordering=-created_at"
        );
        const list = Array.isArray(payload) ? payload : payload.results ?? [];
        if (mounted) setContratos(list);
      } catch (err) {
        if (mounted) await alertError("No pudimos cargar contratos", (err as Error).message);
      } finally {
        if (mounted) setLoadingContratos(false);
      }
    };

    void loadContratos();
    void loadFedatarioCatalog();
    return () => {
      mounted = false;
    };
  }, [loadFedatarioCatalog]);

  /* ── Auto-load contract data ── */
  const handleContratoChange = useCallback(
    async (id: string) => {
      set("contratoId", id);
      setResultado(null);
      if (!id) return;

      try {
        const data = await obtenerFirmaLogistica(Number(id));
        if (data) {
          dispatch({
            type: "LOAD_DATA",
            data: {
              firmaModalidad: data.firma_modalidad || "NOTARIAL",
              logisticaEstado: data.logistica_estado || "PENDIENTE",
              fechaCita: data.fecha_cita_firma ? data.fecha_cita_firma.slice(0, 16) : "",
              lugarCita: data.lugar_cita || "",
              responsable: data.responsable_logistica || "",
              contacto: data.contacto_responsable || "",
              fechaCiertaRequerida: data.fecha_cierta_requerida ?? true,
              fechaCiertaObtenida: data.fecha_cierta_obtenida ?? false,
              fedatarioId: data.fedatario_id ?? null,
              fedatario: data.fedatario_nombre || "",
              numeroInstrumento: data.numero_instrumento || "",
              fechaRatificacion: data.fecha_ratificacion || "",
              archivoNotariadoUrl: data.archivo_notariado_url || "",
              selloTiempoFecha: data.sello_tiempo_aplicado ? data.sello_tiempo_aplicado.slice(0, 16) : "",
              selloTiempoProveedor: data.sello_tiempo_proveedor || "",
              selloTiempoAcuse: data.sello_tiempo_acuse_url || "",
              registroFolio: data.registro_publico_folio || "",
              registroUrl: data.registro_publico_url || "",
              notas: data.notas_logistica || "",
            },
          });
          setResultado(data);
        }
      } catch {
        /* contract may not have logistics yet */
      }
    },
    [set]
  );

  /* ── Fedatario selection handler ── */
  const handleFedatarioSelect = useCallback(
    (fedatarioIdStr: string) => {
      const fedId = fedatarioIdStr ? Number(fedatarioIdStr) : null;
      set("fedatarioId", fedId);
      const found = fedatarioCatalog.find((f) => f.id === fedId);
      if (found) {
        set("fedatario", found.nombre);
        /* Auto-fill lugar from fedatario data */
        const parts: string[] = [];
        if (found.direccion) {
          parts.push(found.direccion);
        } else {
          if (found.numero_notaria) parts.push(`Notaría ${found.numero_notaria}`);
          if (found.ciudad) parts.push(found.ciudad);
          if (found.estado) parts.push(found.estado);
        }
        if (parts.length) set("lugarCita", parts.join(", "));
        /* Auto-fill contact */
        if (found.telefono) set("contacto", found.telefono);
      } else {
        set("fedatario", "");
      }
    },
    [fedatarioCatalog, set]
  );

  /* ── Submit ── */
  const handleSubmit = async () => {
    const idNumber = Number(form.contratoId);
    if (!idNumber) {
      await alertError("Falta contrato", "Indica el contrato a actualizar");
      return;
    }

    if (form.fechaCiertaObtenida && (!form.fedatario.trim() || !form.numeroInstrumento.trim())) {
      await alertError("Datos faltantes", "Captura fedatario y número de instrumento para fecha cierta");
      return;
    }
    if (form.fechaCiertaObtenida && !form.archivoNotariadoUrl.trim() && !form.selloTiempoAcuse.trim()) {
      await alertError("Acuse requerido", "Agrega el acuse del sello de tiempo o el link al testimonio notariado");
      return;
    }

    // eslint-disable-next-line @next/next/no-assign-module-variable
    const payload: Record<string, unknown> = {
      firma_modalidad: form.firmaModalidad,
      logistica_estado: form.logisticaEstado,
      fecha_cierta_requerida: form.fechaCiertaRequerida,
      fecha_cierta_obtenida: form.fechaCiertaObtenida,
      lugar_cita: form.lugarCita || undefined,
      responsable_logistica: form.responsable || undefined,
      contacto_responsable: form.contacto || undefined,
      fedatario: form.fedatarioId || undefined,
      fedatario_nombre: form.fedatario || undefined,
      numero_instrumento: form.numeroInstrumento || undefined,
      archivo_notariado_url: form.archivoNotariadoUrl || undefined,
      sello_tiempo_aplicado: form.selloTiempoFecha ? new Date(form.selloTiempoFecha).toISOString() : undefined,
      sello_tiempo_proveedor: form.selloTiempoProveedor || undefined,
      sello_tiempo_acuse_url: form.selloTiempoAcuse || undefined,
      registro_publico_folio: form.registroFolio || undefined,
      registro_publico_url: form.registroUrl || undefined,
      notas_logistica: form.notas || undefined,
    };

    if (form.fechaCita) {
      payload.fecha_cita_firma = new Date(form.fechaCita).toISOString();
    }
    if (form.fechaRatificacion) {
      payload.fecha_ratificacion = form.fechaRatificacion;
    }

    setLoading(true);
    try {
      const res = await actualizarFirmaLogistica(idNumber, payload);
      setResultado(res);
      await alertSuccess("Guardado", "Logística de firma actualizada");
    } catch (e) {
      await alertError("No pudimos guardar", (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  /* ── Conditional visibility helpers ── */
  const isNotarial = form.firmaModalidad === "NOTARIAL";
  const isElectronica = form.firmaModalidad === "ELECTRONICA";

  /* ── Checklist progress ── */
  const checklist = [
    { done: !!form.contratoId, label: "Contrato seleccionado" },
    { done: !!form.firmaModalidad, label: "Modalidad definida" },
    { done: isNotarial ? !!form.fedatarioId : true, label: isNotarial ? "Fedatario elegido" : "Firmante/modalidad lista" },
    { done: !!form.fechaCita, label: "Cita agendada" },
    { done: form.fechaCiertaObtenida, label: "Fecha cierta acreditada" },
  ];

  const completedSteps = checklist.filter((c) => c.done).length;

  return (
    <DashboardShell>
      <div className="space-y-10 text-slate-900">
        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          {/* ══════════════════ LEFT COLUMN: Form ══════════════════ */}
          <section className="space-y-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
            {/* ── Header ── */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Fecha cierta</p>
                <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Firma y logística</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Elige primero tu fedatario, después programa la firma y registra la instrumentación.
                </p>
              </div>
            </div>

            {/* ═══ PASO 1 — Contrato + Modalidad ═══ */}
            <div className="space-y-4">
              <SectionHeader icon="📋" title="Contrato y modalidad" subtitle="Selecciona el contrato y cómo se firmará" />
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-slate-500">Contrato</label>
                  <select
                    className={inputCls}
                    value={form.contratoId}
                    onChange={(e) => void handleContratoChange(e.target.value)}
                  >
                    <option value="">Selecciona un contrato</option>
                    {loadingContratos && <option value="">Cargando contratos…</option>}
                    {!loadingContratos && contratos.length === 0 && (
                      <option value="">Sin contratos disponibles</option>
                    )}
                    {contratos.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        #{c.id} · {c.nombre}
                        {c.proveedor_nombre ? ` — ${c.proveedor_nombre}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Modalidad de firma</label>
                  <div className="mt-1 space-y-2">
                    {MODALIDADES.map((m) => (
                      <label
                        key={m.value}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-all ${form.firmaModalidad === m.value
                          ? "border-emerald-400 bg-emerald-50/60 text-emerald-800 shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                          }`}
                      >
                        <input
                          type="radio"
                          name="modalidad"
                          value={m.value}
                          checked={form.firmaModalidad === m.value}
                          onChange={() => set("firmaModalidad", m.value)}
                          className="sr-only"
                        />
                        <span className="text-base">{m.icon}</span>
                        <div>
                          <span className="font-medium">{m.label}</span>
                          <p className="text-[11px] text-slate-400">{m.hint}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ═══ PASO 2 — Fedatario (solo NOTARIAL) ═══ */}
            {isNotarial && (
              <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5">
                <div className="flex items-center justify-between">
                  <SectionHeader icon="🏛️" title="Fedatario público" subtitle="Selecciona al notario o corredor que dará fe" />
                  <button
                    type="button"
                    onClick={() => setFedatarioModalOpen(true)}
                    className="min-h-[44px] rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-600 shadow-sm transition hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    ＋ Gestionar catálogo
                  </button>
                </div>
                <select
                  className={inputCls}
                  value={form.fedatarioId ? String(form.fedatarioId) : ""}
                  onChange={(e) => handleFedatarioSelect(e.target.value)}
                >
                  <option value="">Selecciona un fedatario</option>
                  {fedatarioCatalog.map((f) => (
                    <option key={f.id} value={String(f.id)}>
                      {f.display_label}
                    </option>
                  ))}
                </select>

                {/* ── Fedatario contact card ── */}
                {selectedFedatario && (
                  <div className="mt-2 grid gap-3 rounded-xl border border-emerald-100 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Teléfono</p>
                      <p className="text-sm font-medium text-slate-700">{selectedFedatario.telefono || "N/D"}</p>
                      {selectedFedatario.telefono_alterno && (
                        <p className="text-xs text-slate-500">Alt: {selectedFedatario.telefono_alterno}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Horario</p>
                      <p className="text-sm font-medium text-slate-700">{selectedFedatario.horario_atencion || "Sin especificar"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Email</p>
                      <p className="text-sm font-medium text-slate-700">{selectedFedatario.email || "N/D"}</p>
                    </div>
                    {selectedFedatario.contacto_asistente && (
                      <div className="sm:col-span-2 lg:col-span-3">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Asistente</p>
                        <p className="text-sm text-slate-700">
                          {selectedFedatario.contacto_asistente}
                          {selectedFedatario.contacto_asistente_tel ? ` · ${selectedFedatario.contacto_asistente_tel}` : ""}
                          {selectedFedatario.contacto_asistente_email ? ` · ${selectedFedatario.contacto_asistente_email}` : ""}
                        </p>
                      </div>
                    )}
                    {selectedFedatario.notas && (
                      <div className="sm:col-span-2 lg:col-span-3">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Notas</p>
                        <p className="text-xs text-slate-500 whitespace-pre-line">{selectedFedatario.notas}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ═══ PASO 3 — Logística ═══ */}
            <div className="space-y-4">
              <SectionHeader icon="📅" title="Logística de firma" subtitle="Cuándo, dónde y quién coordina" />
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-slate-500">Estado logístico</label>
                  <select
                    className={inputCls}
                    value={form.logisticaEstado}
                    onChange={(e) => set("logisticaEstado", e.target.value as EstadoLogistica)}
                  >
                    {ESTADOS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Cita para firma</label>
                  <input
                    type="datetime-local"
                    className={inputCls}
                    value={form.fechaCita}
                    onChange={(e) => set("fechaCita", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-slate-500">
                    {isNotarial ? "Lugar de firma / notaría" : "Lugar de firma"}
                  </label>
                  <input
                    className={inputCls}
                    placeholder={isNotarial ? "Se llena al elegir fedatario" : "Domicilio, sala o plataforma"}
                    value={form.lugarCita}
                    onChange={(e) => set("lugarCita", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Responsable logística</label>
                  <input
                    className={inputCls}
                    placeholder="Nombre y rol"
                    value={form.responsable}
                    onChange={(e) => set("responsable", e.target.value)}
                  />
                  <input
                    className={`${inputCls} !mt-2`}
                    placeholder="Contacto (teléfono o email)"
                    value={form.contacto}
                    onChange={(e) => set("contacto", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* ═══ PASO 4 — Fecha cierta y acreditación ═══ */}
            <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/30 p-5">
              <SectionHeader icon="📜" title="Fecha cierta y acreditación" subtitle="Instrumentación notarial, sello de tiempo y registro público" />

              {/* Checkboxes */}
              <div className="flex flex-wrap items-center gap-5 text-sm text-slate-700">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.fechaCiertaRequerida}
                    onChange={(e) => set("fechaCiertaRequerida", e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Requiere fecha cierta
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.fechaCiertaObtenida}
                    onChange={(e) => set("fechaCiertaObtenida", e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Fecha cierta obtenida
                </label>
              </div>

              {/* ── Instrumentación notarial (NOTARIAL) ── */}
              {isNotarial && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Instrumentación notarial</p>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className="text-xs font-medium text-slate-500">Fedatario</label>
                      {form.fedatarioId ? (
                        <div className="mt-1 flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2.5">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">✓</span>
                          <span className="text-sm font-medium text-emerald-800">{form.fedatario}</span>
                          <span className="ml-auto text-[10px] text-emerald-600">Catálogo · ID {form.fedatarioId}</span>
                        </div>
                      ) : (
                        <input
                          className={inputCls}
                          value={form.fedatario}
                          placeholder="Escribe el nombre o selecciónalo arriba ↑"
                          onChange={(e) => set("fedatario", e.target.value)}
                        />
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500">No. de instrumento</label>
                      <input
                        className={inputCls}
                        placeholder="Ej. 15,234"
                        value={form.numeroInstrumento}
                        onChange={(e) => set("numeroInstrumento", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500">Fecha de protocolización</label>
                      <input
                        type="date"
                        className={inputCls}
                        value={form.fechaRatificacion}
                        onChange={(e) => set("fechaRatificacion", e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">URL de testimonio / archivo notariado</label>
                    <input
                      className={inputCls}
                      placeholder="Link seguro al testimonio"
                      value={form.archivoNotariadoUrl}
                      onChange={(e) => set("archivoNotariadoUrl", e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* ── Sello de tiempo (ELECTRONICA o complementario) ── */}
              {(isElectronica || isNotarial) && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                    {isElectronica ? "Sello de tiempo y firma electrónica" : "Sello de tiempo (complementario)"}
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-slate-500">Proveedor del sello</label>
                      <input
                        className={inputCls}
                        placeholder="Ej. TimeStamp Authority"
                        value={form.selloTiempoProveedor}
                        onChange={(e) => set("selloTiempoProveedor", e.target.value)}
                      />
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="datetime-local"
                          className={inputCls}
                          value={form.selloTiempoFecha}
                          onChange={(e) => set("selloTiempoFecha", e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => set("selloTiempoFecha", new Date().toISOString().slice(0, 16))}
                          className="min-h-[44px] whitespace-nowrap rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                        >
                          Marcar ahora
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500">Acuse / hash del sello</label>
                      <input
                        className={inputCls}
                        placeholder="URL o hash del acuse"
                        value={form.selloTiempoAcuse}
                        onChange={(e) => set("selloTiempoAcuse", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Registro público (siempre visible, pero colapsado para manuscrita) ── */}
              {!(!isNotarial && !isElectronica) && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Registro público (opcional)</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-slate-500">Folio de inscripción</label>
                      <input
                        className={inputCls}
                        placeholder="Folio de inscripción"
                        value={form.registroFolio}
                        onChange={(e) => set("registroFolio", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500">URL constancia de registro</label>
                      <input
                        className={inputCls}
                        placeholder="URL a constancia de registro"
                        value={form.registroUrl}
                        onChange={(e) => set("registroUrl", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Notas ── */}
            <div>
              <label className="text-xs font-medium text-slate-500">Notas de logística / instrucciones</label>
              <textarea
                rows={3}
                className={`${inputCls} placeholder-slate-400`}
                placeholder="Mensajería, entregables que deben acompañar la firma, SLA, etc."
                value={form.notas}
                onChange={(e) => set("notas", e.target.value)}
              />
            </div>

            {/* ── Submit ── */}
            <button
              type="button"
              disabled={loading || !form.contratoId}
              onClick={() => void handleSubmit()}
              className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white shadow-md transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Guardando…" : "Guardar logística"}
            </button>
          </section>

          {/* ══════════════════ RIGHT COLUMN: Status ══════════════════ */}
          <aside className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
            {/* ── Progress checklist ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Progreso</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${(completedSteps / checklist.length) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-500">{completedSteps}/{checklist.length}</span>
              </div>
              <div className="mt-3 space-y-2">
                {checklist.map((item, i) => (
                  <CheckItem key={i} done={item.done} label={item.label} />
                ))}
              </div>
            </div>

            {/* ── Saved data ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Estatus guardado</p>
              {!resultado && (
                <p className="mt-2 text-sm text-slate-400">
                  Selecciona un contrato para ver su logística de firma, o completa el formulario y guárdalo.
                </p>
              )}
              {resultado && (
                <div className="mt-2 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill label={`Contrato #${resultado.id}`} />
                    <Pill
                      label={resultado.logistica_estado}
                      tone={
                        resultado.logistica_estado === "COMPLETADA"
                          ? "emerald"
                          : resultado.logistica_estado === "CANCELADA"
                            ? "red"
                            : "sky"
                      }
                    />
                    {resultado.fecha_cierta_obtenida && <Pill label="Fecha cierta ✓" tone="amber" />}
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-400">Modalidad</p>
                    <p className="text-base font-semibold text-slate-900">
                      {MODALIDADES.find((m) => m.value === resultado.firma_modalidad)?.icon}{" "}
                      {MODALIDADES.find((m) => m.value === resultado.firma_modalidad)?.label ?? resultado.firma_modalidad}
                    </p>
                    {resultado.fecha_cita_firma && (
                      <p className="text-sm text-slate-600">
                        Cita: {new Date(resultado.fecha_cita_firma).toLocaleString()}
                      </p>
                    )}
                    {resultado.lugar_cita && (
                      <p className="text-sm text-slate-600">Lugar: {resultado.lugar_cita}</p>
                    )}
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 space-y-1">
                    <p className="text-xs font-medium text-slate-400">Fedatario</p>
                    <p className="text-sm text-slate-900">{resultado.fedatario_nombre || "Sin capturar"}</p>
                    <p className="text-sm text-slate-600">Instrumento: {resultado.numero_instrumento || "N/D"}</p>
                    <p className="text-sm text-slate-600">Fecha: {resultado.fecha_ratificacion || "N/D"}</p>
                    {resultado.archivo_notariado_url && (
                      <a
                        className="text-xs font-medium text-emerald-600 underline hover:text-emerald-700"
                        href={resultado.archivo_notariado_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver testimonio ↗
                      </a>
                    )}
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-400">Responsable</p>
                    <p className="text-sm text-slate-900">{resultado.responsable_logistica || "N/D"}</p>
                    <p className="text-sm text-slate-600">{resultado.contacto_responsable || "Sin contacto"}</p>
                  </div>
                  {resultado.notas_logistica && (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <p className="text-xs font-medium text-slate-400">Notas</p>
                      <p className="text-sm text-slate-600 whitespace-pre-line">{resultado.notas_logistica}</p>
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400">
                    Actualizado: {new Date(resultado.updated_at).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      <FedatarioModal
        open={fedatarioModalOpen}
        onClose={() => setFedatarioModalOpen(false)}
        onChanged={() => void loadFedatarioCatalog()}
      />
    </DashboardShell>
  );
}
