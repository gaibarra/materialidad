"use client";

import { Operacion } from "../lib/operaciones";

const CHECK_CONFIG = [
  { key: "cfdi", label: "CFDI", description: "Comprobante Fiscal Digital por Internet" },
  { key: "spei", label: "SPEI", description: "Transferencia bancaria verificada" },
  { key: "contrato", label: "Contrato", description: "Contrato vinculado a la operación" },
  { key: "nif", label: "NIF", description: "Norma de Información Financiera aplicable" },
] as const;

function getCheckState(op: Operacion, key: string): "ok" | "warn" | "pending" {
  switch (key) {
    case "cfdi":
      if (op.cfdi_estatus === "VALIDO") return "ok";
      if (op.cfdi_estatus === "INVALIDO") return "warn";
      return "pending";
    case "spei":
      if (op.spei_estatus === "VALIDADO") return "ok";
      if (op.spei_estatus === "NO_ENCONTRADO") return "warn";
      return "pending";
    case "contrato":
      return op.contrato_nombre ? "ok" : "pending";
    case "nif":
      return op.nif_aplicable ? "ok" : "pending";
    default:
      return "pending";
  }
}

const STATE_STYLES = {
  ok: {
    bg: "bg-emerald-50 border-emerald-200",
    icon: "text-emerald-600",
    label: "text-emerald-700",
    symbol: "✓",
  },
  warn: {
    bg: "bg-red-50 border-red-200",
    icon: "text-red-600",
    label: "text-red-700",
    symbol: "✗",
  },
  pending: {
    bg: "bg-slate-50 border-slate-200",
    icon: "text-slate-400",
    label: "text-slate-500",
    symbol: "·",
  },
};

interface SemaforoMaterialidadProps {
  op: Operacion;
  /** "compact" = inline badges, "full" = card grid with descriptions */
  variant?: "compact" | "full";
}

export function SemaforoMaterialidad({ op, variant = "compact" }: SemaforoMaterialidadProps) {
  const checks = CHECK_CONFIG.map((c) => ({
    ...c,
    state: getCheckState(op, c.key),
  }));

  const okCount = checks.filter((c) => c.state === "ok").length;
  const hasWarn = checks.some((c) => c.state === "warn");

  if (variant === "full") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-600">
            Semáforo de materialidad
          </p>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
              okCount === 4
                ? "bg-emerald-100 text-emerald-700"
                : hasWarn
                ? "bg-red-100 text-red-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {okCount}/4
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {checks.map((c) => {
            const s = STATE_STYLES[c.state];
            return (
              <div
                key={c.key}
                className={`flex items-center gap-2.5 rounded-xl border p-2.5 ${s.bg}`}
              >
                <span className={`text-base font-bold ${s.icon}`}>{s.symbol}</span>
                <div className="min-w-0">
                  <p className={`text-xs font-bold ${s.label}`}>{c.label}</p>
                  <p className="text-[10px] text-slate-500 truncate">{c.description}</p>
                </div>
              </div>
            );
          })}
        </div>
        {hasWarn && (
          <p className="text-[11px] font-semibold text-red-600">
            ⛔ Riesgo alto — revisa los elementos marcados en rojo
          </p>
        )}
      </div>
    );
  }

  // variant === "compact"
  return (
    <div className="flex flex-wrap gap-1.5">
      {checks.map((c) => {
        const s = STATE_STYLES[c.state];
        return (
          <span
            key={c.key}
            title={`${c.label}: ${c.description}`}
            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold ${s.bg} ${s.label}`}
          >
            {s.symbol} {c.label}
          </span>
        );
      })}
    </div>
  );
}
