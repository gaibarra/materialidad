import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { AlertTriangle, Clock, FileWarning } from "lucide-react"
import Link from "next/link"

interface OperativeWorkflowsProps {
    contracts_expiring: number
    pending_dossiers: number
    unvalidated_providers: number
}

export function OperativeWorkflows({
    contracts_expiring,
    pending_dossiers,
    unvalidated_providers
}: OperativeWorkflowsProps) {
    return (
        <div className="space-y-4">
            <h3 className="text-lg font-medium text-slate-100">Fricciones Operativas (Atención Requerida)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* Contratos por Vencer */}
                <Link href="/dashboard/contratos?filter=expiring" className="block outline-none hover:ring-2 hover:ring-slate-400 rounded-xl transition-all">
                    <Card className="bg-slate-900 border-slate-800 h-full flex flex-col justify-between hover:bg-slate-800/80 transition-colors">
                        <CardHeader className="pb-2 flex flex-row items-center justify-between">
                            <CardTitle className="text-slate-300 text-sm font-medium">Contratos por Vencer</CardTitle>
                            <Clock className="h-4 w-4 text-amber-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-baseline space-x-2">
                                <span className="text-3xl font-bold text-amber-500">{contracts_expiring}</span>
                                <span className="text-xs text-slate-400">en próximos 30 días</span>
                            </div>
                            <CardDescription className="mt-2 text-xs text-slate-500">
                                Renovación requerida para mantener deducibilidad.
                            </CardDescription>
                        </CardContent>
                    </Card>
                </Link>

                {/* Expedientes Pendientes */}
                <Link href="/dashboard/operaciones?status=PENDIENTE,EN_PROCESO" className="block outline-none hover:ring-2 hover:ring-slate-400 rounded-xl transition-all">
                    <Card className="bg-slate-900 border-slate-800 h-full flex flex-col justify-between hover:bg-slate-800/80 transition-colors">
                        <CardHeader className="pb-2 flex flex-row items-center justify-between">
                            <CardTitle className="text-slate-300 text-sm font-medium">Expedientes Incompletos</CardTitle>
                            <FileWarning className="h-4 w-4 text-orange-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-baseline space-x-2">
                                <span className="text-3xl font-bold text-orange-500">{pending_dossiers}</span>
                                <span className="text-xs text-slate-400">operaciones expuestas</span>
                            </div>
                            <CardDescription className="mt-2 text-xs text-slate-500">
                                Falta soporte documental (Art 5-A).
                            </CardDescription>
                        </CardContent>
                    </Card>
                </Link>

                {/* Proveedores Sin Validar */}
                <Link href="/dashboard/proveedores?validation=expired" className="block outline-none hover:ring-2 hover:ring-slate-400 rounded-xl transition-all">
                    <Card className="bg-slate-900 border-slate-800 h-full flex flex-col justify-between hover:bg-slate-800/80 transition-colors">
                        <CardHeader className="pb-2 flex flex-row items-center justify-between">
                            <CardTitle className="text-slate-300 text-sm font-medium">Proveedores sin Validar</CardTitle>
                            <AlertTriangle className="h-4 w-4 text-rose-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-baseline space-x-2">
                                <span className="text-3xl font-bold text-rose-500">{unvalidated_providers}</span>
                                <span className="text-xs text-slate-400">sin escaneo reciente</span>
                            </div>
                            <CardDescription className="mt-2 text-xs text-slate-500">
                                Verificación Listas Negras (Art 69-B) caducada.
                            </CardDescription>
                        </CardContent>
                    </Card>
                </Link>

            </div>
        </div>
    )
}
