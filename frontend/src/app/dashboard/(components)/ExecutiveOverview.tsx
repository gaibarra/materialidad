"use client";

import { useState, useEffect } from "react";
import { useAuthContext } from "../../../context/AuthContext";
import { AlertBanner } from "./shared/AlertBanner";
import { ProtectedValueCard } from "./metrics/ProtectedValueCard";
import { CsdRiskThermometer } from "./metrics/CsdRiskThermometer";
import { MaterialityDonutChart } from "./metrics/MaterialityDonutChart";
import { IntangibleAssetsChart } from "./metrics/IntangibleAssetsChart";
import { PortfolioRiskTable } from "./tenant-variants/PortfolioRiskTable";
import { OperativeWorkflows } from "./tenant-variants/OperativeWorkflows";
import { apiFetch } from "../../../lib/api";
import Cookies from "js-cookie";
import { GuiaContador } from "../../../components/GuiaContador";

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

export function ExecutiveOverview() {
    const { user, tenant } = useAuthContext();
    const [dashboardData, setDashboardData] = useState<DashboardSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDashboardSummary = async () => {
            try {
                setIsLoading(true);
                const response = await apiFetch<DashboardSummary>('/api/materialidad/dashboard/executive-summary/');
                if (response) {
                    setDashboardData(response);
                    setError(null);
                } else {
                    setError('Received empty response from the server');
                }
            } catch (err) {
                console.error("Error fetching dashboard summary:", err);
                setError(err instanceof Error ? err.message : 'An unknown error occurred');
            } finally {
                setIsLoading(false);
            }
        };

        if (user) {
            fetchDashboardSummary();
        }
    }, [user]);

    // Loading Skeletons
    if (isLoading) {
        return (
            <div className="space-y-8 animate-pulse">
                <div className="h-24 bg-slate-200 rounded-2xl w-full" />
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-8 h-96 bg-slate-200 rounded-3xl" />
                    <div className="md:col-span-4 h-96 bg-slate-200 rounded-3xl" />
                    <div className="md:col-span-6 h-64 bg-slate-200 rounded-3xl" />
                    <div className="md:col-span-6 h-64 bg-slate-200 rounded-3xl" />
                </div>
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
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Guía del Contador */}
            <div className="flex justify-start mb-6">
                <GuiaContador
                    section="Dashboard Ejecutivo"
                    steps={[
                        {
                            title: "Revisa las Alertas Críticas",
                            description: "Detecta de inmediato si algún proveedor tiene riesgo 69-B (EFOS) o si tu CSD está en peligro de cancelación."
                        },
                        {
                            title: "Analiza el Valor Fiscal Protegido",
                            description: "Mide el impacto económico de las operaciones que ya cuentan con un expediente de materialidad validado."
                        },
                        {
                            title: "Coordina la Operación",
                            description: "Utiliza las Herramientas Operativas para vigilar qué expedientes faltan o qué contratos están por vencer, y delega a tu equipo."
                        }
                    ]}
                    concepts={[
                        {
                            term: "Riesgo CSD",
                            definition: "El porcentaje de operaciones facturadas que provienen de proveedores con un estatus riesgoso ante el SAT."
                        },
                        {
                            term: "Cobertura Contractual",
                            definition: "El porcentaje de empresas en el grupo que cuentan con contratos vigentes cargados en la plataforma."
                        }
                    ]}
                    tips={[
                        "Mantén tu Cobertura de Materialidad por encima del 80% para asegurar el flujo de la organización en caso de auditoría.",
                        "Revisa diariamente el panel de 'Atención Inmediata' para mitigar cualquier riesgo o controversia fiscal de raíz."
                    ]}
                />
            </div>

            {/* Sección 1: Alertas Críticas (Atención Inmediata) */}
            <section className="flex flex-col gap-3">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">Atención Inmediata</h2>
                {dashboardData?.active_alerts && dashboardData.active_alerts.length > 0 ? (
                    dashboardData.active_alerts.map(alert => (
                        <AlertBanner key={alert.id} title={alert.title} message={alert.message} severity={alert.severity as any} />
                    ))
                ) : (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 flex items-center gap-4">
                        <div className="p-2 bg-emerald-100 rounded-full">
                            <span className="text-emerald-600">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            </span>
                        </div>
                        <div>
                            <h3 className="font-bold text-emerald-900">Sin Alertas Críticas</h3>
                            <p className="text-sm text-emerald-700">Tu red de proveedores no presenta cruces con las listas 69-B ni riesgos de CSD activos.</p>
                        </div>
                    </div>
                )}
            </section>

            {/* Sección 2: Métricas Hero (Defensa y Valor CFO) */}
            <section>
                <div className="mb-4">
                    <h2 className="text-xl sm:text-2xl font-semibold text-ink-500">Valor Fiscal Protegido</h2>
                    <p className="text-sm text-slate-500">Métricas de impacto directo en el balance y exposición ante auditorías.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-8">
                        <ProtectedValueCard protectedAmount={dashboardData?.protected_value} />
                    </div>

                    <div className="md:col-span-4">
                        <CsdRiskThermometer riskScore={dashboardData?.csd_risk_score} />
                    </div>

                    <div className="md:col-span-6">
                        <MaterialityDonutChart
                            coveragePercentage={dashboardData?.materiality_coverage}
                            totalOpsCount={dashboardData?.total_ops_count}
                            validatedOpsCount={dashboardData?.validated_ops_count}
                        />
                    </div>
                    <div className="md:col-span-6">
                        <IntangibleAssetsChart intangiblesValuation={dashboardData?.intangibles_valuation} />
                    </div>
                </div>
            </section>

            {/* Sección 3: Variantes Específicas del Tenant */}
            <section className="pt-6 border-t border-slate-200">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-6">Herramientas Operativas</h2>
                {user?.despacho_tipo === 'despacho' && <PortfolioRiskTable portfolio={dashboardData?.portfolio} activeClientsCount={dashboardData?.active_clients_count} />}
                {user?.despacho_tipo !== 'despacho' && (
                    <OperativeWorkflows
                        contracts_expiring={dashboardData?.contracts_expiring || 0}
                        pending_dossiers={dashboardData?.pending_dossiers || 0}
                        unvalidated_providers={dashboardData?.unvalidated_providers || 0}
                    />
                )}
            </section>
        </div>
    );
}
