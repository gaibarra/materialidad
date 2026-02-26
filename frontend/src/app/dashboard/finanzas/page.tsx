"use client";
import { PasteUrlField } from "../../../components/PasteUrlField";

import { useEffect, useMemo, useState } from "react";

import { DashboardShell } from "../../../components/DashboardShell";
import { GuiaContador } from "../../../components/GuiaContador";
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

const MONEDAS = [
  { value: "MXN", label: "MXN" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
];

const MOV_TIPOS = [
  { value: "ABONO", label: "Abono" },
  { value: "CARGO", label: "Cargo" },
];

export default function FinanzasPage() {
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
  const [filters, setFilters] = useState<MovimientoFilters>({});
  const [appliedFilters, setAppliedFilters] = useState<MovimientoFilters>({});
  const [cuentaForm, setCuentaForm] = useState({ alias: "", banco: "", numero_cuenta: "", clabe: "", moneda: "MXN" as CuentaBancaria["moneda"], titular: "" });
  const [estadoForm, setEstadoForm] = useState({ periodo_inicio: "", periodo_fin: "", archivo_url: "", saldo_inicial: "", saldo_final: "" });
  const [movForm, setMovForm] = useState({
    fecha: "",
    monto: "",
    tipo: "ABONO" as MovimientoBancario["tipo"],
    referencia: "",
    descripcion: "",
    spei_referencia: "",
    cuenta_contraparte: "",
    banco_contraparte: "",
    nombre_contraparte: "",
    categoria: "",
  });

  const selectedCuenta = useMemo(() => cuentas.find((c) => c.id === selectedCuentaId) ?? null, [cuentas, selectedCuentaId]);

  const formatCurrency = (value: string, currency?: string) => {
    const number = Number(value || 0);
    return number.toLocaleString("es-MX", { style: "currency", currency: currency || "MXN", maximumFractionDigits: 2 });
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!selectedCuentaId) return;
    void loadEstados(selectedCuentaId);
  }, [selectedCuentaId]);

  useEffect(() => {
    if (!selectedCuentaId) return;
    void loadMovimientos({ ...appliedFilters, cuenta: selectedCuentaId });
  }, [selectedCuentaId, appliedFilters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cuentasData, conc] = await Promise.all([fetchCuentas(), fetchConciliaciones()]);
      setCuentas(cuentasData);
      setConciliaciones(conc);
      const first = cuentasData[0]?.id ?? null;
      setSelectedCuentaId(first);
    } catch (err) {
      void alertError("No pudimos cargar finanzas", (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadEstados = async (cuentaId: number) => {
    try {
      const data = await fetchEstados(cuentaId);
      setEstados(data);
    } catch (err) {
      void alertError("No pudimos cargar estados de cuenta", (err as Error).message);
    }
  };

  const loadMovimientos = async (f: MovimientoFilters = {}) => {
    try {
      const data = await fetchMovimientos(f);
      setMovimientos(data);
    } catch (err) {
      void alertError("No pudimos cargar movimientos", (err as Error).message);
    }
  };

  const refreshConciliaciones = async () => {
    try {
      const data = await fetchConciliaciones();
      setConciliaciones(data);
      setConciliacionForm(
        data.reduce<Record<number, { estado: OperacionConciliacion["estado"]; comentario: string; confianza: string }>>((acc, c) => {
          acc[c.id] = { estado: c.estado, comentario: c.comentario || "", confianza: c.confianza || "" };
          return acc;
        }, {})
      );
    } catch (err) {
      void alertError("No pudimos cargar conciliaciones", (err as Error).message);
    }
  };

  const handleCreateCuenta = async () => {
    if (!cuentaForm.alias && !cuentaForm.numero_cuenta) {
      await alertError("Alias o cuenta requerido", "Captura al menos un alias o número de cuenta");
      return;
    }
    setSavingCuenta(true);
    try {
      const nueva = await createCuenta({ ...cuentaForm, empresa: selectedCuenta?.empresa || undefined });
      await alertSuccess("Cuenta creada", "Ahora puedes cargar estados y movimientos");
      await loadData();
      setSelectedCuentaId(nueva.id);
    } catch (err) {
      void alertError("No pudimos crear la cuenta", (err as Error).message);
    } finally {
      setSavingCuenta(false);
    }
  };

  const handleCreateEstado = async () => {
    if (!selectedCuentaId) {
      await alertError("Selecciona una cuenta", "Necesitas elegir una cuenta");
      return;
    }
    setSavingEstado(true);
    try {
      await createEstado({
        cuenta: selectedCuentaId,
        periodo_inicio: estadoForm.periodo_inicio,
        periodo_fin: estadoForm.periodo_fin,
        archivo_url: estadoForm.archivo_url,
        saldo_inicial: estadoForm.saldo_inicial || null,
        saldo_final: estadoForm.saldo_final || null,
      });
      await alertSuccess("Estado guardado", "Adjunta el PDF y captura saldos para conciliación");
      // TODO: cuando haya upload backend, reemplazar por subida directa
      await loadEstados(selectedCuentaId);
    } catch (err) {
      void alertError("No pudimos crear el estado", (err as Error).message);
    } finally {
      setSavingEstado(false);
    }
  };

  const handleCreateMovimiento = async () => {
    if (!selectedCuentaId) {
      await alertError("Selecciona una cuenta", "Necesitas elegir una cuenta");
      return;
    }
    if (!movForm.fecha || !movForm.monto) {
      await alertError("Datos incompletos", "Captura fecha y monto");
      return;
    }
    setSavingMov(true);
    try {
      await createMovimiento({
        cuenta: selectedCuentaId,
        estado_cuenta: estados[0]?.id,
        fecha: movForm.fecha,
        monto: movForm.monto,
        tipo: movForm.tipo,
        referencia: movForm.referencia,
        descripcion: movForm.descripcion,
        spei_referencia: movForm.spei_referencia,
        cuenta_contraparte: movForm.cuenta_contraparte,
        banco_contraparte: movForm.banco_contraparte,
        nombre_contraparte: movForm.nombre_contraparte,
        categoria: movForm.categoria,
      });
      await alertSuccess("Movimiento registrado", "Intentaremos conciliarlo automáticamente");
      await loadMovimientos({ ...appliedFilters, cuenta: selectedCuentaId });
      await refreshConciliaciones();
    } catch (err) {
      void alertError("No pudimos registrar el movimiento", (err as Error).message);
    } finally {
      setSavingMov(false);
    }
  };

  const applyFilters = () => {
    setAppliedFilters({ ...filters });
  };

  const handleUpdateConciliacion = async (id: number) => {
    const form = conciliacionForm[id];
    if (!form) return;
    try {
      await updateConciliacion(id, { estado: form.estado, comentario: form.comentario, confianza: form.confianza || null });
      await alertSuccess("Conciliación actualizada", "Se registró el ajuste");
      await refreshConciliaciones();
    } catch (err) {
      void alertError("No pudimos actualizar la conciliación", (err as Error).message);
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-8 text-white">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Finanzas</p>
            <h1 className="text-xl sm:text-2xl font-semibold text-white">Bancarización y conciliación</h1>
            <p className="text-sm text-slate-300">Adjunta cuentas, estados, movimientos y monitorea conciliaciones con alertas.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <GuiaContador
              section="Finanzas y bancarización"
              steps={[
                { title: "Registra la cuenta bancaria", description: "Captura <strong>alias</strong>, banco, número de cuenta, <strong>CLABE</strong>, moneda y titular. Cada cuenta se vincula a una empresa." },
                { title: "Carga estados de cuenta", description: "Registra el <strong>período</strong> (inicio/fin), enlaza el <strong>PDF del estado</strong> y captura saldos inicial y final para conciliación." },
                { title: "Registra movimientos", description: "Captura cada movimiento: <strong>fecha, monto, tipo</strong> (abono/cargo), referencia SPEI, contraparte y categoría." },
                { title: "Revisa conciliaciones", description: "El sistema <strong>concilia automáticamente</strong> movimientos con operaciones. Revisa las alertas de <strong>operaciones circulares</strong> y <strong>capacidad operativa</strong>." },
              ]}
              concepts={[
                { term: "Bancarización", definition: "Obligación de realizar pagos superiores a $2,000 MXN mediante medios electrónicos o cheque para efectos de deducibilidad (Art. 27-III LISR)." },
                { term: "Conciliación", definition: "Proceso de cruzar movimientos bancarios contra operaciones registradas para verificar que cada pago corresponde a una operación real." },
                { term: "Operación circular", definition: "Movimiento donde el dinero sale y regresa al mismo contribuyente sin sustancia económica real. Indicador de riesgo fiscal." },
                { term: "SPEI", definition: "Sistema de Pagos Electrónicos Interbancarios del Banco de México. La referencia SPEI permite rastrear cada transferencia." },
              ]}
              tips={[
                "Registra <strong>una cuenta por cada banco</strong> y moneda para facilitar la conciliación.",
                "Carga el estado de cuenta <strong>dentro de los 5 primeros días</strong> del mes siguiente para no acumular atrasos.",
                "Si una conciliación es rechazada, <strong>documenta el motivo</strong> en el campo de comentarios.",
                "Las alertas de <strong>operaciones circulares</strong> requieren atención inmediata — pueden indicar operaciones simuladas.",
              ]}
            />
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-200">
              {conciliaciones.length} conciliaciones registradas
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Cuentas</p>
                <h2 className="text-lg font-semibold text-white">Bancarización</h2>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-100">{cuentas.length}</span>
            </div>
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {loading && <p className="text-sm text-slate-300">Cargando cuentas...</p>}
              {!loading && cuentas.length === 0 && <p className="text-sm text-slate-300">Aún no hay cuentas.</p>}
              {cuentas.map((c) => {
                const active = c.id === selectedCuentaId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCuentaId(c.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${active ? "border-emerald-300/60 bg-emerald-500/10" : "border-white/10 bg-white/5 hover:border-emerald-300/40"
                      }`}
                  >
                    <p className="text-sm font-semibold text-white">{c.alias || c.numero_cuenta || "Cuenta"}</p>
                    <p className="text-xs text-slate-300">{c.banco} • {c.moneda}</p>
                    {c.clabe && <p className="text-[11px] text-slate-400">CLABE: {c.clabe}</p>}
                  </button>
                );
              })}
            </div>
            <div className="pt-2 border-t border-white/10 space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Nueva cuenta</p>
              <div className="grid gap-2">
                <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="Alias" value={cuentaForm.alias} onChange={(e) => setCuentaForm((p) => ({ ...p, alias: e.target.value }))} />
                <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="Banco" value={cuentaForm.banco} onChange={(e) => setCuentaForm((p) => ({ ...p, banco: e.target.value }))} />
                <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="Número de cuenta" value={cuentaForm.numero_cuenta} onChange={(e) => setCuentaForm((p) => ({ ...p, numero_cuenta: e.target.value }))} />
                <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="CLABE" value={cuentaForm.clabe} onChange={(e) => setCuentaForm((p) => ({ ...p, clabe: e.target.value }))} />
                <select className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" value={cuentaForm.moneda} onChange={(e) => setCuentaForm((p) => ({ ...p, moneda: e.target.value as CuentaBancaria["moneda"] }))}>
                  {MONEDAS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="Titular" value={cuentaForm.titular} onChange={(e) => setCuentaForm((p) => ({ ...p, titular: e.target.value }))} />
                <button onClick={() => void handleCreateCuenta()} disabled={savingCuenta} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60">
                  {savingCuenta ? "Guardando..." : "Crear cuenta"}
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Evidencia</p>
                <h2 className="text-lg font-semibold text-white">Estados y movimientos</h2>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-100">{movimientos.length}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Nuevo estado de cuenta</p>
                <div className="grid gap-2">
                  <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" type="date" value={estadoForm.periodo_inicio} onChange={(e) => setEstadoForm((p) => ({ ...p, periodo_inicio: e.target.value }))} />
                  <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" type="date" value={estadoForm.periodo_fin} onChange={(e) => setEstadoForm((p) => ({ ...p, periodo_fin: e.target.value }))} />
                  <PasteUrlField
                    value={estadoForm.archivo_url}
                    onChange={(v) => setEstadoForm((p) => ({ ...p, archivo_url: v }))}
                    placeholder="URL del estado (PDF)"
                    className="rounded-xl border border-white/10 bg-white/5 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none transition"
                  />
                  <p className="text-[11px] text-slate-300">Próximamente: carga directa de PDF cuando el backend exponga upload.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="Saldo inicial" value={estadoForm.saldo_inicial} onChange={(e) => setEstadoForm((p) => ({ ...p, saldo_inicial: e.target.value }))} />
                    <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="Saldo final" value={estadoForm.saldo_final} onChange={(e) => setEstadoForm((p) => ({ ...p, saldo_final: e.target.value }))} />
                  </div>
                  <button onClick={() => void handleCreateEstado()} disabled={savingEstado} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60">
                    {savingEstado ? "Guardando..." : "Guardar estado"}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Nuevo movimiento</p>
                <div className="grid gap-2">
                  <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" type="date" value={movForm.fecha} onChange={(e) => setMovForm((p) => ({ ...p, fecha: e.target.value }))} />
                  <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="Monto" value={movForm.monto} onChange={(e) => setMovForm((p) => ({ ...p, monto: e.target.value }))} />
                  <select className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" value={movForm.tipo} onChange={(e) => setMovForm((p) => ({ ...p, tipo: e.target.value as MovimientoBancario["tipo"] }))}>
                    {MOV_TIPOS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="Referencia" value={movForm.referencia} onChange={(e) => setMovForm((p) => ({ ...p, referencia: e.target.value }))} />
                  <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="Descripción" value={movForm.descripcion} onChange={(e) => setMovForm((p) => ({ ...p, descripcion: e.target.value }))} />
                  <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="Referencia SPEI" value={movForm.spei_referencia} onChange={(e) => setMovForm((p) => ({ ...p, spei_referencia: e.target.value }))} />
                  <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="Cuenta contraparte" value={movForm.cuenta_contraparte} onChange={(e) => setMovForm((p) => ({ ...p, cuenta_contraparte: e.target.value }))} />
                  <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="Banco contraparte" value={movForm.banco_contraparte} onChange={(e) => setMovForm((p) => ({ ...p, banco_contraparte: e.target.value }))} />
                  <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="Nombre contraparte" value={movForm.nombre_contraparte} onChange={(e) => setMovForm((p) => ({ ...p, nombre_contraparte: e.target.value }))} />
                  <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="Categoría" value={movForm.categoria} onChange={(e) => setMovForm((p) => ({ ...p, categoria: e.target.value }))} />
                  <button onClick={() => void handleCreateMovimiento()} disabled={savingMov} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60">
                    {savingMov ? "Guardando..." : "Registrar movimiento"}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Filtros</p>
                <input type="date" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white" value={filters.min_fecha || ""} onChange={(e) => setFilters((p) => ({ ...p, min_fecha: e.target.value }))} />
                <input type="date" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white" value={filters.max_fecha || ""} onChange={(e) => setFilters((p) => ({ ...p, max_fecha: e.target.value }))} />
                <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white" placeholder="Monto mín" value={filters.min_monto || ""} onChange={(e) => setFilters((p) => ({ ...p, min_monto: e.target.value }))} />
                <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white" placeholder="Monto máx" value={filters.max_monto || ""} onChange={(e) => setFilters((p) => ({ ...p, max_monto: e.target.value }))} />
                <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white" placeholder="Ref SPEI" value={filters.spei_referencia || ""} onChange={(e) => setFilters((p) => ({ ...p, spei_referencia: e.target.value }))} />
                <button onClick={() => void applyFilters()} className="rounded-xl bg-white/10 px-4 py-2 min-h-[44px] text-xs font-semibold text-white hover:bg-white/20">Aplicar</button>
              </div>
            </div>

            <div className="max-h-[260px] overflow-y-auto overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/40">
              <table className="min-w-full divide-y divide-white/10 text-sm text-slate-100">
                <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-300">
                  <tr>
                    <th className="px-3 py-2 text-left">Fecha</th>
                    <th className="px-3 py-2 text-left">Monto</th>
                    <th className="px-3 py-2 text-left">Tipo</th>
                    <th className="px-3 py-2 text-left">SPEI</th>
                    <th className="px-3 py-2 text-left">Circular</th>
                    <th className="px-3 py-2 text-left">Alerta cap.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {movimientos.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-300">Sin movimientos</td></tr>
                  )}
                  {movimientos.map((m) => (
                    <tr key={m.id}>
                      <td className="px-3 py-2 text-slate-200">{m.fecha}</td>
                      <td className="px-3 py-2 font-semibold text-white">{formatCurrency(m.monto, selectedCuenta?.moneda)}</td>
                      <td className="px-3 py-2 text-slate-200">{m.tipo}</td>
                      <td className="px-3 py-2 text-slate-200">{m.spei_referencia || "-"}</td>
                      <td className="px-3 py-2">{m.es_circular ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Circular</span> : <span className="text-xs text-slate-400">No</span>}</td>
                      <td className="px-3 py-2">{m.alerta_capacidad ? <span className="rounded-full bg-flame-100 px-3 py-1 text-xs font-semibold text-flame-800">Alerta</span> : <span className="text-xs text-slate-400">OK</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Conciliaciones</p>
                <h2 className="text-lg font-semibold text-white">Auto / manual</h2>
              </div>
              <button onClick={() => void refreshConciliaciones()} className="rounded-xl bg-white/10 px-3 py-2 min-h-[44px] text-xs font-semibold text-white hover:bg-white/20">Refrescar</button>
            </div>
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {conciliaciones.length === 0 && <p className="text-sm text-slate-300">Sin conciliaciones aún.</p>}
              {conciliaciones.map((c) => {
                const badge = c.estado === "AUTO" ? "bg-emerald-100 text-emerald-800" : c.estado === "MANUAL" ? "bg-blue-100 text-blue-800" : c.estado === "RECHAZADA" ? "bg-flame-100 text-flame-800" : "bg-amber-100 text-amber-800";
                const form = conciliacionForm[c.id] || { estado: c.estado, comentario: c.comentario || "", confianza: c.confianza || "" };
                return (
                  <div key={c.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">Operación #{c.operacion}</p>
                        <p className="text-xs text-slate-300">Movimiento #{c.movimiento}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge}`}>{c.estado}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-300">
                      <p>Monto operación: <span className="font-semibold text-white">{formatCurrency(c.operacion_monto, selectedCuenta?.moneda)}</span></p>
                      <p>Monto movimiento: <span className="font-semibold text-white">{formatCurrency(c.movimiento_monto, selectedCuenta?.moneda)}</span></p>
                      <p>Confianza: <span className="font-semibold text-white">{c.confianza ?? "-"}</span></p>
                      <p>Comentario: <span className="font-semibold text-white">{c.comentario || ""}</span></p>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-slate-200">
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={form.estado}
                          onChange={(e) => setConciliacionForm((p) => ({ ...p, [c.id]: { ...form, estado: e.target.value as OperacionConciliacion["estado"] } }))}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"
                        >
                          <option value="PENDIENTE">Pendiente</option>
                          <option value="AUTO">Auto</option>
                          <option value="MANUAL">Manual</option>
                          <option value="RECHAZADA">Rechazada</option>
                        </select>
                        <input
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"
                          placeholder="Confianza (0-1)"
                          value={form.confianza}
                          onChange={(e) => setConciliacionForm((p) => ({ ...p, [c.id]: { ...form, confianza: e.target.value } }))}
                        />
                      </div>
                      <textarea
                        rows={2}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"
                        placeholder="Comentario"
                        value={form.comentario}
                        onChange={(e) => setConciliacionForm((p) => ({ ...p, [c.id]: { ...form, comentario: e.target.value } }))}
                      />
                      <div className="flex justify-end">
                        <button
                          onClick={() => void handleUpdateConciliacion(c.id)}
                          className="rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20"
                        >
                          Guardar cambios
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}
