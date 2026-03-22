'use client';

import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Building2, Mail, Lock, Globe, Database, Home } from 'lucide-react';
import Link from 'next/link';
import { loadSession } from '../../../../../../../lib/token-storage';

export default function NewTenantPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const despachoId = params.id as string;
    const tipo = searchParams.get('tipo') || 'despacho';
    const entityLabel = tipo === 'corporativo' ? 'Empresa del Grupo' : 'Cliente del Despacho';
    const nameLabel = tipo === 'corporativo' ? 'Nombre de la Empresa' : 'Nombre del Cliente';

    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        db_name: '', // Opcional, puede generarse
        admin_email: '',
        admin_password: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const generateSlug = (name: string) => {
        return name
            .toLowerCase()
            .normalize('NFD') // Quita acentos
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-') // Reemplaza no alfanuméricos con guiones
            .replace(/^-+|-+$/g, ''); // Quita guiones al inicio/fin
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const name = e.target.value;
        setFormData(prev => ({
            ...prev,
            name,
            slug: generateSlug(name) // Auto-generar slug
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const session = loadSession();
            const token = session?.accessToken;

            if (!token) {
                throw new Error("Sesión expirada. Por favor recarga.");
            }

            // Nota: Asumimos que el endpoint para crear tenants en este despacho existe.
            // Si no, habrá que crearlo en el backend.
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/tenancy/admin/despachos/${despachoId}/create_tenant/`,
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
                throw new Error(data.detail || 'Error al crear tenant');
            }

            const result = await response.json();
            setSuccessMsg(`✅ ${result.detail || 'Tenant aprovisionado'} — ${result.name} (${result.slug})`);

            // Redirigir después de mostrar el mensaje
            setTimeout(() => {
                router.push(`/dashboard/admin/organizaciones/${despachoId}`);
            }, 2000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(184,137,70,0.12),transparent_36%),linear-gradient(180deg,#f7f2e8_0%,#f3efe6_24%,#f8f6f1_100%)] p-6 sm:p-8">
            <div className="max-w-2xl mx-auto">
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
                        <div className="rounded-xl bg-[rgba(45,91,136,0.12)] p-3 text-[var(--fiscal-accent)]">
                            <Building2 className="w-8 h-8" />
                        </div>
                        <div>
                            <p className="kicker-label">Alta controlada</p>
                            <h1 className="font-display text-3xl font-semibold text-[var(--fiscal-ink)]">
                                {`Nuevo ${entityLabel}`}
                            </h1>
                            <p className="text-[var(--fiscal-muted)]">
                                {tipo === 'corporativo'
                                    ? 'Registra una nueva empresa para este grupo corporativo'
                                    : 'Registra un nuevo cliente para este despacho'}
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-6 flex items-center gap-2 rounded-2xl bg-[var(--fiscal-danger-soft)] p-4 text-[var(--fiscal-danger)]">
                            <span className="font-bold">Error:</span> {error}
                        </div>
                    )}

                    {successMsg && (
                        <div className="mb-6 rounded-2xl bg-[var(--fiscal-success-soft)] p-4 font-medium text-[var(--fiscal-success)]">
                            {successMsg}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Nombre y Slug */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-[var(--fiscal-muted)]">
                                    {`${nameLabel} *`}
                                </label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={handleNameChange}
                                        className="w-full rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white py-3 pl-10 pr-4 text-[var(--fiscal-ink)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]"
                                        placeholder="Ej: Contoso Ltd."
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-[var(--fiscal-muted)]">
                                    Identificador (Slug) *
                                </label>
                                <div className="relative">
                                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="text"
                                        required
                                        value={formData.slug}
                                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                                        className="w-full rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white py-3 pl-10 pr-4 text-[var(--fiscal-ink)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]"
                                        placeholder="ej: contoso"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Admin Usuario */}
                        <div className="space-y-4 border-t border-[rgba(25,36,52,0.08)] pt-4">
                            <h3 className="font-display text-xl font-semibold text-[var(--fiscal-ink)]">
                                Usuario Administrador Inicial
                            </h3>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-[var(--fiscal-muted)]">
                                    Correo Electrónico *
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="email"
                                        required
                                        value={formData.admin_email}
                                        onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                                        className="w-full rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white py-3 pl-10 pr-4 text-[var(--fiscal-ink)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]"
                                        placeholder="admin@empresa.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-[var(--fiscal-muted)]">
                                    Contraseña Temporal *
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="password"
                                        required
                                        value={formData.admin_password}
                                        onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })}
                                        className="w-full rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white py-3 pl-10 pr-4 text-[var(--fiscal-ink)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]"
                                        placeholder="••••••••"
                                    />
                                </div>
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
                                disabled={loading}
                                className="button-institutional flex flex-1 justify-center rounded-full px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {loading ? 'Aprovisionando...' : `Crear y Aprovisionar ${entityLabel}`}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
