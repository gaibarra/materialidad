import { Users, AlertCircle } from "lucide-react";

interface PortfolioData {
    id: number;
    name: string;
    riskScore: number;
    missingFiles: number;
}

interface PortfolioRiskTableProps {
    portfolio?: PortfolioData[];
    activeClientsCount?: number;
}

export function PortfolioRiskTable({ portfolio = [], activeClientsCount = 0 }: PortfolioRiskTableProps) {
    return (
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-slate-900">Mapa de Calor del Portafolio</h3>
                    <p className="text-sm text-slate-500 mt-1">Clientes ordenados por índice de exposición fiscal.</p>
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                    <Users className="h-4 w-4" />
                    <span>{activeClientsCount} Clientes Activos</span>
                </div>
            </div>

            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold tracking-wider border-b border-slate-100">
                    <tr>
                        <th className="px-6 py-4">Cliente Corporativo</th>
                        <th className="px-6 py-4">Índice de Riesgo</th>
                        <th className="px-6 py-4">Documentos Faltantes (Mat.)</th>
                        <th className="px-6 py-4 text-right">Acción Comercial</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {portfolio.map(client => (
                        <tr key={client.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 font-semibold text-slate-800">{client.name}</td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <div className={`h-2.5 w-2.5 rounded-full ${client.riskScore > 80 ? 'bg-rose-500' : client.riskScore > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                    <span className="font-bold">{client.riskScore}/100</span>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-slate-600">
                                {client.missingFiles} expedientes
                            </td>
                            <td className="px-6 py-4 text-right">
                                {client.riskScore > 80 ? (
                                    <button className="text-xs font-bold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg hover:bg-rose-100 transition inline-flex items-center gap-1.5">
                                        <AlertCircle className="h-3.5 w-3.5" />
                                        Ofrecer Auditoría
                                    </button>
                                ) : (
                                    <span className="text-xs font-medium text-slate-400">En control</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
