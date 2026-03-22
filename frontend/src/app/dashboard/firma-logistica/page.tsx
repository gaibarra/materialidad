"use client";

import { PasteUrlField } from "../../../components/PasteUrlField";

import { useCallback, useEffect, useReducer, useState } from "react";

import { DashboardShell } from "../../../components/DashboardShell";
import { FedatarioModal } from "../../../components/FedatarioModal";
import { GuiaContador } from "../../../components/GuiaContador";
import { alertError, alertSuccess } from "../../../lib/alerts";
import { apiFetch } from "../../../lib/api";
import {
  fetchFedatarios,
  Fedatario as FedatarioType,
} from "../../../lib/fedatarios";
import {
  actualizarFirmaLogistica,
  obtenerFirmaLogistica,
  ContratoLogistica,
  EstadoLogistica,
  FirmaModalidad,
} from "../../../lib/firma";

/* ═══════════════ tipos locales ═══════════════ */

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

/* ═══════════════ constantes ═══════════════ */

const MODALIDADES: Array<{
  value: FirmaModalidad;
  label: string;
  hint: string;
  icon: string;
}> = [
  {
    value: "NOTARIAL",
    label: "Notarial (fecha cierta)",
    hint: "Protocolización con fedatario público",
    icon: "🏛️",
  },
  {
    value: "ELECTRONICA",
    label: "Firma electrónica avanzada",
    hint: "FEA / plataformas de e-sign",
    icon: "🔐",
  },
  {
    value: "MANUSCRITA",
    label: "Manuscrita / física",
    hint: "Firma autógrafa con testigos",
    icon: "✍️",
  },
];

const ESTADOS: Array<{ value: EstadoLogistica; label: string }> = [
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "AGENDADA", label: "Agendada" },
  { value: "EN_PROCESO", label: "En proceso" },
  { value: "COMPLETADA", label: "Completada" },
  { value: "CANCELADA", label: "Cancelada" },
];

/* ═══════════════ state management (useReducer) ═══════════════ */

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

/* ───────── clase compartida de input ───────── */
const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 transition";

/* ───────── sección colapsable ───────── */
function Section({
  title,
  tag,
  badge,
  defaultOpen = true,
  actions,
  children,
  visible = true,
}: {
  title: string;
  tag: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
  visible?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!visible) return null;
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl shadow-slate-200/60">
      <div className="flex w-full items-center justify-between gap-3 px-6 py-5">
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
            <p className="text-[11px] uppercase tracking-[0.35em] text-blue-500">{tag}</p>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          </div>
          {badge}
          <span
            className={`ml-auto text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          >
            ▾
          </span>
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>
      {open && <div className="border-t border-slate-100 px-6 pb-6 pt-4">{children}</div>}
    </section>
  );
}

/* ───────── KPI card with semantic color ───────── */
const KPI_COLORS = {
  green:  { border: "border-emerald-200", bg: "bg-emerald-50",  value: "text-emerald-700", dot: "bg-emerald-400" },
  amber:  { border: "border-amber-200",   bg: "bg-amber-50",    value: "text-amber-700",   dot: "bg-amber-400"   },
  red:    { border: "border-red-200",     bg: "bg-red-50",      value: "text-red-700",     dot: "bg-red-400"     },
  blue:   { border: "border-blue-200",    bg: "bg-blue-50",     value: "text-blue-700",    dot: "bg-blue-400"    },
  gray:   { border: "border-slate-100",   bg: "bg-slate-50",    value: "text-slate-400",   dot: "bg-slate-300"   },
  none:   { border: "border-slate-100",   bg: "bg-white",       value: "text-slate-900",   dot: ""               },
} as const;
type KpiColor = keyof typeof KPI_COLORS;

function Kpi({
  label,
  value,
  sub,
  color = "none",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: KpiColor;
}) {
  const c = KPI_COLORS[color];
  return (
    <div className={`rounded-2xl border ${c.border} ${c.bg} px-5 py-4 shadow-sm`}>
      <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400 flex items-center gap-1.5">
        {c.dot && <span className={`inline-block h-2 w-2 rounded-full ${c.dot}`} />}
        {label}
      </p>
      <p className={`mt-1 text-2xl font-extrabold ${c.value}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

/* ───────── check item ───────── */
function CheckItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
          done ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400"
        }`}
      >
        {done ? "✓" : "·"}
      </span>
      <span className={done ? "text-slate-700" : "text-slate-400"}>{label}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════ PÁGINA ═══════════════════════════════════════════ */

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
    [],
  );

  /* ── Selected fedatario's full record from catalog ── */
  const selectedFedatario =
    fedatarioCatalog.find((f) => f.id === form.fedatarioId) ?? null;

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
          "/api/materialidad/contratos/?ordering=-created_at",
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
              fechaCita: data.fecha_cita_firma
                ? data.fecha_cita_firma.slice(0, 16)
                : "",
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
              selloTiempoFecha: data.sello_tiempo_aplicado
                ? data.sello_tiempo_aplicado.slice(0, 16)
                : "",
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
    [set],
  );

  /* ── Fedatario selection handler ── */
  const handleFedatarioSelect = useCallback(
    (fedatarioIdStr: string) => {
      const fedId = fedatarioIdStr ? Number(fedatarioIdStr) : null;
      set("fedatarioId", fedId);
      const found = fedatarioCatalog.find((f) => f.id === fedId);
      if (found) {
        set("fedatario", found.nombre);
        const parts: string[] = [];
        if (found.direccion) {
          parts.push(found.direccion);
        } else {
          if (found.numero_notaria) parts.push(`Notaría ${found.numero_notaria}`);
          if (found.ciudad) parts.push(found.ciudad);
          if (found.estado) parts.push(found.estado);
        }
        if (parts.length) set("lugarCita", parts.join(", "));
        if (found.telefono) set("contacto", found.telefono);
      } else {
        set("fedatario", "");
      }
    },
    [fedatarioCatalog, set],
  );

  /* ── Submit ── */
  const handleSubmit = async () => {
    const idNumber = Number(form.contratoId);
    if (!idNumber) {
      await alertError("Falta contrato", "Indica el contrato a actualizar");
      return;
    }
    if (
      form.fechaCiertaObtenida &&
      (!form.fedatario.trim() || !form.numeroInstrumento.trim())
    ) {
      await alertError(
        "Datos faltantes",
        "Captura fedatario y número de instrumento para fecha cierta",
      );
      return;
    }
    if (
      form.fechaCiertaObtenida &&
      !form.archivoNotariadoUrl.trim() &&
      !form.selloTiempoAcuse.trim()
    ) {
      await alertError(
        "Acuse requerido",
        "Agrega el acuse del sello de tiempo o el link al testimonio notariado",
      );
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
      sello_tiempo_aplicado: form.selloTiempoFecha
        ? new Date(form.selloTiempoFecha).toISOString()
        : undefined,
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
  const showSello = isElectronica || isNotarial;
  const showRegistro = isNotarial || isElectronica;

  /* ── Checklist progress ── */
  const checklist = [
    { done: !!form.contratoId, label: "Contrato seleccionado" },
    { done: !!form.firmaModalidad, label: "Modalidad definida" },
    {
      done: isNotarial ? !!form.fedatarioId : true,
      label: isNotarial ? "Fedatario elegido" : "Firmante / modalidad lista",
    },
    { done: !!form.fechaCita, label: "Cita agendada" },
    { done: form.fechaCiertaObtenida, label: "Fecha cierta acreditada" },
  ];
  const completedSteps = checklist.filter((c) => c.done).length;

  /* ── KPI helpers ── */
  const hasContrato = !!form.contratoId;
  const estadoLabel = hasContrato
    ? (ESTADOS.find((e) => e.value === form.logisticaEstado)?.label ?? "—")
    : "Sin contrato";
  const modalidadLabel = hasContrato
    ? (MODALIDADES.find((m) => m.value === form.firmaModalidad)?.label ?? "—")
    : "—";

  const estadoColor: KpiColor = !hasContrato
    ? "gray"
    : form.logisticaEstado === "COMPLETADA"
      ? "green"
      : form.logisticaEstado === "CANCELADA"
        ? "red"
        : form.logisticaEstado === "EN_PROCESO" || form.logisticaEstado === "AGENDADA"
          ? "blue"
          : "amber";

  const modalidadColor: KpiColor = !hasContrato ? "gray" : "blue";

  const fechaCiertaColor: KpiColor = !hasContrato
    ? "gray"
    : form.fechaCiertaObtenida
      ? "green"
      : form.fechaCiertaRequerida
        ? "amber"
        : "gray";

  const progresoColor: KpiColor = !hasContrato
    ? "gray"
    : completedSteps === checklist.length
      ? "green"
      : completedSteps >= 3
        ? "blue"
        : "amber";

  return (
    <DashboardShell>
      <div className="mx-auto max-w-5xl space-y-6">
        {/* ── Encabezado ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-blue-500">
              Fecha cierta
            </p>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Firma y logística
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Programa la firma, elige fedatario y acredita la fecha cierta de
              tus contratos.
            </p>
          </div>
          <GuiaContador
            section="Firma y fecha cierta"
            steps={[
              {
                title: "Selecciona contrato y modalidad",
                description:
                  "Elige el contrato que vas a firmar y define cómo se firmará: <strong>Notarial</strong> (ante fedatario), <strong>Electrónica</strong> (FEA/FIEL) o <strong>Manuscrita</strong> (autógrafa).",
              },
              {
                title: "Elige tu fedatario",
                description:
                  "Si la modalidad es <strong>Notarial</strong>, selecciona al notario o corredor público del catálogo. Se prellenarán automáticamente el lugar, teléfono y datos de contacto.",
              },
              {
                title: "Programa la logística",
                description:
                  "Registra la <strong>fecha y hora</strong> de la cita de firma, el <strong>lugar</strong> (se autollena con la dirección del fedatario) y quién será el <strong>responsable de coordinar</strong>.",
              },
              {
                title: "Acredita la fecha cierta",
                description:
                  "Después de la firma, captura el <strong>número de instrumento</strong>, la <strong>fecha de protocolización</strong> y sube el link al <strong>testimonio notariado</strong> o acuse de sello de tiempo.",
              },
            ]}
            concepts={[
              {
                term: "Fecha cierta",
                definition:
                  "Certeza jurídica de que un contrato existía en determinada fecha. Sin ella, el SAT podría cuestionar la temporalidad del acto.",
              },
              {
                term: "Fedatario público",
                definition:
                  "Notario o corredor público con fe pública para dar fecha cierta a documentos privados (Art. 2246 CC Federal).",
              },
              {
                term: "Protocolización",
                definition:
                  "Acto de incorporar un documento al protocolo del notario, generando un instrumento (escritura) con número consecutivo.",
              },
              {
                term: "Sello de tiempo",
                definition:
                  "Certificado digital emitido por una TSA (Time Stamping Authority) que acredita la existencia de un documento en un momento específico.",
              },
            ]}
            tips={[
              "Siempre registra la firma <strong>antes de deducir</strong> operaciones vinculadas al contrato.",
              "Guarda el testimonio notariado en formato digital con link accesible (Drive, SharePoint, etc.).",
              "Si usas firma electrónica avanzada, guarda el <strong>acuse del sello de tiempo</strong> como respaldo complementario.",
              "Mantén actualizado el <strong>catálogo de fedatarios</strong> con datos de contacto para agilizar futuras firmas.",
            ]}
          />
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi
            label="Estado actual"
            value={estadoLabel}
            sub={hasContrato ? `Contrato #${form.contratoId}` : "Selecciona un contrato para comenzar"}
            color={estadoColor}
          />
          <Kpi
            label="Modalidad"
            value={modalidadLabel}
            sub={hasContrato ? undefined : ""}
            color={modalidadColor}
          />
          <Kpi
            label="Fecha cierta"
            value={!hasContrato ? "—" : form.fechaCiertaObtenida ? "✓ Acreditada" : "Pendiente"}
            sub={!hasContrato ? "" : form.fechaCiertaRequerida ? "Requerida" : "No requerida"}
            color={fechaCiertaColor}
          />
          <Kpi
            label="Progreso"
            value={!hasContrato ? "—" : `${completedSteps}/${checklist.length}`}
            sub={
              !hasContrato
                ? ""
                : completedSteps === checklist.length
                  ? "✓ Proceso completo"
                  : `Falta${checklist.length - completedSteps > 1 ? "n" : ""} ${checklist.length - completedSteps} paso${checklist.length - completedSteps > 1 ? "s" : ""}`
            }
            color={progresoColor}
          />
        </div>

        {/* ═══════════════ SECCIÓN 1 — Contrato y modalidad ═══════════════ */}
        <Section tag="Paso 1" title="Contrato y modalidad" defaultOpen>
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
              <label className="text-xs font-medium text-slate-500">
                Modalidad de firma
              </label>
              <div className="mt-1 space-y-2">
                {MODALIDADES.map((m) => (
                  <label
                    key={m.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-all ${
                      form.firmaModalidad === m.value
                        ? "border-blue-400 bg-blue-50/60 text-blue-800 shadow-sm"
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
        </Section>

        {/* ═══════════════ SECCIÓN 2 — Fedatario (condicional: NOTARIAL) ═══════════════ */}
        <Section
          tag="Paso 2 · Fedatario"
          title="Fedatario público"
          defaultOpen
          visible={isNotarial}
          actions={
            <button
              type="button"
              onClick={() => setFedatarioModalOpen(true)}
              className="min-h-[44px] rounded-xl border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 shadow-sm transition hover:bg-blue-50 hover:text-blue-700"
            >
              ＋ Gestionar catálogo
            </button>
          }
        >
          <div className="space-y-4">
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

            {selectedFedatario && (
              <div className="grid gap-3 rounded-xl border border-blue-100 bg-blue-50/40 p-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                    Teléfono
                  </p>
                  <p className="text-sm font-medium text-slate-700">
                    {selectedFedatario.telefono || "N/D"}
                  </p>
                  {selectedFedatario.telefono_alterno && (
                    <p className="text-xs text-slate-500">
                      Alt: {selectedFedatario.telefono_alterno}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                    Horario
                  </p>
                  <p className="text-sm font-medium text-slate-700">
                    {selectedFedatario.horario_atencion || "Sin especificar"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                    Email
                  </p>
                  <p className="text-sm font-medium text-slate-700">
                    {selectedFedatario.email || "N/D"}
                  </p>
                </div>
                {selectedFedatario.contacto_asistente && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                      Asistente
                    </p>
                    <p className="text-sm text-slate-700">
                      {selectedFedatario.contacto_asistente}
                      {selectedFedatario.contacto_asistente_tel
                        ? ` · ${selectedFedatario.contacto_asistente_tel}`
                        : ""}
                      {selectedFedatario.contacto_asistente_email
                        ? ` · ${selectedFedatario.contacto_asistente_email}`
                        : ""}
                    </p>
                  </div>
                )}
                {selectedFedatario.notas && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                      Notas
                    </p>
                    <p className="whitespace-pre-line text-xs text-slate-500">
                      {selectedFedatario.notas}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>

        {/* ═══════════════ SECCIÓN 3 — Logística de firma ═══════════════ */}
        <Section tag="Paso 3 · Logística" title="Logística de la cita" defaultOpen>
          <div className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-500">
                  Estado logístico
                </label>
                <select
                  className={inputCls}
                  value={form.logisticaEstado}
                  onChange={(e) =>
                    set("logisticaEstado", e.target.value as EstadoLogistica)
                  }
                >
                  {ESTADOS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">
                  Cita para firma
                </label>
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
                  placeholder={
                    isNotarial
                      ? "Se llena al elegir fedatario"
                      : "Domicilio, sala o plataforma"
                  }
                  value={form.lugarCita}
                  onChange={(e) => set("lugarCita", e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">
                  Responsable logística
                </label>
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

            <div>
              <label className="text-xs font-medium text-slate-500">
                Notas de logística / instrucciones
              </label>
              <textarea
                rows={3}
                className={`${inputCls} placeholder-slate-400`}
                placeholder="Mensajería, entregables que deben acompañar la firma, SLA, etc."
                value={form.notas}
                onChange={(e) => set("notas", e.target.value)}
              />
            </div>
          </div>
        </Section>

        {/* ═══════════════ SECCIÓN 4 — Fecha cierta y acreditación ═══════════════ */}
        <Section tag="Paso 4 · Acreditación" title="Fecha cierta y acreditación" defaultOpen>
          <div className="space-y-5">
            {/* Checkboxes */}
            <div className="flex flex-wrap items-center gap-5 text-sm text-slate-700">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.fechaCiertaRequerida}
                  onChange={(e) => set("fechaCiertaRequerida", e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Requiere fecha cierta
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.fechaCiertaObtenida}
                  onChange={(e) => set("fechaCiertaObtenida", e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Fecha cierta obtenida
              </label>
            </div>

            {/* ── Instrumentación notarial (NOTARIAL) ── */}
            {isNotarial && (
              <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/30 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                  Instrumentación notarial
                </p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="text-xs font-medium text-slate-500">
                      Fedatario
                    </label>
                    {form.fedatarioId ? (
                      <div className="mt-1 flex items-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-3 py-2.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                          ✓
                        </span>
                        <span className="text-sm font-medium text-blue-800">
                          {form.fedatario}
                        </span>
                        <span className="ml-auto text-[10px] text-blue-600">
                          Catálogo · ID {form.fedatarioId}
                        </span>
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
                    <label className="text-xs font-medium text-slate-500">
                      No. de instrumento
                    </label>
                    <input
                      className={inputCls}
                      placeholder="Ej. 15,234"
                      value={form.numeroInstrumento}
                      onChange={(e) => set("numeroInstrumento", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">
                      Fecha de protocolización
                    </label>
                    <input
                      type="date"
                      className={inputCls}
                      value={form.fechaRatificacion}
                      onChange={(e) => set("fechaRatificacion", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">
                    URL de testimonio / archivo notariado
                  </label>
                  <PasteUrlField
                    value={form.archivoNotariadoUrl}
                    onChange={(v) => set("archivoNotariadoUrl", v)}
                    placeholder="Link seguro al testimonio"
                    className="mt-1 rounded-xl border border-slate-200 bg-slate-50 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 transition"
                  />
                </div>
              </div>
            )}

            {/* ── Sello de tiempo (ELECTRONICA o complementario) ── */}
            {showSello && (
              <div className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50/30 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">
                  {isElectronica
                    ? "Sello de tiempo y firma electrónica"
                    : "Sello de tiempo (complementario)"}
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-slate-500">
                      Proveedor del sello
                    </label>
                    <input
                      className={inputCls}
                      placeholder="Ej. TimeStamp Authority"
                      value={form.selloTiempoProveedor}
                      onChange={(e) =>
                        set("selloTiempoProveedor", e.target.value)
                      }
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
                        onClick={() =>
                          set(
                            "selloTiempoFecha",
                            new Date().toISOString().slice(0, 16),
                          )
                        }
                        className="min-h-[44px] whitespace-nowrap rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                      >
                        Marcar ahora
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">
                      Acuse / hash del sello
                    </label>
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

            {/* ── Registro público ── */}
            {showRegistro && (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Registro público (opcional)
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-slate-500">
                      Folio de inscripción
                    </label>
                    <input
                      className={inputCls}
                      placeholder="Folio de inscripción"
                      value={form.registroFolio}
                      onChange={(e) => set("registroFolio", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">
                      URL constancia de registro
                    </label>
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
        </Section>

        {/* ═══════════════ SECCIÓN 5 — Progreso y estado guardado ═══════════════ */}
        <Section tag="Resumen" title="Progreso y estado" defaultOpen>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* ── Checklist de progreso ── */}
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                Lista de verificación
              </p>
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-500"
                    style={{
                      width: `${(completedSteps / checklist.length) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  {completedSteps}/{checklist.length}
                </span>
              </div>
              <div className="space-y-2">
                {checklist.map((item, i) => (
                  <CheckItem key={i} done={item.done} label={item.label} />
                ))}
              </div>
            </div>

            {/* ── Estatus guardado ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                Estatus guardado
              </p>
              {!resultado && (
                <p className="text-sm text-slate-400">
                  Selecciona un contrato para ver su logística de firma, o
                  completa el formulario y guárdalo.
                </p>
              )}
              {resultado && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      Contrato #{resultado.id}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        resultado.logistica_estado === "COMPLETADA"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : resultado.logistica_estado === "CANCELADA"
                            ? "border-red-300 bg-red-50 text-red-700"
                            : "border-sky-300 bg-sky-50 text-sky-700"
                      }`}
                    >
                      {resultado.logistica_estado}
                    </span>
                    {resultado.fecha_cierta_obtenida && (
                      <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                        Fecha cierta ✓
                      </span>
                    )}
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-400">Modalidad</p>
                    <p className="text-base font-semibold text-slate-900">
                      {MODALIDADES.find((m) => m.value === resultado.firma_modalidad)?.icon}{" "}
                      {MODALIDADES.find((m) => m.value === resultado.firma_modalidad)
                        ?.label ?? resultado.firma_modalidad}
                    </p>
                    {resultado.fecha_cita_firma && (
                      <p className="text-sm text-slate-600">
                        Cita:{" "}
                        {new Date(resultado.fecha_cita_firma).toLocaleString()}
                      </p>
                    )}
                    {resultado.lugar_cita && (
                      <p className="text-sm text-slate-600">
                        Lugar: {resultado.lugar_cita}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-400">Fedatario</p>
                    <p className="text-sm text-slate-900">
                      {resultado.fedatario_nombre || "Sin capturar"}
                    </p>
                    <p className="text-sm text-slate-600">
                      Instrumento: {resultado.numero_instrumento || "N/D"}
                    </p>
                    <p className="text-sm text-slate-600">
                      Fecha: {resultado.fecha_ratificacion || "N/D"}
                    </p>
                    {resultado.archivo_notariado_url && (
                      <a
                        className="text-xs font-medium text-blue-600 underline hover:text-blue-700"
                        href={resultado.archivo_notariado_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver testimonio ↗
                      </a>
                    )}
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-400">
                      Responsable
                    </p>
                    <p className="text-sm text-slate-900">
                      {resultado.responsable_logistica || "N/D"}
                    </p>
                    <p className="text-sm text-slate-600">
                      {resultado.contacto_responsable || "Sin contacto"}
                    </p>
                  </div>
                  {resultado.notas_logistica && (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <p className="text-xs font-medium text-slate-400">Notas</p>
                      <p className="whitespace-pre-line text-sm text-slate-600">
                        {resultado.notas_logistica}
                      </p>
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400">
                    Actualizado:{" "}
                    {new Date(resultado.updated_at).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* ── Botón guardar ── */}
        <button
          type="button"
          disabled={loading || !form.contratoId}
          onClick={() => void handleSubmit()}
          className="w-full rounded-2xl bg-blue-600 px-4 py-3.5 text-base font-semibold text-white shadow-lg transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Guardando…" : "💾 Guardar logística de firma"}
        </button>
      </div>

      <FedatarioModal
        open={fedatarioModalOpen}
        onClose={() => setFedatarioModalOpen(false)}
        onChanged={() => void loadFedatarioCatalog()}
      />
    </DashboardShell>
  );
}
