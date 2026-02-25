
"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardShell } from "../../../components/DashboardShell";
import { GuiaContador } from "../../../components/GuiaContador";
import { apiFetch } from "../../../lib/api";

/* ── Types ───────────────────────────────────────────────────── */

type Proveedor = {
  id: number;
  razon_social: string;
  rfc: string;
  estatus_sat: "SIN_COINCIDENCIA" | "PRESUNTO" | "DEFINITIVO" | null;
  sat_validado_en: string | null;
};

type Operacion = {
  id: number;
  proveedor_nombre: string;
  contrato_nombre: string | null;
  cfdi_estatus: string;
  spei_estatus: string;
  monto: string;
  moneda: string;
  fecha_operacion: string;
};

type AlertaFiscal = {
  id: string;
  nivel: "CRITICO" | "ALTO" | "MEDIO" | "INFO";
  categoria: string;
  titulo: string;
  detalle: string;
  accion: string;
  fecha: string;
};

type PaginatedResponse<T> = {
  count: number;
  results: T[];
};

/* ── Helpers ─────────────────────────────────────────────────── */

const NIVEL_STYLE: Record<AlertaFiscal["nivel"], string> = {
  CRITICO: "border-red-300 bg-red-50 text-red-900",
  ALTO: "border-orange-300 bg-orange-50 text-orange-900",
  MEDIO: "border-amber-200 bg-amber-50 text-amber-900",
  INFO: "border-sky-200 bg-sky-50 text-sky-900",
};

const NIVEL_BADGE: Record<AlertaFiscal["nivel"], string> = {
  CRITICO: "bg-red-600 text-white",
  ALTO: "bg-orange-500 text-white",
  MEDIO: "bg-amber-500 text-white",
  INFO: "bg-sky-500 text-white",
};

const NIVEL_ICON: Record<AlertaFiscal["nivel"], string> = {
  CRITICO: "⛔",
  ALTO: "🔴",
  MEDIO: "⚠️",
  INFO: "ℹ️",
};

/* ── Checklist Pre-Auditoría ─────────────────────────────────── */

const CHECKLIST_PREAUDITORIA = [
  { id: "c1", texto: "Expediente por proveedor: CSF < 3 meses, REPS, IMSS patronal, fotos domicilio", urgente: true },
  { id: "c2", texto: "Todos los proveedores validados contra Art. 69-B SAT este trimestre", urgente: true },
  { id: "c3", texto: "Memo de análisis de riesgo para proveedores PRESUNTO o DEFINITIVO", urgente: true },
  { id: "c4", texto: "Cada operación > $100,000 tiene entregables con evidencia ligada", urgente: true },
  { id: "c5", texto: "CFDI y SPEI conciliados por operación (no solo por monto global)", urgente: false },
  { id: "c6", texto: "Contratos con cláusula de razón de negocio y penalidades firmados", urgente: false },
  { id: "c7", texto: "Flujo de aprobaciones Art. 5-A completado para contratos clave", urgente: false },
  { id: "c8", texto: "Pólizas contables por operación con NIF aplicable registrada", urgente: false },
  { id: "c9", texto: "Intercompañías con estudio de precios de transferencia actualizado", urgente: false },
  { id: "c10", texto: "Instalaciones y procesos documentados con video/foto (Art. 48 CFF)", urgente: false },
];

/* ── Component ───────────────────────────────────────────────── */

export default function AlertasPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [operaciones, setOperaciones] = useState<Operacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const toggleCheck = (id: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [provRes, opRes] = await Promise.all([
        apiFetch<PaginatedResponse<Proveedor> | Proveedor[]>("/api/materialidad/proveedores/"),
        apiFetch<PaginatedResponse<Operacion> | Operacion[]>("/api/materialidad/operaciones/?ordering=-fecha_operacion"),
      ]);
      const provList = Array.isArray(provRes) ? provRes : provRes.results ?? [];
      const opList = Array.isArray(opRes) ? opRes : opRes.results ?? [];
      setProveedores(provList);
      setOperaciones(opList);
    } catch {
      /* silently handled */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  /* ── Generar alertas dinámicas ──────────────────────────── */
  const alertas: AlertaFiscal[] = [];

  // Alertas 69-B por proveedor
  proveedores
    .filter((p) => p.estatus_sat === "DEFINITIVO" || p.estatus_sat === "PRESUNTO")
    .forEach((p) => {
      alertas.push({
        id: `prov-${p.id}`,
        nivel: p.estatus_sat === "DEFINITIVO" ? "CRITICO" : "ALTO",
        categoria: "Art. 69-B CFF",
        titulo: `${p.razon_social} — ${p.estatus_sat}`,
        detalle:
          p.estatus_sat === "DEFINITIVO"
            ? `EFOS DEFINITIVO: Las deducciones con ${p.razon_social} (${p.rfc}) serán rechazadas. Continuar operando puede tipificar delito fiscal como EDO (Art. 69-B CFF Reforma 2026).`
            : `EFOS PRESUNTO: ${p.razon_social} (${p.rfc}) está en proceso de resolución. Documenta análisis de riesgo por escrito y considera retención de IVA.`,
        accion:
          p.estatus_sat === "DEFINITIVO"
            ? "Suspende pagos pendientes y consulta a tu abogado fiscal"
            : "Crea memo de análisis de riesgo y valida su estado cada 30 días",
        fecha: p.sat_validado_en ?? new Date().toISOString().slice(0, 10),
      });
    });

  // Alertas de operaciones sin materialidad completa
  operaciones
    .filter((op) => op.cfdi_estatus === "VALIDO" && !op.contrato_nombre)
    .slice(0, 5)
    .forEach((op) => {
      alertas.push({
        id: `op-${op.id}`,
        nivel: "ALTO",
        categoria: "Materialidad incompleta",
        titulo: `Operación ${op.proveedor_nombre} — CFDI sin contrato`,
        detalle: `Operación del ${op.fecha_operacion} por $${Number(op.monto).toLocaleString("es-MX")} ${op.moneda} tiene CFDI válido pero NO está vinculada a un contrato. Reforma 2026 exige sustancia documental completa.`,
        accion: "Vincula la operación a un contrato o genera uno desde el módulo de contratos",
        fecha: op.fecha_operacion,
      });
    });

  // Alerta de validación 69-B vencida (> 90 días)
  const provSinValidar = proveedores.filter((p) => {
    if (!p.sat_validado_en) return true;
    const dias = Math.floor((Date.now() - new Date(p.sat_validado_en).getTime()) / 86400000);
    return dias > 90;
  });
  if (provSinValidar.length > 0) {
    alertas.push({
      id: "val-vencida",
      nivel: "MEDIO",
      categoria: "Due diligence periódico",
      titulo: `${provSinValidar.length} proveedor${provSinValidar.length > 1 ? "es" : ""} sin validación 69-B reciente`,
      detalle: `La Reforma 2026 exige due diligence trimestral. ${provSinValidar.length} proveedor${provSinValidar.length > 1 ? "es tienen" : " tiene"} más de 90 días sin validar contra las listas SAT.`,
      accion: "Dirígete al módulo Proveedores y solicita validación para cada uno",
      fecha: new Date().toISOString().slice(0, 10),
    });
  }

  // Ordenar por nivel
  const nivelOrden: Record<AlertaFiscal["nivel"], number> = { CRITICO: 0, ALTO: 1, MEDIO: 2, INFO: 3 };
  alertas.sort((a, b) => nivelOrden[a.nivel] - nivelOrden[b.nivel]);

  const urgentesCount = alertas.filter((a) => a.nivel === "CRITICO" || a.nivel === "ALTO").length;
  const checklistCompletado = checkedItems.size;
  const checklistTotal = CHECKLIST_PREAUDITORIA.length;

  return (
    <DashboardShell>
      <div className="space-y-6 text-slate-900">
        {/* Header */}
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/50 to-red-900/30 p-6 shadow-2xl shadow-red-500/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-red-300">Reforma Fiscal 2026</p>
              <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
                Alertas fiscales y pre-auditoría
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Alertas 69-B, operaciones sin materialidad y checklist de preparación ante el SAT.
              </p>
            </div>
            <GuiaContador
              section="Alertas fiscales — Reforma 2026"
              steps={[
                {
                  title: "1. Atiende alertas CRÍTICAS primero",
                  description:
                    "Las alertas en <strong>rojo (CRÍTICO)</strong> son proveedores EFOS DEFINITIVOS. Suspende pagos y consulta al abogado fiscal antes de continuar operando con ellos.",
                },
                {
                  title: "2. Documenta el análisis de riesgo",
                  description:
                    "Para alertas <strong>ALTO (PRESUNTO)</strong>: crea un memo de análisis de riesgo firmado por compliance. Es tu defensa ante el SAT si decides continuar la relación comercial.",
                },
                {
                  title: "3. Completa el checklist pre-auditoría",
                  description:
                    "El checklist contiene los <strong>10 puntos clave</strong> que el SAT revisará primero en una visita domiciliaria. Marca los que ya tienes cubiertos.",
                },
                {
                  title: "4. Revisa periódicamente",
                  description:
                    "Las alertas se actualizan al cargar la página. Revisa <strong>al menos 1 vez al mes</strong> — un proveedor puede aparecer en 69-B sin previo aviso.",
                },
              ]}
              concepts={[
                {
                  term: "EFOS Definitivo",
                  definition:
                    "Proveedor publicado en el DOF como definitivamente declarado por el SAT como emisor de operaciones simuladas. Cualquier CFDI emitido es inválido para efectos fiscales.",
                },
                {
                  term: "EDO — Reforma 2026",
                  definition:
                    "Empresa Que Deduce Operaciones Simuladas. La Reforma 2026 tipifica como delito penal al receptor que sabía o debía saber que el CFDI correspondía a una operación simulada.",
                },
                {
                  term: "CSD (Certificado de Sello Digital)",
                  definition:
                    "Certificado necesario para emitir CFDIs. El SAT puede restringirlo (Art. 17-H Bis) si detecta que recibes CFDIs de EFOS, bloqueando toda tu facturación.",
                },
                {
                  term: "Due diligence periódico",
                  definition:
                    "La Reforma 2026 establece que el deber de cuidado del contribuyente incluye validar trimestral o semestralmente a sus proveedores habituales contra las listas 69-B del SAT.",
                },
              ]}
              tips={[
                "<strong>⛔ Crítico:</strong> Un EFOS DEFINITIVO en tu lista de proveedores activos es una contingencia fiscal inmediata — actúa hoy.",
                "La restricción del CSD puede ocurrir en 24-48 horas si el SAT detecta patrones de EFOS en tus datos.",
                "Guarda evidencia de tu due diligence (capturas SAT con fecha/hora) — es tu principal defensa ante el SAT.",
                "Revisa el checklist antes de cualquier auditoría, ACDO o carta-invitación del SAT.",
              ]}
            />
          </div>

          {/* KPIs */}
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-slate-400">Alertas activas</p>
              <p className={`mt-1 text-3xl font-bold ${urgentesCount > 0 ? "text-red-400" : "text-emerald-400"}`}>
                {loading ? "—" : alertas.length}
              </p>
              <p className="text-xs text-slate-400">{urgentesCount} urgentes</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-slate-400">Proveedores en riesgo 69-B</p>
              <p className={`mt-1 text-3xl font-bold ${proveedores.filter((p) => p.estatus_sat && p.estatus_sat !== "SIN_COINCIDENCIA").length > 0 ? "text-red-400" : "text-emerald-400"}`}>
                {loading ? "—" : proveedores.filter((p) => p.estatus_sat && p.estatus_sat !== "SIN_COINCIDENCIA").length}
              </p>
              <p className="text-xs text-slate-400">de {proveedores.length} proveedores</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-slate-400">Checklist pre-auditoría</p>
              <p className={`mt-1 text-3xl font-bold ${checklistCompletado === checklistTotal ? "text-emerald-400" : "text-amber-400"}`}>
                {checklistCompletado}/{checklistTotal}
              </p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all ${checklistCompletado === checklistTotal ? "bg-emerald-500" : "bg-amber-400"}`}
                  style={{ width: `${(checklistCompletado / checklistTotal) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </header>

        {/* Alertas dinámicas */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Alertas detectadas
              {!loading && alertas.length > 0 && (
                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                  {alertas.length}
                </span>
              )}
            </h2>
            <button
              type="button"
              onClick={() => void loadData()}
              className="text-xs font-medium text-emerald-600 hover:text-emerald-700 transition"
            >
              ↻ Actualizar
            </button>
          </div>

          {loading && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              Analizando proveedores y operaciones…
            </div>
          )}

          {!loading && alertas.length === 0 && (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <span className="text-2xl">✅</span>
              <div>
                <p className="font-semibold text-emerald-800">Sin alertas activas</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Todos los proveedores aparecen sin coincidencia en las listas SAT y las operaciones tienen materialidad básica registrada.
                  Revisa de nuevo próxima semana.
                </p>
              </div>
            </div>
          )}

          {!loading &&
            alertas.map((alerta) => (
              <div
                key={alerta.id}
                className={`rounded-2xl border p-5 shadow-sm ${NIVEL_STYLE[alerta.nivel]}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 text-xl">{NIVEL_ICON[alerta.nivel]}</span>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${NIVEL_BADGE[alerta.nivel]}`}
                        >
                          {alerta.nivel}
                        </span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider opacity-60">
                          {alerta.categoria}
                        </span>
                      </div>
                      <p className="text-sm font-semibold">{alerta.titulo}</p>
                      <p className="text-xs opacity-80">{alerta.detalle}</p>
                    </div>
                  </div>
                  <p className="shrink-0 text-[11px] opacity-50">{alerta.fecha}</p>
                </div>
                <div className="mt-3 rounded-xl border border-current/20 bg-white/50 px-3 py-2 text-xs font-medium">
                  <span className="mr-1 font-bold">→ Acción:</span>
                  {alerta.accion}
                </div>
              </div>
            ))}
        </section>

        {/* Checklist Pre-Auditoría */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Preparación</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">
                Checklist pre-auditoría SAT — Reforma 2026
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Los 10 puntos que el SAT revisará primero en cualquier auditoría de materialidad.
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-slate-900">
                {checklistCompletado}
                <span className="text-lg text-slate-400">/{checklistTotal}</span>
              </p>
              <p className="text-xs text-slate-400">completados</p>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {CHECKLIST_PREAUDITORIA.map((item) => {
              const done = checkedItems.has(item.id);
              return (
                <label
                  key={item.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${done
                      ? "border-emerald-200 bg-emerald-50"
                      : item.urgente
                        ? "border-red-100 bg-red-50/60 hover:border-red-200"
                        : "border-slate-100 bg-slate-50 hover:border-slate-200"
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => toggleCheck(item.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-emerald-500"
                  />
                  <div className="flex-1">
                    <p className={`text-sm ${done ? "text-emerald-700 line-through" : "text-slate-800"}`}>
                      {item.texto}
                    </p>
                  </div>
                  {item.urgente && !done && (
                    <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 uppercase">
                      Urgente
                    </span>
                  )}
                  {done && (
                    <span className="shrink-0 text-emerald-500 text-lg">✓</span>
                  )}
                </label>
              );
            })}
          </div>

          {checklistCompletado === checklistTotal && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-center">
              <p className="text-sm font-bold text-emerald-800">
                🎉 ¡Checklist completo! Tu empresa está preparada para una auditoría de materialidad.
              </p>
              <p className="mt-1 text-xs text-emerald-700">
                Recuerda revisar este checklist trimestralmente o ante cualquier carta-invitación del SAT.
              </p>
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
