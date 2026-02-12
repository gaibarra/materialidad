/**
 * Página de Administración de Organizaciones (Despachos y Corporativos)
 * Solo accesible para superusuarios
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Building2, Users, Search, Edit2, Trash2, Eye, AlertTriangle, Home } from 'lucide-react';
import Link from 'next/link';
import { loadSession } from '../../../../lib/token-storage';

interface Despacho {
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

export default function OrganizacionesPage() {
    const [despachos, setDespachos] = useState<Despacho[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTipo, setFilterTipo] = useState<'all' | 'despacho' | 'corporativo'>('all');
    const [showModal, setShowModal] = useState(false);
    const [editingDespacho, setEditingDespacho] = useState<Despacho | null>(null);
    const [authError, setAuthError] = useState(false);

    const fetchDespachos = useCallback(async () => {
        try {
            setLoading(true);
            setAuthError(false);

            // Usar loadSession porque el token está dentro de un objeto JSON
            const session = loadSession();
            const token = session?.accessToken;


            if (!token) {
                console.error('No hay token de sesión disponible');
                setAuthError(true);
                setLoading(false);
                return;
            }

            const params = new URLSearchParams();
            if (filterTipo !== 'all') params.append('tipo', filterTipo);

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/tenancy/admin/despachos/?${params}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (response.status === 401) {
                setAuthError(true);
                return;
            }

            if (!response.ok) throw new Error('Error al cargar organizaciones');

            const data = await response.json();

            if (Array.isArray(data)) {
                setDespachos(data);
            } else if (data.results && Array.isArray(data.results)) {
                setDespachos(data.results);
            } else {
                setDespachos([]);
                console.warn("Formato de respuesta inesperado:", data);
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    }, [filterTipo]);

    useEffect(() => {
        fetchDespachos();
    }, [fetchDespachos]);

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Estás seguro de eliminar esta organización?')) return;

        try {
            const session = loadSession();
            const token = session?.accessToken;

            if (!token) {
                alert("Sesión no válida. Por favor recarga.");
                return;
            }

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/tenancy/admin/despachos/${id}/`,
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) throw new Error('Error al eliminar');

            fetchDespachos();
        } catch (error) {
            console.error('Error:', error);
            alert('Error al eliminar la organización');
        }
    };

    const filteredDespachos = despachos.filter((d) =>
        d.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.contacto_email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const stats = {
        totalDespachos: despachos.filter(d => d.tipo === 'despacho').length,
        totalCorporativos: despachos.filter(d => d.tipo === 'corporativo').length,
        totalTenants: despachos.reduce((sum, d) => sum + d.total_tenants, 0),
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 p-8">
            <div className="max-w-7xl mx-auto">
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

                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">
                        Administración de Organizaciones
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Gestiona despachos contables y grupos corporativos
                    </p>
                </div>

                {/* Auth Error Message */}
                {authError && (
                    <div className="mb-8 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl p-8 shadow-xl">
                        <div className="flex items-start gap-6">
                            <div className="bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 p-4 rounded-xl">
                                <AlertTriangle className="w-8 h-8" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                                    🔄 Necesitas Actualizar Tu Sesión
                                </h2>
                                <p className="text-gray-700 dark:text-gray-300 mb-4">
                                    Tu token de autenticación fue generado con una versión anterior del sistema.
                                    Para acceder a esta sección, necesitas <strong>cerrar sesión y volver a iniciar</strong>
                                    para obtener un token actualizado.
                                </p>
                                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4">
                                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                                        ⚡ Solución Rápida (1 minuto):
                                    </h3>
                                    <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
                                        <li>Haz clic en <strong>&quot;Cerrar Sesión y Volver a Entrar&quot;</strong> abajo</li>
                                        <li>En la pantalla de login, ingresa tus credenciales</li>
                                        <li>Deja el campo &quot;Código de empresa&quot; <strong>vacío</strong></li>
                                        <li>El sistema te dará un token actualizado</li>
                                        <li>Regresa a esta página - funcionará perfectamente</li>
                                    </ol>
                                </div>
                                <div className="flex gap-4">
                                    <button
                                        onClick={handleLogout}
                                        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl font-semibold flex items-center gap-2"
                                    >
                                        🔄 Cerrar Sesión y Volver a Entrar
                                    </button>
                                    <button
                                        onClick={() => window.history.back()}
                                        className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all font-semibold"
                                    >
                                        ← Volver al Dashboard
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <StatCard
                        title="Despachos"
                        value={stats.totalDespachos}
                        icon={<Building2 className="w-8 h-8" />}
                        color="blue"
                    />
                    <StatCard
                        title="Corporativos"
                        value={stats.totalCorporativos}
                        icon={<Building2 className="w-8 h-8" />}
                        color="purple"
                    />
                    <StatCard
                        title="Clientes / Empresas"
                        value={stats.totalTenants}
                        icon={<Users className="w-8 h-8" />}
                        color="green"
                    />
                </div>

                {/* Filters and Actions */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                        <div className="flex-1 relative w-full md:max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Buscar organizaciones..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            />
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <select
                                value={filterTipo}
                                onChange={(e) => setFilterTipo(e.target.value as any)}
                                className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            >
                                <option value="all">Todos</option>
                                <option value="despacho">Despachos</option>
                                <option value="corporativo">Corporativos</option>
                            </select>

                            <button
                                onClick={() => {
                                    setEditingDespacho(null);
                                    setShowModal(true);
                                }}
                                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl"
                            >
                                <Plus className="w-5 h-5" />
                                Nueva Organización
                            </button>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-x-auto">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        Organización
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        Tipo
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        Contacto
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        Clientes / Empresas
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                            Cargando...
                                        </td>
                                    </tr>
                                ) : filteredDespachos.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                            No se encontraron organizaciones
                                        </td>
                                    </tr>
                                ) : (
                                    filteredDespachos.map((despacho) => (
                                        <tr
                                            key={despacho.id}
                                            className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${despacho.tipo === 'despacho'
                                                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
                                                        : 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300'
                                                        }`}>
                                                        <Building2 className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-gray-900 dark:text-white">
                                                            {despacho.nombre}
                                                        </div>
                                                        {despacho.notas && (
                                                            <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                                                                {despacho.notas}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${despacho.tipo === 'despacho'
                                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                                    : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                                                    }`}>
                                                    {despacho.tipo === 'despacho' ? 'Despacho' : 'Corporativo'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-gray-900 dark:text-white">
                                                    {despacho.contacto_email}
                                                </div>
                                                {despacho.contacto_telefono && (
                                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                                        {despacho.contacto_telefono}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Users className="w-4 h-4 text-gray-400" />
                                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                        {despacho.total_tenants}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => {
                                                            window.location.href = `/dashboard/admin/organizaciones/${despacho.id}`;
                                                        }}
                                                        className="min-h-[44px] min-w-[44px] p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 rounded-lg transition-colors"
                                                        title="Ver detalles"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setEditingDespacho(despacho);
                                                            setShowModal(true);
                                                        }}
                                                        className="min-h-[44px] min-w-[44px] p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(despacho.id)}
                                                        className="min-h-[44px] min-w-[44px] p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Modal */}
                {showModal && (
                    <DespachoModal
                        despacho={editingDespacho}
                        onClose={() => {
                            setShowModal(false);
                            setEditingDespacho(null);
                        }}
                        onSuccess={() => {
                            setShowModal(false);
                            setEditingDespacho(null);
                            fetchDespachos();
                        }}
                    />
                )}
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, color }: any) {
    const colorClasses = {
        blue: 'from-blue-500 to-blue-600',
        purple: 'from-purple-500 to-purple-600',
        green: 'from-green-500 to-green-600',
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">{title}</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
                </div>
                <div className={`bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} text-white p-4 rounded-xl`}>
                    {icon}
                </div>
            </div>
        </div>
    );
}

function DespachoModal({ despacho, onClose, onSuccess }: any) {
    const [formData, setFormData] = useState({
        nombre: despacho?.nombre || '',
        tipo: despacho?.tipo || 'despacho',
        contacto_email: despacho?.contacto_email || '',
        contacto_telefono: despacho?.contacto_telefono || '',
        notas: despacho?.notas || '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const session = loadSession();
            const token = session?.accessToken;

            if (!token) {
                setError("Sesión no válida o expirada");
                setLoading(false);
                return;
            }
            const url = despacho
                ? `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/tenancy/admin/despachos/${despacho.id}/`
                : `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/tenancy/admin/despachos/`;

            const response = await fetch(url, {
                method: despacho ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Error al guardar');
            }

            onSuccess();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                        {despacho ? 'Editar Organización' : 'Nueva Organización'}
                    </h2>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                            <p className="text-red-800 dark:text-red-200">{error}</p>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Nombre *
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.nombre}
                            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            placeholder="Nombre del despacho o corporativo"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Tipo *
                        </label>
                        <select
                            required
                            value={formData.tipo}
                            onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        >
                            <option value="despacho">Despacho Contable</option>
                            <option value="corporativo">Grupo Corporativo</option>
                        </select>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            {formData.tipo === 'despacho'
                                ? 'Los despachos agrupan a sus clientes. Cada cliente tendrá su espacio independiente.'
                                : 'Los corporativos agrupan a las empresas del grupo y permiten gestionar transacciones intercompañía.'}
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Email de Contacto
                        </label>
                        <input
                            type="email"
                            value={formData.contacto_email}
                            onChange={(e) => setFormData({ ...formData, contacto_email: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            placeholder="contacto@ejemplo.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Teléfono de Contacto
                        </label>
                        <input
                            type="tel"
                            value={formData.contacto_telefono}
                            onChange={(e) => setFormData({ ...formData, contacto_telefono: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            placeholder="+52 55 1234 5678"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Notas
                        </label>
                        <textarea
                            value={formData.notas}
                            onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                            rows={4}
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            placeholder="Notas adicionales..."
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Guardando...' : despacho ? 'Actualizar' : 'Crear'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
