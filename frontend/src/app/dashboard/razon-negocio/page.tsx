"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { DashboardShell } from "../../../components/DashboardShell";
import { GuiaContador } from "../../../components/GuiaContador";
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

/* ── Indicador BE vs. BF (Art. 5-A CFF Reforma 2026) ─────────────────── */
function BeFbIndicador({ contrato }: { contrato: ContratoLite }) {
  const be = parseFloat(contrato.beneficio_economico_esperado ?? "0") || 0;
  const bf = parseFloat(contrato.beneficio_fiscal_estimado ?? "0") || 0;

  const fmt = (n: number) =>
    `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (!be && !bf) {
    return (
      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Beneficio económico vs. fiscal
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Sin datos registrados en el contrato. Edita el contrato y captura el{" "}
          <strong>beneficio económico esperado</strong> y el{" "}
          <strong>beneficio fiscal estimado</strong> para activar este indicador.
        </p>
      </div>
    );
  }

  const cumple = be > bf;
  const diferencia = be - bf;
  const pct = bf > 0 ? ((diferencia / bf) * 100).toFixed(1) : null;

  return (
    <div
      className={`mt-4 rounded-2xl border p-4 ${cumple
        ? "border-emerald-200 bg-emerald-50"
        : "border-red-200 bg-red-50"
        }`}
    >
      {/* Encabezado con semáforo */}
      <div className="flex items-center gap-2">
        <span className="text-xl">{cumple ? "🟢" : "🔴"}</span>
        <div>
          <p
            className={`text-sm font-bold ${cumple ? "text-emerald-800" : "text-red-800"
              }`}
          >
            {cumple
              ? "BE > BF — cumple Art. 5-A CFF"
              : "BE ≤ BF — RIESGO Art. 5-A CFF"}
          </p>
          <p className="text-xs text-slate-500">
            Beneficio Económico vs Beneficio Fiscal
          </p>
        </div>
      </div>

      {/* Desglose de valores */}
      <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-current/10 bg-white/60 p-3 text-center text-xs">
        <div>
          <p className="font-semibold uppercase tracking-wider text-slate-400">BE</p>
          <p className={`mt-1 text-base font-bold ${cumple ? "text-emerald-700" : "text-slate-700"}`}>
            {fmt(be)}
          </p>
        </div>
        <div>
          <p className="font-semibold uppercase tracking-wider text-slate-400">BF</p>
          <p className="mt-1 text-base font-bold text-slate-700">{fmt(bf)}</p>
        </div>
        <div>
          <p className="font-semibold uppercase tracking-wider text-slate-400">
            Δ Diferencia
          </p>
          <p
            className={`mt-1 text-base font-bold ${cumple ? "text-emerald-700" : "text-red-700"
              }`}
          >
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
        <div className="mt-3 rounded-xl border border-red-200 bg-red-100/60 px-3 py-2 text-xs text-red-800">
          <p className="font-semibold">⚠️ Acción requerida (Reforma 2026)</p>
          <p className="mt-1">
            El beneficio fiscal supera al económico. El SAT puede recaracterizar
            este contrato conforme al Art. 5-A CFF. Opciones:
          </p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            <li>Actualiza el monto del <strong>beneficio económico</strong> en el contrato si está subestimado.</li>
            <li>Documenta en la <strong>razón de negocio</strong> el beneficio cualitativo adicional (reducción de riesgo, acceso a mercado, etc.).</li>
            <li>Registra una aprobación de <strong>Compliance</strong> con el análisis de sustancia económica.</li>
          </ul>
        </div>
      )}
    </div>
  );
}

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
  PENDIENTE: "bg-amber-100 text-amber-700",
  APROBADO: "bg-emerald-100 text-emerald-700",
  RECHAZADO: "bg-flame-100 text-flame-700",
};

export default function RazonNegocioPage() {
  const [contratos, setContratos] = useState<ContratoLite[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [aprobaciones, setAprobaciones] = useState<RazonNegocioAprobacion[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string>("");
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
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/40 to-emerald-900/30 p-6 shadow-2xl shadow-emerald-500/20">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">
                Razón de negocio
              </p>
              <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-white">
                Aprobaciones Art. 5-A
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Define la necesidad, monto esperado y registra quién autoriza
                cada contrato antes de ejecutar.
              </p>
            </div>
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
                    "La Reforma 2026 exige que el <strong>beneficio económico sea mayor al beneficio fiscal</strong>. Captura el monto, cómo se midió y quién lo validó. Generico como 'mejorar eficiencia' ya no es suficiente.",
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
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg lg:col-span-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-600">
                  Contratos
                </p>
                <h2 className="text-lg font-semibold text-slate-900">
                  Selecciona un contrato
                </h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                {contratos.length}
              </span>
            </div>
            <div className="mt-4 space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {loading && <p className="text-sm text-slate-500">Cargando...</p>}
              {!loading && contratos.length === 0 && (
                <p className="text-sm text-slate-500">Aún no hay contratos.</p>
              )}
              {!loading &&
                contratos.map((c) => {
                  const isActive = c.id === selectedId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        void handleSelectContrato(c.id);
                      }}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${isActive
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-300 hover:bg-slate-100"
                        }`}
                    >
                      <p className="text-sm font-semibold">{c.nombre}</p>
                      <p className="text-xs text-slate-500">
                        {c.proveedor_nombre || "Sin proveedor"}
                      </p>
                      {c.beneficio_economico_esperado && (
                        <p className="text-[11px] font-medium text-emerald-600">
                          Beneficio esperado: ${c.beneficio_economico_esperado}
                        </p>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-emerald-600">
                    Registro
                  </p>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Nueva aprobación
                  </h3>
                  <p className="text-sm text-slate-500">
                    Captura quién aprueba/rechaza y adjunta evidencia de la
                    decisión.
                  </p>
                </div>
                {selectedContrato && (
                  <div className="text-right text-xs text-slate-500">
                    <p className="font-semibold text-slate-900">
                      {selectedContrato.nombre}
                    </p>
                    <p>
                      {selectedContrato.proveedor_nombre || "Sin proveedor"}
                    </p>
                  </div>
                )}
              </div>

              {selectedContrato && (
                <BeFbIndicador contrato={selectedContrato} />
              )}
              {flujoCerrado && (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  El flujo de aprobaciones ya concluyó (aprobado o rechazado).
                  No puedes capturar más pasos.
                </div>
              )}
              {!flujoCerrado && nextRol && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  Próximo rol esperado:{" "}
                  <span className="font-semibold text-slate-900">
                    {ROLES.find((r) => r.value === nextRol)?.label}
                  </span>
                </div>
              )}
              {formError && (
                <div className="mt-3 rounded-xl border border-flame-200 bg-flame-50 px-4 py-3 text-sm text-flame-800">
                  {formError}
                </div>
              )}
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Rol
                    </label>
                    <select
                      value={form.rol}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          rol: e.target.value as RazonNegocioAprobacion["rol"],
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400 placeholder-slate-400"
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
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Estado
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
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400 placeholder-slate-400"
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
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Evidencia (URL)
                    </label>
                    <input
                      value={form.evidencia_url}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          evidencia_url: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400 placeholder-slate-400"
                      placeholder="Carpeta de aprobaciones, correo o acta"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Nombre aprobador
                      </label>
                      <input
                        value={form.firmado_por}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            firmado_por: e.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400 placeholder-slate-400"
                        placeholder="Quien autoriza"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Correo
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
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400 placeholder-slate-400"
                        placeholder="correo@empresa.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400 placeholder-slate-400"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    void handleSave();
                  }}
                  disabled={saving || !selectedId || flujoCerrado}
                  className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"
                >
                  {saving ? "Guardando..." : "Guardar aprobación"}
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-emerald-600">
                    Historial
                  </p>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Aprobaciones registradas
                  </h3>
                  <p className="text-sm text-slate-500">
                    Queda constancia con rol, nombre y evidencia.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                  {aprobaciones.length}
                </span>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm text-slate-700">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Rol</th>
                      <th className="px-3 py-2 text-left">Estado</th>
                      <th className="px-3 py-2 text-left">Aprobador</th>
                      <th className="px-3 py-2 text-left">Evidencia</th>
                      <th className="px-3 py-2 text-left">Comentario</th>
                      <th className="px-3 py-2 text-left">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {aprobaciones.length === 0 && (
                      <tr>
                        <td
                          className="px-3 py-4 text-center text-slate-300"
                          colSpan={6}
                        >
                          No hay aprobaciones registradas.
                        </td>
                      </tr>
                    )}
                    {aprobaciones.map((ap) => (
                      <tr key={ap.id}>
                        <td className="px-3 py-3 text-slate-800">{ap.rol}</td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${estadoColor[ap.estado]}`}
                          >
                            {ap.estado}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-semibold text-slate-900">
                            {ap.firmado_por || "-"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {ap.firmado_email || ""}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          {ap.evidencia_url ? (
                            <a
                              href={ap.evidencia_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                            >
                              Evidencia
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400">N/A</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-slate-800">
                          {ap.comentario || "-"}
                        </td>
                        <td className="px-3 py-3 text-slate-600">
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
