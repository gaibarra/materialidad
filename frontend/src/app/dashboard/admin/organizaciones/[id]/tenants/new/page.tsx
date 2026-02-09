'use client';

import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Building2, Mail, Lock, Globe, Database } from 'lucide-react';
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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 p-8">
            <div className="max-w-2xl mx-auto">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                    Volver
                </button>

                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-xl text-blue-600 dark:text-blue-300">
                            <Building2 className="w-8 h-8" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                {`Nuevo ${entityLabel}`}
                            </h1>
                            <p className="text-gray-500 dark:text-gray-400">
                                {tipo === 'corporativo'
                                    ? 'Registra una nueva empresa para este grupo corporativo'
                                    : 'Registra un nuevo cliente para este despacho'}
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg flex items-center gap-2">
                            <span className="font-bold">Error:</span> {error}
                        </div>
                    )}

                    {successMsg && (
                        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg font-medium">
                            {successMsg}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Nombre y Slug */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {`${nameLabel} *`}
                                </label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={handleNameChange}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                        placeholder="Ej: Contoso Ltd."
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Identificador (Slug) *
                                </label>
                                <div className="relative">
                                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="text"
                                        required
                                        value={formData.slug}
                                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                        placeholder="ej: contoso"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Admin Usuario */}
                        <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Usuario Administrador Inicial
                            </h3>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Correo Electrónico *
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="email"
                                        required
                                        value={formData.admin_email}
                                        onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                        placeholder="admin@empresa.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Contraseña Temporal *
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="password"
                                        required
                                        value={formData.admin_password}
                                        onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                        placeholder="••••••••"
                                    />
                                </div>
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
                                disabled={loading}
                                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex justify-center"
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
