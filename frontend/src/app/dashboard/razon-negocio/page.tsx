"use client";

import { PasteUrlField } from "../../../components/PasteUrlField";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookOpenCheck, Building2, FileSearch, Search, ShieldCheck, Stamp } from "lucide-react";

import { DashboardShell } from "../../../components/DashboardShell";
import { GuiaContador } from "../../../components/GuiaContador";
import { MobileDataList } from "../../../components/MobileDataList";
import { alertError, alertSuccess } from "../../../lib/alerts";
import { apiFetch } from "../../../lib/api";
import {
  actualizarAprobacionRazon,
  crearAprobacionRazon,
  fetchAprobacionesRazon,
  RazonNegocioAprobacion,
} from "../../../lib/contracts";

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type ContratoLite = {
  id: number;
  nombre: string;
  empresa: number;
  proveedor: number | null;
  proveedor_nombre: string | null;
  razon_negocio?: string;
  beneficio_economico_esperado?: string | null;
  beneficio_fiscal_estimado?: string | null;
};

/* ──────────────────────── Constants & Helpers ──────────────────────── */

const ROLES: Array<{ value: RazonNegocioAprobacion["rol"]; label: string }> = [
  { value: "SOLICITANTE", label: "Solicitante" },
  { value: "RESPONSABLE_AREA", label: "Responsable del área" },
  { value: "COMPLIANCE", label: "Compliance / Legal" },
  { value: "FISCAL", label: "Fiscal" },
  { value: "DIRECTOR", label: "Dirección" },
];

const ESTADOS: Array<{
  value: RazonNegocioAprobacion["estado"];
  label: string;
}> = [
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "APROBADO", label: "Aprobado" },
  { value: "RECHAZADO", label: "Rechazado" },
];

const estadoColor: Record<RazonNegocioAprobacion["estado"], string> = {
  PENDIENTE: "bg-[var(--fiscal-warning-soft)] text-[var(--fiscal-warning)] border-[rgba(166,103,31,0.22)]",
  APROBADO: "bg-[var(--fiscal-success-soft)] text-[var(--fiscal-success)] border-[rgba(31,122,90,0.22)]",
  RECHAZADO: "bg-[var(--fiscal-danger-soft)] text-[var(--fiscal-danger)] border-[rgba(160,67,61,0.22)]",
};

const rolIcon: Record<RazonNegocioAprobacion["rol"], string> = {
  SOLICITANTE: "📋",
  RESPONSABLE_AREA: "👤",
  COMPLIANCE: "⚖️",
  FISCAL: "🏛️",
  DIRECTOR: "🏢",
};

const approvalLabelCls =
  "text-xs font-semibold uppercase tracking-wide text-[var(--fiscal-muted)]";

const approvalInputCls = (invalid: boolean) =>
  `mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-[var(--fiscal-ink)] focus:bg-white focus:outline-none focus:ring-2 disabled:bg-[rgba(244,242,237,0.55)] disabled:text-[var(--fiscal-muted)] placeholder:text-[var(--fiscal-muted)]/70 transition ${
    invalid
      ? "border-[rgba(160,67,61,0.38)] bg-[var(--fiscal-danger-soft)]/45 focus:border-[var(--fiscal-danger)] focus:ring-[rgba(160,67,61,0.16)]"
      : "border-[rgba(200,192,177,0.8)] focus:border-[var(--fiscal-accent)] focus:ring-[rgba(45,91,136,0.12)]"
  }`;

const approvalHintCls = "mt-1 text-xs font-medium text-[var(--fiscal-danger)]";

/* ── Indicador BE vs. BF (Art. 5-A CFF Reforma 2026) ─────────────────── */
function BeFbIndicador({ contrato }: { contrato: ContratoLite }) {
  const be = parseFloat(contrato.beneficio_economico_esperado ?? "0") || 0;
  const bf = parseFloat(contrato.beneficio_fiscal_estimado ?? "0") || 0;

  const fmt = (n: number) =>
    `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (!be && !bf) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-[rgba(200,192,177,0.72)] bg-[rgba(244,242,237,0.55)] px-4 py-4">
        <div className="flex items-center gap-2">
          <FileSearch className="h-5 w-5 text-[var(--fiscal-muted)]/60" />
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--fiscal-muted)]">
            Beneficio económico vs. fiscal
          </p>
        </div>
        <p className="mt-2 text-sm text-[var(--fiscal-muted)]">
          Sin datos registrados. Edita el contrato y captura el{" "}
          <strong className="text-[var(--fiscal-ink)]">beneficio económico esperado</strong> y el{" "}
          <strong className="text-[var(--fiscal-ink)]">beneficio fiscal estimado</strong> para activar este indicador.
        </p>
      </div>
    );
  }

  const cumple = be > bf;
  const diferencia = be - bf;
  const pct = bf > 0 ? ((diferencia / bf) * 100).toFixed(1) : null;

  return (
    <div
      className={`mt-4 rounded-2xl border p-4 ${
        cumple
          ? "border-[rgba(31,122,90,0.22)] bg-gradient-to-br from-[var(--fiscal-success-soft)] to-white"
          : "border-[rgba(160,67,61,0.22)] bg-gradient-to-br from-[var(--fiscal-danger-soft)] to-white"
      }`}
    >
      {/* Encabezado con semáforo */}
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${cumple ? "bg-white/80" : "bg-white/80"}`}>
          <span className="text-lg">{cumple ? "✅" : "⛔"}</span>
        </div>
        <div>
          <p className={`text-sm font-bold ${cumple ? "text-[var(--fiscal-success)]" : "text-[var(--fiscal-danger)]"}`}>
            {cumple
              ? "BE > BF — cumple Art. 5-A CFF"
              : "BE ≤ BF — RIESGO Art. 5-A CFF"}
          </p>
          <p className="text-xs text-[var(--fiscal-muted)]">
            Beneficio Económico vs Beneficio Fiscal
          </p>
        </div>
      </div>

      {/* Desglose de valores */}
      <div className="mt-3 grid grid-cols-1 gap-3 rounded-xl border border-[rgba(200,192,177,0.55)] bg-white p-3 text-center text-xs shadow-panel sm:grid-cols-3">
        <div>
          <p className="font-semibold uppercase tracking-wider text-[var(--fiscal-muted)]">BE</p>
          <p className={`mt-1 text-base font-bold ${cumple ? "text-[var(--fiscal-success)]" : "text-[var(--fiscal-ink)]"}`}>
            {fmt(be)}
          </p>
        </div>
        <div className="border-y border-[rgba(200,192,177,0.55)] py-2 sm:border-x sm:border-y-0 sm:py-0">
          <p className="font-semibold uppercase tracking-wider text-[var(--fiscal-muted)]">BF</p>
          <p className="mt-1 text-base font-bold text-[var(--fiscal-ink)]">{fmt(bf)}</p>
        </div>
        <div>
          <p className="font-semibold uppercase tracking-wider text-[var(--fiscal-muted)]">
            Δ Diferencia
          </p>
          <p className={`mt-1 text-base font-bold ${cumple ? "text-[var(--fiscal-success)]" : "text-[var(--fiscal-danger)]"}`}>
            {fmt(diferencia)}
            {pct !== null && (
              <span className="ml-1 text-xs font-normal opacity-70">
                ({cumple ? "+" : ""}{pct}%)
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Alerta cuando no cumple */}
      {!cumple && (
        <div className="mt-3 rounded-xl border border-[rgba(160,67,61,0.22)] bg-[var(--fiscal-danger-soft)] px-3 py-2.5 text-xs text-[var(--fiscal-danger)]">
          <p className="font-semibold">⚠️ Acción requerida (Reforma 2026)</p>
          <p className="mt-1">
            El beneficio fiscal supera al económico. El SAT puede recaracterizar
            este contrato conforme al Art. 5-A CFF. Opciones:
          </p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            <li>Actualiza el monto del <strong>beneficio económico</strong> en el contrato si está subestimado.</li>
            <li>Documenta en la <strong>razón de negocio</strong> el beneficio cualitativo adicional.</li>
            <li>Registra una aprobación de <strong>Compliance</strong> con el análisis de sustancia económica.</li>
          </ul>
        </div>
      )}
    </div>
  );
}

/* ── Visual del flujo de aprobaciones escalonado ──────────────────────── */
function FlujoAprobaciones({
  aprobaciones,
}: {
  aprobaciones: RazonNegocioAprobacion[];
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {ROLES.map((rol, idx) => {
        const ap = aprobaciones.find((a) => a.rol === rol.value);
        const estado = ap?.estado;
        let dotColor = "bg-slate-200";
        let lineColor = "bg-slate-200";
        if (estado === "APROBADO") {
          dotColor = "bg-[var(--fiscal-success)]";
          lineColor = "bg-[rgba(31,122,90,0.35)]";
        } else if (estado === "RECHAZADO") {
          dotColor = "bg-[var(--fiscal-danger)]";
          lineColor = "bg-[rgba(160,67,61,0.35)]";
        } else if (estado === "PENDIENTE") {
          dotColor = "bg-[var(--fiscal-warning)]";
        }
        return (
          <div key={rol.value} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`h-3 w-3 rounded-full ${dotColor} ring-2 ring-white shadow-sm`} />
              <p className="mt-1 whitespace-nowrap text-[10px] font-medium text-[var(--fiscal-muted)]">
                {rol.label.split(" ")[0]}
              </p>
            </div>
            {idx < ROLES.length - 1 && (
              <div className={`mx-1 h-0.5 w-6 ${estado === "APROBADO" ? lineColor : "bg-[rgba(200,192,177,0.72)]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function RazonNegocioPage() {
  const [contratos, setContratos] = useState<ContratoLite[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [aprobaciones, setAprobaciones] = useState<RazonNegocioAprobacion[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [approvalValidationRequested, setApprovalValidationRequested] = useState(false);
  const [form, setForm] = useState<{
    rol: RazonNegocioAprobacion["rol"];
    estado: RazonNegocioAprobacion["estado"];
    comentario: string;
    evidencia_url: string;
    firmado_por: string;
    firmado_email: string;
  }>({
    rol: "RESPONSABLE_AREA",
    estado: "PENDIENTE",
    comentario: "",
    evidencia_url: "",
    firmado_por: "",
    firmado_email: "",
  });

  const selectedContrato = useMemo(
    () => contratos.find((c) => c.id === selectedId) ?? null,
    [contratos, selectedId],
  );

  const filteredContratos = useMemo(() => {
    if (!searchTerm.trim()) return contratos;
    const q = searchTerm.toLowerCase();
    return contratos.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        (c.proveedor_nombre ?? "").toLowerCase().includes(q),
    );
  }, [contratos, searchTerm]);

  /* ── KPIs ─────────────────────────────────────────────────────────── */
  const kpis = useMemo(() => {
    const totalContratos = contratos.length;
    const totalAprobaciones = aprobaciones.length;
    const flujosAprobados = aprobaciones.filter((a) => a.estado === "APROBADO").length;
    const flujosRechazados = aprobaciones.filter((a) => a.estado === "RECHAZADO").length;
    const riesgoBEBF = contratos.filter((c) => {
      const be = parseFloat(c.beneficio_economico_esperado ?? "0") || 0;
      const bf = parseFloat(c.beneficio_fiscal_estimado ?? "0") || 0;
      return bf > 0 && be <= bf;
    }).length;
    return { totalContratos, totalAprobaciones, flujosAprobados, flujosRechazados, riesgoBEBF };
  }, [contratos, aprobaciones]);

  const nextRol = useMemo(() => {
    const orden = ROLES.map((r) => r.value);
    if (aprobaciones.some((a) => a.estado === "RECHAZADO")) {
      return null;
    }
    for (const rol of orden) {
      const aprobado = aprobaciones.find(
        (a) => a.rol === rol && a.estado === "APROBADO",
      );
      if (!aprobado) return rol;
    }
    return null;
  }, [aprobaciones]);

  const flujoCerrado = useMemo(() => {
    if (aprobaciones.some((a) => a.estado === "RECHAZADO")) return true;
    return aprobaciones.length > 0 && nextRol === null;
  }, [aprobaciones, nextRol]);

  const approvalRequiresSigner = form.estado !== "PENDIENTE";
  const contractMissing = approvalValidationRequested && !selectedId;
  const signerNameMissing = approvalValidationRequested && approvalRequiresSigner && !form.firmado_por.trim();
  const signerEmailMissing = approvalValidationRequested && approvalRequiresSigner && !form.firmado_email.trim();

  useEffect(() => {
    if (nextRol) {
      setForm((prev) => ({ ...prev, rol: nextRol }));
    }
  }, [nextRol]);

  const loadContratos = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await apiFetch<
        PaginatedResponse<ContratoLite> | ContratoLite[]
      >("/api/materialidad/contratos/?ordering=-created_at");
      const list = Array.isArray(payload) ? payload : (payload.results ?? []);
      setContratos(list);
      const first = list[0]?.id ?? null;
      setSelectedId(first);
      if (first) {
        await loadAprobaciones(first);
      }
    } catch (err) {
      void alertError("No pudimos cargar contratos", (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContratos();
  }, [loadContratos]);

  const loadAprobaciones = async (contratoId: number) => {
    try {
      const data = await fetchAprobacionesRazon(contratoId);
      setAprobaciones(data);
    } catch (err) {
      void alertError("No pudimos cargar aprobaciones", (err as Error).message);
    }
  };

  const handleSelectContrato = async (id: number) => {
    setSelectedId(id);
    setApprovalValidationRequested(false);
    await loadAprobaciones(id);
  };

  const extractErrorMessage = (err: unknown): string => {
    if (err instanceof Error) {
      const raw = err.message;
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === "string") return parsed;
        if (parsed?.detail) return String(parsed.detail);
        if (parsed && typeof parsed === "object") {
          const values = Object.values(parsed).flat().map(String);
          if (values.length) return values.join(" ");
        }
      } catch {
        /* ignore json parse */
      }
      return raw;
    }
    return "Error desconocido";
  };

  const handleSave = async () => {
    setApprovalValidationRequested(true);
    if (!selectedId) {
      await alertError(
        "Falta contrato",
        "Elige un contrato para registrar la aprobación",
      );
      return;
    }
    if (form.estado !== "PENDIENTE") {
      if (!form.firmado_por.trim() || !form.firmado_email.trim()) {
        await alertError(
          "Datos de aprobador",
          "Captura nombre y correo de quien aprueba/rechaza",
        );
        return;
      }
    }
    setSaving(true);
    setFormError("");
    try {
      await crearAprobacionRazon({
        contrato: selectedId,
        rol: form.rol,
        estado: form.estado,
        comentario: form.comentario,
        evidencia_url: form.evidencia_url,
        firmado_por: form.firmado_por,
        firmado_email: form.firmado_email,
      });
      await alertSuccess("Guardado", "Aprobación registrada");
      await loadAprobaciones(selectedId);
      setApprovalValidationRequested(false);
      setForm((prev) => ({
        ...prev,
        estado: "PENDIENTE",
        comentario: "",
        evidencia_url: "",
        firmado_por: "",
        firmado_email: "",
      }));
    } catch (err) {
      const message = extractErrorMessage(err);
      setFormError(message);
      await alertError("No pudimos guardar", message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6 text-slate-900">

        {/* ═══════════ HEADER — LIGHT THEME ═══════════ */}
        <header className="surface-panel-strong rounded-[1.85rem] p-6 shadow-fiscal">
          {/* Alert banner for contracts with BE ≤ BF */}
          {kpis.riesgoBEBF > 0 && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[rgba(160,67,61,0.22)] bg-[var(--fiscal-danger-soft)] px-5 py-4">
              <AlertTriangle className="mt-0.5 h-6 w-6 text-[var(--fiscal-danger)]" />
              <div>
                <p className="text-sm font-bold text-[var(--fiscal-danger)]">
                  {kpis.riesgoBEBF} contrato{kpis.riesgoBEBF > 1 ? "s" : ""} con riesgo Art. 5-A CFF
                </p>
                <p className="mt-1 text-xs text-[var(--fiscal-danger)]">
                  El beneficio fiscal supera al económico. La Reforma 2026 faculta al SAT a recaracterizar estas operaciones como carentes de razón de negocio.
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div>
              <p className="kicker-label">
                Razón de negocio
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--fiscal-ink)] sm:text-[2.8rem]">
                Aprobaciones Art. 5-A
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--fiscal-muted)] sm:text-base">
                Define la necesidad, monto esperado y registra quién autoriza
                cada contrato antes de ejecutar.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <div className="rounded-full border border-[rgba(45,91,136,0.18)] bg-[var(--fiscal-accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--fiscal-accent)]">
                  Sustancia económica previa a ejecución
                </div>
                <div className="rounded-full border border-[rgba(143,240,224,0.22)] bg-[rgba(142,231,218,0.12)] px-3 py-2 text-xs font-semibold text-[var(--fiscal-gold)]">
                  Cadena deliberativa con firma y evidencia
                </div>
              </div>
            </div>
            <div className="surface-shell rounded-[1.5rem] p-5 text-white">
              <p className="eyebrow-shell">Mesa deliberativa</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-white">Cada aprobación debe probar que la operación existe por negocio, no por ahorro fiscal</h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-[rgba(220,255,250,0.78)]">
                Esta vista tiene que mostrar quién tomó la decisión, qué evidencia revisó y dónde aparece un desequilibrio entre beneficio económico y fiscal.
              </p>
              <div className="mt-4 flex justify-end">
                <GuiaContador
                  section="Razón de negocio — Art. 5-A Reforma 2026"
                  steps={[
                    {
                      title: "1. Selecciona el contrato",
                      description:
                        "Elige el contrato que requiere validación previa. <strong>Reforma 2026:</strong> el Art. 5-A ahora exige documentar la razón de negocio <em>antes</em> de ejecutar cualquier operación con impacto fiscal significativo.",
                    },
                    {
                      title: "2. Registra la aprobación escalonada",
                      description:
                        "Sigue el flujo: <strong>Solicitante → Responsable del área → Compliance → Fiscal → Dirección</strong>. Cada paso requiere nombre, correo y evidencia. La cadena de aprobaciones es tu principal defensa ante el SAT.",
                    },
                    {
                      title: "3. Documenta el beneficio económico cuantificable",
                      description:
                        "La Reforma 2026 exige que el <strong>beneficio económico sea mayor al beneficio fiscal</strong>. Captura el monto, cómo se midió y quién lo validó. Genérico como 'mejorar eficiencia' ya no es suficiente.",
                    },
                    {
                      title: "4. Verifica que el flujo esté completo",
                      description:
                        "El historial muestra todas las aprobaciones. El flujo se cierra cuando todos aprueban o alguno rechaza. <strong>Guarda el PDF del historial</strong> como evidencia ante una revisión del SAT.",
                    },
                  ]}
                  concepts={[
                    {
                      term: "Art. 5-A CFF (Reforma 2026)",
                      definition:
                        "Los actos jurídicos que carezcan de razón de negocio y generen un beneficio fiscal directo o indirecto tendrán efectos fiscales conforme a la realidad económica. La Reforma 2026 amplió la presunción de simulación a operaciones entre partes independientes.",
                    },
                    {
                      term: "Razón de negocio",
                      definition:
                        "Justificación económica válida e independiente del ahorro fiscal que pudiera generar. Debe ser <strong>cuantificable</strong>, <strong>previa a la operación</strong> y <strong>documentada</strong> formalmente por área responsable.",
                    },
                    {
                      term: "Beneficio económico vs fiscal",
                      definition:
                        "Reforma 2026: el SAT puede recaracterizar operaciones si el beneficio fiscal (ahorro en impuestos) supera al económico (ahorro real, ingresos adicionales, reducción de riesgos). El beneficio económico siempre debe ser el motivo principal.",
                    },
                    {
                      term: "Flujo de aprobaciones",
                      definition:
                        "Cadena escalonada de autorizaciones que constituye la evidencia de que la decisión empresarial fue tomada de forma deliberada, informada y por los órganos competentes — no solo por motivos fiscales.",
                    },
                  ]}
                  tips={[
                    "<strong>Reforma 2026:</strong> Ya no basta con justificar la razón de negocio después de una revisión del SAT. Debe estar documentada <em>previa</em> a la operación.",
                    "Cuantifica el beneficio económico en pesos o porcentaje: 'Reducción de costo del 18%' es mejor que 'mejorar eficiencia operativa'.",
                    "Si un rol rechaza, el flujo se cierra. Resuelve la observación <strong>antes de ejecutar</strong> el contrato y crea un nuevo ciclo de aprobaciones.",
                    "Guarda el historial de aprobaciones en el expediente del contrato — puede pedirse en visitas domiciliarias del SAT (Art. 48 CFF).",
                  ]}
                />
              </div>
            </div>
          </div>

          {/* ── KPI Row ─────────────────────────────────────────────── */}
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-[rgba(200,192,177,0.72)] bg-[rgba(244,242,237,0.62)] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-2xl font-bold text-[var(--fiscal-ink)]">{kpis.totalContratos}</p>
                  <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--fiscal-muted)]">Contratos</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 shadow-panel">
                  <BookOpenCheck className="h-5 w-5 text-[var(--fiscal-muted)]" />
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-[rgba(31,122,90,0.18)] bg-[var(--fiscal-success-soft)] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-2xl font-bold text-[var(--fiscal-success)]">{kpis.flujosAprobados}</p>
                  <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--fiscal-success)]/80">Aprobados</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 shadow-panel">
                  <ShieldCheck className="h-5 w-5 text-[var(--fiscal-success)]" />
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-[rgba(166,103,31,0.18)] bg-[var(--fiscal-warning-soft)] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-2xl font-bold text-[var(--fiscal-warning)]">{kpis.totalAprobaciones - kpis.flujosAprobados - kpis.flujosRechazados}</p>
                  <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--fiscal-warning)]/80">Pendientes</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 shadow-panel">
                  <Stamp className="h-5 w-5 text-[var(--fiscal-warning)]" />
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-[rgba(160,67,61,0.18)] bg-[var(--fiscal-danger-soft)] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-2xl font-bold text-[var(--fiscal-danger)]">{kpis.riesgoBEBF}</p>
                  <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--fiscal-danger)]/80">Riesgo BE≤BF</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 shadow-panel">
                  <AlertTriangle className="h-5 w-5 text-[var(--fiscal-danger)]" />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ═══════════ MAIN GRID ═══════════ */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* ── Panel izquierdo: Lista de contratos ─────────────────── */}
          <div className="surface-panel rounded-[1.75rem] p-5 shadow-fiscal lg:col-span-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="kicker-label">
                  Contratos
                </p>
                <h2 className="font-display text-xl font-semibold text-[var(--fiscal-ink)]">
                  Selecciona un contrato
                </h2>
              </div>
              <span className="rounded-full border border-[rgba(45,91,136,0.18)] bg-[var(--fiscal-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--fiscal-accent)]">
                {filteredContratos.length}
              </span>
            </div>

            {/* Buscador */}
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fiscal-muted)]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar contrato o proveedor…"
                className="w-full rounded-xl border border-[rgba(200,192,177,0.8)] bg-white py-2 pl-9 pr-3 text-sm text-[var(--fiscal-ink)] placeholder:text-[var(--fiscal-muted)]/70 focus:border-[var(--fiscal-accent)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.12)] transition"
              />
            </div>

            <div className="mt-3 space-y-2 max-h-[520px] overflow-y-auto pr-1 scrollbar-thin">
              {loading && (
                <div className="flex items-center gap-2 py-6 justify-center">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--fiscal-accent)] border-t-transparent" />
                  <p className="text-sm text-[var(--fiscal-muted)]">Cargando contratos con lectura 5-A…</p>
                </div>
              )}
              {!loading && filteredContratos.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[rgba(200,192,177,0.72)] bg-[rgba(244,242,237,0.45)] py-8 text-center">
                  <BookOpenCheck className="mx-auto h-10 w-10 text-[var(--fiscal-muted)]/50" />
                  <p className="mt-2 text-sm text-[var(--fiscal-muted)]">
                    {searchTerm ? "No encontramos contratos para esta búsqueda." : "Todavía no hay contratos listos para evaluación de razón de negocio."}
                  </p>
                </div>
              )}
              {!loading &&
                filteredContratos.map((c) => {
                  const isActive = c.id === selectedId;
                  const be = parseFloat(c.beneficio_economico_esperado ?? "0") || 0;
                  const bf = parseFloat(c.beneficio_fiscal_estimado ?? "0") || 0;
                  const tieneRiesgo = bf > 0 && be <= bf;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        void handleSelectContrato(c.id);
                      }}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                        isActive
                          ? "border-[rgba(45,91,136,0.28)] bg-[var(--fiscal-accent-soft)]/55 text-[var(--fiscal-ink)] shadow-panel"
                          : "border-[rgba(200,192,177,0.65)] bg-[rgba(244,242,237,0.45)] text-[var(--fiscal-ink)] hover:border-[rgba(45,91,136,0.18)] hover:bg-white hover:shadow-panel"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{c.nombre}</p>
                          <p className="truncate text-xs text-[var(--fiscal-muted)]">
                            {c.proveedor_nombre || "Sin proveedor"}
                          </p>
                        </div>
                        {tieneRiesgo && (
                          <span className="mt-0.5 flex-shrink-0 rounded-full border border-[rgba(160,67,61,0.22)] bg-[var(--fiscal-danger-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--fiscal-danger)]">
                            ⚠ BE≤BF
                          </span>
                        )}
                      </div>
                      {c.beneficio_economico_esperado && (
                        <p className="mt-1 text-[11px] font-medium text-[var(--fiscal-success)]">
                          BE: ${c.beneficio_economico_esperado}
                        </p>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>

          {/* ── Panel derecho: Formulario + Historial ───────────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Flujo visual de aprobaciones */}
            {selectedContrato && aprobaciones.length > 0 && (
              <div className="surface-panel rounded-[1.75rem] px-5 py-4 shadow-fiscal">
                <p className="mb-2 kicker-label">
                  Flujo de aprobaciones
                </p>
                <FlujoAprobaciones aprobaciones={aprobaciones} />
              </div>
            )}

            {/* ── Formulario de nueva aprobación ─────────────────── */}
            <div className="surface-panel rounded-[1.75rem] p-5 shadow-fiscal">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="kicker-label">
                    Registro
                  </p>
                  <h3 className="font-display text-xl font-semibold text-[var(--fiscal-ink)]">
                    Nueva aprobación
                  </h3>
                  <p className="text-sm text-[var(--fiscal-muted)]">
                    Captura quién aprueba/rechaza y adjunta evidencia de la
                    decisión.
                  </p>
                </div>
                {selectedContrato && (
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-semibold text-[var(--fiscal-ink)]">
                      {selectedContrato.nombre}
                    </p>
                    <p className="text-xs text-[var(--fiscal-muted)]">
                      {selectedContrato.proveedor_nombre || "Sin proveedor"}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-3 rounded-2xl border border-[rgba(160,67,61,0.16)] bg-[var(--fiscal-danger-soft)]/45 px-4 py-3 text-sm text-[var(--fiscal-ink)]">
                <p className="font-semibold text-[var(--fiscal-danger)]">Campos obligatorios para guardar</p>
                <p className="mt-1 text-xs text-[var(--fiscal-muted)]">
                  Debes tener un contrato seleccionado. Si el estado cambia a aprobado o rechazado, también debes capturar nombre y correo de quien firma la decisión.
                </p>
              </div>

              {contractMissing && (
                <div className="mt-3 flex items-start gap-2 rounded-2xl border border-[rgba(160,67,61,0.22)] bg-[var(--fiscal-danger-soft)] px-4 py-3 text-sm text-[var(--fiscal-danger)]">
                  <span className="mt-0.5">❌</span>
                  <p>Selecciona un contrato en la columna izquierda antes de registrar la aprobación.</p>
                </div>
              )}

              {selectedContrato && (
                <BeFbIndicador contrato={selectedContrato} />
              )}

              {flujoCerrado && (
                <div className="mt-3 flex items-start gap-2 rounded-2xl border border-[rgba(31,122,90,0.22)] bg-[var(--fiscal-success-soft)] px-4 py-3 text-sm text-[var(--fiscal-success)]">
                  <span className="mt-0.5">✅</span>
                  <div>
                    <p className="font-semibold">Flujo concluido</p>
                    <p className="text-xs text-[var(--fiscal-success)]">
                      El ciclo de aprobaciones ya fue completado (aprobado o rechazado). No se pueden agregar más pasos.
                    </p>
                  </div>
                </div>
              )}

              {!flujoCerrado && nextRol && (
                <div className="mt-3 flex items-center gap-2 rounded-2xl border border-[rgba(45,91,136,0.22)] bg-[var(--fiscal-accent-soft)] px-4 py-3 text-sm text-[var(--fiscal-accent)]">
                  <span>{rolIcon[nextRol] || "📋"}</span>
                  <p>
                    Próximo rol esperado:{" "}
                    <span className="font-bold text-[var(--fiscal-ink)]">
                      {ROLES.find((r) => r.value === nextRol)?.label}
                    </span>
                  </p>
                </div>
              )}

              {formError && (
                <div className="mt-3 flex items-start gap-2 rounded-2xl border border-[rgba(160,67,61,0.22)] bg-[var(--fiscal-danger-soft)] px-4 py-3 text-sm text-[var(--fiscal-danger)]">
                  <span className="mt-0.5">❌</span>
                  <p>{formError}</p>
                </div>
              )}

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <label className={approvalLabelCls}>
                      Rol <span className="font-bold text-[var(--fiscal-danger)]">*</span>
                    </label>
                    <select
                      value={form.rol}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          rol: e.target.value as RazonNegocioAprobacion["rol"],
                        }))
                      }
                      className={approvalInputCls(false)}
                      disabled={flujoCerrado}
                    >
                      {ROLES.map((r) => (
                        <option
                          key={r.value}
                          value={r.value}
                          disabled={Boolean(nextRol && r.value !== nextRol)}
                        >
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={approvalLabelCls}>
                      Estado <span className="font-bold text-[var(--fiscal-danger)]">*</span>
                    </label>
                    <select
                      value={form.estado}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          estado: e.target
                            .value as RazonNegocioAprobacion["estado"],
                        }))
                      }
                      className={approvalInputCls(false)}
                      disabled={flujoCerrado}
                    >
                      {ESTADOS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={approvalLabelCls}>
                      Evidencia (URL)
                    </label>
                    <PasteUrlField
                      value={form.evidencia_url}
                      onChange={(v) => setForm((prev) => ({ ...prev, evidencia_url: v }))}
                      placeholder="Carpeta de aprobaciones, correo o acta"
                      className="mt-1 rounded-xl border border-[rgba(200,192,177,0.8)] bg-white py-2.5 text-sm text-[var(--fiscal-ink)] focus:border-[var(--fiscal-accent)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.12)] disabled:bg-[rgba(244,242,237,0.55)] disabled:text-[var(--fiscal-muted)] placeholder:text-[var(--fiscal-muted)]/70 transition"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className={approvalLabelCls}>
                        Nombre aprobador {approvalRequiresSigner ? <span className="font-bold text-[var(--fiscal-danger)]">*</span> : <span className="text-[var(--fiscal-muted)]/80">(opcional)</span>}
                      </label>
                      <input
                        value={form.firmado_por}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            firmado_por: e.target.value,
                          }))
                        }
                        className={approvalInputCls(signerNameMissing)}
                        placeholder="Quien autoriza"
                      />
                      {signerNameMissing && (
                        <p className={approvalHintCls}>Captura quién aprueba o rechaza esta decisión.</p>
                      )}
                    </div>
                    <div>
                      <label className={approvalLabelCls}>
                        Correo {approvalRequiresSigner ? <span className="font-bold text-[var(--fiscal-danger)]">*</span> : <span className="text-[var(--fiscal-muted)]/80">(opcional)</span>}
                      </label>
                      <input
                        type="email"
                        value={form.firmado_email}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            firmado_email: e.target.value,
                          }))
                        }
                        className={approvalInputCls(signerEmailMissing)}
                        placeholder="correo@empresa.com"
                      />
                      {signerEmailMissing && (
                        <p className={approvalHintCls}>Captura el correo de la persona que firma la aprobación o rechazo.</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className={approvalLabelCls}>
                      Comentarios
                    </label>
                    <textarea
                      value={form.comentario}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          comentario: e.target.value,
                        }))
                      }
                      rows={3}
                      className={approvalInputCls(false)}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    void handleSave();
                  }}
                  disabled={saving || !selectedId || flujoCerrado}
                  className="button-institutional rounded-full px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Guardando…
                    </span>
                  ) : (
                    "Guardar aprobación"
                  )}
                </button>
              </div>
            </div>

            {/* ── Historial de aprobaciones ───────────────────────── */}
            <div className="surface-panel rounded-[1.75rem] p-5 shadow-fiscal">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="kicker-label">
                    Historial
                  </p>
                  <h3 className="font-display text-xl font-semibold text-[var(--fiscal-ink)]">
                    Aprobaciones registradas
                  </h3>
                  <p className="text-sm text-[var(--fiscal-muted)]">
                    Constancia con rol, nombre, evidencia y fecha.
                  </p>
                </div>
                <span className="rounded-full border border-[rgba(45,91,136,0.18)] bg-[var(--fiscal-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--fiscal-accent)]">
                  {aprobaciones.length}
                </span>
              </div>
              <MobileDataList
                items={aprobaciones}
                getKey={(aprobacion) => aprobacion.id}
                className="mt-4"
                empty={(
                  <div className="rounded-2xl border border-dashed border-[rgba(200,192,177,0.72)] bg-[rgba(244,242,237,0.45)] px-5 py-8 text-center text-[var(--fiscal-muted)]">
                    <Stamp className="mx-auto h-10 w-10 text-[var(--fiscal-muted)]/45" />
                    <p className="mt-2 text-sm">Todavía no hay aprobaciones registradas para este contrato.</p>
                  </div>
                )}
                renderItem={(ap) => (
                  <article className="rounded-[1.35rem] border border-[rgba(200,192,177,0.72)] bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{rolIcon[ap.rol] || "📋"}</span>
                          <span className="font-medium text-[var(--fiscal-ink)]">
                            {ROLES.find((r) => r.value === ap.rol)?.label ?? ap.rol}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-slate-900">{ap.firmado_por || "—"}</p>
                        <p className="text-xs text-[var(--fiscal-muted)]">{ap.firmado_email || ""}</p>
                      </div>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${estadoColor[ap.estado]}`}>
                        {ap.estado}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-[rgba(244,242,237,0.55)] px-3 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">Evidencia</p>
                        <div className="mt-1">
                          {ap.evidencia_url ? (
                            <a
                              href={ap.evidencia_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-[var(--fiscal-accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--fiscal-accent)] transition hover:bg-[var(--fiscal-accent-soft)]/70"
                            >
                              📎 Ver
                            </a>
                          ) : (
                            <span className="text-xs text-[var(--fiscal-muted)]">N/A</span>
                          )}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-[rgba(244,242,237,0.55)] px-3 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">Fecha</p>
                        <p className="mt-1 text-xs text-[var(--fiscal-muted)]">{ap.decidido_en || ap.created_at}</p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">Comentario</p>
                      <p className="mt-1 text-sm text-[var(--fiscal-muted)] break-words">{ap.comentario || "—"}</p>
                    </div>
                  </article>
                )}
              />

              <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-[rgba(200,192,177,0.72)] bg-white lg:block">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-[rgba(244,242,237,0.88)]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--fiscal-muted)]">Rol</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--fiscal-muted)]">Estado</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--fiscal-muted)]">Aprobador</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--fiscal-muted)]">Evidencia</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--fiscal-muted)]">Comentario</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--fiscal-muted)]">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {aprobaciones.length === 0 && (
                      <tr>
                        <td
                          className="px-4 py-10 text-center text-[var(--fiscal-muted)]"
                          colSpan={6}
                        >
                          <Stamp className="mx-auto h-10 w-10 text-[var(--fiscal-muted)]/45" />
                          <p className="mt-2 text-sm">Todavía no hay aprobaciones registradas para este contrato.</p>
                        </td>
                      </tr>
                    )}
                    {aprobaciones.map((ap) => (
                      <tr key={ap.id} className="transition-colors hover:bg-[rgba(244,242,237,0.45)]">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{rolIcon[ap.rol] || "📋"}</span>
                            <span className="font-medium text-[var(--fiscal-ink)]">
                              {ROLES.find((r) => r.value === ap.rol)?.label ?? ap.rol}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${estadoColor[ap.estado]}`}
                          >
                            {ap.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">
                            {ap.firmado_por || "—"}
                          </p>
                          <p className="text-xs text-[var(--fiscal-muted)]">
                            {ap.firmado_email || ""}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {ap.evidencia_url ? (
                            <a
                              href={ap.evidencia_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-[var(--fiscal-accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--fiscal-accent)] transition hover:bg-[var(--fiscal-accent-soft)]/70"
                            >
                              📎 Ver
                            </a>
                          ) : (
                            <span className="text-xs text-[var(--fiscal-muted)]">N/A</span>
                          )}
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-3 text-[var(--fiscal-muted)]">
                          {ap.comentario || "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--fiscal-muted)]">
                          {ap.decidido_en || ap.created_at}
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
