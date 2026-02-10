'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Building2, DollarSign, Calendar, FileText, ArrowRightLeft, Home } from 'lucide-react';
import Link from 'next/link';
import { loadSession } from '../../../../../../../lib/token-storage';

interface Tenant {
    id: number;
    name: string;
    slug: string;
}

export default function NewIntercompanyTransactionPage() {
    const params = useParams();
    const router = useRouter();
    const despachoId = params.id as string;

    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        source_tenant_id: '',
        destination_tenant_id: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        concept: '',
        notes: ''
    });

    const fetchTenants = useCallback(async () => {
        try {
            const session = loadSession();
            const token = session?.accessToken;
            if (!token) throw new Error("No auth token");

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/tenancy/admin/despachos/${despachoId}/tenants/`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) throw new Error('Error al cargar empresas del grupo');

            const data = await response.json();
            setTenants(data);
        } catch (error) {
            console.error('Error:', error);
            setError('Error al cargar las empresas del grupo corporativo');
        } finally {
            setLoading(false);
        }
    }, [despachoId]);

    useEffect(() => {
        if (despachoId) {
            void fetchTenants();
        }
    }, [despachoId, fetchTenants]);

    const getAuthToken = () => {
        const session = loadSession();
        return session?.accessToken;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.source_tenant_id === formData.destination_tenant_id) {
            setError('La empresa de origen y destino no pueden ser la misma');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            const token = getAuthToken();
            if (!token) throw new Error("Sesión expirada");

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/tenancy/admin/despachos/${despachoId}/intercompany/`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(formData),
                }
            );

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Error al registrar la transacción');
            }

            // Éxito
            router.push(`/dashboard/admin/organizaciones/${despachoId}`);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
                <div className="text-gray-600 dark:text-gray-400">Cargando...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 p-8">
            <div className="max-w-3xl mx-auto">
                {/* Home button */}
                <div className="mb-4">
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-400 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-200/50 transition hover:-translate-y-0.5 hover:shadow-xl"
                        title="Inicio – Inteligencia Fiscal"
                    >
                        <Home className="h-4 w-4" />
                        Inicio
                    </Link>
                </div>

                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                    Volver
                </button>

                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-xl text-purple-600 dark:text-purple-300">
                            <ArrowRightLeft className="w-8 h-8" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                Nueva Transacción Intercompañía
                            </h1>
                            <p className="text-gray-500 dark:text-gray-400">
                                Registra un préstamo, pago o movimiento entre empresas del grupo
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg flex items-center gap-2">
                            <span className="font-bold">Error:</span> {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-8">

                        {/* Empresas */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                            {/* Connector Line (Desktop) */}
                            <div className="hidden md:block absolute top-10 left-1/2 -translate-x-1/2 z-0">
                                <ArrowRightLeft className="w-6 h-6 text-gray-300 dark:text-gray-600" />
                            </div>

                            <div className="space-y-2 relative z-10">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Empresa Origen (Emisor) *
                                </label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <select
                                        required
                                        value={formData.source_tenant_id}
                                        onChange={(e) => setFormData({ ...formData, source_tenant_id: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white appearance-none"
                                    >
                                        <option value="">Seleccionar empresa...</option>
                                        {tenants.map(tenant => (
                                            <option key={tenant.id} value={tenant.id} disabled={formData.destination_tenant_id === String(tenant.id)}>
                                                {tenant.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2 relative z-10">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Empresa Destino (Receptor) *
                                </label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <select
                                        required
                                        value={formData.destination_tenant_id}
                                        onChange={(e) => setFormData({ ...formData, destination_tenant_id: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white appearance-none"
                                    >
                                        <option value="">Seleccionar empresa...</option>
                                        {tenants.map(tenant => (
                                            <option key={tenant.id} value={tenant.id} disabled={formData.source_tenant_id === String(tenant.id)}>
                                                {tenant.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Detalles */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Monto de la Operación *
                                </label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="number"
                                        required
                                        step="0.01"
                                        min="0"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Fecha *
                                </label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="date"
                                        required
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Concepto / Descripción *
                            </label>
                            <div className="relative">
                                <FileText className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                                <textarea
                                    required
                                    rows={3}
                                    value={formData.concept}
                                    onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                                    placeholder="Descripción detallada de la operación (ej. Préstamo para capital de trabajo, Pago de servicios administrativos...)"
                                />
                            </div>
                        </div>

                        <div className="pt-6 flex gap-4">
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-semibold"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex justify-center"
                            >
                                {submitting ? 'Registrando...' : 'Registrar Transacción'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
