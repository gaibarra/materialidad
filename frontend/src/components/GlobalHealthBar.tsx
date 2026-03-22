"use client";

import { cn } from "../lib/utils";
import { ShieldCheck, AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";

export interface GlobalHealthBarProps {
  /** 0-100 aggregate score */
  score: number;
  riskCount: number;
  coveragePct: number;
  lastUpdated?: string | null;
}

type HealthLevel = "critical" | "warning" | "good" | "excellent" | "nodata";

function getLevel(score: number, coveragePct: number): HealthLevel {
  if (score === 0 && coveragePct === 0) return "nodata";
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "warning";
  return "critical";
}

const LEVEL_CONFIG: Record<HealthLevel, {
  label: string;
  color: string;
  bg: string;
  ring: string;
  dot: string;
  icon: React.ReactNode;
}> = {
  nodata: {
    label: "Sin Datos",
    color: "text-slate-500",
    bg: "bg-slate-50",
    ring: "ring-slate-200",
    dot: "bg-slate-400",
    icon: <HelpCircle className="h-5 w-5 text-slate-400" />,
  },
  excellent: {
    label: "Excelente",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    ring: "ring-emerald-200",
    dot: "bg-emerald-500",
    icon: <ShieldCheck className="h-5 w-5 text-emerald-600" />,
  },
  good: {
    label: "Saludable",
    color: "text-blue-700",
    bg: "bg-blue-50",
    ring: "ring-blue-200",
    dot: "bg-blue-500",
    icon: <CheckCircle2 className="h-5 w-5 text-blue-600" />,
  },
  warning: {
    label: "Requiere Atención",
    color: "text-amber-700",
    bg: "bg-amber-50",
    ring: "ring-amber-200",
    dot: "bg-amber-500",
    icon: <AlertTriangle className="h-5 w-5 text-amber-600" />,
  },
  critical: {
    label: "Crítico",
    color: "text-rose-700",
    bg: "bg-rose-50",
    ring: "ring-rose-200",
    dot: "bg-rose-500",
    icon: <AlertTriangle className="h-5 w-5 text-rose-600" />,
  },
};

/**
 * Compute composite score
 *   - If there are no operations, score = 0 (no data ≠ healthy)
 *   - coverage 0-100 maps to 0-40 points
 *   - riskCount=0 → 30pts, each risk -10, floor at 0
 *   - csdRisk 0 → 30pts, scaled down with exposure
 */
export function computeHealthScore(coveragePct: number, riskCount: number, csdRisk: number, totalOps = 0): number {
  // Sin operaciones no hay datos suficientes para evaluar salud
  if (totalOps === 0) return 0;
  const coveragePts = Math.min(Math.max(coveragePct, 0), 100) * 0.4;
  const riskPts = Math.max(30 - riskCount * 10, 0);
  const csdPts = Math.max(30 - csdRisk * 0.3, 0);
  return Math.round(coveragePts + riskPts + csdPts);
}

export function GlobalHealthBar({ score, riskCount, coveragePct, lastUpdated }: GlobalHealthBarProps) {
  const level = getLevel(score, coveragePct);
  const config = LEVEL_CONFIG[level];

  const headline =
    level === "nodata"
      ? "Registra operaciones para activar el indicador de salud fiscal"
      : riskCount === 0
        ? `Tu organización tiene cobertura ${coveragePct >= 80 ? "alta" : coveragePct >= 50 ? "media" : "baja"} sin riesgos abiertos`
        : `Tu organización tiene ${riskCount} riesgo${riskCount > 1 ? "s" : ""} pendiente${riskCount > 1 ? "s" : ""} con cobertura al ${coveragePct.toFixed(0)}%`;

  return (
    <div
      role="region"
      aria-label={`Salud organizacional: ${config.label} — ${score} de 100`}
      className={cn("flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-2xl p-4 ring-1 transition-all", config.bg, config.ring)}
    >
      {/* Icon + Score */}
      <div className="flex items-center gap-3">
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", config.bg)}>
          {config.icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className={cn("text-2xl font-black tracking-tight", config.color)}>{score}</span>
            <span className="text-xs text-slate-400 font-medium">/100</span>
            <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-bold uppercase", config.bg, config.color)}>
              {config.label}
            </span>
          </div>
          <p className="text-sm text-slate-600 max-w-lg">{headline}</p>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Mini stats */}
      <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className={cn("h-2 w-2 rounded-full", riskCount > 0 ? "bg-rose-500 animate-pulse" : "bg-emerald-500")} />
          <span>{riskCount} riesgo{riskCount !== 1 ? "s" : ""}</span>
        </div>
        <div className="h-3 w-px bg-slate-200" />
        <span>{coveragePct.toFixed(0)}% cobertura</span>
        {lastUpdated && (
          <>
            <div className="h-3 w-px bg-slate-200 hidden sm:block" />
            <span className="hidden sm:inline">{lastUpdated}</span>
          </>
        )}
      </div>
    </div>
  );
}
