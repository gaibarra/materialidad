"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, Info, Plus, ShieldAlert } from "lucide-react";
import { useAuthContext } from "../../../context/AuthContext";
import {
    AlertaCSD,
    AlertaCSDPayload,
    getAlertasCSD,
    createAlertaCSD,
    updateAlertaCSD,
} from "../../../lib/alerta-csd";
import { Proveedor, fetchProviders, fetchEmpresas, EmpresaLite } from "../../../lib/providers";

// Componentes UI standard (usando Tailwind)
function classNames(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(" ");
}

export default function AlertaCSDPage() {
    const { user } = useAuthContext();
    const [alertas, setAlertas] = useState<AlertaCSD[]>([]);
    const [proveedores, setProveedores] = useState<Proveedor[]>([]);
    const [empresas, setEmpresas] = useState<EmpresaLite[]>([]);
    const [selectedEmpresa, setSelectedEmpresa] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    // Estado para el modal/formulario lateral
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    // Form State
    const [formData, setFormData] = useState<AlertaCSDPayload>({
        empresa: 0,
        tipo_alerta: "PROPIETARIO",
        estatus: "ACTIVA",
        fecha_deteccion: new Date().toISOString().split("T")[0],
        proveedor: null,
        oficio_sat: "",
        motivo_presuncion: "",
        acciones_tomadas: "",
    });

    const fetchData = async (empresaId: number) => {
        setLoading(true);
        try {
            const [alertasData, proveedoresData] = await Promise.all([
                getAlertasCSD(empresaId),
                fetchProviders()
            ]);
            setAlertas(alertasData as AlertaCSD[]);
            // @ts-ignore
            setProveedores(proveedoresData.results ? proveedoresData.results : proveedoresData);
        } catch (e) {
            console.error("Error cargando Alertas CSD", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const init = async () => {
            try {
                const emps = await fetchEmpresas();
                setEmpresas(emps);
                if (emps.length > 0) {
                    setSelectedEmpresa(emps[0].id);
                } else {
                    setLoading(false);
                }
            } catch (e) {
                console.error(e);
                setLoading(false);
            }
        };
        init();
    }, []);

    useEffect(() => {
        if (selectedEmpresa) {
            fetchData(selectedEmpresa);
            setFormData((prev: AlertaCSDPayload) => ({ ...prev, empresa: selectedEmpresa }));
        }
    }, [selectedEmpresa]);

    const hasActiveAlerts = alertas.some(a => a.estatus === "ACTIVA");

    const handleOpenNew = () => {
        setEditingId(null);
        setFormData({
            empresa: selectedEmpresa || 0,
            tipo_alerta: "PROPIETARIO",
            estatus: "ACTIVA",
            fecha_deteccion: new Date().toISOString().split("T")[0],
            proveedor: null,
            oficio_sat: "",
            motivo_presuncion: "",
            acciones_tomadas: "",
        });
        setShowForm(true);
    };

    const handleOpenEdit = (alerta: AlertaCSD) => {
        setEditingId(alerta.id);
        setFormData({
            empresa: alerta.empresa,
            tipo_alerta: alerta.tipo_alerta,
            estatus: alerta.estatus,
            fecha_deteccion: alerta.fecha_deteccion,
            fecha_resolucion: alerta.fecha_resolucion || "",
            proveedor: alerta.proveedor,
            oficio_sat: alerta.oficio_sat || "",
            motivo_presuncion: alerta.motivo_presuncion || "",
            acciones_tomadas: alerta.acciones_tomadas || "",
        });
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmpresa) return;

        try {
            const payload = { ...formData };
            if (payload.tipo_alerta === "PROPIETARIO") payload.proveedor = null;
            if (!payload.fecha_resolucion) delete payload.fecha_resolucion;

            if (editingId) {
                await updateAlertaCSD(editingId, payload);
            } else {
                await createAlertaCSD(payload);
            }
            setShowForm(false);
            fetchData(selectedEmpresa);
        } catch (error) {
            console.error("Error guardando alerta", error);
            alert("Error al guardar la contingencia.");
        }
    };

    if (loading) {
        return <div className="p-8 animate-pulse bg-gray-50 h-full rounded-md" />;
    }

    return (
        <div className="flex flex-col h-full bg-gray-50/50 p-6 overflow-auto">
            {/* Banner de Emergencia */}
            {hasActiveAlerts && (
                <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-md shadow-sm animate-pulse">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <ShieldAlert className="h-6 w-6 text-red-500" aria-hidden="true" />
                        </div>
                        <div className="ml-3">
                            <h3 className="text-lg font-medium text-red-800">
                                ¡Alerta Crítica! CSD en Riesgo o Suspendido
                            </h3>
                            <div className="mt-2 text-sm text-red-700">
                                <p>
                                    Tienes alertas de estado &quot;ACTIVA&quot;. Acorde a las reformas del Art. 17-H Bis del CFF,
                                    el plazo para ingresar un caso de aclaración y recuperar el sello es inmediato para detener
                                    el cese de facturación.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        Contingencias CSD <ShieldAlert className="h-5 w-5 text-gray-400" />
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Gestión y seguimiento de bloqueos de Sellos Digitales (Art. 17-H Bis).
                    </p>
                </div>
                <button
                    onClick={handleOpenNew}
                    className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                >
                    <Plus className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
                    Registrar Contingencia
                </button>
            </div>

            <div className="flex flex-1 gap-6">
                {/* Main content - Listado */}
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 p-6 overflow-hidden flex flex-col">
                    <h2 className="text-md font-semibold text-gray-900 mb-4">Bitácora de Sucesos</h2>

                    {alertas.length === 0 ? (
                        <div className="text-center py-12 flex-1 flex flex-col items-center justify-center">
                            <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
                            <h3 className="mt-2 text-sm font-semibold text-gray-900">Operación Libre de Riesgo</h3>
                            <p className="mt-1 text-sm text-gray-500">No hay contingencias CSD registradas en esta Empresa.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-300">
                                <thead>
                                    <tr>
                                        <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">Tipo</th>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Materia</th>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Oficio SAT</th>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Estado</th>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Fecha</th>
                                        <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {alertas.map((alerta) => (
                                        <tr key={alerta.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                                                {alerta.tipo_alerta === "PROPIETARIO" ? "Títular (Propio)" : "Proveedor"}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                {alerta.tipo_alerta === "PROPIETARIO" ? alerta.empresa_nombre : alerta.proveedor_nombre}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 font-mono text-xs">
                                                {alerta.oficio_sat || "Sin especificar"}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                                                <span className={classNames(
                                                    "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
                                                    alerta.estatus === "ACTIVA" ? "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20" :
                                                        alerta.estatus === "ACLARACION" ? "bg-yellow-50 text-yellow-800 ring-1 ring-inset ring-yellow-600/20" :
                                                            alerta.estatus === "RESUELTA" ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20" :
                                                                "bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-500/10"
                                                )}>
                                                    {alerta.estatus}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                {alerta.fecha_deteccion}
                                            </td>
                                            <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium">
                                                <button
                                                    onClick={() => handleOpenEdit(alerta)}
                                                    className="text-indigo-600 hover:text-indigo-900 font-semibold"
                                                >
                                                    Actualizar<span className="sr-only">, {alerta.id}</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Panel Lateral: Formulario CSD (condicional) */}
                {showForm && (
                    <div className="w-[400px] bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col animate-in slide-in-from-right fade-in duration-200">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-base font-semibold leading-6 text-gray-900">
                                {editingId ? "Actualizar Contingencia" : "Nueva Contingencia"}
                            </h3>
                            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-500 text-lg">&times;</button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">

                            <div>
                                <label className="block text-sm font-medium leading-6 text-gray-900">Tipo de Restricción</label>
                                <select
                                    value={formData.tipo_alerta}
                                    onChange={(e) => setFormData({ ...formData, tipo_alerta: e.target.value as any })}
                                    className="mt-2 block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                >
                                    <option value="PROPIETARIO">CSD Propio (Empresa Alta)</option>
                                    <option value="PROVEEDOR">CSD de Proveedor Clave</option>
                                </select>
                            </div>

                            {formData.tipo_alerta === "PROVEEDOR" && (
                                <div>
                                    <label className="block text-sm font-medium leading-6 text-gray-900">Proveedor Afectado</label>
                                    <select
                                        required={formData.tipo_alerta === "PROVEEDOR"}
                                        value={formData.proveedor || ""}
                                        onChange={(e) => setFormData({ ...formData, proveedor: Number(e.target.value) })}
                                        className="mt-2 block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                    >
                                        <option value="">Seleccione un proveedor...</option>
                                        {proveedores.map(p => (
                                            <option key={p.id} value={p.id}>{p.razon_social} ({p.rfc})</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium leading-6 text-gray-900">Fecha Detección</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.fecha_deteccion}
                                        onChange={(e) => setFormData({ ...formData, fecha_deteccion: e.target.value })}
                                        className="mt-2 block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium leading-6 text-gray-900">Resolución</label>
                                    <input
                                        type="date"
                                        value={formData.fecha_resolucion || ""}
                                        onChange={(e) => setFormData({ ...formData, fecha_resolucion: e.target.value })}
                                        className="mt-2 block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium leading-6 text-gray-900">Estatus Legal</label>
                                <select
                                    value={formData.estatus}
                                    onChange={(e) => setFormData({ ...formData, estatus: e.target.value as any })}
                                    className="mt-2 block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6 font-medium"
                                >
                                    <option value="ACTIVA">🔴 ACTIVA (Bloqueo Total)</option>
                                    <option value="ACLARACION">🟡 ACLARACION (En Buzón)</option>
                                    <option value="RESUELTA">🟢 RESUELTA (CSD Reactivado)</option>
                                    <option value="REVOCADO">⚫ REVOCADO (Cancelación)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium leading-6 text-gray-900">Número de Oficio (SAT)</label>
                                <input
                                    type="text"
                                    placeholder="Ej. 500-05-2026-10293"
                                    value={formData.oficio_sat || ""}
                                    onChange={(e) => setFormData({ ...formData, oficio_sat: e.target.value })}
                                    className="mt-2 block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6 font-mono text-xs"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium leading-6 text-gray-900">Motivo de Presunción</label>
                                <textarea
                                    rows={2}
                                    placeholder="Se detectó omisión en el domicilio fiscal..."
                                    value={formData.motivo_presuncion || ""}
                                    onChange={(e) => setFormData({ ...formData, motivo_presuncion: e.target.value })}
                                    className="mt-2 block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium leading-6 text-gray-900">Bitácora de Acciones</label>
                                <textarea
                                    rows={4}
                                    placeholder="24-Feb: Presentación de Caso en Buzón.&#10;25-Feb: Ingreso de evidencias (Contratos, Fotografías EXIF)..."
                                    value={formData.acciones_tomadas || ""}
                                    onChange={(e) => setFormData({ ...formData, acciones_tomadas: e.target.value })}
                                    className="mt-2 block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                />
                            </div>

                            <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                                >
                                    {editingId ? "Guardar Cambios" : "Crear Registro"}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>

            {/* Guía 17-H Bis (Visual Aid Component) */}
            <div className="mt-6 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 uppercase tracking-wide">
                    <Info className="w-5 h-5 text-indigo-500" />
                    Guía de Acción Rápida: Art. 17-H Bis (Reforma 2026)
                </h3>
                <p className="text-sm text-gray-600 mt-2">
                    La restricción temporal del Certificado de Sello Digital paraliza la facturación. Siga estos pasos de inmediato:
                </p>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold mb-3">1</span>
                        <h4 className="font-semibold text-gray-900 text-sm">Presentar Aclaración Inicial</h4>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-3">
                            Ingresar vía Buzón Tributario la Solicitud de Aclaración. Por ley, el SAT <b>debe reactivar el sello temporalmente</b> al día hábil siguiente mientras valora la defensa.
                        </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold mb-3">2</span>
                        <h4 className="font-semibold text-gray-900 text-sm">Aportar Materialidad (10 días)</h4>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-3">
                            Cuentas con 10 días hábiles para adjuntar Contratos, Entregables (Dossier con metadata EXIF de fotos), bitácoras cruzadas y transferencias validadas de tu panel.
                        </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold mb-3">3</span>
                        <h4 className="font-semibold text-gray-900 text-sm">Atender Requerimientos</h4>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-3">
                            Monitorea tu estatus. El SAT tiene derecho a efectuar requerimientos adicionales que otorgan 10 días extras. Usa esta herramienta para anotar cada avance.
                        </p>
                    </div>
                </div>
            </div>

        </div>
    );
}
