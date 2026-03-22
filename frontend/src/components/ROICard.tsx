"use client";

import { cn } from "../lib/utils";
import { TrendingUp, FileCheck, FileText, ShieldCheck } from "lucide-react";

export interface ROICardProps {
  /** Current month protected value MXN */
  currentValue: number;
  /** Previous month protected value MXN (for delta). Omit if not available from backend. */
  previousValue?: number;
  /** Count of completed/validated dossiers */
  dossierCount: number;
  /** Count of contracts expiring soon */
  contractCount: number;
  /** Total operations tracked on platform */
  validationCount: number;
  className?: string;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);

export function ROICard({
  currentValue,
  previousValue,
  dossierCount,
  contractCount,
  validationCount,
  className,
}: ROICardProps) {
  const delta = previousValue != null && previousValue > 0
    ? ((currentValue - previousValue) / previousValue * 100).toFixed(1)
    : null;
  const isPositive = previousValue != null ? currentValue >= previousValue : true;

  return (
    <div
      role="region"
      aria-label="Valor generado por la plataforma"
      className={cn(
        "surface-panel relative overflow-hidden rounded-[1.8rem] p-6 sm:p-7",
        className
      )}
    >
      {/* Decorative blurs */}
      <div className="pointer-events-none absolute right-0 top-0 -mr-12 -mt-12 h-48 w-48 rounded-full bg-[rgba(31,122,90,0.08)] blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 -ml-8 -mb-8 h-32 w-32 rounded-full bg-[rgba(184,137,70,0.08)] blur-2xl" />

      <div className="relative z-10 flex flex-col gap-5">
        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--fiscal-success-soft)]">
            <TrendingUp className="h-4 w-4 text-[var(--fiscal-success)]" />
          </div>
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--fiscal-success)]">
            Valor generado por la plataforma
          </span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-3">
          <span className="font-display text-[2rem] font-semibold tracking-tight text-[var(--fiscal-ink)] sm:text-3xl">{fmt(currentValue)}</span>
          {delta && (
            <span className={cn(
              "rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-[0.12em]",
              isPositive ? "bg-[var(--fiscal-success-soft)] text-[var(--fiscal-success)]" : "bg-[var(--fiscal-danger-soft)] text-[var(--fiscal-danger)]"
            )}>
              {isPositive ? "+" : ""}{delta}% vs mes anterior
            </span>
          )}
        </div>
        <p className="text-sm leading-relaxed text-[var(--fiscal-muted)]">Monto protegido con expedientes de materialidad validados</p>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 border-t border-[rgba(200,192,177,0.72)] pt-4 sm:grid-cols-3">
          <div className="flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-[var(--fiscal-success)]" />
            <div>
              <p className="text-lg font-bold text-[var(--fiscal-ink)]">{dossierCount}</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--fiscal-muted)]">Expedientes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[var(--fiscal-success)]" />
            <div>
              <p className="text-lg font-bold text-[var(--fiscal-ink)]">{contractCount}</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--fiscal-muted)]">Contratos vigentes</p>
            </div>
          </div>
          <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
            <ShieldCheck className="h-4 w-4 text-[var(--fiscal-success)]" />
            <div>
              <p className="text-lg font-bold text-[var(--fiscal-ink)]">{validationCount}</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--fiscal-muted)]">Operaciones</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
