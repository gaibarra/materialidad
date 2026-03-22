"use client";

import { MatrizCadenaDocumental } from "../lib/operaciones";

const STEPS = [
  { key: "cfdi", label: "CFDI", icon: "📑" },
  { key: "contrato", label: "Contrato", icon: "📋" },
  { key: "pago", label: "Pago", icon: "💳" },
  { key: "evidencia", label: "Evidencia", icon: "📎" },
] as const;

interface CadenaDocumentalProps {
  data: MatrizCadenaDocumental;
}

export function CadenaDocumental({ data }: CadenaDocumentalProps) {
  const items = STEPS.map((step) => {
    const entry = data[step.key as keyof MatrizCadenaDocumental];
    return {
      ...step,
      present: entry?.presente ?? false,
      detail: getDetail(step.key, entry),
    };
  });

  const completadas = items.filter((i) => i.present).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-600">
          Cadena documental
        </p>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
            completadas === 4
              ? "bg-emerald-100 text-emerald-700"
              : completadas >= 2
              ? "bg-amber-100 text-amber-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {completadas}/4
        </span>
      </div>

      <div className="flex items-center gap-1">
        {items.map((item, idx) => (
          <div key={item.key} className="flex items-center flex-1">
            <div
              className={`flex flex-col items-center justify-center rounded-xl border p-3 flex-1 min-h-[72px] transition ${
                item.present
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-slate-50 border-slate-200"
              }`}
              title={item.detail}
            >
              <span className="text-lg">{item.icon}</span>
              <span
                className={`mt-1 text-[10px] font-bold ${
                  item.present ? "text-emerald-700" : "text-slate-400"
                }`}
              >
                {item.label}
              </span>
              <span
                className={`text-[10px] font-bold ${
                  item.present ? "text-emerald-600" : "text-slate-300"
                }`}
              >
                {item.present ? "✓" : "—"}
              </span>
            </div>
            {idx < items.length - 1 && (
              <div
                className={`mx-0.5 h-0.5 w-3 shrink-0 rounded ${
                  item.present && items[idx + 1].present
                    ? "bg-emerald-400"
                    : "bg-slate-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function getDetail(
  key: string,
  entry: MatrizCadenaDocumental[keyof MatrizCadenaDocumental]
): string {
  if (!entry?.presente) return "No disponible";
  switch (key) {
    case "cfdi": {
      const e = entry as MatrizCadenaDocumental["cfdi"];
      return `UUID: ${e.uuid || "N/A"} — ${e.estatus || ""}`;
    }
    case "contrato": {
      const e = entry as MatrizCadenaDocumental["contrato"];
      return e.nombre || "Vinculado";
    }
    case "pago": {
      const e = entry as MatrizCadenaDocumental["pago"];
      return `${e.tipo || "N/A"} — Ref: ${e.referencia_spei || "N/A"}`;
    }
    case "evidencia": {
      const e = entry as MatrizCadenaDocumental["evidencia"];
      return `${e.total || 0} evidencia(s): ${e.tipos?.join(", ") || "N/A"}`;
    }
    default:
      return "";
  }
}
