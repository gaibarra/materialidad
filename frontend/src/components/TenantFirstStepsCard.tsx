"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileBadge,
  FolderOpenDot,
  Loader2,
  PlayCircle,
  Sparkles,
  Truck,
} from "lucide-react";

import type { UserProfile } from "../context/AuthContext";
import { cn } from "../lib/utils";
import { useTenantOnboarding, type TenantOnboardingStep, type TenantOnboardingStepId } from "../hooks/useTenantOnboarding";

type DashboardSummaryLike = {
  total_ops_count?: number;
  validated_ops_count?: number;
  pending_dossiers?: number;
};

function isCurrentModule(pathname: string | null | undefined, href: string) {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

const STEP_ICONS: Record<TenantOnboardingStepId, React.ComponentType<{ className?: string }>> = {
  empresa_base: Building2,
  proveedor_inicial: Truck,
  contrato_inicial: FileBadge,
  operacion_inicial: PlayCircle,
  expediente_inicial: FolderOpenDot,
  checklist_inicial: ClipboardList,
};

function getCompactTone(stepId?: TenantOnboardingStepId | null, isComplete?: boolean) {
  if (isComplete) {
    return {
      shell: "border-emerald-200 bg-[rgba(236,253,245,0.92)]",
      icon: "bg-emerald-100 text-emerald-700",
      progress: "bg-emerald-500",
      primaryButton: "bg-emerald-600 hover:bg-emerald-700 text-white",
      secondaryButton: "border-emerald-200 text-emerald-700 hover:border-emerald-300 hover:text-emerald-800",
      accentText: "text-emerald-700",
    };
  }

  if (stepId === "checklist_inicial") {
    return {
      shell: "border-emerald-200 bg-[rgba(240,253,244,0.90)]",
      icon: "bg-emerald-100 text-emerald-700",
      progress: "bg-emerald-500",
      primaryButton: "bg-emerald-600 hover:bg-emerald-700 text-white",
      secondaryButton: "border-emerald-200 text-emerald-700 hover:border-emerald-300 hover:text-emerald-800",
      accentText: "text-emerald-700",
    };
  }

  if (stepId === "contrato_inicial" || stepId === "operacion_inicial" || stepId === "expediente_inicial") {
    return {
      shell: "border-amber-200 bg-[rgba(255,251,235,0.92)]",
      icon: "bg-amber-100 text-amber-700",
      progress: "bg-amber-500",
      primaryButton: "bg-amber-500 hover:bg-amber-600 text-white",
      secondaryButton: "border-amber-200 text-amber-700 hover:border-amber-300 hover:text-amber-800",
      accentText: "text-amber-700",
    };
  }

  return {
    shell: "border-[rgba(45,91,136,0.14)] bg-[rgba(255,255,255,0.88)]",
    icon: "bg-[rgba(45,91,136,0.10)] text-[var(--fiscal-accent)]",
    progress: "bg-[var(--fiscal-accent)]",
    primaryButton: "bg-[var(--fiscal-accent)] hover:bg-[color:rgb(32,67,104)] text-white",
    secondaryButton: "border-blue-200 text-blue-700 hover:border-blue-300 hover:text-blue-800",
    accentText: "text-[var(--fiscal-accent)]",
  };
}

function StatusBadge({ step }: { step: TenantOnboardingStep }) {
  const badgeStyles = {
    completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
    pending: "border-blue-200 bg-blue-50 text-blue-700",
    unknown: "border-slate-200 bg-slate-50 text-slate-600",
  } as const;

  const labels = {
    completed: "Completado",
    pending: "Pendiente",
    unknown: "Sin verificar",
  } as const;

  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]", badgeStyles[step.status])}>
      {labels[step.status]}
    </span>
  );
}

function StepRow({ step, isNext }: { step: TenantOnboardingStep; isNext: boolean }) {
  const Icon = STEP_ICONS[step.id];
  const iconTone =
    step.status === "completed"
      ? "bg-emerald-100 text-emerald-700"
      : step.status === "unknown"
        ? "bg-slate-100 text-slate-500"
        : "bg-blue-100 text-blue-700";

  return (
    <div className={cn(
      "rounded-[1.35rem] border p-4 transition-colors",
      isNext
        ? "border-blue-200 bg-[linear-gradient(180deg,rgba(239,246,255,0.92),rgba(255,255,255,0.98))]"
        : "border-[rgba(200,192,177,0.7)] bg-white/90"
    )}>
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", iconTone)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-[var(--fiscal-ink)]">{step.title}</h4>
            <StatusBadge step={step} />
            {isNext && step.status === "pending" && (
              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
                Siguiente recomendado
              </span>
            )}
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--fiscal-muted)]">{step.description}</p>
          <p className="mt-2 text-xs font-medium text-slate-600">{step.detail}</p>
          {step.status !== "completed" && step.status !== "unknown" && (
            <Link href={step.href} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--fiscal-accent)] hover:text-[var(--fiscal-ink)]">
              {step.ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export function TenantFirstStepsCard({
  user,
  tenant,
  summary,
  variant = "full",
  currentPathname,
}: {
  user: UserProfile | null;
  tenant: string | null;
  summary: DashboardSummaryLike | null;
  variant?: "full" | "compact";
  currentPathname?: string | null;
}) {
  const {
    steps,
    isLoading,
    errorHint,
    completedCount,
    totalSteps,
    nextStep,
    upcomingSteps,
    isComplete,
    hasUnknownSteps,
    isCollapsed,
    setIsCollapsed,
  } = useTenantOnboarding({ user, tenant, summary });

  const [isCompactExpanded, setIsCompactExpanded] = useState(false);

  if (!user) return null;

  const progressLabel = totalSteps > 0
    ? completedCount === 0
      ? "Aún no comienzas"
      : isComplete
        ? "Primeros pasos completados"
        : `Llevas ${completedCount} de ${totalSteps} pasos completados`
    : "Configurando pasos iniciales";

  const subtitle = isComplete
    ? "Ya completaste los primeros pasos. Mantén visible este bloque como referencia rápida del arranque de tu cuenta."
    : "Configura tu primer caso en 6 pasos. Detectamos tu avance cada vez que entras y te sugerimos qué sigue.";

  const isAlreadyInSuggestedStep = variant === "compact" && Boolean(nextStep && isCurrentModule(currentPathname, nextStep.href));
  const compactTone = getCompactTone(nextStep?.id, isComplete);

  if (isAlreadyInSuggestedStep) {
    return null;
  }

  if (variant === "compact") {
    return (
      <section className={cn("surface-panel overflow-hidden rounded-[1.6rem] border shadow-sm", compactTone.shell)}>
        <div className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <span className={cn("inline-flex h-10 w-10 items-center justify-center rounded-2xl", compactTone.icon)}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : isComplete ? <CheckCircle2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">Primeros pasos</p>
                  <p className="truncate text-sm font-semibold text-[var(--fiscal-ink)]">{progressLabel}</p>
                </div>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgba(15,23,42,0.08)]">
                <div
                  className={cn("h-full rounded-full transition-all", compactTone.progress)}
                  style={{ width: totalSteps > 0 ? `${(completedCount / totalSteps) * 100}%` : "0%" }}
                />
              </div>

              <p className="mt-3 text-xs leading-5 text-[var(--fiscal-muted)]">
                {nextStep
                  ? `Siguiente recomendado: ${nextStep.title}. ${nextStep.detail}`
                  : "Ya completaste los primeros pasos. Ahora puedes seguir fortaleciendo expedientes y validación."}
              </p>
              {errorHint && <p className="mt-2 text-xs font-medium text-[var(--fiscal-muted)]">{errorHint}</p>}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
              {nextStep ? (
                <Link href={nextStep.href} className={cn("inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors", compactTone.primaryButton)}>
                  {nextStep.ctaLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <Link href="/dashboard/expedientes" className={cn("inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors", compactTone.primaryButton)}>
                  Ver expedientes
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              <button
                type="button"
                onClick={() => setIsCompactExpanded((value) => !value)}
                className={cn("inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold transition-colors", compactTone.secondaryButton)}
              >
                {isCompactExpanded ? "Ocultar pasos" : "Ver primeros pasos"}
                <ArrowRight className={cn("h-4 w-4 transition-transform", isCompactExpanded && "rotate-90")} />
              </button>
            </div>
          </div>

          {isCompactExpanded && (
            <div className="mt-4 border-t border-[rgba(200,192,177,0.5)] pt-4">
              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                {steps.map((step) => (
                  <StepRow key={step.id} step={step} isNext={step.id === nextStep?.id} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="surface-panel-strong overflow-hidden rounded-[1.9rem] border border-[rgba(45,91,136,0.16)] shadow-fiscal">
      <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,rgba(45,91,136,0.12),rgba(45,91,136,0.20))] text-[var(--fiscal-accent)]">
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            </span>
            <div>
              <p className="kicker-label">Primer ingreso a la cuenta</p>
              <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-[var(--fiscal-ink)]">
                Primeros pasos
              </h2>
            </div>
          </div>
          <p className="mt-4 text-base font-semibold text-[var(--fiscal-ink)]">{progressLabel}</p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--fiscal-muted)]">{subtitle}</p>
          {errorHint && <p className="mt-3 text-xs font-medium text-[var(--fiscal-muted)]">{errorHint}</p>}
          {hasUnknownSteps && !errorHint && (
            <p className="mt-3 text-xs font-medium text-[var(--fiscal-muted)]">Algunas señales aún no tienen suficiente contexto para verificarse.</p>
          )}
        </div>

        <div className="flex w-full shrink-0 flex-col gap-3 rounded-[1.5rem] border border-[rgba(200,192,177,0.72)] bg-white/85 p-4 lg:w-[320px]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">Progreso</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--fiscal-ink)]">{totalSteps > 0 ? `${completedCount}/${totalSteps}` : "—"}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsCollapsed((value) => !value)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-700"
            >
              {isCollapsed ? "Expandir" : "Compactar"}
              <ChevronDown className={cn("h-4 w-4 transition-transform", isCollapsed && "rotate-180")} />
            </button>
          </div>

          <div className="h-2.5 overflow-hidden rounded-full bg-[rgba(15,23,42,0.08)]">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                isComplete ? "bg-emerald-500" : "bg-[var(--fiscal-accent)]"
              )}
              style={{ width: totalSteps > 0 ? `${(completedCount / totalSteps) * 100}%` : "0%" }}
            />
          </div>

          {nextStep ? (
            <div className="rounded-[1.2rem] border border-blue-200 bg-blue-50/80 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">Siguiente recomendado</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{nextStep.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">{nextStep.detail}</p>
              <Link href={nextStep.href} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900">
                {nextStep.ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="rounded-[1.2rem] border border-emerald-200 bg-emerald-50/80 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">Primeros pasos completos</p>
              <p className="mt-2 text-sm font-semibold text-emerald-900">Tu cuenta ya completó la configuración inicial.</p>
              <p className="mt-1 text-xs leading-5 text-emerald-700">Ahora puedes concentrarte en fortalecer expedientes, validación y seguimiento fiscal.</p>
              <Link href="/dashboard/expedientes" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-900">
                Explorar expedientes
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}

          {upcomingSteps.length > 0 && !isCollapsed && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">Después sigue</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {upcomingSteps.map((step) => (
                  <Link key={step.id} href={step.href} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700">
                    {step.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="border-t border-[rgba(200,192,177,0.5)] bg-[rgba(255,255,255,0.58)] px-6 py-6">
          {isLoading ? (
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-40 animate-pulse rounded-[1.35rem] border border-[rgba(200,192,177,0.7)] bg-white/80" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {steps.map((step) => (
                <StepRow key={step.id} step={step} isNext={nextStep?.id === step.id} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}