"use client";

import Link from "next/link";
import { cn } from "../lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileWarning,
  ShieldAlert,
  Users,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { type ReactNode } from "react";

export type ActionSeverity = "alert" | "warning" | "info" | "success";
export type ActionItem = {
  id: string;
  title: string;
  description?: string;
  severity: ActionSeverity;
  href: string;
  icon?: ReactNode;
};

export interface TodayActionsProps {
  actions: ActionItem[];
  className?: string;
}

const SEV_STYLES: Record<ActionSeverity, { dot: string; hover: string; icon: ReactNode }> = {
  alert: {
    dot: "bg-rose-500",
    hover: "hover:bg-rose-50",
    icon: <ShieldAlert className="h-4 w-4 text-rose-500" />,
  },
  warning: {
    dot: "bg-amber-500",
    hover: "hover:bg-amber-50",
    icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  },
  info: {
    dot: "bg-blue-500",
    hover: "hover:bg-blue-50",
    icon: <Clock className="h-4 w-4 text-blue-500" />,
  },
  success: {
    dot: "bg-emerald-500",
    hover: "hover:bg-emerald-50",
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  },
};

/**
 * Build the TodayActions list from dashboard data.
 * Max 5 items, sorted by severity.
 */
export function buildTodayActions(params: {
  contractsExpiring: number;
  pendingDossiers: number;
  unvalidatedProviders: number;
  activeAlerts: number;
  riskAltoCount: number;
}): ActionItem[] {
  const items: ActionItem[] = [];

  if (params.activeAlerts > 0) {
    items.push({
      id: "alerts",
      title: `${params.activeAlerts} alerta${params.activeAlerts > 1 ? "s" : ""} CSD activa${params.activeAlerts > 1 ? "s" : ""}`,
      description: "Proveedores en listas 69-B requieren atención",
      severity: "alert",
      href: "/dashboard/alertas-csd",
      icon: <ShieldAlert className="h-4 w-4 text-rose-500" />,
    });
  }

  if (params.riskAltoCount > 0) {
    items.push({
      id: "risk-alto",
      title: `${params.riskAltoCount} operación${params.riskAltoCount > 1 ? "es" : ""} en riesgo alto`,
      description: "Requieren expediente de materialidad urgente",
      severity: "alert",
      href: "/dashboard/operaciones",
      icon: <FileWarning className="h-4 w-4 text-rose-500" />,
    });
  }

  if (params.unvalidatedProviders > 0) {
    items.push({
      id: "providers",
      title: `${params.unvalidatedProviders} proveedor${params.unvalidatedProviders > 1 ? "es" : ""} sin validar (SAT)`,
      description: "Verificación de listas negras caducada",
      severity: "warning",
      href: "/dashboard/proveedores",
      icon: <Users className="h-4 w-4 text-amber-500" />,
    });
  }

  if (params.contractsExpiring > 0) {
    items.push({
      id: "contracts",
      title: `${params.contractsExpiring} contrato${params.contractsExpiring > 1 ? "s" : ""} por vencer (30d)`,
      description: "Renovar para mantener deducibilidad",
      severity: "warning",
      href: "/dashboard/contratos",
      icon: <Clock className="h-4 w-4 text-amber-500" />,
    });
  }

  if (params.pendingDossiers > 0) {
    items.push({
      id: "dossiers",
      title: `${params.pendingDossiers} expediente${params.pendingDossiers > 1 ? "s" : ""} incompleto${params.pendingDossiers > 1 ? "s" : ""}`,
      description: "Soporte documental faltante (Art 5-A)",
      severity: "info",
      href: "/dashboard/operaciones",
      icon: <FileWarning className="h-4 w-4 text-blue-500" />,
    });
  }

  return items.slice(0, 5);
}

export function TodayActions({ actions, className }: TodayActionsProps) {
  if (actions.length === 0) {
    return (
      <div className={cn("surface-panel flex min-h-[17.5rem] flex-col items-center justify-center rounded-[1.6rem] p-6 text-center", className)}>
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
          <Sparkles className="h-5 w-5 text-emerald-600" />
        </div>
        <h3 className="text-base font-bold text-emerald-900">Todo al día</h3>
        <p className="mt-1 max-w-xs text-sm text-emerald-700">
          No hay acciones pendientes. Tu posición fiscal está controlada.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("surface-panel overflow-hidden rounded-[1.6rem]", className)} role="region" aria-label="Acciones prioritarias del día">
      <div className="border-b border-[rgba(200,192,177,0.72)] px-4 py-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">Qué hacer hoy</h3>
      </div>
      <ul role="list" className="divide-y divide-[rgba(200,192,177,0.6)]">
        {actions.map((action) => {
          const sev = SEV_STYLES[action.severity];
          return (
            <li key={action.id}>
              <Link
                href={action.href}
                className={cn("group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 transition-colors", sev.hover)}
              >
                <div className="shrink-0">{action.icon || sev.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--fiscal-ink)]">{action.title}</p>
                  {action.description && (
                    <p className="truncate text-[11px] text-[var(--fiscal-muted)]">{action.description}</p>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-[rgba(91,102,120,0.45)] transition-colors group-hover:text-[var(--fiscal-accent)]" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
