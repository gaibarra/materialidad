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
        <div className="flex h-full flex-col justify-between rounded-3xl border border-rose-200 bg-white p-6 shadow-sm relative overflow-hidden">
            {/* Danger glow */}
            {riskScore > 50 && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
            )}

            <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">
                    Exposición CSD (Art. 69-B)
                </p>
                <h3 className="text-xl font-bold text-slate-900 leading-tight">
                    Índice de Riesgo Acumulado
                </h3>

                <div className="mt-8 flex items-end justify-between">
                    <span className={`text-5xl font-black tracking-tighter ${riskScore > 50 ? 'text-rose-600' : 'text-slate-800'}`}>
                        {riskScore.toFixed(1)}<span className="text-2xl opacity-50">%</span>
                    </span>
                </div>

                {/* Dynamic gauge UI */}
                <div className="mt-4 h-3 w-full rounded-full bg-slate-100 overflow-hidden flex">
                    <div className="bg-emerald-400 h-full transition-all duration-700" style={{ width: `${safeZone}%` }} />
                    <div className="bg-amber-400 h-full transition-all duration-700" style={{ width: `${warningZone}%` }} />
                    <div className="bg-rose-500 h-full relative transition-all duration-700" style={{ width: `${dangerZone}%` }}>
                        {dangerZone > 0 && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white animate-pulse shadow-sm" />
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-6 rounded-xl bg-slate-50 p-4 border border-slate-100 flex flex-col gap-3 z-10">
                <p className="text-sm font-medium text-slate-600">
                    Calculado usando operaciones ligadas a proveedores en listas negras del SAT o presuntos simuladores.
                </p>
                {riskScore > 0 && (
                    <Link
                        href="/dashboard/proveedores"
                        className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors w-full border border-rose-200 shadow-sm"
                    >
                        Investigar Proveedores Mapeados
                    </Link>
                )}
            </div>
        </div>
    );
}
