import { Award } from "lucide-react";

interface IntangibleAssetsChartProps {
    intangiblesValuation?: number;
}

export function IntangibleAssetsChart({ intangiblesValuation = 0 }: IntangibleAssetsChartProps) {
    // Fase 2: Distribuimos el valor total recibido entre las 3 barras para mantener el look visual.
    // Propiedad Intelectual: 50%, Branding: 35%, I&D: 15%
    const propIntelectual = intangiblesValuation * 0.50;
    const branding = intangiblesValuation * 0.35;
    const id = intangiblesValuation * 0.15;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
            notation: amount > 1000000 ? "compact" : "standard"
        }).format(amount);
    };

    return (
        <div className="flex h-full flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">
                        NIF C-8 y Valor Agregado
                    </p>
                    <h3 className="text-xl font-bold text-slate-900 leading-tight">
                        Valuación de Intangibles
                    </h3>
                </div>
                <div className="p-2 bg-indigo-50 rounded-lg">
                    <Award className="h-5 w-5 text-indigo-600" />
                </div>
            </div>

            <div className="mt-6 mb-4 space-y-5 flex-1">
                <div>
                    <div className="flex justify-between text-sm font-semibold mb-2">
                        <span className="text-slate-700">Propiedad Intelectual y Software</span>
                        <span className="text-slate-900">{formatCurrency(propIntelectual)}</span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: intangiblesValuation > 0 ? '50%' : '0%' }} />
                    </div>
                </div>
                <div>
                    <div className="flex justify-between text-sm font-semibold mb-2">
                        <span className="text-slate-700">Capital de Marca (Branding)</span>
                        <span className="text-slate-900">{formatCurrency(branding)}</span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full transition-all duration-1000" style={{ width: intangiblesValuation > 0 ? '35%' : '0%' }} />
                    </div>
                </div>
                <div>
                    <div className="flex justify-between text-sm font-semibold mb-2">
                        <span className="text-slate-700">Desarrollo e Investigación</span>
                        <span className="text-slate-900">{formatCurrency(id)}</span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-400 rounded-full transition-all duration-1000" style={{ width: intangiblesValuation > 0 ? '15%' : '0%' }} />
                    </div>
                </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 mt-2">
                <p className="text-sm font-medium text-slate-600">
                    Suma proyectada de activos documentados bajo Contratos de categoría &apos;ACTIVOS&apos;.
                </p>
            </div>
        </div>
    );
}
