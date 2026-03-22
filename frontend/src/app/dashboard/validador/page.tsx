"use client";

import { useCallback, useReducer, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  ChevronDown,
  Clock,
  FileSearch,
  HelpCircle,
  Landmark,
  Loader2,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Trash2,
  type LucideIcon,
  XCircle,
} from "lucide-react";
import Swal from "sweetalert2";

import HelpGuide from "../../../components/HelpGuide";
import { DashboardShell } from "../../../components/DashboardShell";
import { MobileDataList } from "../../../components/MobileDataList";
import { validarCfdiSpei, ValidacionCFDISPEI } from "../../../lib/validador";

const inputCls =
  "w-full rounded-xl border border-[rgba(200,192,177,0.72)] bg-[rgba(255,255,255,0.82)] px-3 py-2 text-sm text-[var(--fiscal-ink)] placeholder:text-[var(--fiscal-muted)] focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)] transition";

const KPI_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  green: { bg: "bg-[var(--fiscal-success-soft)]/80", text: "text-[var(--fiscal-success)]", dot: "bg-[var(--fiscal-success)]" },
  blue: { bg: "bg-[var(--fiscal-accent-soft)]/80", text: "text-[var(--fiscal-accent)]", dot: "bg-[var(--fiscal-accent)]" },
  amber: { bg: "bg-[var(--fiscal-warning-soft)]/80", text: "text-[var(--fiscal-warning)]", dot: "bg-[var(--fiscal-warning)]" },
  red: { bg: "bg-[var(--fiscal-danger-soft)]/80", text: "text-[var(--fiscal-danger)]", dot: "bg-[var(--fiscal-danger)]" },
  gray: { bg: "bg-[rgba(255,255,255,0.78)]", text: "text-[var(--fiscal-muted)]", dot: "bg-[var(--fiscal-muted)]" },
};

function Kpi({ label, value, sub, color = "gray", icon: Icon }: { label: string; value: string | number; sub?: string; color?: string; icon?: LucideIcon }) {
  const colorSet = KPI_COLORS[color] ?? KPI_COLORS.gray;
  return (
    <div className={`surface-panel rounded-panel flex min-w-0 items-center gap-3 px-5 py-4 ${colorSet.bg}`}>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[rgba(255,255,255,0.72)] shadow-panel">
        {Icon ? <Icon className={`h-5 w-5 ${colorSet.text}`} /> : <span className={`inline-block h-2.5 w-2.5 rounded-full ${colorSet.dot}`} />}
      </div>
      <div className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">{label}</span>
        <span className={`block truncate font-display text-3xl font-semibold ${colorSet.text}`}>{value}</span>
        {sub && <span className="block truncate text-xs text-[var(--fiscal-muted)]">{sub}</span>}
      </div>
    </div>
  );
}

function Section({
  badge,
  title,
  defaultOpen = false,
  children,
  right,
}: {
  badge?: string;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="surface-panel overflow-hidden rounded-[1.75rem] shadow-fiscal">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => event.key === "Enter" && setOpen((value) => !value)}
        className="flex cursor-pointer items-center justify-between px-6 py-5 select-none"
      >
        <div className="min-w-0">
          {badge ? <span className="kicker-label">{badge}</span> : null}
          <h2 className="text-lg font-bold leading-tight text-[var(--fiscal-ink)]">{title}</h2>
        </div>
        <div className="flex items-center gap-3">
          {right}
          <ChevronDown className={`h-5 w-5 text-[var(--fiscal-muted)] transition-transform duration-200 ${open ? "" : "-rotate-90"}`} />
        </div>
      </div>
      {open ? <div className="px-6 pb-6">{children}</div> : null}
    </section>
  );
}

const STATUS_MAP: Record<string, { label: string; bg: string; text: string; ring: string; Icon: LucideIcon }> = {
  PENDIENTE: { label: "Pendiente", bg: "bg-[rgba(255,255,255,0.78)]", text: "text-[var(--fiscal-muted)]", ring: "ring-[rgba(200,192,177,0.72)]", Icon: Clock },
  VALIDO: { label: "Válido", bg: "bg-[var(--fiscal-success-soft)]/80", text: "text-[var(--fiscal-success)]", ring: "ring-[rgba(31,122,90,0.18)]", Icon: CheckCircle },
  VALIDADO: { label: "Validado", bg: "bg-[var(--fiscal-success-soft)]/80", text: "text-[var(--fiscal-success)]", ring: "ring-[rgba(31,122,90,0.18)]", Icon: ShieldCheck },
  INVALIDO: { label: "Inválido", bg: "bg-[var(--fiscal-danger-soft)]/80", text: "text-[var(--fiscal-danger)]", ring: "ring-[rgba(160,67,61,0.18)]", Icon: XCircle },
  NO_ENCONTRADO: { label: "No encontrado", bg: "bg-[var(--fiscal-warning-soft)]/80", text: "text-[var(--fiscal-warning)]", ring: "ring-[rgba(166,103,31,0.18)]", Icon: HelpCircle },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_MAP[status] ?? STATUS_MAP.PENDIENTE;
  const { Icon } = config;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${config.bg} ${config.text} ${config.ring}`}>
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}

type HistoryEntry = ValidacionCFDISPEI & {
  id: number;
  timestamp: string;
  inputUuid: string;
  inputRef: string;
  inputMonto: string;
};

type State = {
  uuid: string;
  referencia: string;
  monto: string;
  loading: boolean;
  resultado: ValidacionCFDISPEI | null;
  history: HistoryEntry[];
  nextId: number;
};

const init: State = {
  uuid: "",
  referencia: "",
  monto: "",
  loading: false,
  resultado: null,
  history: [],
  nextId: 1,
};

type Action =
  | { type: "SET_UUID"; payload: string }
  | { type: "SET_REF"; payload: string }
  | { type: "SET_MONTO"; payload: string }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_RESULT"; payload: ValidacionCFDISPEI; entry: Omit<HistoryEntry, "id"> }
  | { type: "CLEAR_FORM" }
  | { type: "CLEAR_HISTORY" }
  | { type: "REMOVE_ENTRY"; id: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_UUID":
      return { ...state, uuid: action.payload };
    case "SET_REF":
      return { ...state, referencia: action.payload };
    case "SET_MONTO":
      return { ...state, monto: action.payload };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_RESULT":
      return {
        ...state,
        loading: false,
        resultado: action.payload,
        history: [{ ...action.entry, id: state.nextId } as HistoryEntry, ...state.history].slice(0, 20),
        nextId: state.nextId + 1,
      };
    case "CLEAR_FORM":
      return { ...state, uuid: "", referencia: "", monto: "", resultado: null };
    case "CLEAR_HISTORY":
      return { ...state, history: [] };
    case "REMOVE_ENTRY":
      return { ...state, history: state.history.filter((entry) => entry.id !== action.id) };
    default:
      return state;
  }
}

export default function ValidadorCFDISPEI() {
  const [state, dispatch] = useReducer(reducer, init);
  const [liveFeedback, setLiveFeedback] = useState<{ tone: "success" | "error" | "info"; message: string } | null>(null);

  const handleValidate = useCallback(async () => {
    if (!state.uuid.trim() && !state.referencia.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Faltan datos",
        text: "Captura al menos el UUID del CFDI o la referencia SPEI.",
        confirmButtonColor: "#2563eb",
      });
      return;
    }

    dispatch({ type: "SET_LOADING", payload: true });

    try {
      const result = await validarCfdiSpei({
        uuid_cfdi: state.uuid.trim() || undefined,
        referencia_spei: state.referencia.trim() || undefined,
        monto: state.monto.trim() || undefined,
      });

      dispatch({
        type: "SET_RESULT",
        payload: result,
        entry: {
          ...result,
          timestamp: new Date().toLocaleString("es-MX"),
          inputUuid: state.uuid.trim(),
          inputRef: state.referencia.trim(),
          inputMonto: state.monto.trim(),
        },
      });

      const cfdiOk = result.cfdi_estatus === "VALIDO";
      const speiOk = result.spei_estatus === "VALIDADO";

      if (cfdiOk && speiOk) {
        setLiveFeedback({ tone: "success", message: "Validación exitosa: CFDI y SPEI verificados." });
        Swal.fire({ icon: "success", title: "¡Validación exitosa!", text: "CFDI válido y SPEI verificado.", timer: 2000, showConfirmButton: false });
      } else if (result.cfdi_estatus === "INVALIDO" || result.spei_estatus === "NO_ENCONTRADO") {
        setLiveFeedback({ tone: "error", message: "Se detectaron discrepancias entre CFDI y SPEI." });
        Swal.fire({ icon: "error", title: "Problema detectado", text: "Revisa los resultados — se encontraron discrepancias.", confirmButtonColor: "#2563eb" });
      } else {
        setLiveFeedback({ tone: "info", message: "Validación terminada. Revisa el resultado." });
      }
    } catch (error) {
      dispatch({ type: "SET_LOADING", payload: false });
      setLiveFeedback({ tone: "error", message: `No se pudo completar la validación: ${(error as Error).message}` });
      Swal.fire({ icon: "error", title: "Error de validación", text: (error as Error).message, confirmButtonColor: "#2563eb" });
    }
  }, [state.monto, state.referencia, state.uuid]);

  const totalValidaciones = state.history.length;
  const validos = state.history.filter((entry) => entry.cfdi_estatus === "VALIDO").length;
  const invalidos = state.history.filter((entry) => entry.cfdi_estatus === "INVALIDO").length;
  const speiOk = state.history.filter((entry) => entry.spei_estatus === "VALIDADO").length;

  return (
    <DashboardShell>
      <div className="space-y-6 pb-12">
        <div className="surface-panel-strong rounded-[1.75rem] p-6 shadow-fiscal">
          <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div>
              <p className="kicker-label">Materialidad</p>
              <h1 className="mt-3 flex items-center gap-3 font-display text-4xl font-semibold text-[var(--fiscal-ink)] sm:text-[2.8rem]">
                Validador CFDI / SPEI
                <FileSearch className="h-6 w-6 text-[var(--fiscal-muted)]" />
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--fiscal-muted)] sm:text-base">
                Verifica si la factura y el flujo bancario sostienen la misma historia. Esta vista debe sentirse como una mesa de contraste probatorio, no solo como un formulario de consulta.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <div className="rounded-full border border-[rgba(45,91,136,0.18)] bg-[var(--fiscal-accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--fiscal-accent)]">
                  Cruce fiscal y bancario en un solo punto
                </div>
                <div className="rounded-full border border-[rgba(143,240,224,0.22)] bg-[rgba(142,231,218,0.12)] px-3 py-2 text-xs font-semibold text-[var(--fiscal-gold)]">
                  Dictamen operativo de materialidad del pago
                </div>
              </div>
            </div>

            <div className="surface-shell rounded-[1.5rem] p-5 text-white">
              <p className="eyebrow-shell">Mesa de contraste</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-white">El sistema contrasta evidencia fiscal, bancaria y monto capturado</h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-[rgba(220,255,250,0.78)]">
                Si uno de los tres elementos falla, la historia económica pierde solidez. La interfaz debe dejar eso claro en segundos.
              </p>
              <div className="mt-4 flex justify-end">
                <HelpGuide
                  steps={[
                    "Captura el UUID del CFDI y/o la referencia SPEI del pago que quieres validar.",
                    "Agrega el monto (opcional) para que el sistema verifique que coincida con los registros.",
                    "Haz clic en Validar. El sistema cruzará los datos contra el SAT y los registros de pago.",
                    "Revisa el estatus: Válido (todo correcto), Inválido (discrepancia), No encontrado (no existe en registros).",
                  ]}
                  concepts={[
                    { term: "UUID CFDI", definition: "Identificador único universal del Comprobante Fiscal Digital por Internet. Es el 'folio fiscal' que valida la autenticidad del CFDI ante el SAT." },
                    { term: "Referencia SPEI", definition: "Clave de rastreo de transferencias interbancarias. Permite vincular un pago bancario con un CFDI específico." },
                    { term: "Validación cruzada", definition: "Proceso de verificar que UUID, referencia SPEI y monto coincidan, demostrando que el pago corresponde a la factura." },
                    { term: "Estatus del CFDI", definition: "Estado fiscal del comprobante ante el SAT: Vigente (válido para deducir) o Cancelado (no deducible)." },
                  ]}
                  tips={[
                    "Valida cada CFDI antes de contabilizarlo — un CFDI cancelado no es deducible.",
                    "La referencia SPEI confirma que el pago se realizó efectivamente al beneficiario correcto.",
                    "Si el resultado es 'No encontrado', verifica que el UUID esté correctamente capturado (sin espacios).",
                    "Usa la validación cruzada UUID + SPEI + monto para máxima certeza de materialidad del pago.",
                  ]}
                />
              </div>
            </div>
          </div>
        </div>

        {liveFeedback && (
          <div
            role={liveFeedback.tone === "error" ? "alert" : "status"}
            aria-live={liveFeedback.tone === "error" ? "assertive" : "polite"}
            className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
              liveFeedback.tone === "success"
                ? "border-[rgba(31,122,90,0.18)] bg-[var(--fiscal-success-soft)] text-[var(--fiscal-success)]"
                : liveFeedback.tone === "error"
                  ? "border-[rgba(160,67,61,0.22)] bg-[var(--fiscal-danger-soft)] text-[var(--fiscal-danger)]"
                  : "border-[rgba(45,91,136,0.18)] bg-[var(--fiscal-accent-soft)] text-[var(--fiscal-accent)]"
            }`}
          >
            {liveFeedback.message}
          </div>
        )}

        {totalValidaciones > 0 ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Validaciones" value={totalValidaciones} sub="en esta sesión" color="gray" icon={Scale} />
            <Kpi label="CFDI válidos" value={validos} sub={totalValidaciones > 0 ? `${Math.round((validos / totalValidaciones) * 100)}%` : "—"} color="green" icon={ShieldCheck} />
            <Kpi label="CFDI inválidos" value={invalidos} sub={invalidos > 0 ? "Requieren atención" : "Sin problemas"} color={invalidos > 0 ? "red" : "green"} icon={AlertTriangle} />
            <Kpi label="SPEI verificados" value={speiOk} sub={totalValidaciones > 0 ? `${Math.round((speiOk / totalValidaciones) * 100)}%` : "—"} color="blue" icon={Landmark} />
          </div>
        ) : null}

        <Section badge="Validar" title="Formulario de validación CFDI / SPEI" defaultOpen>
          <div className="grid gap-6 lg:grid-cols-[1.3fr,1fr]">
            <div className="surface-panel space-y-4 rounded-[1.5rem] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="kicker-label">Captura de contraste</p>
                  <h3 className="mt-1 text-lg font-semibold text-[var(--fiscal-ink)]">Datos de factura y pago</h3>
                </div>
                <div className="rounded-2xl border border-[rgba(45,91,136,0.18)] bg-[var(--fiscal-accent-soft)] p-3 text-[var(--fiscal-accent)]">
                  <Search className="h-5 w-5" />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--fiscal-muted)]">UUID CFDI</label>
                  <input className={inputCls} value={state.uuid} onChange={(event) => dispatch({ type: "SET_UUID", payload: event.target.value })} placeholder="ej. 6BA7B810-9DAD-11D1-80B4-00C04FD430C8" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--fiscal-muted)]">Referencia SPEI</label>
                  <input className={inputCls} value={state.referencia} onChange={(event) => dispatch({ type: "SET_REF", payload: event.target.value })} placeholder="Clave de rastreo del pago" />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--fiscal-muted)]">Monto (opcional)</label>
                  <input className={inputCls} value={state.monto} onChange={(event) => dispatch({ type: "SET_MONTO", payload: event.target.value })} placeholder="0.00" inputMode="decimal" />
                </div>
                <div className="flex items-end gap-2 md:col-span-2">
                  <button type="button" disabled={state.loading} onClick={() => void handleValidate()} className="button-institutional inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50">
                    {state.loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Validando…
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4" />
                        Validar
                      </>
                    )}
                  </button>
                  {state.uuid || state.referencia || state.monto ? (
                    <button type="button" onClick={() => dispatch({ type: "CLEAR_FORM" })} className="rounded-xl border border-[rgba(200,192,177,0.72)] px-3 py-2.5 text-sm text-[var(--fiscal-muted)] transition hover:bg-[rgba(244,242,237,0.88)]" title="Limpiar formulario">
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-[rgba(143,240,224,0.18)] bg-[rgba(142,231,218,0.09)] px-4 py-3 text-xs text-[var(--fiscal-gold)]">
                El cruce ideal confirma tres capas: vigencia fiscal del CFDI, existencia bancaria del SPEI y consistencia del monto capturado.
              </div>
            </div>

            <div className="surface-shell rounded-[1.5rem] p-5 text-white">
              <span className="eyebrow-shell">Resultado</span>

              {!state.resultado && !state.loading ? (
                <div className="mt-6 text-center">
                  <FileSearch className="mx-auto h-12 w-12 text-[rgba(193,243,235,0.4)]" />
                  <p className="mt-3 text-sm text-[rgba(220,255,250,0.78)]">Ingresa datos y ejecuta la validación.</p>
                </div>
              ) : null}

              {state.loading ? (
                <div className="mt-6 text-center">
                  <Loader2 className="mx-auto h-10 w-10 animate-spin text-[var(--fiscal-gold)]" />
                  <p className="mt-3 text-sm text-[rgba(220,255,250,0.78)]">Consultando registros…</p>
                </div>
              ) : null}

              {state.resultado && !state.loading ? (
                <div className="mt-4 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[rgba(195,244,236,0.62)]">CFDI</span>
                      <div><StatusBadge status={state.resultado.cfdi_estatus} /></div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[rgba(195,244,236,0.62)]">SPEI</span>
                      <div><StatusBadge status={state.resultado.spei_estatus} /></div>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-xl border border-[rgba(143,240,224,0.16)] bg-[rgba(8,91,86,0.46)] p-4 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs text-[rgba(195,244,236,0.62)]">UUID</span>
                      <span className="max-w-[200px] truncate font-mono text-xs text-[rgba(255,255,255,0.88)]">{state.resultado.uuid_cfdi || "N/D"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs text-[rgba(195,244,236,0.62)]">Referencia SPEI</span>
                      <span className="max-w-[200px] truncate font-mono text-xs text-[rgba(255,255,255,0.88)]">{state.resultado.referencia_spei || "N/D"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs text-[rgba(195,244,236,0.62)]">Monto</span>
                      <span className="text-xs font-semibold text-[rgba(255,255,255,0.88)]">{state.resultado.monto ? `$${Number(state.resultado.monto).toLocaleString("es-MX")}` : "N/D"}</span>
                    </div>
                    {state.resultado.operacion_id ? (
                      <div className="border-t border-[rgba(200,192,177,0.18)] pt-2">
                        <span className="text-xs font-semibold text-[var(--fiscal-success)]">✓ Guardado en operación #{state.resultado.operacion_id}</span>
                      </div>
                    ) : null}
                  </div>

                  {state.resultado.cfdi_estatus === "VALIDO" && state.resultado.spei_estatus === "VALIDADO" ? (
                    <div className="flex items-start gap-2 rounded-xl border border-[rgba(31,122,90,0.22)] bg-[var(--fiscal-success-soft)] px-4 py-3 text-xs text-[var(--fiscal-success)]">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>CFDI válido ante el SAT y pago SPEI verificado. Esta operación tiene materialidad del pago confirmada.</span>
                    </div>
                  ) : null}

                  {state.resultado.cfdi_estatus === "INVALIDO" ? (
                    <div className="flex items-start gap-2 rounded-xl border border-[rgba(160,67,61,0.22)] bg-[var(--fiscal-danger-soft)] px-4 py-3 text-xs text-[var(--fiscal-danger)]">
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>El CFDI no pasó la validación. Verifica el UUID o consulta directamente en el portal del SAT.</span>
                    </div>
                  ) : null}

                  {state.resultado.spei_estatus === "NO_ENCONTRADO" && state.resultado.cfdi_estatus !== "INVALIDO" ? (
                    <div className="flex items-start gap-2 rounded-xl border border-[rgba(166,103,31,0.22)] bg-[var(--fiscal-warning-soft)] px-4 py-3 text-xs text-[var(--fiscal-warning)]">
                      <HelpCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>La referencia SPEI no fue encontrada. Verifica que la clave de rastreo esté correcta y tenga al menos 6 caracteres.</span>
                    </div>
                  ) : null}

                  {state.resultado.cfdi_estatus !== "INVALIDO" && state.resultado.spei_estatus !== "VALIDADO" && state.resultado.spei_estatus !== "NO_ENCONTRADO" ? (
                    <div className="flex items-start gap-2 rounded-xl border border-[rgba(143,240,224,0.14)] bg-[rgba(255,255,255,0.08)] px-4 py-3 text-xs text-[rgba(220,255,250,0.78)]">
                      <Bell className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>La conciliación bancaria todavía no es concluyente. Revisa si faltan datos de rastreo o si la validación sigue en proceso.</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </Section>

        {state.history.length > 0 ? (
          <Section
            badge="Sesión"
            title="Historial de validaciones"
            defaultOpen
            right={
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  Swal.fire({
                    title: "¿Limpiar historial?",
                    text: "Se borrarán todas las validaciones de esta sesión.",
                    icon: "question",
                    showCancelButton: true,
                    confirmButtonColor: "#2563eb",
                    confirmButtonText: "Sí, limpiar",
                    cancelButtonText: "Cancelar",
                  }).then((result) => {
                    if (result.isConfirmed) {
                      dispatch({ type: "CLEAR_HISTORY" });
                      setLiveFeedback({ tone: "info", message: "Historial de validaciones limpiado." });
                    }
                  });
                }}
                className="flex items-center gap-1 text-xs text-[var(--fiscal-muted)] transition hover:text-[var(--fiscal-danger)]"
              >
                <Trash2 className="h-3.5 w-3.5" /> Limpiar
              </button>
            }
          >
            <MobileDataList
              items={state.history}
              getKey={(entry) => entry.id}
              renderItem={(entry, index) => (
                <article className="rounded-[1.35rem] border border-[rgba(200,192,177,0.72)] bg-white px-4 py-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">
                        Validación #{state.history.length - index}
                      </p>
                      <p className="mt-1 text-xs text-[var(--fiscal-muted)]">{entry.timestamp}</p>
                    </div>
                    <button onClick={() => dispatch({ type: "REMOVE_ENTRY", id: entry.id })} className="rounded-lg p-2 text-[var(--fiscal-muted)]/60 transition hover:bg-[var(--fiscal-danger-soft)] hover:text-[var(--fiscal-danger)]" title="Eliminar">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">UUID CFDI</p>
                      <p className="mt-1 break-all font-mono text-xs text-[var(--fiscal-ink)]">{entry.inputUuid || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">Ref. SPEI</p>
                      <p className="mt-1 break-all font-mono text-xs text-[var(--fiscal-ink)]">{entry.inputRef || "—"}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-[rgba(244,242,237,0.55)] px-3 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">Monto</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--fiscal-ink)]">
                        {entry.inputMonto ? `$${Number(entry.inputMonto).toLocaleString("es-MX")}` : "—"}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 rounded-2xl bg-[rgba(244,242,237,0.55)] px-3 py-3">
                      <div>
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">CFDI</p>
                        <StatusBadge status={entry.cfdi_estatus} />
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">SPEI</p>
                        <StatusBadge status={entry.spei_estatus} />
                      </div>
                    </div>
                  </div>
                </article>
              )}
            />

            <div className="hidden overflow-x-auto rounded-2xl border border-[rgba(200,192,177,0.72)] bg-white lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgba(200,192,177,0.55)] bg-[rgba(244,242,237,0.88)] text-left">
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--fiscal-muted)]">#</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--fiscal-muted)]">UUID CFDI</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--fiscal-muted)]">Ref. SPEI</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--fiscal-muted)]">Monto</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--fiscal-muted)]">CFDI</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--fiscal-muted)]">SPEI</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--fiscal-muted)]">Hora</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {state.history.map((entry, index) => (
                    <tr key={entry.id} className="border-b border-[rgba(200,192,177,0.42)] transition hover:bg-[rgba(244,242,237,0.56)]">
                      <td className="px-4 py-3 text-xs text-[var(--fiscal-muted)]">{state.history.length - index}</td>
                      <td className="max-w-[160px] truncate px-4 py-3 font-mono text-xs text-[var(--fiscal-ink)]">{entry.inputUuid || "—"}</td>
                      <td className="max-w-[120px] truncate px-4 py-3 font-mono text-xs text-[var(--fiscal-ink)]">{entry.inputRef || "—"}</td>
                      <td className="px-4 py-3 text-xs text-[var(--fiscal-ink)]">{entry.inputMonto ? `$${Number(entry.inputMonto).toLocaleString("es-MX")}` : "—"}</td>
                      <td className="px-4 py-3"><StatusBadge status={entry.cfdi_estatus} /></td>
                      <td className="px-4 py-3"><StatusBadge status={entry.spei_estatus} /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--fiscal-muted)]">{entry.timestamp}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => dispatch({ type: "REMOVE_ENTRY", id: entry.id })} className="rounded-lg p-1 text-[var(--fiscal-muted)]/60 transition hover:bg-[var(--fiscal-danger-soft)] hover:text-[var(--fiscal-danger)]" title="Eliminar">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        ) : null}
      </div>
    </DashboardShell>
  );
}
