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
    const radius = 58;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (coveragePercentage / 100) * circumference;
    const pendingOpsCount = Math.max(0, totalOpsCount - validatedOpsCount);
    const toneClass = coveragePercentage >= 80
        ? 'text-[var(--fiscal-accent)]'
        : coveragePercentage >= 50
            ? 'text-[var(--fiscal-warning)]'
            : 'text-[var(--fiscal-danger)]';
    const statusLabel = coveragePercentage >= 80 ? 'Saludable' : coveragePercentage >= 50 ? 'Riesgo Moderado' : 'Criticidad Alta';

    return (
        <div className="surface-panel flex h-full min-h-[17.5rem] flex-col justify-between rounded-[1.8rem] p-5 sm:min-h-[18.5rem] sm:p-6">
            <div className="mb-1 flex items-start justify-between gap-4">
                <div>
                    <p className="kicker-label mb-1">
                        Validación documental
                    </p>
                    <h3 className="font-display text-lg font-semibold leading-tight text-[var(--fiscal-ink)] sm:text-xl">
                        Cobertura de Materialidad
                    </h3>
                </div>
                <div className="rounded-xl bg-[var(--fiscal-accent-soft)] p-2 shrink-0">
                    <Activity className="h-4 w-4 text-[var(--fiscal-accent)]" />
                </div>
            </div>

            <div className="my-3 flex flex-1 items-center justify-center sm:my-4">
                <div className="relative h-32 w-32 sm:h-36 sm:w-36">
                    <TooltipProvider>
                        {/* Fondo gris (Pendientes) */}
                        <Tooltip delayDuration={200}>
                            <TooltipTrigger asChild>
                                <svg className="w-full h-full transform -rotate-90 absolute inset-0 cursor-help focus:outline-none">
                                    <circle cx="72" cy="72" r={radius} stroke="currentColor" strokeWidth="14" fill="transparent" className="text-[rgba(200,192,177,0.38)] hover:text-[rgba(200,192,177,0.56)] transition-colors" />
                                </svg>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p className="font-medium text-[var(--fiscal-ink)]">{pendingOpsCount} operaciones pendientes</p>
                            </TooltipContent>
                        </Tooltip>

                        {/* Porcentaje activo (Completados) */}
                        <Tooltip delayDuration={200}>
                            <TooltipTrigger asChild>
                                <svg className="w-full h-full transform -rotate-90 absolute inset-0 pointer-events-none">
                                    <circle cx="72" cy="72" r={radius} stroke="currentColor" strokeWidth="14" fill="transparent"
                                        strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                                        className={`${toneClass} transition-all duration-1000 ease-out cursor-help pointer-events-auto`} />
                                </svg>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p className="font-medium text-[var(--fiscal-ink)]">{validatedOpsCount} operaciones completadas</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {/* Texto central */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="font-display text-[1.9rem] font-semibold text-[var(--fiscal-ink)] sm:text-[2.2rem]">{coveragePercentage.toFixed(1)}<span className="text-base sm:text-lg">%</span></span>
                        <span className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${toneClass}`}>
                            {statusLabel}
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-2 border-t border-[rgba(200,192,177,0.65)] pt-3">
                <div className="col-span-2">
                    <p className="text-center text-xs font-medium text-[var(--fiscal-muted)]">Basado en expedientes validados frente al universo requerido.</p>
                </div>
            </div>
        </div>
    );
}
