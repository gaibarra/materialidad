"use client";

const RISK_CONFIG = {
  BAJO: {
    bg: "bg-[var(--fiscal-success-soft)] border-[rgba(31,122,90,0.24)]",
    text: "text-[var(--fiscal-success)]",
    dot: "bg-[var(--fiscal-success)]",
  },
  MEDIO: {
    bg: "bg-[var(--fiscal-warning-soft)] border-[rgba(166,103,31,0.24)]",
    text: "text-[var(--fiscal-warning)]",
    dot: "bg-[var(--fiscal-warning)]",
  },
  ALTO: {
    bg: "bg-[var(--fiscal-danger-soft)] border-[rgba(160,67,61,0.24)]",
    text: "text-[var(--fiscal-danger)]",
    dot: "bg-[var(--fiscal-danger)]",
  },
} as const;

type RiskLevel = "BAJO" | "MEDIO" | "ALTO";

interface RiskBadgeProps {
  level?: RiskLevel | null;
  score?: number | null;
  motivos?: string[];
  /** "badge" = compact inline, "card" = expanded with motivos */
  variant?: "badge" | "card";
}

export function RiskBadge({ level, score, motivos, variant = "badge" }: RiskBadgeProps) {
  const riskLevel = level || "BAJO";
  const config = RISK_CONFIG[riskLevel] || RISK_CONFIG.BAJO;

  if (variant === "card") {
    return (
      <div className={`rounded-panel border p-4 shadow-panel ${config.bg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${config.dot}`} />
            <span className={`text-sm font-bold uppercase tracking-[0.12em] ${config.text}`}>
              Riesgo {riskLevel}
            </span>
          </div>
          {typeof score === "number" && (
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ${config.bg} ${config.text}`}>
              Score: {score}
            </span>
          )}
        </div>
        {motivos && motivos.length > 0 && (
          <ul className="mt-2 space-y-1">
            {motivos.map((m, i) => (
              <li key={i} className={`text-xs leading-relaxed ${config.text}`}>
                • {m}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // variant === "badge"
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${config.bg} ${config.text}`}
      title={motivos?.join(", ") || `Riesgo ${riskLevel}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {riskLevel}
      {typeof score === "number" && (
        <span className="ml-0.5 opacity-70">({score})</span>
      )}
    </span>
  );
}
