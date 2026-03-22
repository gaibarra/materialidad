import { ShieldCheck, Info } from "lucide-react";
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
        <div className="surface-panel relative flex h-full min-h-[17.5rem] flex-col justify-between overflow-hidden rounded-[1.8rem] p-5 sm:min-h-[18.5rem] sm:p-6">

            <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-[rgba(45,91,136,0.06)] blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 -ml-12 -mb-12 h-40 w-40 rounded-full bg-[rgba(184,137,70,0.08)] blur-2xl pointer-events-none" />

            <div className="relative z-10 flex flex-1 flex-col items-start gap-4 sm:gap-5">
                <TooltipProvider>
                    <Tooltip delayDuration={300}>
                        <TooltipTrigger asChild>
                            <div className="flex cursor-help flex-wrap items-center gap-2 rounded-full border border-[rgba(45,91,136,0.18)] bg-[rgba(219,230,240,0.58)] px-3 py-1.5 transition hover:bg-[rgba(219,230,240,0.78)] sm:px-3.5">
                                <ShieldCheck className="h-4 w-4 text-[var(--fiscal-accent)]" />
                                <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--fiscal-accent)]">Riesgo mitigado</span>
                                <Info className="ml-1 h-3.5 w-3.5 text-[var(--fiscal-accent)]/70" />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs border-[rgba(200,192,177,0.75)] bg-[var(--fiscal-panel)] text-[var(--fiscal-ink)]">
                            <p className="text-sm">
                                Suma total de operaciones blindadas exitosamente con Expedientes de Materialidad Definitivos, protegiendo a la empresa contra controversias del SAT (Artículo 5-A CFF).
                            </p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <div className="space-y-1.5">
                    <p className="kicker-label">Valor protegido</p>
                    <h3 className="font-display text-[2.3rem] font-semibold leading-[0.92] tracking-[-0.04em] text-[var(--fiscal-ink)] sm:text-[3.2rem] lg:text-[3.6rem]">
                        {formattedAmount}
                    </h3>
                    <p className="max-w-lg text-sm leading-relaxed text-[var(--fiscal-muted)]">
                        Facturación con expediente validado y defendible.
                    </p>
                </div>
            </div>

            <div className="relative z-10 mt-4 flex justify-end border-t border-[rgba(200,192,177,0.72)] pt-4">
                <Link
                    href="/dashboard/expedientes"
                    className="group flex items-center gap-1 text-sm font-semibold text-[var(--fiscal-accent)] transition-colors hover:text-[var(--fiscal-ink)]"
                >
                    Explorar Expedientes
                    <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
                </Link>
            </div>
        </div>
    );
}
