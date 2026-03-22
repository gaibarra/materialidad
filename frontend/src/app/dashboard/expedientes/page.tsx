"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { DataCardsSkeleton, InlineEmptyState } from "../../../components/DataState";
import { DashboardShell } from "../../../components/DashboardShell";
import { GuiaContador } from "../../../components/GuiaContador";
import { MobileDataList } from "../../../components/MobileDataList";
import {
  BandejaRevisionItem,
  cambiarOperacionEstatus,
  fetchAlertasOperacion,
  fetchBandejaRevision,
  fetchMatrizMaterialidad,
  MatrizMaterialidadItem,
  OperacionChecklistResumen,
  exportOperacionDossier,
  exportOperacionDefensaPdf,
} from "../../../lib/operaciones";
import { alertError, alertSuccess } from "../../../lib/alerts";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  FileArchive,
  FileSearch,
  Filter,
  Landmark,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

/* ───────── style maps ───────── */
const RISK_BADGE: Record<string, string> = {
  ALTO: "border-red-200 bg-red-50 text-red-700",
  MEDIO: "border-amber-200 bg-amber-50 text-amber-700",
  BAJO: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const STATUS_BADGE: Record<string, string> = {
  INCOMPLETO: "border-amber-200 bg-amber-50 text-amber-700",
  COMPLETO: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const VALIDACION_BADGE: Record<string, string> = {
  PENDIENTE: "border-slate-200 bg-slate-50 text-slate-600",
  EN_PROCESO: "border-blue-200 bg-blue-50 text-blue-700",
  VALIDADO: "border-emerald-200 bg-emerald-50 text-emerald-700",
  RECHAZADO: "border-red-200 bg-red-50 text-red-700",
};

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 transition";

/* ───────── chain doc check mark ───────── */
function DocCheck({ present, label }: { present: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold ${present ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-600"}`}>
      <span>{present ? "✓" : "✗"}</span>
      <span>{label}</span>
    </div>
  );
}

function ChecklistSnapshot({ checklists }: { checklists: OperacionChecklistResumen[] }) {
  if (!checklists.length) return null;

  return (
    <div className="rounded-xl border border-[rgba(45,91,136,0.18)] bg-[var(--fiscal-accent-soft)]/55 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--fiscal-accent)]">Checklist operativo</p>
        <span className="text-[11px] font-medium text-[var(--fiscal-muted)]">{checklists.length} asociado(s)</span>
      </div>
      <div className="mt-2 space-y-2">
        {checklists.map((checklist) => (
          <div key={checklist.id} className="rounded-xl border border-white/70 bg-white/80 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[var(--fiscal-ink)]">{checklist.nombre}</p>
              <div className="flex items-center gap-2 text-[10px] font-bold">
                <span className={`rounded-full border px-2 py-0.5 ${STATUS_BADGE[checklist.requeridos_pendientes > 0 ? "INCOMPLETO" : "COMPLETO"]}`}>
                  {checklist.requeridos_pendientes > 0 ? `${checklist.requeridos_pendientes} req. pendientes` : "Requeridos completos"}
                </span>
                <span className="rounded-full border border-[rgba(45,91,136,0.18)] bg-white px-2 py-0.5 text-[var(--fiscal-accent)]">
                  {checklist.progreso_porcentaje}%
                </span>
              </div>
            </div>
            <p className="mt-1 text-[11px] text-[var(--fiscal-muted)]">
              {checklist.completos}/{checklist.total_items} items completos
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────── KPI card ───────── */
function KPI({ label, value, color = "slate", icon }: { label: string; value: React.ReactNode; color?: string; icon?: ReactNode }) {
  const map: Record<string, string> = {
    slate: "bg-[rgba(255,255,255,0.78)] text-[var(--fiscal-ink)]",
    emerald: "bg-[var(--fiscal-success-soft)]/80 text-[var(--fiscal-success)]",
    amber: "bg-[var(--fiscal-warning-soft)]/80 text-[var(--fiscal-warning)]",
    red: "bg-[var(--fiscal-danger-soft)]/80 text-[var(--fiscal-danger)]",
    blue: "bg-[var(--fiscal-accent-soft)]/80 text-[var(--fiscal-accent)]",
  };
  const subMap: Record<string, string> = {
    slate: "text-[var(--fiscal-muted)]", emerald: "text-[var(--fiscal-success)]", amber: "text-[var(--fiscal-warning)]", red: "text-[var(--fiscal-danger)]", blue: "text-[var(--fiscal-accent)]",
  };
  return (
    <div className={`surface-panel rounded-panel px-4 py-4 ${map[color] || map.slate}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[rgba(255,255,255,0.72)] shadow-panel">
          {icon}
        </div>
        <div className="min-w-0 text-left">
          <p className="font-display text-3xl font-semibold leading-tight">{value}</p>
          <p className={`mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] ${subMap[color] || subMap.slate}`}>{label}</p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════ PAGE ═══════════════════════════════════════════ */

export default function ExpedientesPage() {
  const [loading, setLoading] = useState(true);
  const [rol, setRol] = useState<"SERVICIOS" | "COMPRAS" | "PARTES_RELACIONADAS" | "GENERAL">("GENERAL");
  const [riesgo, setRiesgo] = useState<"" | "BAJO" | "MEDIO" | "ALTO">("");
  const [rfc, setRfc] = useState("");
  const [matriz, setMatriz] = useState<MatrizMaterialidadItem[]>([]);
  const [bandeja, setBandeja] = useState<BandejaRevisionItem[]>([]);
  const [alertasActivas, setAlertasActivas] = useState(0);
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [updatingEstatusId, setUpdatingEstatusId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [matrizRes, bandejaRes, alertasRes] = await Promise.all([
        fetchMatrizMaterialidad({ riesgo: riesgo || undefined, rfc: rfc || undefined, orden: "riesgo" }),
        fetchBandejaRevision({ rol, riesgo: riesgo || undefined, rfc: rfc || undefined, orden: "riesgo" }),
        fetchAlertasOperacion({ estatus: "ACTIVA" }),
      ]);
      setMatriz(matrizRes.results ?? []);
      setBandeja(bandejaRes.results ?? []);
      setAlertasActivas(alertasRes.count ?? 0);
    } catch (err) {
      void alertError("No pudimos cargar expedientes", (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [riesgo, rfc, rol]);

  useEffect(() => { void loadData(); }, [loadData]);

  const kpi = useMemo(() => {
    const total = matriz.length;
    const incompletos = matriz.filter((i) => i.estado_completitud === "INCOMPLETO").length;
    const alto = matriz.filter((i) => i.riesgo_nivel === "ALTO").length;
    const medio = matriz.filter((i) => i.riesgo_nivel === "MEDIO").length;
    const completos = total - incompletos;
    const pctCompleto = total > 0 ? Math.round((completos / total) * 100) : 0;
    return { total, incompletos, completos, alto, medio, pctCompleto };
  }, [matriz]);

  const handleExportZip = async (operacionId: number) => {
    setExportingId(operacionId);
    try { await exportOperacionDossier(operacionId); }
    catch (err) { void alertError("Error al exportar ZIP", (err as Error).message); }
    finally { setExportingId(null); }
  };

  const handleExportPdf = async (operacionId: number) => {
    setExportingId(operacionId);
    try { await exportOperacionDefensaPdf(operacionId); }
    catch (err) { void alertError("Error al exportar PDF", (err as Error).message); }
    finally { setExportingId(null); }
  };

  const handleCambioEstatus = async (operacionId: number, estatus: "EN_PROCESO" | "VALIDADO" | "RECHAZADO", comentario: string) => {
    setUpdatingEstatusId(operacionId);
    try {
      await cambiarOperacionEstatus(operacionId, { estatus_validacion: estatus, comentario });
      await alertSuccess("Estatus actualizado", `La operación quedó en ${estatus}.`);
      await loadData();
    } catch (err) {
      void alertError("No se pudo cambiar estatus", `${(err as Error).message}\n\nRevisa faltantes críticos y evidencia contractual.`);
    } finally { setUpdatingEstatusId(null); }
  };

  /* ═══════════════════ RENDER ═══════════════════ */
  return (
    <DashboardShell>
      <div className="space-y-6 text-slate-900">

        {/* ── HEADER ── */}
        <header className="surface-panel-strong rounded-[1.75rem] p-6 shadow-fiscal">
          <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div>
              <p className="kicker-label">Materialidad</p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--fiscal-ink)] sm:text-[2.8rem]">Centro de calidad de expedientes</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--fiscal-muted)] sm:text-base">
                Controla la matriz documental, bandeja de revisión por rol y alertas activas para mantener
                expedientes de calidad profesional defendible ante auditoría.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <div className="rounded-full border border-[rgba(45,91,136,0.18)] bg-[var(--fiscal-accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--fiscal-accent)]">
                  Archivo probatorio vivo
                </div>
                <div className="rounded-full border border-[rgba(184,137,70,0.18)] bg-[rgba(184,137,70,0.10)] px-3 py-2 text-xs font-semibold text-[var(--fiscal-gold)]">
                  Validación documental por riesgo
                </div>
              </div>
            </div>
            <div className="surface-shell rounded-[1.5rem] p-5 text-white">
              <p className="eyebrow-shell">Control de calidad</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-white">Revisión documental con criterio de defensa</h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-[rgba(216,211,200,0.78)]">
                Aquí no solo se revisa si un expediente existe. Se determina si está completo, trazable y listo para sostener una postura frente a auditoría.
              </p>
              <div className="mt-4 flex justify-end">
                <GuiaContador
                  section="Expedientes — Calidad documental"
                  steps={[
                    { title: "1. Filtra por rol y riesgo", description: "Prioriza expedientes <strong>ALTO</strong> riesgo e <strong>INCOMPLETO</strong> antes del cierre semanal." },
                    { title: "2. Revisa cadena documental", description: "Verifica que cada operación tenga <strong>CFDI + Contrato + Pago + Evidencia</strong> completa." },
                    { title: "3. Valida o envía a revisión", description: "Cambia el estatus: <strong>EN_PROCESO</strong> si falta algo, <strong>VALIDADO</strong> si todo está completo." },
                    { title: "4. Exporta evidencia", description: "Genera <strong>PDF de defensa</strong> o <strong>ZIP dossier</strong> para auditoría o revisión interna." },
                  ]}
                  concepts={[
                    { term: "Cadena documental", definition: "Secuencia CFDI → Contrato → Pago → Evidencia que demuestra la sustancia económica de cada operación." },
                    { term: "Matriz de materialidad", definition: "Cruce de todas las operaciones con su nivel de riesgo y completitud documental." },
                    { term: "Perfil de validación", definition: "Tipo de operación (Servicios, Compras, Partes Relacionadas) que define los requisitos específicos de evidencia." },
                    { term: "Dossier de defensa", definition: "Paquete completo de evidencia exportable para presentar ante auditoría fiscal." },
                  ]}
                  tips={[
                    "Un expediente INCOMPLETO + ALTO riesgo = <strong>prioridad máxima</strong>.",
                    "Exporta el PDF de defensa <strong>antes</strong> de marcar como VALIDADO para confirmar que todo está en orden.",
                    "Las alertas activas indican <strong>faltantes críticos</strong> que podrían generar observaciones en auditoría.",
                    "Usa el filtro de RFC para revisar expedientes de un <strong>proveedor específico</strong> bajo revisión.",
                  ]}
                />
              </div>
            </div>
          </div>

          {/* KPI ROW */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <KPI label="Operaciones" value={loading ? "—" : kpi.total} color="slate" icon={<FileSearch className="h-5 w-5 text-[var(--fiscal-accent)]" />} />
            <KPI label="Completos" value={loading ? "—" : kpi.completos} color="emerald" icon={<CheckCircle2 className="h-5 w-5 text-[var(--fiscal-success)]" />} />
            <KPI label="Incompletos" value={loading ? "—" : kpi.incompletos} color="amber" icon={<ShieldAlert className="h-5 w-5 text-[var(--fiscal-warning)]" />} />
            <KPI label="Riesgo alto" value={loading ? "—" : kpi.alto} color="red" icon={<AlertTriangle className="h-5 w-5 text-[var(--fiscal-danger)]" />} />
            <KPI label="Alertas activas" value={loading ? "—" : alertasActivas} color={alertasActivas > 0 ? "red" : "slate"} icon={<Bell className="h-5 w-5 text-[var(--fiscal-danger)]" />} />
            <KPI label="% Completo" value={loading ? "—" : `${kpi.pctCompleto}%`} color={kpi.pctCompleto >= 80 ? "emerald" : kpi.pctCompleto >= 50 ? "amber" : "red"} icon={<ShieldCheck className="h-5 w-5 text-[var(--fiscal-success)]" />} />
          </div>

          {/* progress bar */}
          {!loading && kpi.total > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Completitud global</span>
                <span className="font-semibold text-slate-700">{kpi.completos}/{kpi.total}</span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all ${kpi.pctCompleto >= 80 ? "bg-emerald-500" : kpi.pctCompleto >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${kpi.pctCompleto}%` }}
                />
              </div>
            </div>
          )}
        </header>

        {/* ── FILTERS ── */}
        <section className="surface-panel rounded-[1.75rem] p-6 shadow-fiscal">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[var(--fiscal-accent)]" />
            <p className="kicker-label">Filtros de revisión</p>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Rol de revisión</label>
              <select value={rol} onChange={(e) => setRol(e.target.value as typeof rol)} className={inputCls}>
                <option value="GENERAL">General (todos)</option>
                <option value="SERVICIOS">Servicios</option>
                <option value="COMPRAS">Compras</option>
                <option value="PARTES_RELACIONADAS">Partes relacionadas</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Nivel de riesgo</label>
              <select value={riesgo} onChange={(e) => setRiesgo(e.target.value as typeof riesgo)} className={inputCls}>
                <option value="">Todos</option>
                <option value="ALTO">Alto</option>
                <option value="MEDIO">Medio</option>
                <option value="BAJO">Bajo</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">RFC empresa / proveedor</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fiscal-muted)]" />
                <input value={rfc} onChange={(e) => setRfc(e.target.value.toUpperCase())} placeholder="RFC…" className={`${inputCls} pl-10`} />
              </div>
            </div>
            <div className="flex items-end">
              <button onClick={() => void loadData()}
                className="button-institutional inline-flex w-full items-center justify-center rounded-full px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5">
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                {loading ? "Actualizando revisión…" : "Actualizar revisión"}
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs text-[var(--fiscal-muted)]">
            Prioriza expedientes con riesgo <span className="font-bold text-[var(--fiscal-danger)]">ALTO</span> y estado <span className="font-bold text-[var(--fiscal-warning)]">INCOMPLETO</span> antes del cierre semanal.
          </p>
        </section>

        {/* ── MATRIZ DOCUMENTAL ── */}
        <section className="surface-panel rounded-[1.75rem] p-6 shadow-fiscal">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="kicker-label">Cadena documental</p>
              <h2 className="text-lg font-bold text-[var(--fiscal-ink)]">Matriz CFDI → Contrato → Pago → Evidencia</h2>
            </div>
            {!loading && kpi.alto > 0 && (
              <span className="rounded-full border border-[rgba(160,67,61,0.22)] bg-[var(--fiscal-danger-soft)] px-3 py-1 text-xs font-bold text-[var(--fiscal-danger)]">
                {kpi.alto} riesgo alto
              </span>
            )}
          </div>

          <div className="mt-4">
            {loading ? (
              <DataCardsSkeleton cards={3} className="xl:grid-cols-2" />
            ) : matriz.length === 0 ? (
              <InlineEmptyState
                icon={<FileSearch className="h-6 w-6" />}
                title="La matriz quedó vacía con esta lectura"
                description="Ajusta rol, riesgo o RFC para recuperar expedientes relevantes y volver a poblar la revisión documental en móvil."
              />
            ) : (
              <div className="space-y-3">
                {matriz.map((item) => {
                  const expanded = expandedId === item.id;
                  const checklistPendientes = item.checklists_resumen.reduce((acc, checklist) => acc + checklist.requeridos_pendientes, 0);
                  return (
                    <article key={item.id} className="rounded-2xl border border-[rgba(200,192,177,0.72)] bg-white shadow-panel transition hover:shadow-fiscal">
                      {/* card header */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setExpandedId(expanded ? null : item.id)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpandedId(expanded ? null : item.id); }}
                        className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-5 py-4"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-bold text-[var(--fiscal-ink)]">{item.proveedor_nombre}</p>
                          <p className="text-xs text-[var(--fiscal-muted)]">{item.empresa_nombre} · {item.fecha_operacion} · {Number(item.monto).toLocaleString("es-MX", { style: "currency", currency: item.moneda || "MXN" })}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${RISK_BADGE[item.riesgo_nivel] || "border-slate-200 bg-slate-50 text-slate-600"}`}>
                            {item.riesgo_nivel} · {item.riesgo_score}
                          </span>
                          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${STATUS_BADGE[item.estado_completitud] || "border-slate-200 bg-slate-50 text-slate-600"}`}>
                            {item.estado_completitud}
                          </span>
                          {item.checklists_resumen.length > 0 && (
                            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${checklistPendientes > 0 ? "border-blue-200 bg-blue-50 text-blue-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                              Checklist {checklistPendientes > 0 ? `pendiente ${checklistPendientes}` : "al día"}
                            </span>
                          )}
                          {item.estatus_validacion && (
                            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${VALIDACION_BADGE[item.estatus_validacion] || "border-slate-200 bg-slate-50 text-slate-600"}`}>
                              {item.estatus_validacion}
                            </span>
                          )}
                          <span className={`text-[var(--fiscal-muted)] transition-transform text-xs ${expanded ? "rotate-180" : ""}`}>▾</span>
                        </div>
                      </div>

                      {/* expanded detail */}
                      {expanded && (
                        <div className="space-y-4 border-t border-[rgba(200,192,177,0.55)] px-5 pb-5 pt-4">
                          {/* doc chain */}
                          <div className="flex flex-wrap gap-2">
                            <DocCheck present={item.cadena_documental.cfdi.presente} label="CFDI" />
                            <DocCheck present={item.cadena_documental.contrato.presente} label="Contrato" />
                            <DocCheck present={item.cadena_documental.pago.presente} label="Pago" />
                            <DocCheck present={item.cadena_documental.evidencia.presente} label="Evidencia" />
                          </div>

                          <ChecklistSnapshot checklists={item.checklists_resumen} />

                          {/* missing items */}
                          {item.faltantes.length > 0 && (
                            <div className="rounded-xl border border-[rgba(166,103,31,0.22)] bg-[var(--fiscal-warning-soft)]/70 px-4 py-3">
                              <p className="text-xs font-semibold text-[var(--fiscal-warning)]">Faltantes ({item.faltantes.length})</p>
                              <ul className="mt-1 list-inside list-disc text-xs text-[var(--fiscal-warning)]">
                                {item.faltantes.map((f, i) => <li key={i}>{f}</li>)}
                              </ul>
                            </div>
                          )}

                          {/* active alerts */}
                          {item.alertas_activas && item.alertas_activas.length > 0 && (
                            <div className="rounded-xl border border-[rgba(160,67,61,0.22)] bg-[var(--fiscal-danger-soft)]/70 px-4 py-3">
                              <p className="text-xs font-semibold text-[var(--fiscal-danger)]">Alertas activas ({item.alertas_activas.length})</p>
                              <ul className="mt-1 list-inside list-disc text-xs text-[var(--fiscal-danger)]">
                                {item.alertas_activas.map((a) => <li key={a.id}>{a.tipo_alerta}: {a.motivo}</li>)}
                              </ul>
                            </div>
                          )}

                          {/* action buttons */}
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => void handleCambioEstatus(item.id, "EN_PROCESO", "Enviado a revisión documental")}
                              disabled={updatingEstatusId === item.id}
                              className="rounded-full border border-[rgba(166,103,31,0.22)] bg-[var(--fiscal-warning-soft)] px-4 py-1.5 text-xs font-semibold text-[var(--fiscal-warning)] transition hover:bg-[var(--fiscal-warning-soft)]/80 disabled:opacity-50">
                              {updatingEstatusId === item.id && <RefreshCw className="mr-1 inline h-3.5 w-3.5 animate-spin" />}
                              {updatingEstatusId === item.id ? "Actualizando…" : "Enviar a revisión"}
                            </button>
                            <button onClick={() => void handleCambioEstatus(item.id, "VALIDADO", "Validado — expediente completo")}
                              disabled={updatingEstatusId === item.id}
                              className="rounded-full border border-[rgba(31,122,90,0.22)] bg-[var(--fiscal-success-soft)] px-4 py-1.5 text-xs font-semibold text-[var(--fiscal-success)] transition hover:bg-[var(--fiscal-success-soft)]/80 disabled:opacity-50">
                              {updatingEstatusId === item.id && <RefreshCw className="mr-1 inline h-3.5 w-3.5 animate-spin" />}
                              {updatingEstatusId === item.id ? "Actualizando…" : "Marcar VALIDADO"}
                            </button>
                            <button onClick={() => void handleCambioEstatus(item.id, "RECHAZADO", "Rechazado — faltantes críticos")}
                              disabled={updatingEstatusId === item.id}
                              className="rounded-full border border-[rgba(160,67,61,0.22)] bg-[var(--fiscal-danger-soft)] px-4 py-1.5 text-xs font-semibold text-[var(--fiscal-danger)] transition hover:bg-[var(--fiscal-danger-soft)]/80 disabled:opacity-50">
                              {updatingEstatusId === item.id && <RefreshCw className="mr-1 inline h-3.5 w-3.5 animate-spin" />}
                              {updatingEstatusId === item.id ? "Actualizando…" : "Rechazar"}
                            </button>
                            <div className="ml-auto flex gap-2">
                              <button onClick={() => void handleExportPdf(item.id)} disabled={exportingId === item.id}
                                className="rounded-full border border-[rgba(45,91,136,0.22)] bg-[var(--fiscal-accent-soft)] px-4 py-1.5 text-xs font-semibold text-[var(--fiscal-accent)] transition hover:bg-[var(--fiscal-accent-soft)]/80 disabled:opacity-50">
                                {exportingId === item.id && <RefreshCw className="mr-1 inline h-3.5 w-3.5 animate-spin" />}
                                {exportingId === item.id ? "Generando…" : "PDF defensa"}
                              </button>
                              <button onClick={() => void handleExportZip(item.id)} disabled={exportingId === item.id}
                                className="rounded-full border border-[rgba(184,137,70,0.22)] bg-[rgba(184,137,70,0.10)] px-4 py-1.5 text-xs font-semibold text-[var(--fiscal-gold)] transition hover:bg-[rgba(184,137,70,0.16)] disabled:opacity-50">
                                {exportingId === item.id && <RefreshCw className="mr-1 inline h-3.5 w-3.5 animate-spin" />}
                                {exportingId === item.id ? "Generando…" : "ZIP dossier"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ── BANDEJA DE REVISIÓN ── */}
        <section className="surface-panel rounded-[1.75rem] p-6 shadow-fiscal">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="kicker-label">Bandeja</p>
              <h2 className="text-lg font-bold text-[var(--fiscal-ink)]">Revisión por rol: {rol}</h2>
              <p className="mt-1 text-xs text-[var(--fiscal-muted)]">Prioriza operaciones y asigna atención inmediata a faltantes críticos.</p>
            </div>
            <span className="rounded-full border border-[rgba(200,192,177,0.8)] bg-[rgba(255,255,255,0.75)] px-3 py-1 text-xs font-semibold text-[var(--fiscal-muted)]">{bandeja.length} operaciones</span>
          </div>

          <MobileDataList
            items={bandeja}
            getKey={(item) => item.id}
            className="mt-4"
            empty={(
              !loading ? (
                <InlineEmptyState
                  icon={<Scale className="h-6 w-6" />}
                  title="No hay operaciones pendientes en esta bandeja"
                  description="Prueba con otro rol, riesgo o RFC para recuperar expedientes en revisión."
                />
              ) : null
            )}
            renderItem={(item) => (
              <article className="rounded-[1.35rem] border border-[rgba(200,192,177,0.72)] bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.proveedor_nombre}</p>
                    <p className="truncate text-[11px] font-mono text-slate-400">{item.proveedor_rfc}</p>
                  </div>
                  <p className="text-right text-sm font-semibold text-slate-900">
                    {Number(item.monto).toLocaleString("es-MX", { style: "currency", currency: item.moneda || "MXN" })}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{item.perfil_validacion}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${RISK_BADGE[item.riesgo_nivel] || ""}`}>
                    {item.riesgo_nivel} · {item.riesgo_score}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${VALIDACION_BADGE[item.estatus_validacion] || "border-slate-200 bg-slate-50 text-slate-600"}`}>
                    {item.estatus_validacion}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Empresa</p>
                    <p className="mt-1 text-slate-700">{item.empresa_nombre}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Concepto</p>
                    <p className="mt-1 text-slate-700">{item.concepto || item.tipo_operacion}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-amber-50 px-3 py-2 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700">Faltantes</p>
                    <p className="mt-1 text-sm font-semibold text-amber-800">{item.faltantes.length}</p>
                  </div>
                  <div className="rounded-2xl bg-blue-50 px-3 py-2 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Checklist</p>
                    <p className="mt-1 text-sm font-semibold text-blue-800">{item.checklists_resumen.reduce((acc, checklist) => acc + checklist.requeridos_pendientes, 0)}</p>
                  </div>
                  <div className="rounded-2xl bg-red-50 px-3 py-2 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-700">Alertas</p>
                    <p className="mt-1 text-sm font-semibold text-red-800">{item.alertas_activas.length}</p>
                  </div>
                </div>
              </article>
            )}
          />

          <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-[rgba(200,192,177,0.72)] bg-white lg:block">
            <table className="min-w-full text-sm">
              <thead className="bg-[rgba(244,242,237,0.88)]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--fiscal-muted)]">Proveedor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--fiscal-muted)]">Empresa</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--fiscal-muted)]">Perfil</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--fiscal-muted)]">Riesgo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--fiscal-muted)]">Estatus</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--fiscal-muted)]">Monto</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[var(--fiscal-muted)]">Faltantes</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[var(--fiscal-muted)]">Checklist</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[var(--fiscal-muted)]">Alertas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!loading && bandeja.length === 0 && (
                  <tr><td className="px-4 py-8 text-center text-sm text-[var(--fiscal-muted)]" colSpan={9}>No hay operaciones pendientes en esta bandeja con los filtros actuales.</td></tr>
                )}
                {bandeja.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{item.proveedor_nombre}</p>
                      <p className="text-[11px] font-mono text-slate-400">{item.proveedor_rfc}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{item.empresa_nombre}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{item.perfil_validacion}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${RISK_BADGE[item.riesgo_nivel] || ""}`}>
                        {item.riesgo_nivel} · {item.riesgo_score}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${VALIDACION_BADGE[item.estatus_validacion] || "border-slate-200 bg-slate-50 text-slate-600"}`}>
                        {item.estatus_validacion}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {Number(item.monto).toLocaleString("es-MX", { style: "currency", currency: item.moneda || "MXN" })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.faltantes.length > 0
                        ? <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">{item.faltantes.length}</span>
                        : <span className="text-xs text-slate-300">0</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.checklists_resumen.length > 0 ? (
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${item.checklists_resumen.some((checklist) => checklist.requeridos_pendientes > 0) ? "border-blue-200 bg-blue-50 text-blue-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                          {item.checklists_resumen.reduce((acc, checklist) => acc + checklist.requeridos_pendientes, 0)} req.
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.alertas_activas.length > 0
                        ? <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">{item.alertas_activas.length}</span>
                        : <span className="text-xs text-slate-300">0</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
