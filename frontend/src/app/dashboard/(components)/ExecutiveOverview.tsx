"use client";

import Link from "next/link";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ShieldCheck, BarChart3, FolderOpenDot } from "lucide-react";
import { useAuthContext } from "../../../context/AuthContext";
import { AlertBanner } from "./shared/AlertBanner";
import { ProtectedValueCard } from "./metrics/ProtectedValueCard";
import { CsdRiskThermometer } from "./metrics/CsdRiskThermometer";
import { MaterialityDonutChart } from "./metrics/MaterialityDonutChart";
import { IntangibleAssetsChart } from "./metrics/IntangibleAssetsChart";
import { PortfolioRiskTable } from "./tenant-variants/PortfolioRiskTable";
import { OperativeWorkflows } from "./tenant-variants/OperativeWorkflows";
import { apiFetch } from "../../../lib/api";
import { TodayActions, buildTodayActions } from "../../../components/TodayActions";
import { ROICard } from "../../../components/ROICard";
import { MetricCard, SparklineSVG } from "../../../components/MetricCard";
import { GuiaContador } from "../../../components/GuiaContador";
import { FdiInfoModalTrigger } from "../../../components/FdiInfoModalTrigger";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "../../../components/ui/dialog";

const fmt = (v: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);

const FDI_LEVEL_UI: Record<string, { label: string; tone: string }> = {
    NO_DATA: { label: "Sin datos suficientes", tone: "text-slate-600 bg-slate-50 border-slate-200" },
    ROBUSTO: { label: "Robusto", tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    CONTROLADO: { label: "Controlado", tone: "text-blue-700 bg-blue-50 border-blue-200" },
    DEBIL: { label: "Débil", tone: "text-amber-700 bg-amber-50 border-amber-200" },
    CRITICO: { label: "Crítico", tone: "text-rose-700 bg-rose-50 border-rose-200" },
};

const QUICK_LINKS = [
    {
        label: "Operaciones",
        href: "/dashboard/operaciones",
        description: "Expedientes y captura.",
    },
    {
        label: "Consulta legal",
        href: "/dashboard/consultas",
        description: "Criterio y postura.",
    },
    {
        label: "Historial FDI",
        href: "/dashboard/fdi-history",
        description: "Serie y quiebres.",
    },
];

function ExecutiveDetailModal({
    triggerLabel,
    eyebrow,
    title,
    description,
    children,
    triggerClassName,
    contentClassName,
}: {
    triggerLabel: string;
    eyebrow: string;
    title: string;
    description?: string;
    children: ReactNode;
    triggerClassName?: string;
    contentClassName?: string;
}) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <button
                    type="button"
                    className={triggerClassName ?? "inline-flex items-center justify-center rounded-full border border-[rgba(200,192,177,0.72)] bg-white/85 px-4 py-2.5 text-sm font-semibold text-[var(--fiscal-muted)] transition hover:border-[var(--fiscal-accent)]/35 hover:text-[var(--fiscal-accent)]"}
                >
                    {triggerLabel}
                </button>
            </DialogTrigger>
            <DialogContent className={contentClassName ?? "max-h-[88vh] max-w-4xl overflow-y-auto rounded-[30px] border-[rgba(200,192,177,0.78)] bg-[var(--fiscal-canvas)] p-0 shadow-2xl"}>
                <div className="border-b border-[rgba(200,192,177,0.62)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(243,239,231,0.92))] px-6 py-5 sm:px-8">
                    <p className="kicker-label mb-2">{eyebrow}</p>
                    <DialogHeader className="space-y-2 text-left">
                        <DialogTitle className="font-display text-2xl font-semibold text-[var(--fiscal-ink)] sm:text-3xl">
                            {title}
                        </DialogTitle>
                        {description ? (
                            <DialogDescription className="max-w-2xl text-sm leading-6 text-[var(--fiscal-muted)] sm:text-base">
                                {description}
                            </DialogDescription>
                        ) : null}
                    </DialogHeader>
                </div>
                <div className="space-y-5 px-6 py-6 sm:px-8">
                    {children}
                    <div className="flex justify-end pb-1">
                        <DialogClose asChild>
                            <button
                                type="button"
                                className="button-institutional inline-flex min-h-[44px] items-center justify-center rounded-xl px-5 text-sm font-semibold"
                            >
                                Cerrar
                            </button>
                        </DialogClose>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

const FOCUS_CARD_TONE: Record<"rose" | "blue" | "emerald" | "purple", { shell: string; icon: string; accent: string }> = {
    rose: {
        shell: "border-[rgba(160,67,61,0.18)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,242,241,0.92))]",
        icon: "bg-[rgba(160,67,61,0.10)] text-[var(--fiscal-danger)]",
        accent: "text-[var(--fiscal-danger)]",
    },
    blue: {
        shell: "border-[rgba(45,91,136,0.18)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(241,246,250,0.92))]",
        icon: "bg-[rgba(45,91,136,0.10)] text-[var(--fiscal-accent)]",
        accent: "text-[var(--fiscal-accent)]",
    },
    emerald: {
        shell: "border-[rgba(31,122,90,0.18)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(240,248,244,0.92))]",
        icon: "bg-[rgba(31,122,90,0.10)] text-[var(--fiscal-success)]",
        accent: "text-[var(--fiscal-success)]",
    },
    purple: {
        shell: "border-[rgba(98,77,154,0.16)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,242,249,0.92))]",
        icon: "bg-[rgba(98,77,154,0.10)] text-[rgb(98,77,154)]",
        accent: "text-[rgb(98,77,154)]",
    },
};

function CompactFocusCard({
    tone,
    icon,
    eyebrow,
    title,
    summary,
    stats,
    modalTitle,
    modalDescription,
    children,
}: {
    tone: "rose" | "blue" | "emerald" | "purple";
    icon: ReactNode;
    eyebrow: string;
    title: string;
    summary: string;
    stats: Array<{ label: string; value: string }>;
    modalTitle: string;
    modalDescription: string;
    children: ReactNode;
}) {
    const ui = FOCUS_CARD_TONE[tone];

    return (
        <div className={`surface-panel-strong flex h-full flex-col rounded-[1.55rem] border p-4 ${ui.shell}`}>
            <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ui.icon}`}>
                    {icon}
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">{eyebrow}</p>
                    <h3 className={`mt-1 font-display text-lg font-semibold tracking-tight ${ui.accent}`}>{title}</h3>
                </div>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-[var(--fiscal-muted)]">{summary}</p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                {stats.map((item) => (
                    <div key={item.label} className="rounded-[1rem] border border-[rgba(200,192,177,0.65)] bg-white/82 px-3.5 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">{item.label}</p>
                        <p className="mt-1 text-base font-semibold text-[var(--fiscal-ink)]">{item.value}</p>
                    </div>
                ))}
            </div>

            <div className="mt-4 pt-1">
                <ExecutiveDetailModal
                    triggerLabel="Abrir detalle"
                    eyebrow={eyebrow}
                    title={modalTitle}
                    description={modalDescription}
                    triggerClassName="inline-flex w-full items-center justify-center rounded-full border border-[rgba(200,192,177,0.72)] bg-white/90 px-4 py-2.5 text-sm font-semibold text-[var(--fiscal-muted)] transition hover:border-[var(--fiscal-accent)]/35 hover:text-[var(--fiscal-accent)]"
                    contentClassName="max-h-[88vh] max-w-5xl overflow-y-auto rounded-[30px] border-[rgba(200,192,177,0.78)] bg-[var(--fiscal-canvas)] p-0 shadow-2xl"
                >
                    {children}
                </ExecutiveDetailModal>
            </div>
        </div>
    );
}

interface AlertData {
    id: number;
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'error' | 'success';
}

interface PortfolioData {
    id: number;
    name: string;
    riskScore: number;
    missingFiles: number;
}

interface DashboardSummary {
    protected_value: number;
    csd_risk_score: number;
    materiality_coverage: number;
    total_ops_count: number;
    validated_ops_count: number;
    intangibles_valuation: number;
    active_alerts: AlertData[];
    portfolio: PortfolioData[];
    contracts_expiring: number;
    pending_dossiers: number;
    unvalidated_providers: number;
    active_clients_count: number;
}

interface CoberturaP0Response {
    generated_at: string;
    period: {
        days: number;
        from: string;
        to: string;
        empresa_id: number | null;
    };
    coverage: {
        total_operaciones: number;
        completas: number;
        incompletas: number;
        cobertura_documental_pct: number;
    };
    riesgo_distribution: Record<"BAJO" | "MEDIO" | "ALTO", { count: number; monto: number }>;
    alertas: {
        activas_total: number;
        por_tipo: {
            FALTANTES_CRITICOS: number;
            VENCIMIENTO_EVIDENCIA: number;
        };
    };
    trend_weekly: Array<{
        week_start: string;
        week_end: string;
        total_operaciones: number;
        validadas: number;
        completas: number;
        incompletas: number;
    }>;
}

interface FDIResponse {
    generated_at: string;
    period: {
        days: number;
        from: string;
        to: string;
        empresa_id: number | null;
    };
    score: number;
    level: "NO_DATA" | "ROBUSTO" | "CONTROLADO" | "DEBIL" | "CRITICO";
    breakdown: {
        DM: number;
        SE: number;
        SC: number;
        EC: number;
        DO: number;
    };
    actions: Array<{ priority: string; title: string; description: string }>;
    inputs: {
        total_operaciones: number;
        operaciones_validadas: number;
        alertas_criticas: number;
        pct_proveedores_riesgo_alto?: number;
    };
}

interface FDINarrativeResponse {
    fdi: {
        score: number;
        level: string;
        generated_at: string;
    };
    narrative: {
        audience: "RECTOR" | "CFO" | "DESPACHO";
        headline: string;
        executive_summary: string;
        evidence_points: string[];
        priority_actions: string[];
        generated_at: string;
    };
}

interface FDIHistoryResponse {
    range: {
        from: string;
        to: string;
        days: number;
        limit: number;
    };
    series: Array<{
        captured_at: string;
        score: number;
        level: string;
        breakdown: {
            DM?: number;
            SE?: number;
            SC?: number;
            EC?: number;
            DO?: number;
        };
    }>;
    summary: {
        points: number;
        current_score: number;
        trend_delta: number;
    };
}

export function ExecutiveOverview() {
    const { user } = useAuthContext();
    const [dashboardData, setDashboardData] = useState<DashboardSummary | null>(null);
    const [coberturaP0, setCoberturaP0] = useState<CoberturaP0Response | null>(null);
    const [fdiData, setFdiData] = useState<FDIResponse | null>(null);
    const [fdiNarrative, setFdiNarrative] = useState<FDINarrativeResponse | null>(null);
    const [fdiHistory, setFdiHistory] = useState<FDIHistoryResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isNarrativeLoading, setIsNarrativeLoading] = useState(false);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [narrativeError, setNarrativeError] = useState<string | null>(null);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const fetchDashboardSummary = async () => {
            try {
                setIsLoading(true);
                setNarrativeError(null);
                setHistoryError(null);

                const [response, cobertura, fdi] = await Promise.all([
                    apiFetch<DashboardSummary>('/api/materialidad/dashboard/executive-summary/'),
                    apiFetch<CoberturaP0Response>('/api/materialidad/dashboard/metricas/cobertura-p0/?days=90'),
                    apiFetch<FDIResponse>('/api/materialidad/dashboard/fdi/?period_days=90'),
                ]);

                if (cancelled) return;

                if (response) {
                    setDashboardData(response);
                    setError(null);
                } else {
                    setError('Received empty response from the server');
                }
                setCoberturaP0(cobertura);
                setFdiData(fdi);

                // Carga no bloqueante: narrativa AI
                setIsNarrativeLoading(true);
                apiFetch<FDINarrativeResponse>('/api/materialidad/dashboard/fdi/narrative/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ audience: 'CFO', period_days: 90 }),
                })
                    .then((narrative) => {
                        if (!cancelled) {
                            setFdiNarrative(narrative);
                            setNarrativeError(null);
                        }
                    })
                    .catch((narrativeErr) => {
                        console.error('Error fetching FDI narrative:', narrativeErr);
                        if (!cancelled) {
                            setNarrativeError('No se pudo cargar la narrativa automática.');
                        }
                    })
                    .finally(() => {
                        if (!cancelled) {
                            setIsNarrativeLoading(false);
                        }
                    });

                // Carga no bloqueante: historia FDI
                setIsHistoryLoading(true);
                apiFetch<FDIHistoryResponse>('/api/materialidad/dashboard/fdi/history/?days=90&limit=90')
                    .then((history) => {
                        if (!cancelled) {
                            setFdiHistory(history);
                            setHistoryError(null);
                        }
                    })
                    .catch((historyErr) => {
                        console.error('Error fetching FDI history:', historyErr);
                        if (!cancelled) {
                            setHistoryError('No se pudo cargar la evolución histórica del FDI.');
                        }
                    })
                    .finally(() => {
                        if (!cancelled) {
                            setIsHistoryLoading(false);
                        }
                    });
            } catch (err) {
                console.error("Error fetching dashboard summary:", err);
                setError(err instanceof Error ? err.message : 'An unknown error occurred');
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        if (user) {
            fetchDashboardSummary();
        }

        return () => {
            cancelled = true;
        };
    }, [user]);

    const todayActions = useMemo(() => {
        if (!dashboardData || !coberturaP0) return [];
        return buildTodayActions({
            contractsExpiring: dashboardData.contracts_expiring,
            pendingDossiers: dashboardData.pending_dossiers,
            unvalidatedProviders: dashboardData.unvalidated_providers,
            activeAlerts: dashboardData.active_alerts?.length ?? 0,
            riskAltoCount: coberturaP0.riesgo_distribution?.ALTO?.count ?? 0,
        });
    }, [dashboardData, coberturaP0]);

    const lastUpdated = useMemo(() => {
        if (!coberturaP0?.generated_at) return null;
        try {
            return new Date(coberturaP0.generated_at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
        } catch (e) { console.warn("Could not parse generated_at date:", e); return null; }
    }, [coberturaP0]);

    const fdiSnapshot = useMemo(() => {
        if (!fdiData) return null;
        const levelUi = FDI_LEVEL_UI[fdiData.level] ?? FDI_LEVEL_UI.NO_DATA;
        return {
            score: fdiData.score,
            periodDays: fdiData.period?.days ?? 90,
            level: levelUi,
            components: [
                { key: "DM", label: "Documentación Material", score: fdiData.breakdown?.DM ?? 0, weight: "28%", inverse: false },
                { key: "SE", label: "Sustancia Económica", score: fdiData.breakdown?.SE ?? 0, weight: "22%", inverse: false },
                { key: "SC", label: "Soporte Contractual", score: fdiData.breakdown?.SC ?? 0, weight: "18%", inverse: false },
                { key: "EC", label: "Exposición Crítica", score: fdiData.breakdown?.EC ?? 0, weight: "20%", inverse: true },
                { key: "DO", label: "Disciplina Operativa", score: fdiData.breakdown?.DO ?? 0, weight: "12%", inverse: false },
            ],
            inputs: [
                { label: "Operaciones", value: String(fdiData.inputs?.total_operaciones ?? 0) },
                { label: "Validadas", value: String(fdiData.inputs?.operaciones_validadas ?? 0) },
                { label: "Alertas críticas", value: String(fdiData.inputs?.alertas_criticas ?? 0) },
                { label: "Riesgo alto (%)", value: String(fdiData.inputs?.pct_proveedores_riesgo_alto ?? 0) },
            ],
        };
    }, [fdiData]);

    const compactNarrative = useMemo(() => {
        if (!fdiNarrative?.narrative) return null;
        return {
            headline: fdiNarrative.narrative.headline,
            summary: fdiNarrative.narrative.executive_summary,
            evidence: fdiNarrative.narrative.evidence_points.slice(0, 2),
            actions: fdiNarrative.narrative.priority_actions.slice(0, 2),
        };
    }, [fdiNarrative]);

    // Extract sparkline data from trend_weekly for MetricCards
    const coverageSparkline = useMemo(() => {
        if (!coberturaP0?.trend_weekly?.length) return undefined;
        return coberturaP0.trend_weekly.map(w =>
            w.total_operaciones > 0 ? Math.round((w.completas / w.total_operaciones) * 100) : 0
        );
    }, [coberturaP0]);

    const validatedSparkline = useMemo(() => {
        if (!coberturaP0?.trend_weekly?.length) return undefined;
        return coberturaP0.trend_weekly.map(w => w.validadas);
    }, [coberturaP0]);

    const historySparkline = useMemo(() => {
        if (!fdiHistory?.series?.length) return undefined;
        return fdiHistory.series.map((point) => point.score);
    }, [fdiHistory]);

    // Loading Skeletons
    if (isLoading) {
        return (
            <div className="space-y-4 animate-pulse">
                <div className="h-16 bg-slate-200 rounded-2xl w-full" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="h-48 bg-slate-200 rounded-2xl" />
                    <div className="h-48 bg-slate-200 rounded-2xl" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="h-48 bg-slate-200 rounded-2xl" />
                    <div className="h-48 bg-slate-200 rounded-2xl" />
                </div>
                <div className="h-64 bg-slate-200 rounded-2xl" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
                <p className="text-rose-600 font-medium">{error}</p>
            </div>
        );
    }

    return (
        <div className="space-y-5 animate-in fade-in duration-500">
            <section className="grid gap-4 xl:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)] xl:items-stretch">
                <div className="surface-panel-strong relative overflow-hidden rounded-[2rem] border border-[rgba(200,192,177,0.78)] p-4 shadow-fiscal">
                    <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 translate-x-12 -translate-y-10 rounded-full bg-[rgba(45,91,136,0.12)] blur-3xl" />
                    <div className="pointer-events-none absolute bottom-0 left-0 h-44 w-44 -translate-x-10 translate-y-10 rounded-full bg-[rgba(184,137,70,0.10)] blur-3xl" />

                    <div className="relative z-10 flex h-full flex-col">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                            <p className="kicker-label">Resumen del día</p>
                            <h1 className="mt-2 max-w-[10ch] font-display text-[1.7rem] font-semibold leading-[0.92] tracking-[-0.04em] text-[var(--fiscal-ink)] sm:text-[2rem]">
                                Defensa fiscal en un tablero corto.
                            </h1>
                            <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-[var(--fiscal-muted)]">
                                Corte, presión y salto directo al frente crítico.
                            </p>
                            </div>
                            <div className="shrink-0 pt-0.5 text-sm text-[var(--fiscal-accent)]">
                                <FdiInfoModalTrigger />
                            </div>
                        </div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                            <div className="rounded-[1rem] border border-[rgba(45,91,136,0.16)] bg-[linear-gradient(180deg,rgba(219,230,240,0.62),rgba(255,255,255,0.88))] px-3.5 py-3 shadow-sm">
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-accent)]">FDI actual</p>
                                <p className="mt-1 font-display text-[1.95rem] font-semibold leading-none text-[var(--fiscal-ink)]">
                                    {fdiSnapshot ? fdiSnapshot.score.toFixed(1) : "-"}
                                </p>
                            </div>
                            <div className="rounded-[1rem] border border-[rgba(160,67,61,0.16)] bg-[linear-gradient(180deg,rgba(250,242,241,0.92),rgba(255,255,255,0.88))] px-3.5 py-3 shadow-sm">
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-danger)]">Alertas activas</p>
                                <p className="mt-1 font-display text-[1.95rem] font-semibold leading-none text-[var(--fiscal-ink)]">
                                    {dashboardData?.active_alerts?.length ?? 0}
                                </p>
                            </div>
                            <div className="rounded-[1rem] border border-[rgba(184,137,70,0.18)] bg-[linear-gradient(180deg,rgba(255,248,238,0.94),rgba(255,255,255,0.88))] px-3.5 py-3 shadow-sm">
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-gold)]">Último corte</p>
                                <p className="mt-1 text-[12px] font-semibold leading-snug text-[var(--fiscal-ink)]">
                                    {lastUpdated ?? "Sin datos"}
                                </p>
                            </div>
                        </div>

                        <div className="mt-3 rounded-[1.35rem] border border-[rgba(200,192,177,0.68)] bg-white/80 p-3 shadow-panel">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-accent)]">Acceso rápido</span>
                                {QUICK_LINKS.map((item, index) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`group inline-flex min-h-[42px] items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${
                                            index === 0
                                                ? "border-[rgba(45,91,136,0.18)] bg-[rgba(219,230,240,0.42)] hover:bg-[rgba(219,230,240,0.6)]"
                                                : index === 1
                                                    ? "border-[rgba(184,137,70,0.18)] bg-[rgba(255,248,238,0.85)] hover:bg-[rgba(255,244,228,0.95)]"
                                                    : "border-[rgba(31,122,90,0.16)] bg-[rgba(240,248,244,0.88)] hover:bg-[rgba(231,244,237,0.98)]"
                                        }`}
                                    >
                                        <span className="text-[var(--fiscal-ink)]">{item.label}</span>
                                        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--fiscal-muted)]">{item.description}</span>
                                        <span className="text-base text-[var(--fiscal-muted)] transition group-hover:translate-x-1 group-hover:text-[var(--fiscal-accent)]">→</span>
                                    </Link>
                                ))}
                                <div className="ml-auto">
                                    <GuiaContador
                                        section="Centro de defensa fiscal"
                                        variant="modal"
                                        defaultOpen={false}
                                        steps={[
                                            { title: "Lee primero el corte", description: "Empieza por <strong>FDI actual</strong>, alertas activas y fecha de corte para entender si el tablero exige reacción inmediata o seguimiento ordinario." },
                                            { title: "Entra sólo al frente crítico", description: "Usa <strong>Operaciones</strong>, <strong>Consulta legal</strong> o <strong>Historial FDI</strong> según el hallazgo; evita recorrer todo el dashboard si ya sabes dónde actuar." },
                                            { title: "Abre detalle cuando haga falta", description: "Los botones de detalle concentran fórmula, narrativa y soporte sin obligarte a hacer scroll continuo." },
                                        ]}
                                        concepts={[
                                            { term: "FDI", definition: "Lectura consolidada de defendibilidad fiscal, soporte documental y presión de riesgo." },
                                            { term: "Corte", definition: "Momento exacto de actualización sobre el que debe interpretarse el tablero." },
                                        ]}
                                        tips={[
                                            "Empieza por alertas y presión crítica antes de revisar componentes estables.",
                                            "Usa el detalle modal para comité, no como paso obligatorio de navegación diaria.",
                                        ]}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <section className="surface-shell relative overflow-hidden rounded-[2rem] p-4 text-white shadow-fiscal sm:p-5">
                    <div className="pointer-events-none absolute right-0 top-0 h-56 w-56 translate-x-12 -translate-y-16 rounded-full bg-[rgba(255,255,255,0.10)] blur-3xl" />
                    <div className="pointer-events-none absolute bottom-0 left-0 h-52 w-52 -translate-x-12 translate-y-14 rounded-full bg-[rgba(142,231,218,0.20)] blur-3xl" />

                    {fdiSnapshot ? (
                        <div className="relative z-10 flex h-full flex-col">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <p className="eyebrow-shell">Fiscal Defense Index (FDI)</p>
                                    <div className="mt-2 flex items-end gap-3">
                                        <span className="font-display text-[3.4rem] font-semibold leading-none tracking-[-0.05em] text-white sm:text-[4rem]">
                                            {fdiSnapshot.score.toFixed(1)}
                                        </span>
                                        <span className="mb-2 text-base font-medium text-[rgba(223,255,250,0.82)]">/100</span>
                                    </div>
                                    <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                                        <span className="inline-flex items-center rounded-full border border-white/18 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
                                            {fdiSnapshot.level.label}
                                        </span>
                                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgba(220,255,250,0.76)]">
                                            Ventana {fdiSnapshot.periodDays}d
                                        </span>
                                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgba(220,255,250,0.76)]">
                                            {lastUpdated ? `Corte ${lastUpdated}` : "Sin corte"}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex min-w-[210px] flex-wrap gap-2 lg:max-w-[280px] lg:justify-end">
                                    {fdiSnapshot.inputs.slice(0, 4).map((item) => (
                                        <div key={item.label} className="rounded-full border border-white/12 bg-white/8 px-3 py-2 backdrop-blur-sm">
                                            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[rgba(198,245,237,0.68)]">{item.label}</p>
                                            <p className="mt-0.5 text-sm font-semibold text-white">{item.value}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-4 rounded-[1.35rem] border border-white/12 bg-white/8 p-3 backdrop-blur-sm">
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[rgba(205,249,241,0.7)]">Componentes del índice</p>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgba(188,241,232,0.62)]">Lectura compacta</p>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                                    {fdiSnapshot.components.map((component) => (
                                        <div key={component.key} className="rounded-[1rem] border border-white/10 bg-white/6 px-3 py-2.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white">{component.key}</p>
                                                    <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-[rgba(199,246,238,0.68)]">{component.label}</p>
                                                </div>
                                                <span className="rounded-full bg-white/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[rgba(219,255,250,0.78)]">
                                                    {component.weight}
                                                </span>
                                            </div>
                                            <div className="mt-2 flex items-center justify-between gap-3">
                                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                                                    <div
                                                        className={`h-full rounded-full ${component.inverse ? "bg-[#f6b7ab]" : "bg-[#8ee7da]"}`}
                                                        style={{ width: `${component.score}%` }}
                                                    />
                                                </div>
                                                <span className={`font-display text-[1.35rem] font-semibold leading-none tracking-[-0.03em] ${component.inverse ? "text-[#ffe1db]" : "text-[rgba(236,255,252,0.98)]"}`}>
                                                    {component.score.toFixed(1)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2.5">
                                <ExecutiveDetailModal
                                    triggerLabel="Ver detalle FDI"
                                    eyebrow="Defensa fiscal"
                                    title="Detalle del FDI"
                                    description="Componentes, fórmula e insumos que explican el score actual."
                                    triggerClassName="inline-flex items-center justify-center rounded-full border border-white/14 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/14"
                                >
                                    <div className="rounded-[1.2rem] border border-[rgba(200,192,177,0.72)] bg-white/80 px-4 py-4">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">Fórmula</p>
                                        <p className="mt-2 text-sm font-semibold tracking-[0.02em] text-[var(--fiscal-ink)]">
                                            FDI = 0.28·DM + 0.22·SE + 0.18·SC + 0.20·(100-EC) + 0.12·DO
                                        </p>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                                        {fdiSnapshot.components.map((component) => (
                                            <div key={component.key} className="rounded-[1.2rem] border border-[rgba(200,192,177,0.72)] bg-white/90 px-4 py-4">
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-accent)]">{component.key}</span>
                                                    <span className="rounded-full bg-[rgba(45,91,136,0.08)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--fiscal-accent)]">
                                                        {component.weight}
                                                    </span>
                                                </div>
                                                <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--fiscal-muted)]">{component.label}</p>
                                                <div className="mt-4 flex items-end gap-2">
                                                    <span className={`font-display text-4xl font-semibold tracking-[-0.03em] ${component.inverse ? "text-[var(--fiscal-danger)]" : "text-[var(--fiscal-ink)]"}`}>
                                                        {component.score.toFixed(1)}
                                                    </span>
                                                    <span className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-[var(--fiscal-muted)]">/100</span>
                                                </div>
                                                <div className="mt-4 h-2 overflow-hidden rounded-full bg-[rgba(15,23,42,0.08)]">
                                                    <div
                                                        className={`h-full rounded-full ${component.inverse ? "bg-[var(--fiscal-danger)]" : "bg-[var(--fiscal-accent)]"}`}
                                                        style={{ width: `${component.score}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ExecutiveDetailModal>
                                <Link
                                    href="/dashboard/fdi-history"
                                    className="inline-flex items-center justify-center rounded-full border border-white/14 bg-transparent px-4 py-2.5 text-sm font-semibold text-[rgba(240,236,228,0.86)] transition hover:border-white/24 hover:text-white"
                                >
                                    Ir al historial FDI
                                </Link>
                            </div>
                        </div>
                    ) : null}
                </section>
            </section>

            <section className="surface-panel-strong rounded-[1.5rem] border border-[rgba(200,192,177,0.72)] p-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.8fr)] lg:items-stretch">
                    <div className="min-w-0 lg:border-r lg:border-[rgba(200,192,177,0.58)] lg:pr-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="kicker-label mb-2">Lectura ejecutiva</p>
                                {!isNarrativeLoading && !narrativeError && compactNarrative ? (
                                    <h3 className="truncate font-display text-lg font-semibold text-[var(--fiscal-ink)] sm:text-xl">{compactNarrative.headline}</h3>
                                ) : (
                                    <h3 className="font-display text-lg font-semibold text-[var(--fiscal-ink)] sm:text-xl">Narrativa automática CFO</h3>
                                )}
                            </div>
                            {!isNarrativeLoading && !narrativeError && fdiNarrative ? (
                                <ExecutiveDetailModal
                                    triggerLabel="Abrir lectura"
                                    eyebrow="Narrativa automática"
                                    title={fdiNarrative.narrative.headline}
                                    description="Lectura ejecutiva para revisar evidencia y prioridades sin saturar el panel principal."
                                    triggerClassName="inline-flex shrink-0 items-center justify-center rounded-full border border-[rgba(200,192,177,0.72)] bg-white/85 px-3.5 py-2 text-sm font-semibold text-[var(--fiscal-muted)] transition hover:border-[var(--fiscal-accent)]/35 hover:text-[var(--fiscal-accent)]"
                                >
                                    <p className="text-sm leading-relaxed text-[var(--fiscal-muted)]">{fdiNarrative.narrative.executive_summary}</p>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-xl border border-[rgba(200,192,177,0.5)] bg-white/80 p-3">
                                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">Evidencia</p>
                                            <ul className="mt-2 space-y-1 text-sm text-[var(--fiscal-ink)]">
                                                {fdiNarrative.narrative.evidence_points.map((point) => (
                                                    <li key={point}>- {point}</li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="rounded-xl border border-[rgba(200,192,177,0.5)] bg-white/80 p-3">
                                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">Acciones prioritarias</p>
                                            <ul className="mt-2 space-y-1 text-sm text-[var(--fiscal-ink)]">
                                                {fdiNarrative.narrative.priority_actions.map((action) => (
                                                    <li key={action}>- {action}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </ExecutiveDetailModal>
                            ) : null}
                        </div>
                        {isNarrativeLoading && (
                            <div className="mt-3 space-y-2 animate-pulse">
                                <div className="h-6 w-3/5 rounded bg-[rgba(15,23,42,0.08)]" />
                                <div className="h-4 w-full rounded bg-[rgba(15,23,42,0.08)]" />
                                <div className="h-4 w-10/12 rounded bg-[rgba(15,23,42,0.08)]" />
                            </div>
                        )}
                        {!isNarrativeLoading && narrativeError && (
                            <p className="mt-3 text-sm text-[var(--fiscal-muted)]">{narrativeError}</p>
                        )}
                        {!isNarrativeLoading && !narrativeError && compactNarrative && (
                            <>
                                <p className="mt-3 text-sm leading-relaxed text-[var(--fiscal-muted)]">{compactNarrative.summary}</p>
                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-xl border border-[rgba(200,192,177,0.5)] bg-white/80 p-3">
                                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">Evidencia</p>
                                        <ul className="mt-2 space-y-1 text-sm text-[var(--fiscal-ink)]">
                                            {compactNarrative.evidence.map((point) => (
                                                <li key={point}>- {point}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="rounded-xl border border-[rgba(200,192,177,0.5)] bg-white/80 p-3">
                                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">Acciones</p>
                                        <ul className="mt-2 space-y-1 text-sm text-[var(--fiscal-ink)]">
                                            {compactNarrative.actions.map((action) => (
                                                <li key={action}>- {action}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex min-w-0 flex-col justify-between rounded-[1.25rem] border border-[rgba(200,192,177,0.58)] bg-white/70 p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="kicker-label mb-2">Evolución FDI</p>
                                <h3 className="font-display text-lg font-semibold text-[var(--fiscal-ink)]">Últimos 90 días</h3>
                            </div>
                            <Link
                                href="/dashboard/fdi-history"
                                className="shrink-0 text-sm font-semibold text-[var(--fiscal-accent)] transition hover:text-[var(--fiscal-ink)]"
                            >
                                Ver serie
                            </Link>
                        </div>

                        {isHistoryLoading ? (
                            <div className="mt-4 space-y-2 animate-pulse">
                                <div className="h-10 w-2/3 rounded bg-[rgba(15,23,42,0.08)]" />
                                <div className="h-3 w-1/2 rounded bg-[rgba(15,23,42,0.08)]" />
                                <div className="h-16 w-full rounded bg-[rgba(15,23,42,0.08)]" />
                            </div>
                        ) : fdiHistory ? (
                            <>
                                <div className="mt-3 flex items-end justify-between gap-3">
                                    <div>
                                        <p className="font-display text-3xl font-semibold tracking-tight text-[var(--fiscal-ink)]">
                                            {(fdiHistory.summary?.current_score ?? 0).toFixed(1)}<span className="text-lg text-[var(--fiscal-muted)]">/100</span>
                                        </p>
                                        <p className="mt-1 text-xs text-[var(--fiscal-muted)]">{fdiHistory.summary?.points ?? 0} puntos históricos</p>
                                    </div>
                                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${(fdiHistory.summary?.trend_delta ?? 0) >= 0 ? "bg-[var(--fiscal-success-soft)] text-[var(--fiscal-success)]" : "bg-[var(--fiscal-warning-soft)] text-[var(--fiscal-warning)]"}`}>
                                        {(fdiHistory.summary?.trend_delta ?? 0) >= 0 ? "+" : ""}{(fdiHistory.summary?.trend_delta ?? 0).toFixed(1)}
                                    </span>
                                </div>
                                <div className="mt-4 rounded-[1rem] border border-[rgba(200,192,177,0.58)] bg-white/90 px-3 py-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--fiscal-muted)]">Tendencia</p>
                                        {historySparkline && historySparkline.length > 1 ? (
                                            <div>
                                                <SparklineSVG
                                                    data={historySparkline}
                                                    color={(fdiHistory.summary?.trend_delta ?? 0) >= 0 ? "#1f7a5a" : "#a6671f"}
                                                    width={112}
                                                    height={34}
                                                />
                                            </div>
                                        ) : null}
                                    </div>
                                    <p className="mt-2 text-xs leading-relaxed text-[var(--fiscal-muted)]">
                                        Seguimiento del score para detectar quiebres y cambios de dirección sin abrir otra vista.
                                    </p>
                                </div>
                            </>
                        ) : (
                            <p className="mt-4 text-sm text-[var(--fiscal-muted)]">{historyError ?? "Sin datos históricos disponibles por el momento."}</p>
                        )}
                    </div>
                </div>
            </section>

            {/* ═══ ZONA 1: Hero Metrics (2 columns) ═══ */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-stretch">
                {/* Left: Protected Value */}
                <ProtectedValueCard protectedAmount={dashboardData?.protected_value} />

                {/* Right: Risk Summary + Donut compact */}
                <div className="flex h-full flex-col gap-4">
                    <MaterialityDonutChart
                        coveragePercentage={dashboardData?.materiality_coverage}
                        totalOpsCount={dashboardData?.total_ops_count}
                        validatedOpsCount={dashboardData?.validated_ops_count}
                    />
                </div>
            </div>

            {/* ═══ ZONA 2: Actions + P0 Metrics ═══ */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
                {/* Left: Today Actions */}
                <div className="lg:col-span-2">
                    <TodayActions actions={todayActions} className="h-full" />
                </div>

                {/* Right: P0 Metric Cards */}
                <div className="lg:col-span-3 grid grid-cols-2 gap-3.5 content-start">
                    <MetricCard
                        title="Confianza documental"
                        value={coberturaP0 ? `${coberturaP0.coverage.cobertura_documental_pct.toFixed(1)}%` : "-"}
                        helper={coberturaP0 ? `${coberturaP0.coverage.completas}/${coberturaP0.coverage.total_operaciones} operaciones sostienen el FDI` : undefined}
                        tone={coberturaP0 && coberturaP0.coverage.cobertura_documental_pct >= 80 ? "positive" : coberturaP0 && coberturaP0.coverage.cobertura_documental_pct >= 50 ? "warning" : "alert"}
                        href="/dashboard/operaciones"
                        sparklineData={coverageSparkline}
                    />
                    <MetricCard
                        title="Frentes abiertos"
                        value={coberturaP0 ? String(coberturaP0.alertas.activas_total) : "-"}
                        helper={coberturaP0 ? `Críticas: ${coberturaP0.alertas.por_tipo.FALTANTES_CRITICOS}` : undefined}
                        tone={coberturaP0 && coberturaP0.alertas.activas_total > 0 ? "alert" : "positive"}
                        href="/dashboard/alertas"
                    />
                    <MetricCard
                        title="Presión crítica"
                        value={coberturaP0 ? String(coberturaP0.riesgo_distribution.ALTO.count) : "-"}
                        helper="Operaciones con mayor presión de riesgo hoy"
                        tone={coberturaP0 && coberturaP0.riesgo_distribution.ALTO.count > 0 ? "alert" : "positive"}
                        href="/dashboard/operaciones"
                        sparklineData={validatedSparkline}
                    />
                    <MetricCard
                        title="Última actualización"
                        value={lastUpdated ?? "Sin datos"}
                        tone="info"
                    />
                </div>
            </div>

            {/* ═══ ZONA 3: Resumen profundo compacto ═══ */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
                <CompactFocusCard
                    tone="rose"
                    icon={<AlertTriangle className="h-5 w-5" />}
                    eyebrow="Señales críticas"
                    title="Erosión del FDI"
                    summary="Concentra alertas activas y presión inmediata para que sólo abras el frente rojo cuando realmente lo necesites."
                    stats={[
                        { label: "Alertas activas", value: String(dashboardData?.active_alerts?.length ?? 0) },
                        { label: "Riesgo CSD", value: `${dashboardData?.csd_risk_score ?? 0}/100` },
                    ]}
                    modalTitle="Señales que erosionan el FDI"
                    modalDescription="Monitoreo de alertas críticas y exposición que hoy deterioran el índice."
                >
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
                        <div className="flex flex-col gap-3 md:col-span-8">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">Qué roba tranquilidad hoy</h3>
                            {dashboardData?.active_alerts && dashboardData.active_alerts.length > 0 ? (
                                <div className="flex flex-col gap-3">
                                    {dashboardData.active_alerts.map(alert => (
                                        <AlertBanner key={alert.id} title={alert.title} message={alert.message} severity={alert.severity as any} />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                                    <div className="rounded-full bg-emerald-100 p-3">
                                        <ShieldCheck className="h-6 w-6 text-emerald-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-emerald-900">Sin señales críticas</h3>
                                        <p className="max-w-sm text-sm text-emerald-700">Tu red de proveedores no presenta cruces ni alertas críticas en este momento.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col gap-3 md:col-span-4">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">Presión de riesgo</h3>
                            <CsdRiskThermometer riskScore={dashboardData?.csd_risk_score} />
                        </div>
                    </div>
                </CompactFocusCard>

                <CompactFocusCard
                    tone="blue"
                    icon={<ShieldCheck className="h-5 w-5" />}
                    eyebrow="Soporte"
                    title="Confianza documental"
                    summary="Resume cuánto del universo ya sostiene el índice y qué pendientes siguen quitando defendibilidad."
                    stats={[
                        { label: "Cobertura", value: coberturaP0 ? `${coberturaP0.coverage.cobertura_documental_pct.toFixed(1)}%` : "-" },
                        { label: "Pendientes", value: String(dashboardData?.pending_dossiers ?? 0) },
                    ]}
                    modalTitle="Confianza documental"
                    modalDescription="Progreso del soporte que hoy sostiene el valor fiscal y fortalece el FDI."
                >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <MetricCard
                            title="Valor bajo resguardo"
                            value={dashboardData?.protected_value ? fmt(dashboardData.protected_value) : "$0"}
                            helper="Monto con soporte verificable"
                            tone="positive"
                            href="/dashboard/operaciones"
                        />
                        <MetricCard
                            title="Operaciones que sostienen el FDI"
                            value={`${dashboardData?.validated_ops_count ?? 0} / ${dashboardData?.total_ops_count ?? 0}`}
                            helper="Operaciones con entregable al 100%"
                            tone={dashboardData && dashboardData.materiality_coverage >= 80 ? "positive" : "warning"}
                            href="/dashboard/operaciones"
                        />
                        <MetricCard
                            title="Expedientes que restan confianza"
                            value={String(dashboardData?.pending_dossiers ?? 0)}
                            helper="Requieren documentación crítica"
                            tone={dashboardData && (dashboardData.pending_dossiers ?? 0) > 0 ? "warning" : "positive"}
                            href="/dashboard/operaciones"
                        />
                        <MetricCard
                            title="Proveedores sin validar"
                            value={String(dashboardData?.unvalidated_providers ?? 0)}
                            helper="Sin escaneo SAT reciente"
                            tone={dashboardData && (dashboardData.unvalidated_providers ?? 0) > 0 ? "alert" : "positive"}
                            href="/dashboard/proveedores"
                        />
                    </div>
                </CompactFocusCard>

                <CompactFocusCard
                    tone="emerald"
                    icon={<BarChart3 className="h-5 w-5" />}
                    eyebrow="Fundamento"
                    title="Sustancia económica"
                    summary="Mantiene fuera del flujo principal el análisis económico detallado, pero lo deja disponible para revisión ejecutiva inmediata."
                    stats={[
                        { label: "Intangibles", value: dashboardData?.intangibles_valuation ? fmt(dashboardData.intangibles_valuation) : "$0" },
                        { label: "Operaciones", value: String(dashboardData?.total_ops_count ?? 0) },
                    ]}
                    modalTitle="Sustancia económica"
                    modalDescription="Fundamento económico que explica por qué la postura fiscal se sostiene."
                >
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
                        <div className="md:col-span-12 lg:col-span-8">
                            <IntangibleAssetsChart intangiblesValuation={dashboardData?.intangibles_valuation} />
                        </div>
                    </div>
                </CompactFocusCard>

                <CompactFocusCard
                    tone="purple"
                    icon={<FolderOpenDot className="h-5 w-5" />}
                    eyebrow="Control"
                    title="Prioridades operativas"
                    summary="Consolida cartera, vencimientos y expedientes abiertos en una sola entrada, sin exponer toda la tabla en la portada."
                    stats={[
                        { label: "Contratos por vencer", value: String(dashboardData?.contracts_expiring ?? 0) },
                        { label: "Sin validar", value: String(dashboardData?.unvalidated_providers ?? 0) },
                    ]}
                    modalTitle="Control y prioridades"
                    modalDescription="Pendientes y expedientes que deben resolverse para sostener el FDI."
                >
                    {user?.despacho_tipo === 'despacho' && (
                        <PortfolioRiskTable portfolio={dashboardData?.portfolio} activeClientsCount={dashboardData?.active_clients_count} />
                    )}
                    {user?.despacho_tipo !== 'despacho' && (
                        <OperativeWorkflows
                            contracts_expiring={dashboardData?.contracts_expiring || 0}
                            pending_dossiers={dashboardData?.pending_dossiers || 0}
                            unvalidated_providers={dashboardData?.unvalidated_providers || 0}
                        />
                    )}
                </CompactFocusCard>
            </div>

            {/* ═══ ZONA 4: ROI Card (footer) ═══ */}
            <ROICard
                currentValue={dashboardData?.protected_value ?? 0}
                dossierCount={dashboardData?.validated_ops_count ?? 0}
                contractCount={dashboardData?.contracts_expiring ?? 0}
                validationCount={dashboardData?.total_ops_count ?? 0}
            />
        </div>
    );
}
