import { Activity } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface MaterialityDonutChartProps {
    coveragePercentage?: number;
    totalOpsCount?: number;
    validatedOpsCount?: number;
}

export function MaterialityDonutChart({
    coveragePercentage = 0,
    totalOpsCount = 0,
    validatedOpsCount = 0
}: MaterialityDonutChartProps) {
    // Calculamos el offset del SVG. 440 es el perímetro total aproxmado del círculo.
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (coveragePercentage / 100) * circumference;
    const pendingOpsCount = Math.max(0, totalOpsCount - validatedOpsCount);

    return (
        <div className="flex h-full flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">
                        Validación Documental (Art 5-A)
                    </p>
                    <h3 className="text-xl font-bold text-slate-900 leading-tight">
                        Cobertura de Materialidad
                    </h3>
                </div>
                <div className="p-2 bg-emerald-50 rounded-lg">
                    <Activity className="h-5 w-5 text-emerald-600" />
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center my-6">
                <div className="relative w-40 h-40">
                    <TooltipProvider>
                        {/* Fondo gris (Pendientes) */}
                        <Tooltip delayDuration={200}>
                            <TooltipTrigger asChild>
                                <svg className="w-full h-full transform -rotate-90 absolute inset-0 cursor-help focus:outline-none">
                                    <circle cx="80" cy="80" r={radius} stroke="currentColor" strokeWidth="16" fill="transparent" className="text-slate-100 hover:text-slate-200 transition-colors" />
                                </svg>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p className="font-medium text-slate-700">{pendingOpsCount} operaciones pendientes</p>
                            </TooltipContent>
                        </Tooltip>

                        {/* Porcentaje activo (Completados) */}
                        <Tooltip delayDuration={200}>
                            <TooltipTrigger asChild>
                                <svg className="w-full h-full transform -rotate-90 absolute inset-0 pointer-events-none">
                                    <circle cx="80" cy="80" r={radius} stroke="currentColor" strokeWidth="16" fill="transparent"
                                        strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                                        className={`${coveragePercentage >= 80 ? 'text-emerald-500 hover:text-emerald-400' : coveragePercentage >= 50 ? 'text-amber-500 hover:text-amber-400' : 'text-rose-500 hover:text-rose-400'} transition-all duration-1000 ease-out cursor-help pointer-events-auto`} />
                                </svg>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p className="font-medium text-slate-700">{validatedOpsCount} operaciones completadas</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {/* Texto central */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-4xl font-black text-slate-900">{coveragePercentage.toFixed(1)}<span className="text-xl">%</span></span>
                        <span className={`text-xs font-semibold uppercase ${coveragePercentage >= 80 ? 'text-emerald-600' : coveragePercentage >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                            {coveragePercentage >= 80 ? 'Saludable' : coveragePercentage >= 50 ? 'Riesgo Moderado' : 'Criticidad Alta'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div className="col-span-2">
                    <p className="text-xs font-medium text-slate-500 text-center">Basado en expedientes validados vs total requerido por NIF.</p>
                </div>
            </div>
        </div>
    );
}
