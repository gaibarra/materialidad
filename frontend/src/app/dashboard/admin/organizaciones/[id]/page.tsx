/**
 * Página de detalle de una organización (Despacho o Corporativo)
 * Muestra tenants y transacciones intercompañía (solo para corporativos)
 */
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Building2,
    Users,
    TrendingUp,
    AlertCircle,
    Plus,
    ExternalLink,
    DollarSign,
    Calendar,
    FileText,
} from 'lucide-react';

interface Tenant {
    id: number;
    name: string;
    slug: string;
    db_name: string;
    is_active: boolean;
    created_at: string;
}

interface DespachoDetail {
    id: number;
    nombre: string;
    tipo: 'despacho' | 'corporativo';
    contacto_email: string;
    contacto_telefono: string;
    notas: string;
    is_active: boolean;
    total_tenants: number;
    created_at: string;
    updated_at: string;
}

interface DespachoStats {
    total_tenants: number;
    active_tenants: number;
    inactive_tenants: number;
    tipo: string;
    created_at: string;
}

import { loadSession } from "../../../../../lib/token-storage";

export default function OrganizacionDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [despacho, setDespacho] = useState<DespachoDetail | null>(null);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [stats, setStats] = useState<DespachoStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'tenants' | 'intercompany'>('tenants');

    useEffect(() => {
        if (id) {
            void fetchDespachoDetail();
            void fetchTenants();
            void fetchStats();
        }
    }, [id]);

    const getAuthToken = () => {
        const session = loadSession();
        return session?.accessToken;
    };

    const fetchDespachoDetail = async () => {
        try {
            const token = getAuthToken();
            if (!token) throw new Error("No auth token");

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/tenancy/admin/despachos/${id}/`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) throw new Error('Error al cargar detalles');

            const data = await response.json();
            setDespacho(data);
        } catch (error) {
            console.error('Error:', error);
            router.push('/login'); // Redirect on auth fail
        }
    };

    const fetchTenants = async () => {
        try {
            const token = getAuthToken();
            if (!token) return;

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/tenancy/admin/despachos/${id}/tenants/`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) throw new Error('Error al cargar tenants');

            const data = await response.json();
            setTenants(data);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const token = getAuthToken();
            if (!token) return;

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/tenancy/admin/despachos/${id}/stats/`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) throw new Error('Error al cargar estadísticas');

            const data = await response.json();
            setStats(data);
        } catch (error) {
            console.error('Error:', error);
        }
    };

    if (loading || !despacho) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
                <div className="text-gray-600 dark:text-gray-400">Cargando...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Volver
                    </button>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div
                                className={`w-16 h-16 rounded-2xl flex items-center justify-center ${despacho.tipo === 'despacho'
                                    ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                                    : 'bg-gradient-to-br from-purple-500 to-purple-600'
                                    } text-white shadow-lg`}
                            >
                                <Building2 className="w-8 h-8" />
                            </div>
                            <div>
                                <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                                    {despacho.nombre}
                                </h1>
                                <p className="text-gray-600 dark:text-gray-400 mt-1">
                                    {despacho.tipo === 'despacho' ? 'Despacho Contable' : 'Grupo Corporativo'}
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => router.push(`/dashboard/admin/organizaciones/${id}/edit`)}
                            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl"
                        >
                            Editar
                        </button>
                    </div>
                </div>

                {/* Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <InfoCard
                        title="Total Tenants"
                        value={stats?.total_tenants || 0}
                        subtitle="Activos"
                        icon={<Users className="w-6 h-6" />}
                        color="blue"
                    />
                    <InfoCard
                        title="Contacto"
                        value={despacho.contacto_email || 'No especificado'}
                        subtitle={despacho.contacto_telefono || ''}
                        icon={<Building2 className="w-6 h-6" />}
                        color="green"
                        valueClass="text-lg"
                    />
                    <InfoCard
                        title="Fecha de Creación"
                        value={new Date(despacho.created_at).toLocaleDateString('es-MX')}
                        subtitle=""
                        icon={<Calendar className="w-6 h-6" />}
                        color="purple"
                    />
                </div>

                {/* Tabs */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg mb-6">
                    <div className="border-b border-gray-200 dark:border-gray-700">
                        <div className="flex">
                            <button
                                onClick={() => setActiveTab('tenants')}
                                className={`px-6 py-4 font-medium transition-colors ${activeTab === 'tenants'
                                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                            >
                                Tenants ({tenants.length})
                            </button>
                            {despacho.tipo === 'corporativo' && (
                                <button
                                    onClick={() => setActiveTab('intercompany')}
                                    className={`px-6 py-4 font-medium transition-colors ${activeTab === 'intercompany'
                                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                        }`}
                                >
                                    Transacciones Intercompañía
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="p-6">
                        {activeTab === 'tenants' && (
                            <TenantsTab tenants={tenants} despachoId={id} />
                        )}
                        {activeTab === 'intercompany' && despacho.tipo === 'corporativo' && (
                            <IntercompanyTab despachoId={id} />
                        )}
                    </div>
                </div>

                {/* Notes */}
                {despacho.notas && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                            Notas
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                            {despacho.notas}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

function InfoCard({ title, value, subtitle, icon, color, valueClass = 'text-2xl' }: any) {
    const colorClasses = {
        blue: 'from-blue-500 to-blue-600',
        green: 'from-green-500 to-green-600',
        purple: 'from-purple-500 to-purple-600',
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-start justify-between mb-3">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
                <div
                    className={`bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]
                        } text-white p-2 rounded-lg`}
                >
                    {icon}
                </div>
            </div>
            <p className={`${valueClass} font-bold text-gray-900 dark:text-white mb-1`}>{value}</p>
            {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
    );
}

function TenantsTab({ tenants, despachoId }: { tenants: Tenant[]; despachoId: string }) {
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Tenants Asociados
                </h3>
                <button
                    onClick={() =>
                        (window.location.href = `/dashboard/admin/organizaciones/${despachoId}/tenants/new`)
                    }
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Nuevo Tenant
                </button>
            </div>

            {tenants.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <Building2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>No hay tenants asociados a esta organización</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tenants.map((tenant) => (
                        <div
                            key={tenant.id}
                            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                                        {tenant.name}
                                    </h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                        Slug: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{tenant.slug}</code>
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-500">
                                        Base de datos: {tenant.db_name}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                        Creado: {new Date(tenant.created_at).toLocaleDateString('es-MX')}
                                    </p>
                                </div>
                                <span
                                    className={`px-2 py-1 rounded-full text-xs font-medium ${tenant.is_active
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                        }`}
                                >
                                    {tenant.is_active ? 'Activo' : 'Inactivo'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function IntercompanyTab({ despachoId }: { despachoId: string }) {
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Transacciones Intercompañía
                </h3>
                <button
                    onClick={() =>
                        (window.location.href = `/dashboard/admin/organizaciones/${despachoId}/intercompany/new`)
                    }
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Nueva Transacción
                </button>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
                <div className="flex items-start gap-4">
                    <div className="bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 p-3 rounded-xl">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                            Monitor de Transacciones Intercompañía 2026
                        </h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                            Los préstamos y transacciones entre empresas del mismo grupo corporativo requieren{' '}
                            <strong>documentación rigurosa</strong> para evitar problemas fiscales:
                        </p>
                        <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
                            <li>Contratos con fecha cierta y razón de negocios clara</li>
                            <li>Tasas de interés a valor de mercado (arm&apos;s length)</li>
                            <li>Estudio de precios de transferencia cuando aplique</li>
                            <li>Justificación del beneficio al grupo corporativo</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Placeholder for transactions list - This would connect to the backend endpoint */}
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <DollarSign className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="mb-2">No hay transacciones intercompañía registradas</p>
                <p className="text-sm">
                    Las transacciones aparecerán aquí una vez que se creen desde el sistema de operaciones
                </p>
            </div>
        </div>
    );
}
