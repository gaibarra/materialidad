"use client";

import { PasteUrlField } from "../../../components/PasteUrlField";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRightLeft, Building2, FileSearch, Landmark, RefreshCw, ShieldCheck, Wallet } from "lucide-react";

import { DataCardsSkeleton, InlineEmptyState } from "../../../components/DataState";
import { DashboardShell } from "../../../components/DashboardShell";
import { GuiaContador } from "../../../components/GuiaContador";
import { MobileDataList } from "../../../components/MobileDataList";
import { alertError, alertSuccess } from "../../../lib/alerts";
import {
  CuentaBancaria,
  EstadoCuenta,
  MovimientoBancario,
  OperacionConciliacion,
  createCuenta,
  createEstado,
  createMovimiento,
  fetchCuentas,
  fetchEstados,
  fetchMovimientos,
  fetchConciliaciones,
  MovimientoFilters,
  updateConciliacion,
} from "../../../lib/bancos";

/* ───────── constants ───────── */
const MONEDAS = [
  { value: "MXN", label: "MXN — Peso mexicano" },
  { value: "USD", label: "USD — Dólar" },
  { value: "EUR", label: "EUR — Euro" },
];

const MOV_TIPOS = [
  { value: "ABONO", label: "Abono (ingreso)" },
  { value: "CARGO", label: "Cargo (egreso)" },
];

/* ───────── shared input class ───────── */
const inputCls =
  "w-full rounded-xl border border-[rgba(200,192,177,0.8)] bg-white px-3 py-2 text-sm text-[var(--fiscal-ink)] placeholder:text-[var(--fiscal-muted)]/70 focus:border-[var(--fiscal-accent)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.12)] transition";

/* ───────── helpers ───────── */
const fmtCurrency = (value: string | number, currency = "MXN") =>
  Number(value || 0).toLocaleString("es-MX", { style: "currency", currency, maximumFractionDigits: 2 });

/* ───────── collapsible section ───────── */
function Section({ title, tag, badge, defaultOpen = true, actions, children }: {
  title: string;
  tag: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="surface-panel overflow-hidden rounded-[1.75rem] shadow-fiscal">
      <div className="flex w-full items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpen((p) => !p)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOpen((p) => !p); }}
          className="flex flex-1 cursor-pointer items-center gap-3 text-left"
        >
          <div>
            <p className="kicker-label">{tag}</p>
            <h2 className="font-display text-xl font-semibold text-[var(--fiscal-ink)]">{title}</h2>
          </div>
          {badge}
          <span className={`ml-auto text-[var(--fiscal-muted)] transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>
      {open && <div className="border-t border-[rgba(200,192,177,0.55)] px-4 pb-4 pt-4 sm:px-6 sm:pb-6">{children}</div>}
    </section>
  );
}

/* ═══════════════════════════════════════════ page ═══════════════════════════════════════════ */

export default function FinanzasPage() {
  /* ── state ── */
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [selectedCuentaId, setSelectedCuentaId] = useState<number | null>(null);
  const [estados, setEstados] = useState<EstadoCuenta[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoBancario[]>([]);
  const [conciliaciones, setConciliaciones] = useState<OperacionConciliacion[]>([]);
  const [conciliacionForm, setConciliacionForm] = useState<Record<number, { estado: OperacionConciliacion["estado"]; comentario: string; confianza: string }>>({});
  const [loading, setLoading] = useState(false);
  const [savingCuenta, setSavingCuenta] = useState(false);
  const [savingEstado, setSavingEstado] = useState(false);
  const [savingMov, setSavingMov] = useState(false);
  const [refreshingConciliaciones, setRefreshingConciliaciones] = useState(false);
  const [savingConciliacionId, setSavingConciliacionId] = useState<number | null>(null);
  const [filters, setFilters] = useState<MovimientoFilters>({});
  const [appliedFilters, setAppliedFilters] = useState<MovimientoFilters>({});
  const [showNewCuenta, setShowNewCuenta] = useState(false);
  const [showNewEstado, setShowNewEstado] = useState(false);
  const [showNewMov, setShowNewMov] = useState(false);
  const [cuentaForm, setCuentaForm] = useState({ alias: "", banco: "", numero_cuenta: "", clabe: "", moneda: "MXN" as CuentaBancaria["moneda"], titular: "" });
  const [estadoForm, setEstadoForm] = useState({ periodo_inicio: "", periodo_fin: "", archivo_url: "", saldo_inicial: "", saldo_final: "" });
  const [movForm, setMovForm] = useState({
    fecha: "", monto: "", tipo: "ABONO" as MovimientoBancario["tipo"],
    referencia: "", descripcion: "", spei_referencia: "",
    cuenta_contraparte: "", banco_contraparte: "", nombre_contraparte: "", categoria: "",
  });

  /* ── derived ── */
  const selectedCuenta = useMemo(() => cuentas.find((c) => c.id === selectedCuentaId) ?? null, [cuentas, selectedCuentaId]);

  const stats = useMemo(() => {
    const abonos = movimientos.filter((m) => m.tipo === "ABONO");
    const cargos = movimientos.filter((m) => m.tipo === "CARGO");
    const totalAbonos = abonos.reduce((s, m) => s + Number(m.monto || 0), 0);
    const totalCargos = cargos.reduce((s, m) => s + Number(m.monto || 0), 0);
    const circulares = movimientos.filter((m) => m.es_circular).length;
    const alertas = movimientos.filter((m) => m.alerta_capacidad).length;
    const concAuto = conciliaciones.filter((c) => c.estado === "AUTO").length;
    const concManual = conciliaciones.filter((c) => c.estado === "MANUAL").length;
    const concPendiente = conciliaciones.filter((c) => c.estado === "PENDIENTE").length;
    const concRechazada = conciliaciones.filter((c) => c.estado === "RECHAZADA").length;
    return { totalAbonos, totalCargos, abonos: abonos.length, cargos: cargos.length, circulares, alertas, concAuto, concManual, concPendiente, concRechazada };
  }, [movimientos, conciliaciones]);

  /* ── loaders ── */
  useEffect(() => { void loadData(); }, []);
  useEffect(() => { if (selectedCuentaId) void loadEstados(selectedCuentaId); }, [selectedCuentaId]);
  useEffect(() => { if (selectedCuentaId) void loadMovimientos({ ...appliedFilters, cuenta: selectedCuentaId }); }, [selectedCuentaId, appliedFilters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cuentasData, conc] = await Promise.all([fetchCuentas(), fetchConciliaciones()]);
      setCuentas(cuentasData);
      setConciliaciones(conc);
      setConciliacionForm(conc.reduce<Record<number, { estado: OperacionConciliacion["estado"]; comentario: string; confianza: string }>>((acc, c) => {
        acc[c.id] = { estado: c.estado, comentario: c.comentario || "", confianza: c.confianza || "" };
        return acc;
      }, {}));
      setSelectedCuentaId(cuentasData[0]?.id ?? null);
    } catch (err) {
      void alertError("No pudimos cargar finanzas", (err as Error).message);
    } finally { setLoading(false); }
  };

  const loadEstados = async (cuentaId: number) => {
    try { setEstados(await fetchEstados(cuentaId)); }
    catch (err) { void alertError("No pudimos cargar estados de cuenta", (err as Error).message); }
  };

  const loadMovimientos = async (f: MovimientoFilters = {}) => {
    try { setMovimientos(await fetchMovimientos(f)); }
    catch (err) { void alertError("No pudimos cargar movimientos", (err as Error).message); }
  };

  const refreshConciliaciones = async () => {
    setRefreshingConciliaciones(true);
    try {
      const data = await fetchConciliaciones();
      setConciliaciones(data);
      setConciliacionForm(data.reduce<Record<number, { estado: OperacionConciliacion["estado"]; comentario: string; confianza: string }>>((acc, c) => {
        acc[c.id] = { estado: c.estado, comentario: c.comentario || "", confianza: c.confianza || "" };
        return acc;
      }, {}));
    } catch (err) { void alertError("No pudimos cargar conciliaciones", (err as Error).message); }
    finally { setRefreshingConciliaciones(false); }
  };

  /* ── handlers ── */
  const handleCreateCuenta = async () => {
    if (!cuentaForm.alias && !cuentaForm.numero_cuenta) { await alertError("Alias o cuenta requerido", "Captura al menos un alias o número de cuenta"); return; }
    setSavingCuenta(true);
    try {
      const nueva = await createCuenta({ ...cuentaForm, empresa: selectedCuenta?.empresa || undefined });
      await alertSuccess("Cuenta creada", "Ahora puedes cargar estados y movimientos");
      setShowNewCuenta(false);
      await loadData();
      setSelectedCuentaId(nueva.id);
    } catch (err) { void alertError("No pudimos crear la cuenta", (err as Error).message); }
    finally { setSavingCuenta(false); }
  };

  const handleCreateEstado = async () => {
    if (!selectedCuentaId) { await alertError("Selecciona una cuenta", "Necesitas elegir una cuenta"); return; }
    setSavingEstado(true);
    try {
      await createEstado({
        cuenta: selectedCuentaId, periodo_inicio: estadoForm.periodo_inicio, periodo_fin: estadoForm.periodo_fin,
        archivo_url: estadoForm.archivo_url, saldo_inicial: estadoForm.saldo_inicial || null, saldo_final: estadoForm.saldo_final || null,
      });
      await alertSuccess("Estado guardado", "Adjunta el PDF y captura saldos para conciliación");
      setShowNewEstado(false);
      await loadEstados(selectedCuentaId);
    } catch (err) { void alertError("No pudimos crear el estado", (err as Error).message); }
    finally { setSavingEstado(false); }
  };

  const handleCreateMovimiento = async () => {
    if (!selectedCuentaId) { await alertError("Selecciona una cuenta", "Necesitas elegir una cuenta"); return; }
    if (!movForm.fecha || !movForm.monto) { await alertError("Datos incompletos", "Captura fecha y monto"); return; }
    setSavingMov(true);
    try {
      await createMovimiento({
        cuenta: selectedCuentaId, estado_cuenta: estados[0]?.id,
        fecha: movForm.fecha, monto: movForm.monto, tipo: movForm.tipo,
        referencia: movForm.referencia, descripcion: movForm.descripcion, spei_referencia: movForm.spei_referencia,
        cuenta_contraparte: movForm.cuenta_contraparte, banco_contraparte: movForm.banco_contraparte,
        nombre_contraparte: movForm.nombre_contraparte, categoria: movForm.categoria,
      });
      await alertSuccess("Movimiento registrado", "Intentaremos conciliarlo automáticamente");
      setShowNewMov(false);
      await loadMovimientos({ ...appliedFilters, cuenta: selectedCuentaId });
      await refreshConciliaciones();
    } catch (err) { void alertError("No pudimos registrar el movimiento", (err as Error).message); }
    finally { setSavingMov(false); }
  };

  const handleUpdateConciliacion = async (id: number) => {
    const form = conciliacionForm[id];
    if (!form) return;
    setSavingConciliacionId(id);
    try {
      await updateConciliacion(id, { estado: form.estado, comentario: form.comentario, confianza: form.confianza || null });
      await alertSuccess("Conciliación actualizada", "Se registró el ajuste");
      await refreshConciliaciones();
    } catch (err) { void alertError("No pudimos actualizar la conciliación", (err as Error).message); }
    finally { setSavingConciliacionId(null); }
  };

  /* ═══════════════════ RENDER ═══════════════════ */
  return (
    <DashboardShell>
      <div className="space-y-6 text-slate-900">

        {/* ── HEADER ── */}
        <header className="surface-panel-strong rounded-[1.85rem] p-6 shadow-fiscal">
          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div>
              <p className="kicker-label">Finanzas</p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--fiscal-ink)] sm:text-[2.8rem]">Bancarización y conciliación</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--fiscal-muted)] sm:text-base">
                Registra cuentas, carga estados de cuenta y movimientos bancarios. El sistema concilia automáticamente contra operaciones y alerta sobre
                movimientos circulares o excesos de capacidad operativa.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[rgba(45,91,136,0.18)] bg-[var(--fiscal-accent-soft)]/72 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 shadow-panel">
                      <Wallet className="h-5 w-5 text-[var(--fiscal-accent)]" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--fiscal-accent)]">Trazabilidad</p>
                      <p className="mt-1 text-sm font-medium text-[var(--fiscal-ink)]">Cada saldo y cada SPEI deben poder defenderse con evidencia bancaria visible.</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-[rgba(143,240,224,0.18)] bg-[rgba(142,231,218,0.10)] p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 shadow-panel">
                      <FileSearch className="h-5 w-5 text-[var(--fiscal-gold)]" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--fiscal-gold)]">Lectura fiscal</p>
                      <p className="mt-1 text-sm font-medium text-[var(--fiscal-ink)]">La conciliación no es operativa solamente: es prueba de realidad económica.</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-[rgba(31,122,90,0.18)] bg-[var(--fiscal-success-soft)] p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 shadow-panel">
                      <ShieldCheck className="h-5 w-5 text-[var(--fiscal-success)]" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--fiscal-success)]">Control previo</p>
                      <p className="mt-1 text-sm font-medium text-[var(--fiscal-ink)]">Los desajustes deben verse antes de cerrar mes, antes de pagar y antes de defender deducciones.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="surface-shell rounded-[1.5rem] p-5 text-white">
              <p className="eyebrow-shell">Mesa financiera</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-white">El banco debe leerse como expediente, no como extracto aislado</h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-[rgba(220,255,250,0.78)]">
                Esta vista debe dejar claro qué flujo está bancarizado, qué documento falta y dónde hay señales de circularidad o capacidad insuficiente.
              </p>
              <div className="mt-4 flex justify-end">
                <GuiaContador
                  section="Finanzas — Bancarización y conciliación"
                  steps={[
                    { title: "1. Registra cuentas bancarias", description: "Captura <strong>alias</strong>, banco, número, <strong>CLABE</strong>, moneda y titular. Cada cuenta se vincula a una empresa." },
                    { title: "2. Carga estados de cuenta", description: "Registra <strong>período</strong> (inicio/fin), enlaza el <strong>PDF</strong> y captura saldos inicial y final para la conciliación." },
                    { title: "3. Registra movimientos", description: "Captura cada movimiento: <strong>fecha, monto, tipo</strong> (abono/cargo), referencia SPEI, contraparte y categoría." },
                    { title: "4. Revisa conciliaciones", description: "El sistema <strong>concilia automáticamente</strong>. Revisa alertas de <strong>operaciones circulares</strong> y <strong>capacidad operativa</strong>." },
                  ]}
                  concepts={[
                    { term: "Bancarización", definition: "Obligación de pagos > $2,000 MXN mediante medios electrónicos para deducibilidad (Art. 27-III LISR)." },
                    { term: "Conciliación", definition: "Cruce de movimientos bancarios vs operaciones registradas para verificar que cada pago corresponde a una operación real." },
                    { term: "Operación circular", definition: "Dinero que sale y regresa al mismo contribuyente sin sustancia económica. Indicador de riesgo fiscal." },
                    { term: "SPEI", definition: "Sistema de Pagos Electrónicos Interbancarios del Banco de México. La referencia SPEI identifica cada transferencia." },
                  ]}
                  tips={[
                    "Registra <strong>una cuenta por banco/moneda</strong> para facilitar la conciliación.",
                    "Carga el estado de cuenta <strong>dentro de los 5 primeros días</strong> del mes siguiente.",
                    "Si una conciliación se rechaza, <strong>documenta el motivo</strong> en el campo de comentarios.",
                    "Las alertas de <strong>operaciones circulares</strong> requieren atención inmediata — pueden indicar operaciones simuladas.",
                  ]}
                />
              </div>
            </div>
          </div>

          {/* ── KPI ROW ── */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            <KPI label="Cuentas" value={cuentas.length} color="slate" icon={<Building2 className="h-5 w-5 text-[var(--fiscal-muted)]" />} />
            <KPI label="Abonos" value={fmtCurrency(stats.totalAbonos, selectedCuenta?.moneda)} sub={`${stats.abonos} mov`} color="emerald" icon={<Wallet className="h-5 w-5 text-[var(--fiscal-success)]" />} />
            <KPI label="Cargos" value={fmtCurrency(stats.totalCargos, selectedCuenta?.moneda)} sub={`${stats.cargos} mov`} color="blue" icon={<ArrowRightLeft className="h-5 w-5 text-[var(--fiscal-accent)]" />} />
            <KPI label="Movimientos" value={movimientos.length} color="slate" icon={<ArrowRightLeft className="h-5 w-5 text-[var(--fiscal-muted)]" />} />
            <KPI label="Conciliados" value={stats.concAuto + stats.concManual} sub={`${stats.concAuto} auto / ${stats.concManual} manual`} color="emerald" icon={<ShieldCheck className="h-5 w-5 text-[var(--fiscal-success)]" />} />
            <KPI label="Pendientes" value={stats.concPendiente} color="amber" icon={<FileSearch className="h-5 w-5 text-[var(--fiscal-warning)]" />} />
            <KPI label="Circulares" value={stats.circulares} color={stats.circulares > 0 ? "red" : "slate"} icon={<RefreshCw className="h-5 w-5 text-[var(--fiscal-danger)]" />} />
            <KPI label="Alertas cap." value={stats.alertas} color={stats.alertas > 0 ? "red" : "slate"} icon={<AlertTriangle className="h-5 w-5 text-[var(--fiscal-danger)]" />} />
          </div>
        </header>

        {/* ── SELECTOR DE CUENTA ── */}
        <Section tag="Cuentas bancarias" title="Selecciona o crea una cuenta" badge={
          <span className="rounded-full border border-[rgba(200,192,177,0.72)] bg-[rgba(255,255,255,0.78)] px-3 py-1 text-xs font-semibold text-[var(--fiscal-muted)]">{cuentas.length} cuentas</span>
        } actions={
          <button type="button" onClick={() => setShowNewCuenta((p) => !p)}
            className="button-institutional rounded-full px-4 py-1.5 text-xs font-semibold text-white shadow transition hover:-translate-y-0.5">
            {showNewCuenta ? "Cancelar" : "+ Nueva cuenta"}
          </button>
        }>
          {/* cuentas list */}
          {loading ? (
            <DataCardsSkeleton cards={3} className="xl:grid-cols-3" />
          ) : cuentas.length === 0 ? (
            <InlineEmptyState
              icon={<Wallet className="h-6 w-6" />}
              title="Todavía no hay cuentas bancarias"
              description="Abre la primera bóveda bancaria para iniciar estados de cuenta, movimientos y conciliaciones desde el teléfono."
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {cuentas.map((c) => {
                const active = c.id === selectedCuentaId;
                return (
                  <button key={c.id} type="button" onClick={() => setSelectedCuentaId(c.id)}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${active
                      ? "border-[rgba(45,91,136,0.28)] bg-[var(--fiscal-accent-soft)]/55 shadow-panel"
                      : "border-[rgba(200,192,177,0.72)] bg-white hover:border-[rgba(45,91,136,0.22)] hover:shadow-panel"
                    }`}>
                    <p className="text-sm font-semibold text-[var(--fiscal-ink)]">{c.alias || c.numero_cuenta || "Cuenta"}</p>
                    <p className="text-xs text-[var(--fiscal-muted)]">{c.banco} · {c.moneda} {c.es_principal && <span className="ml-1 text-[var(--fiscal-accent)]">★</span>}</p>
                    {c.clabe && <p className="text-[11px] font-mono text-[var(--fiscal-muted)]">CLABE {c.clabe}</p>}
                  </button>
                );
              })}
            </div>
          )}

          {/* new cuenta form */}
          {showNewCuenta && (
            <div aria-busy={savingCuenta} className="mt-4 rounded-[1.5rem] border border-[rgba(45,91,136,0.18)] bg-[var(--fiscal-accent-soft)]/42 p-4">
              <p className="kicker-label">Nueva cuenta bancaria</p>
              <p className="mb-3 mt-2 text-sm text-[var(--fiscal-muted)]">Registra el instrumento bancario desde el que se sostendrán pagos, cobros y conciliaciones.</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <input className={inputCls} placeholder="Alias (ej. BBVA Nómina)" value={cuentaForm.alias} onChange={(e) => setCuentaForm((p) => ({ ...p, alias: e.target.value }))} />
                <input className={inputCls} placeholder="Banco" value={cuentaForm.banco} onChange={(e) => setCuentaForm((p) => ({ ...p, banco: e.target.value }))} />
                <input className={inputCls} placeholder="Número de cuenta" value={cuentaForm.numero_cuenta} onChange={(e) => setCuentaForm((p) => ({ ...p, numero_cuenta: e.target.value }))} />
                <input className={inputCls} placeholder="CLABE (18 dígitos)" maxLength={18} value={cuentaForm.clabe} onChange={(e) => setCuentaForm((p) => ({ ...p, clabe: e.target.value }))} />
                <select className={inputCls} value={cuentaForm.moneda} onChange={(e) => setCuentaForm((p) => ({ ...p, moneda: e.target.value as CuentaBancaria["moneda"] }))}>
                  {MONEDAS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <input className={inputCls} placeholder="Titular" value={cuentaForm.titular} onChange={(e) => setCuentaForm((p) => ({ ...p, titular: e.target.value }))} />
              </div>
              <div className="mt-3 flex justify-end">
                <button onClick={() => void handleCreateCuenta()} disabled={savingCuenta} aria-disabled={savingCuenta} aria-busy={savingCuenta}
                  className="button-institutional rounded-full px-5 py-2 text-sm font-semibold text-white shadow transition hover:-translate-y-0.5 disabled:opacity-60">
                  {savingCuenta && <RefreshCw className="mr-2 inline h-4 w-4 animate-spin" />}
                  {savingCuenta ? "Guardando…" : "Crear cuenta"}
                </button>
              </div>
            </div>
          )}
        </Section>

        {/* ── ESTADOS DE CUENTA ── */}
        <Section tag="Evidencia documental" title="Estados de cuenta" badge={
          <span className="rounded-full border border-[rgba(200,192,177,0.72)] bg-[rgba(255,255,255,0.78)] px-3 py-1 text-xs font-semibold text-[var(--fiscal-muted)]">{estados.length} períodos</span>
        } defaultOpen={true} actions={
          <button type="button" onClick={() => setShowNewEstado((p) => !p)}
            className="button-institutional rounded-full px-4 py-1.5 text-xs font-semibold text-white shadow transition hover:-translate-y-0.5">
            {showNewEstado ? "Cancelar" : "+ Nuevo estado"}
          </button>
        }>
          {estados.length === 0 && !showNewEstado && (
            <InlineEmptyState
              icon={<Landmark className="h-6 w-6" />}
              title="Esta cuenta aún no tiene estados cargados"
              description="Sube el primer periodo para abrir la trazabilidad documental y que la conciliación tenga base de lectura."
            />
          )}
          {estados.length > 0 && (
            <>
            <MobileDataList
              items={estados}
              getKey={(estado) => estado.id}
              className="mt-1"
              renderItem={(estado) => (
                <article className="rounded-[1.35rem] border border-[rgba(200,192,177,0.72)] bg-white px-4 py-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">Período</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--fiscal-ink)]">
                        {estado.periodo_inicio} → {estado.periodo_fin}
                      </p>
                    </div>
                    {estado.archivo_url ? (
                      <a href={estado.archivo_url} target="_blank" rel="noreferrer" className="rounded-full border border-[rgba(45,91,136,0.18)] bg-[var(--fiscal-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--fiscal-accent)]">
                        PDF ↗
                      </a>
                    ) : (
                      <span className="rounded-full border border-[rgba(200,192,177,0.72)] bg-[rgba(244,242,237,0.55)] px-3 py-1 text-xs font-semibold text-[var(--fiscal-muted)]">
                        Sin archivo
                      </span>
                    )}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-[rgba(244,242,237,0.55)] px-3 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">Saldo inicial</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--fiscal-ink)]">
                        {estado.saldo_inicial ? fmtCurrency(estado.saldo_inicial, selectedCuenta?.moneda) : "—"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[rgba(244,242,237,0.55)] px-3 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">Saldo final</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--fiscal-ink)]">
                        {estado.saldo_final ? fmtCurrency(estado.saldo_final, selectedCuenta?.moneda) : "—"}
                      </p>
                    </div>
                  </div>
                </article>
              )}
            />
            <div className="hidden overflow-x-auto rounded-2xl border border-[rgba(200,192,177,0.72)] bg-white lg:block">
              <table className="min-w-full text-sm">
                <thead className="bg-[rgba(244,242,237,0.88)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--fiscal-muted)]">Período</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--fiscal-muted)]">Saldo inicial</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--fiscal-muted)]">Saldo final</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--fiscal-muted)]">Archivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {estados.map((e) => (
                    <tr key={e.id} className="hover:bg-[rgba(244,242,237,0.45)]">
                      <td className="px-4 py-3 font-medium text-[var(--fiscal-ink)]">{e.periodo_inicio} → {e.periodo_fin}</td>
                      <td className="px-4 py-3 text-[var(--fiscal-muted)]">{e.saldo_inicial ? fmtCurrency(e.saldo_inicial, selectedCuenta?.moneda) : "—"}</td>
                      <td className="px-4 py-3 font-semibold text-[var(--fiscal-ink)]">{e.saldo_final ? fmtCurrency(e.saldo_final, selectedCuenta?.moneda) : "—"}</td>
                      <td className="px-4 py-3">{e.archivo_url ? <a href={e.archivo_url} target="_blank" rel="noreferrer" className="text-[var(--fiscal-accent)] hover:underline">PDF ↗</a> : <span className="text-[var(--fiscal-muted)]">Sin archivo</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}

          {showNewEstado && (
            <div aria-busy={savingEstado} className="mt-4 rounded-[1.5rem] border border-[rgba(45,91,136,0.18)] bg-[var(--fiscal-accent-soft)]/42 p-4">
              <p className="kicker-label">Nuevo estado de cuenta</p>
              <p className="mb-3 mt-2 text-sm text-[var(--fiscal-muted)]">Carga el corte bancario que servirá como base de lectura para la conciliación del periodo.</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--fiscal-muted)]">Inicio del período</label>
                  <input className={inputCls} type="date" value={estadoForm.periodo_inicio} onChange={(e) => setEstadoForm((p) => ({ ...p, periodo_inicio: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--fiscal-muted)]">Fin del período</label>
                  <input className={inputCls} type="date" value={estadoForm.periodo_fin} onChange={(e) => setEstadoForm((p) => ({ ...p, periodo_fin: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--fiscal-muted)]">URL del estado (PDF)</label>
                  <PasteUrlField value={estadoForm.archivo_url} onChange={(v) => setEstadoForm((p) => ({ ...p, archivo_url: v }))} placeholder="https://…"
                    className="w-full rounded-xl border border-[rgba(200,192,177,0.8)] bg-white py-2 text-sm text-[var(--fiscal-ink)] placeholder:text-[var(--fiscal-muted)]/70 focus:border-[var(--fiscal-accent)] focus:ring-2 focus:ring-[rgba(45,91,136,0.12)] focus:outline-none transition" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--fiscal-muted)]">Saldo inicial</label>
                  <input className={inputCls} placeholder="0.00" value={estadoForm.saldo_inicial} onChange={(e) => setEstadoForm((p) => ({ ...p, saldo_inicial: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--fiscal-muted)]">Saldo final</label>
                  <input className={inputCls} placeholder="0.00" value={estadoForm.saldo_final} onChange={(e) => setEstadoForm((p) => ({ ...p, saldo_final: e.target.value }))} />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button onClick={() => void handleCreateEstado()} disabled={savingEstado} aria-disabled={savingEstado} aria-busy={savingEstado}
                  className="button-institutional rounded-full px-5 py-2 text-sm font-semibold text-white shadow transition hover:-translate-y-0.5 disabled:opacity-60">
                  {savingEstado && <RefreshCw className="mr-2 inline h-4 w-4 animate-spin" />}
                  {savingEstado ? "Guardando…" : "Guardar estado"}
                </button>
              </div>
            </div>
          )}
        </Section>

        {/* ── MOVIMIENTOS ── */}
        <Section tag="Transacciones" title="Movimientos bancarios" badge={
          <span className="rounded-full border border-[rgba(200,192,177,0.72)] bg-[rgba(255,255,255,0.78)] px-3 py-1 text-xs font-semibold text-[var(--fiscal-muted)]">{movimientos.length} movimientos</span>
        } actions={
          <button type="button" onClick={() => setShowNewMov((p) => !p)}
            className="button-institutional rounded-full px-4 py-1.5 text-xs font-semibold text-white shadow transition hover:-translate-y-0.5">
            {showNewMov ? "Cancelar" : "+ Nuevo movimiento"}
          </button>
        }>
          {/* filters bar */}
          <div aria-busy={loading} className="mb-4 rounded-2xl border border-[rgba(200,192,177,0.72)] bg-[rgba(244,242,237,0.55)] px-4 py-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fiscal-muted)]">Filtros</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto] lg:items-end">
              <input type="date" className={`${inputCls} !py-2 !text-xs`} value={filters.min_fecha || ""} onChange={(e) => setFilters((p) => ({ ...p, min_fecha: e.target.value }))} />
              <input type="date" className={`${inputCls} !py-2 !text-xs`} value={filters.max_fecha || ""} onChange={(e) => setFilters((p) => ({ ...p, max_fecha: e.target.value }))} />
              <input className={`${inputCls} !py-2 !text-xs`} placeholder="Monto mín" value={filters.min_monto || ""} onChange={(e) => setFilters((p) => ({ ...p, min_monto: e.target.value }))} />
              <input className={`${inputCls} !py-2 !text-xs`} placeholder="Monto máx" value={filters.max_monto || ""} onChange={(e) => setFilters((p) => ({ ...p, max_monto: e.target.value }))} />
              <input className={`${inputCls} !py-2 !text-xs sm:col-span-2 lg:col-span-1`} placeholder="Ref SPEI" value={filters.spei_referencia || ""} onChange={(e) => setFilters((p) => ({ ...p, spei_referencia: e.target.value }))} />
              <button onClick={() => setAppliedFilters({ ...filters })} aria-busy={loading} aria-disabled={loading} className="rounded-full bg-[var(--fiscal-ink)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--fiscal-ink)]/92 sm:col-span-2 lg:col-span-1">
                {loading && <RefreshCw className="mr-1 inline h-3.5 w-3.5 animate-spin" />}
                {loading ? "Aplicando…" : "Aplicar lectura"}
              </button>
            </div>
          </div>

          {/* new mov form */}
          {showNewMov && (
            <div aria-busy={savingMov} className="mb-4 rounded-[1.5rem] border border-[rgba(45,91,136,0.18)] bg-[var(--fiscal-accent-soft)]/42 p-4">
              <p className="kicker-label">Nuevo movimiento</p>
              <p className="mb-3 mt-2 text-sm text-[var(--fiscal-muted)]">Registra el movimiento con suficiente detalle para que la conciliación pueda defender el flujo financiero.</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--fiscal-muted)]">Fecha</label>
                  <input className={inputCls} type="date" value={movForm.fecha} onChange={(e) => setMovForm((p) => ({ ...p, fecha: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--fiscal-muted)]">Monto</label>
                  <input className={inputCls} placeholder="0.00" value={movForm.monto} onChange={(e) => setMovForm((p) => ({ ...p, monto: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--fiscal-muted)]">Tipo</label>
                  <select className={inputCls} value={movForm.tipo} onChange={(e) => setMovForm((p) => ({ ...p, tipo: e.target.value as MovimientoBancario["tipo"] }))}>
                    {MOV_TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--fiscal-muted)]">Referencia</label>
                  <input className={inputCls} placeholder="Referencia" value={movForm.referencia} onChange={(e) => setMovForm((p) => ({ ...p, referencia: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--fiscal-muted)]">Descripción</label>
                  <input className={inputCls} placeholder="Descripción" value={movForm.descripcion} onChange={(e) => setMovForm((p) => ({ ...p, descripcion: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--fiscal-muted)]">Ref. SPEI</label>
                  <input className={inputCls} placeholder="Referencia SPEI" value={movForm.spei_referencia} onChange={(e) => setMovForm((p) => ({ ...p, spei_referencia: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--fiscal-muted)]">Cuenta contraparte</label>
                  <input className={inputCls} placeholder="Cuenta contraparte" value={movForm.cuenta_contraparte} onChange={(e) => setMovForm((p) => ({ ...p, cuenta_contraparte: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--fiscal-muted)]">Banco contraparte</label>
                  <input className={inputCls} placeholder="Banco contraparte" value={movForm.banco_contraparte} onChange={(e) => setMovForm((p) => ({ ...p, banco_contraparte: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--fiscal-muted)]">Nombre contraparte</label>
                  <input className={inputCls} placeholder="Nombre contraparte" value={movForm.nombre_contraparte} onChange={(e) => setMovForm((p) => ({ ...p, nombre_contraparte: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--fiscal-muted)]">Categoría</label>
                  <input className={inputCls} placeholder="Categoría" value={movForm.categoria} onChange={(e) => setMovForm((p) => ({ ...p, categoria: e.target.value }))} />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button onClick={() => void handleCreateMovimiento()} disabled={savingMov} aria-disabled={savingMov} aria-busy={savingMov}
                  className="button-institutional rounded-full px-5 py-2 text-sm font-semibold text-white shadow transition hover:-translate-y-0.5 disabled:opacity-60">
                  {savingMov && <RefreshCw className="mr-2 inline h-4 w-4 animate-spin" />}
                  {savingMov ? "Guardando…" : "Registrar movimiento"}
                </button>
              </div>
            </div>
          )}

          {/* movimientos table */}
          {loading && movimientos.length === 0 ? (
            <DataCardsSkeleton cards={3} className="lg:hidden" />
          ) : (
            <MobileDataList
              items={movimientos}
              getKey={(movimiento) => movimiento.id}
              empty={(
                <InlineEmptyState
                  icon={<ArrowRightLeft className="h-6 w-6" />}
                  title="Todavía no hay movimientos para esta cuenta"
                  description="Registra el primer flujo para abrir la conciliación, detectar alertas y revisar los cruces desde móvil."
                />
              )}
              renderItem={(movimiento) => (
                <article className="rounded-[1.35rem] border border-[rgba(200,192,177,0.72)] bg-white px-4 py-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">Fecha</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--fiscal-ink)]">{movimiento.fecha}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${movimiento.tipo === "ABONO" ? "bg-[var(--fiscal-success-soft)] text-[var(--fiscal-success)]" : "bg-[var(--fiscal-danger-soft)] text-[var(--fiscal-danger)]"}`}>
                        {movimiento.tipo}
                      </span>
                      <p className={`mt-2 text-base font-semibold ${movimiento.tipo === "ABONO" ? "text-emerald-700" : "text-red-600"}`}>
                        {movimiento.tipo === "CARGO" ? "−" : "+"}{fmtCurrency(movimiento.monto, selectedCuenta?.moneda)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">Descripción</p>
                      <p className="mt-1 text-sm text-[var(--fiscal-ink)]">{movimiento.descripcion || movimiento.referencia || "—"}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">SPEI</p>
                        <p className="mt-1 font-mono text-xs text-[var(--fiscal-muted)]">{movimiento.spei_referencia || "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">Contraparte</p>
                        <p className="mt-1 text-sm text-[var(--fiscal-muted)]">{movimiento.nombre_contraparte || movimiento.banco_contraparte || "—"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {movimiento.es_circular && <span className="rounded-full bg-[var(--fiscal-warning-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--fiscal-warning)]">Circular</span>}
                    {movimiento.alerta_capacidad && <span className="rounded-full bg-[var(--fiscal-danger-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--fiscal-danger)]">Capacidad</span>}
                    {!movimiento.es_circular && !movimiento.alerta_capacidad && <span className="rounded-full bg-[var(--fiscal-success-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--fiscal-success)]">En orden</span>}
                  </div>
                </article>
              )}
            />
          )}

          <div className="hidden overflow-x-auto rounded-2xl border border-[rgba(200,192,177,0.72)] bg-white lg:block">
            <table className="min-w-full text-sm">
              <thead className="bg-[rgba(244,242,237,0.88)]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--fiscal-muted)]">Fecha</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--fiscal-muted)]">Monto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--fiscal-muted)]">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--fiscal-muted)]">Descripción</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--fiscal-muted)]">SPEI</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[var(--fiscal-muted)]">Alertas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movimientos.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--fiscal-muted)]">Todavía no hay movimientos para esta cuenta. Registra el primer flujo para abrir la conciliación.</td></tr>
                )}
                {movimientos.map((m) => (
                  <tr key={m.id} className="hover:bg-[rgba(244,242,237,0.45)]">
                    <td className="px-4 py-3 text-[var(--fiscal-muted)]">{m.fecha}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${m.tipo === "ABONO" ? "text-emerald-700" : "text-red-600"}`}>
                      {m.tipo === "CARGO" ? "−" : "+"}{fmtCurrency(m.monto, selectedCuenta?.moneda)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${m.tipo === "ABONO" ? "bg-[var(--fiscal-success-soft)] text-[var(--fiscal-success)]" : "bg-[var(--fiscal-danger-soft)] text-[var(--fiscal-danger)]"}`}>
                        {m.tipo}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-[var(--fiscal-muted)]">{m.descripcion || m.referencia || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--fiscal-muted)]">{m.spei_referencia || "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {m.es_circular && <span className="rounded-full bg-[var(--fiscal-warning-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--fiscal-warning)]">Circular</span>}
                        {m.alerta_capacidad && <span className="rounded-full bg-[var(--fiscal-danger-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--fiscal-danger)]">Capacidad</span>}
                        {!m.es_circular && !m.alerta_capacidad && <span className="text-xs text-[var(--fiscal-success)]">En orden</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── CONCILIACIONES ── */}
        <Section tag="Conciliación" title="Cruce operaciones ↔ movimientos" badge={
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[rgba(31,122,90,0.22)] bg-[var(--fiscal-success-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--fiscal-success)]">{stats.concAuto + stats.concManual} OK</span>
            {stats.concPendiente > 0 && <span className="rounded-full border border-[rgba(166,103,31,0.22)] bg-[var(--fiscal-warning-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--fiscal-warning)]">{stats.concPendiente} pend.</span>}
            {stats.concRechazada > 0 && <span className="rounded-full border border-[rgba(160,67,61,0.22)] bg-[var(--fiscal-danger-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--fiscal-danger)]">{stats.concRechazada} rech.</span>}
          </div>
        } actions={
          <button type="button" onClick={() => void refreshConciliaciones()} aria-busy={refreshingConciliaciones} aria-disabled={refreshingConciliaciones}
            className="rounded-full border border-[rgba(200,192,177,0.72)] bg-white px-4 py-1.5 text-xs font-semibold text-[var(--fiscal-ink)] shadow-sm transition hover:border-[rgba(45,91,136,0.22)] hover:text-[var(--fiscal-accent)]">
            {refreshingConciliaciones && <RefreshCw className="mr-1 inline h-3.5 w-3.5 animate-spin" />}
            {refreshingConciliaciones ? "Refrescando…" : "Refrescar"}
          </button>
        }>
          {conciliaciones.length === 0 && (
            <InlineEmptyState
              icon={<ShieldCheck className="h-6 w-6" />}
              title="Aún no hay conciliaciones generadas"
              description="Cuando existan movimientos y operaciones relacionadas, esta mesa mostrará los cruces, su confianza y las alertas pendientes."
            />
          )}

          <div className="space-y-3">
            {conciliaciones.map((c) => {
              const colorMap: Record<string, string> = {
                AUTO: "border-emerald-200 bg-emerald-50/60",
                MANUAL: "border-blue-200 bg-blue-50/60",
                RECHAZADA: "border-red-200 bg-red-50/60",
                PENDIENTE: "border-amber-200 bg-amber-50/60",
              };
              const badgeMap: Record<string, string> = {
                AUTO: "bg-emerald-100 text-emerald-800",
                MANUAL: "bg-blue-100 text-blue-800",
                RECHAZADA: "bg-red-100 text-red-800",
                PENDIENTE: "bg-amber-100 text-amber-800",
              };
              const form = conciliacionForm[c.id] || { estado: c.estado, comentario: c.comentario || "", confianza: c.confianza || "" };
              return (
                <div key={c.id} aria-busy={savingConciliacionId === c.id} className={`rounded-2xl border p-4 ${colorMap[c.estado] || "border-[rgba(200,192,177,0.72)] bg-white"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--fiscal-ink)]">Operación #{c.operacion} ↔ Movimiento #{c.movimiento}</p>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-[var(--fiscal-muted)]">
                        <span>Monto op: <strong className="text-[var(--fiscal-ink)]">{fmtCurrency(c.operacion_monto, selectedCuenta?.moneda)}</strong></span>
                        <span>Monto mov: <strong className="text-[var(--fiscal-ink)]">{fmtCurrency(c.movimiento_monto, selectedCuenta?.moneda)}</strong></span>
                        <span>Confianza: <strong className="text-[var(--fiscal-ink)]">{c.confianza ?? "—"}</strong></span>
                      </div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${badgeMap[c.estado] || "bg-slate-100 text-slate-700"}`}>{c.estado}</span>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    <select value={form.estado}
                      onChange={(e) => setConciliacionForm((p) => ({ ...p, [c.id]: { ...form, estado: e.target.value as OperacionConciliacion["estado"] } }))}
                      className={inputCls}>
                      <option value="PENDIENTE">Pendiente</option>
                      <option value="AUTO">Auto</option>
                      <option value="MANUAL">Manual</option>
                      <option value="RECHAZADA">Rechazada</option>
                    </select>
                    <input className={inputCls} placeholder="Confianza (0-1)" value={form.confianza}
                      onChange={(e) => setConciliacionForm((p) => ({ ...p, [c.id]: { ...form, confianza: e.target.value } }))} />
                    <input className={`${inputCls} sm:col-span-2`} placeholder="Comentario" value={form.comentario}
                      onChange={(e) => setConciliacionForm((p) => ({ ...p, [c.id]: { ...form, comentario: e.target.value } }))} />
                  </div>
                  <div className="mt-2 flex justify-end">
                    <button onClick={() => void handleUpdateConciliacion(c.id)} disabled={savingConciliacionId === c.id} aria-disabled={savingConciliacionId === c.id} aria-busy={savingConciliacionId === c.id}
                      className="rounded-full bg-[var(--fiscal-ink)] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--fiscal-ink)]/92">
                      {savingConciliacionId === c.id && <RefreshCw className="mr-1 inline h-3.5 w-3.5 animate-spin" />}
                      {savingConciliacionId === c.id ? "Guardando…" : "Guardar criterio"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      </div>
    </DashboardShell>
  );
}

/* ═══════════════════ KPI card ═══════════════════ */
function KPI({ label, value, sub, color = "slate", icon }: { label: string; value: React.ReactNode; sub?: string; color?: string; icon?: React.ReactNode }) {
  const map: Record<string, string> = {
    slate: "border-[rgba(200,192,177,0.72)] bg-[rgba(244,242,237,0.62)]",
    blue: "border-[rgba(45,91,136,0.18)] bg-[var(--fiscal-accent-soft)]/60",
    emerald: "border-[rgba(31,122,90,0.18)] bg-[var(--fiscal-success-soft)]",
    amber: "border-[rgba(166,103,31,0.18)] bg-[var(--fiscal-warning-soft)]",
    red: "border-[rgba(160,67,61,0.18)] bg-[var(--fiscal-danger-soft)]",
  };
  const txtMap: Record<string, string> = {
    slate: "text-[var(--fiscal-ink)]",
    blue: "text-[var(--fiscal-accent)]",
    emerald: "text-[var(--fiscal-success)]",
    amber: "text-[var(--fiscal-warning)]",
    red: "text-[var(--fiscal-danger)]",
  };
  const subTxtMap: Record<string, string> = {
    slate: "text-[var(--fiscal-muted)]",
    blue: "text-[var(--fiscal-accent)]/80",
    emerald: "text-[var(--fiscal-success)]/80",
    amber: "text-[var(--fiscal-warning)]/80",
    red: "text-[var(--fiscal-danger)]/80",
  };
  return (
    <div className={`rounded-2xl border px-3 py-3 ${map[color] || map.slate}`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className={`text-lg font-bold leading-tight ${txtMap[color] || txtMap.slate}`}>{value}</p>
          <p className={`mt-0.5 text-[10px] font-medium uppercase tracking-wide ${subTxtMap[color] || subTxtMap.slate}`}>{label}</p>
        </div>
        {icon && <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 shadow-panel">{icon}</div>}
      </div>
      {sub && <p className={`text-[10px] ${subTxtMap[color] || subTxtMap.slate}`}>{sub}</p>}
    </div>
  );
}
