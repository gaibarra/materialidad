"use client";

import { useEffect, useMemo, useState } from "react";

import type { UserProfile } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import { fetchChecklists, type Checklist } from "../lib/checklists";
import { fetchEmpresas, fetchProviders } from "../lib/providers";

type ContractLite = {
  id: number;
};

type PaginatedLike<T> = {
  count?: number;
  results?: T[];
};

type DashboardSummaryLike = {
  total_ops_count?: number;
  validated_ops_count?: number;
  pending_dossiers?: number;
};

type StepStatus = "completed" | "pending" | "unknown";

export type TenantOnboardingStepId =
  | "empresa_base"
  | "proveedor_inicial"
  | "contrato_inicial"
  | "operacion_inicial"
  | "expediente_inicial"
  | "checklist_inicial";

export type TenantOnboardingStep = {
  id: TenantOnboardingStepId;
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
  status: StepStatus;
  detail: string;
};

type PersistedOnboardingState = {
  collapsed?: boolean;
  lastCompletedCount?: number;
  updatedAt?: string;
};

const STORAGE_PREFIX = "materialidad:onboarding:v1";

const STEP_DEFINITIONS: Array<Omit<TenantOnboardingStep, "status" | "detail">> = [
  {
    id: "empresa_base",
    title: "Crear la empresa base",
    description: "Define la primera empresa para dar contexto fiscal y operativo al resto del flujo.",
    ctaLabel: "Crear empresa",
    href: "/dashboard/empresas",
  },
  {
    id: "proveedor_inicial",
    title: "Registrar el primer proveedor",
    description: "Agrega al primer tercero con quien vas a relacionar contratos, pagos y evidencia.",
    ctaLabel: "Agregar proveedor",
    href: "/dashboard/proveedores",
  },
  {
    id: "contrato_inicial",
    title: "Cargar el primer contrato",
    description: "Documenta el instrumento que soporta la operación antes de empezar a ejecutar.",
    ctaLabel: "Registrar contrato",
    href: "/dashboard/contratos",
  },
  {
    id: "operacion_inicial",
    title: "Registrar la primera operación",
    description: "Activa el caso operativo para que el sistema empiece a construir trazabilidad.",
    ctaLabel: "Cargar operación",
    href: "/dashboard/operaciones",
  },
  {
    id: "expediente_inicial",
    title: "Abrir el primer expediente",
    description: "Concentra evidencia y validación documental del primer caso para volverlo defendible.",
    ctaLabel: "Crear expediente",
    href: "/dashboard/expedientes",
  },
  {
    id: "checklist_inicial",
    title: "Completar el checklist inicial",
    description: "Cierra la configuración base contestando los requisitos obligatorios del caso.",
    ctaLabel: "Completar checklist",
    href: "/dashboard/checklists",
  },
];

function getStorageKey(user: UserProfile | null, tenant: string | null) {
  if (!user?.id) return null;
  const scope = tenant || user.tenant_slug || "sin-tenant";
  return `${STORAGE_PREFIX}:${scope}:${user.id}`;
}

function getCountFromPayload<T>(payload: PaginatedLike<T> | T[] | null | undefined) {
  if (!payload) return 0;
  if (Array.isArray(payload)) return payload.length;
  if (typeof payload.count === "number") return payload.count;
  return Array.isArray(payload.results) ? payload.results.length : 0;
}

function getChecklistStatus(checklists: Checklist[] | null) {
  if (!checklists) {
    return { status: "unknown" as StepStatus, detail: "No pudimos verificar el checklist todavía." };
  }

  if (checklists.length === 0) {
    return { status: "pending" as StepStatus, detail: "Aún no inicias un checklist de trabajo." };
  }

  const hasCompletedChecklist = checklists.some((checklist) => {
    const requiredItems = checklist.items?.filter((item) => item.requerido) ?? [];
    if (requiredItems.length === 0) return false;
    return requiredItems.every((item) => item.estado === "COMPLETO");
  });

  if (hasCompletedChecklist) {
    return { status: "completed" as StepStatus, detail: "Ya existe un checklist obligatorio completo." };
  }

  return { status: "pending" as StepStatus, detail: "Ya iniciaste el checklist; falta cerrar requisitos obligatorios." };
}

function buildStepDetails(stepId: TenantOnboardingStepId, status: StepStatus, counts: Record<string, number>, checklistDetail: string) {
  if (stepId === "checklist_inicial") return checklistDetail;

  if (status === "unknown") {
    return "No pudimos verificar este paso en este momento.";
  }

  const detailByStep: Record<Exclude<TenantOnboardingStepId, "checklist_inicial">, { completed: string; pending: string }> = {
    empresa_base: {
      completed: `${counts.empresas} empresa${counts.empresas === 1 ? "" : "s"} registrada${counts.empresas === 1 ? "" : "s"}.`,
      pending: "Empieza registrando la empresa que operará dentro de tu cuenta.",
    },
    proveedor_inicial: {
      completed: `${counts.proveedores} proveedor${counts.proveedores === 1 ? "" : "es"} disponible${counts.proveedores === 1 ? "" : "s"}.`,
      pending: "Necesitas al menos un proveedor para vincular contratos y operaciones.",
    },
    contrato_inicial: {
      completed: `${counts.contratos} contrato${counts.contratos === 1 ? "" : "s"} cargado${counts.contratos === 1 ? "" : "s"}.`,
      pending: "Sube o genera el primer contrato antes de ejecutar la operación.",
    },
    operacion_inicial: {
      completed: `${counts.operaciones} operación${counts.operaciones === 1 ? "" : "es"} registrada${counts.operaciones === 1 ? "" : "s"}.`,
      pending: "Registra una primera operación para activar trazabilidad y control documental.",
    },
    expediente_inicial: {
      completed: `${counts.expedientes} expediente${counts.expedientes === 1 ? "" : "s"} en seguimiento documental.`,
      pending: "Todavía no existe un expediente activo que concentre soporte y validación.",
    },
  };

  return detailByStep[stepId][status === "completed" ? "completed" : "pending"];
}

export function useTenantOnboarding({
  user,
  tenant,
  summary,
}: {
  user: UserProfile | null;
  tenant: string | null;
  summary: DashboardSummaryLike | null;
}) {
  const storageKey = useMemo(() => getStorageKey(user, tenant), [tenant, user]);
  const [steps, setSteps] = useState<TenantOnboardingStep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hasHydratedState, setHasHydratedState] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadProgress = async () => {
      if (!user) {
        setSteps([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorHint(null);

      const [empresasResult, proveedoresResult, contratosResult, checklistsResult, summaryResult] = await Promise.allSettled([
        fetchEmpresas(),
        fetchProviders(),
        apiFetch<PaginatedLike<ContractLite> | ContractLite[]>("/api/materialidad/contratos/?ordering=-created_at"),
        fetchChecklists(),
        summary
          ? Promise.resolve(summary)
          : apiFetch<DashboardSummaryLike>("/api/materialidad/dashboard/executive-summary/"),
      ]);

      if (cancelled) return;

      const empresas = empresasResult.status === "fulfilled" ? empresasResult.value : null;
      const proveedores = proveedoresResult.status === "fulfilled" ? proveedoresResult.value : null;
      const contratos = contratosResult.status === "fulfilled" ? contratosResult.value : null;
      const checklists = checklistsResult.status === "fulfilled" ? checklistsResult.value : null;
      const effectiveSummary = summaryResult.status === "fulfilled" ? summaryResult.value : null;

      const counts = {
        empresas: empresas ? empresas.length : 0,
        proveedores: proveedores ? proveedores.length : 0,
        contratos: getCountFromPayload(contratos),
        operaciones: effectiveSummary?.total_ops_count ?? 0,
        expedientes: (effectiveSummary?.pending_dossiers ?? 0) + (effectiveSummary?.validated_ops_count ?? 0),
      };

      const checklistStatus = getChecklistStatus(checklists);
      const partialFailures = [empresasResult, proveedoresResult, contratosResult, checklistsResult, summaryResult].some((result) => result.status === "rejected");

      const nextSteps = STEP_DEFINITIONS.map((definition) => {
        const statusMap: Record<TenantOnboardingStepId, StepStatus> = {
          empresa_base: empresas === null ? "unknown" : counts.empresas > 0 ? "completed" : "pending",
          proveedor_inicial: proveedores === null ? "unknown" : counts.proveedores > 0 ? "completed" : "pending",
          contrato_inicial: contratos === null ? "unknown" : counts.contratos > 0 ? "completed" : "pending",
          operacion_inicial: typeof effectiveSummary?.total_ops_count === "number" ? (counts.operaciones > 0 ? "completed" : "pending") : "unknown",
          expediente_inicial:
            typeof effectiveSummary?.pending_dossiers === "number" && typeof effectiveSummary?.validated_ops_count === "number"
              ? counts.expedientes > 0
                ? "completed"
                : "pending"
              : "unknown",
          checklist_inicial: checklistStatus.status,
        };

        const status = statusMap[definition.id];

        return {
          ...definition,
          status,
          detail: buildStepDetails(definition.id, status, counts, checklistStatus.detail),
        } satisfies TenantOnboardingStep;
      });

      setSteps(nextSteps);
      setErrorHint(partialFailures ? "Algunas verificaciones no pudieron actualizarse; mostraremos el avance disponible." : null);
      setIsLoading(false);
      setHasHydratedState(false);
    };

    void loadProgress();

    return () => {
      cancelled = true;
    };
  }, [summary, user]);

  const completedCount = useMemo(() => steps.filter((step) => step.status === "completed").length, [steps]);
  const totalSteps = steps.length;
  const nextStep = useMemo(() => steps.find((step) => step.status === "pending") ?? null, [steps]);
  const upcomingSteps = useMemo(() => {
    const pendingSteps = steps.filter((step) => step.status === "pending");
    return pendingSteps.slice(1, 3);
  }, [steps]);
  const isComplete = totalSteps > 0 && completedCount === totalSteps;
  const hasUnknownSteps = steps.some((step) => step.status === "unknown");

  useEffect(() => {
    if (!storageKey || isLoading || steps.length === 0 || hasHydratedState) return;

    try {
      const raw = window.localStorage.getItem(storageKey);
      const persisted = raw ? (JSON.parse(raw) as PersistedOnboardingState) : null;
      const progressChanged = persisted?.lastCompletedCount !== undefined && persisted.lastCompletedCount !== completedCount;
      setIsCollapsed(progressChanged ? false : Boolean(persisted?.collapsed));
    } catch {
      setIsCollapsed(false);
    } finally {
      setHasHydratedState(true);
    }
  }, [completedCount, hasHydratedState, isLoading, steps.length, storageKey]);

  useEffect(() => {
    if (!storageKey || !hasHydratedState || isLoading) return;

    const payload: PersistedOnboardingState = {
      collapsed: isCollapsed,
      lastCompletedCount: completedCount,
      updatedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [completedCount, hasHydratedState, isCollapsed, isLoading, storageKey]);

  return {
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
  };
}