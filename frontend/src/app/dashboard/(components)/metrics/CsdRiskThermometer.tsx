import Link from "next/link";

interface CsdRiskThermometerProps {
    riskScore?: number;
}

export function CsdRiskThermometer({ riskScore = 0 }: CsdRiskThermometerProps) {
    // Calculamos el ancho de la barra de riesgo en base al score
    const safeZone = Math.min(riskScore, 40); // 0 - 40
    const warningZone = Math.min(Math.max(riskScore - 40, 0), 30); // 41 - 70
    const dangerZone = Math.max(riskScore - 70, 0); // 71 - 100

    return (
        <div className="surface-panel relative flex h-full min-h-[22rem] flex-col justify-between overflow-hidden rounded-[1.8rem] p-6 sm:min-h-[23rem]">
            {/* Danger glow */}
            {riskScore > 50 && (
                <div className="pointer-events-none absolute right-0 top-0 -mr-10 -mt-10 h-32 w-32 rounded-full bg-[rgba(160,67,61,0.10)] blur-3xl" />
            )}

            <div className="flex-1">
                <p className="kicker-label mb-1">
                    Exposición CSD
                </p>
                <h3 className="font-display text-xl font-semibold leading-tight text-[var(--fiscal-ink)] sm:text-2xl">
                    Índice de riesgo acumulado
                </h3>

                <div className="mt-8 flex items-end justify-between">
                    <span className={`font-display text-4xl font-semibold tracking-[-0.04em] sm:text-5xl ${riskScore > 50 ? 'text-[var(--fiscal-danger)]' : 'text-[var(--fiscal-ink)]'}`}>
                        {riskScore.toFixed(1)}<span className="text-2xl opacity-50">%</span>
                    </span>
                </div>

                {/* Dynamic gauge UI */}
                <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-[rgba(200,192,177,0.35)]">
                    <div className="h-full bg-[var(--fiscal-accent)] transition-all duration-700" style={{ width: `${safeZone}%` }} />
                    <div className="h-full bg-[var(--fiscal-warning)] transition-all duration-700" style={{ width: `${warningZone}%` }} />
                    <div className="relative h-full bg-[var(--fiscal-danger)] transition-all duration-700" style={{ width: `${dangerZone}%` }}>
                        {dangerZone > 0 && (
                            <div className="absolute right-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-white shadow-sm" />
                        )}
                    </div>
                </div>
            </div>

            <div className="z-10 mt-6 flex flex-col gap-3 rounded-[1.2rem] border border-[rgba(200,192,177,0.72)] bg-white/70 p-4">
                <p className="text-sm leading-relaxed text-[var(--fiscal-muted)]">
                    Calculado usando operaciones ligadas a proveedores en listas negras del SAT o presuntos simuladores.
                </p>
                {riskScore > 0 && (
                    <Link
                        href="/dashboard/proveedores"
                        className="inline-flex w-full items-center justify-center rounded-full border border-[rgba(160,67,61,0.18)] bg-[rgba(247,221,218,0.42)] px-4 py-2.5 text-sm font-semibold text-[var(--fiscal-danger)] transition-colors hover:bg-[rgba(247,221,218,0.62)]"
                    >
                        Investigar Proveedores Mapeados
                    </Link>
                )}
            </div>
        </div>
    );
}
