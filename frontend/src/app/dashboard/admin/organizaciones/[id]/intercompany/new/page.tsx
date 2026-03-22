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
            <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(184,137,70,0.12),transparent_36%),linear-gradient(180deg,#f7f2e8_0%,#f3efe6_24%,#f8f6f1_100%)]">
                <div className="text-[var(--fiscal-muted)]">Cargando...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(184,137,70,0.12),transparent_36%),linear-gradient(180deg,#f7f2e8_0%,#f3efe6_24%,#f8f6f1_100%)] p-6 sm:p-8">
            <div className="max-w-3xl mx-auto">
                <div className="mb-4">
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-2 rounded-full border border-[rgba(25,36,52,0.12)] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_14px_34px_rgba(15,23,42,0.08)] transition hover:border-[rgba(184,137,70,0.28)] hover:text-[var(--fiscal-ink)]"
                        title="Inicio – Inteligencia Fiscal"
                    >
                        <Home className="h-4 w-4" />
                        Inicio
                    </Link>
                </div>

                <button
                    onClick={() => router.back()}
                    className="mb-6 flex items-center gap-2 text-sm text-[var(--fiscal-muted)] transition-colors hover:text-[var(--fiscal-accent)]"
                >
                    <ArrowLeft className="w-5 h-5" />
                    Volver
                </button>

                <div className="surface-panel-strong rounded-[32px] p-8 shadow-fiscal">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="rounded-xl bg-[rgba(184,137,70,0.12)] p-3 text-[var(--fiscal-gold)]">
                            <ArrowRightLeft className="w-8 h-8" />
                        </div>
                        <div>
                            <p className="kicker-label">Operación intragrupo</p>
                            <h1 className="font-display text-3xl font-semibold text-[var(--fiscal-ink)]">
                                Nueva Transacción Intercompañía
                            </h1>
                            <p className="text-[var(--fiscal-muted)]">
                                Registra un préstamo, pago o movimiento entre empresas del grupo
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-6 flex items-center gap-2 rounded-2xl bg-[var(--fiscal-danger-soft)] p-4 text-[var(--fiscal-danger)]">
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
                                <label className="text-sm font-medium text-[var(--fiscal-muted)]">
                                    Empresa Origen (Emisor) *
                                </label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <select
                                        required
                                        value={formData.source_tenant_id}
                                        onChange={(e) => setFormData({ ...formData, source_tenant_id: e.target.value })}
                                        className="w-full appearance-none rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white py-3 pl-10 pr-4 text-[var(--fiscal-ink)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]"
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
                                <label className="text-sm font-medium text-[var(--fiscal-muted)]">
                                    Empresa Destino (Receptor) *
                                </label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <select
                                        required
                                        value={formData.destination_tenant_id}
                                        onChange={(e) => setFormData({ ...formData, destination_tenant_id: e.target.value })}
                                        className="w-full appearance-none rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white py-3 pl-10 pr-4 text-[var(--fiscal-ink)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]"
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
                                <label className="text-sm font-medium text-[var(--fiscal-muted)]">
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
                                        className="w-full rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white py-3 pl-10 pr-4 text-[var(--fiscal-ink)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-[var(--fiscal-muted)]">
                                    Fecha *
                                </label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="date"
                                        required
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        className="w-full rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white py-3 pl-10 pr-4 text-[var(--fiscal-ink)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--fiscal-muted)]">
                                Concepto / Descripción *
                            </label>
                            <div className="relative">
                                <FileText className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                                <textarea
                                    required
                                    rows={3}
                                    value={formData.concept}
                                    onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
                                    className="w-full rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white py-3 pl-10 pr-4 text-[var(--fiscal-ink)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]"
                                    placeholder="Descripción detallada de la operación (ej. Préstamo para capital de trabajo, Pago de servicios administrativos...)"
                                />
                            </div>
                        </div>

                        <div className="pt-6 flex gap-4">
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="flex-1 rounded-full border border-[rgba(25,36,52,0.12)] bg-white px-6 py-3 font-semibold text-[var(--fiscal-ink)] transition-colors hover:border-[rgba(184,137,70,0.28)]"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="button-institutional flex flex-1 justify-center rounded-full px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
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
