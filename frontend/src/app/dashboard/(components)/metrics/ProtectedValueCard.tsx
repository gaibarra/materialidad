import { ShieldCheck, TrendingUp, Info } from "lucide-react";
import Link from "next/link";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface ProtectedValueCardProps {
    protectedAmount?: number;
}

export function ProtectedValueCard({ protectedAmount = 0 }: ProtectedValueCardProps) {
    const formattedAmount = new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(protectedAmount);

    return (
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-slate-900 to-slate-950 p-8 shadow-xl shadow-emerald-900/10 h-full flex flex-col justify-between">

            {/* Decals background */}
            <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-emerald-500/5 blur-3xl mix-blend-screen pointer-events-none" />
            <div className="absolute bottom-0 left-0 -ml-12 -mb-12 h-40 w-40 rounded-full bg-teal-500/10 blur-2xl pointer-events-none" />

            <div className="relative z-10 flex flex-col items-start gap-6">
                <TooltipProvider>
                    <Tooltip delayDuration={300}>
                        <TooltipTrigger asChild>
                            <div className="flex items-center gap-3 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 shadow-[0_0_15px_rgba(16,185,129,0.2)] cursor-help hover:bg-emerald-500/20 transition">
                                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                                <span className="text-xs font-bold uppercase tracking-widest text-emerald-300">Riesgo Mitigado (Art 5-A)</span>
                                <Info className="h-3.5 w-3.5 text-emerald-400/70 ml-1" />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs bg-slate-900 text-slate-100 border-slate-700">
                            <p className="text-sm">
                                Suma total de operaciones blindadas exitosamente con Expedientes de Materialidad Definitivos, protegiendo a la empresa contra controversias del SAT (Artículo 5-A CFF).
                            </p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <div className="space-y-2">
                    <h3 className="text-5xl md:text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-100 to-slate-400">
                        {formattedAmount} <span className="text-2xl text-slate-500 font-medium tracking-normal">MXN</span>
                    </h3>
                    <p className="text-base font-medium text-slate-400 max-w-lg">
                        Monto acumulado en facturación que cuenta con expediente de materialidad validado, defendible ante auditorías.
                    </p>
                </div>

                <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/5 bg-white/5 px-4 py-2 backdrop-blur-md hidden">
                    {/* Placeholder para la flecha de Crecimiento MoM Fase 3 */}
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm font-semibold text-emerald-300"></span>
                </div>
            </div>

            <div className="relative z-10 mt-6 pt-6 border-t border-slate-800 flex justify-end">
                <Link
                    href="/dashboard/expedientes"
                    className="text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 group"
                >
                    Explorar Expedientes
                    <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
                </Link>
            </div>
        </div>
    );
}
