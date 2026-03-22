/**
 * Página de Administración de Organizaciones (Despachos y Corporativos)
 * Solo accesible para superusuarios
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Building2, Users, Search, Edit2, Trash2, Eye, AlertTriangle, Home } from 'lucide-react';
import Link from 'next/link';
import Swal from 'sweetalert2';
import { MobileDataList } from '../../../../components/MobileDataList';
import { loadSession } from '../../../../lib/token-storage';
import { useAuthContext } from '../../../../context/AuthContext';

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
    const { user } = useAuthContext();
    const [despachos, setDespachos] = useState<Despacho[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTipo, setFilterTipo] = useState<'all' | 'despacho' | 'corporativo'>('all');
    const [showModal, setShowModal] = useState(false);
    const [editingDespacho, setEditingDespacho] = useState<Despacho | null>(null);
    const [authError, setAuthError] = useState(false);
    const [liveFeedback, setLiveFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);

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
            setLiveFeedback({ tone: 'error', message: 'No se pudieron cargar las organizaciones.' });
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
        const confirm = await Swal.fire({
            title: '¿Eliminar esta organización?',
            text: 'Esta acción no se puede deshacer.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
        });
        if (!confirm.isConfirmed) return;

        try {
            setDeletingId(id);
            const session = loadSession();
            const token = session?.accessToken;

            if (!token) {
                await Swal.fire({ icon: 'error', title: 'Sesión no válida', text: 'Recarga la página e intenta de nuevo.', confirmButtonColor: '#2563eb' });
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

            if (!response.ok) {
                let msg = 'Error al eliminar la organización';
                try {
                    const data = await response.json();
                    if (data?.detail) msg = data.detail;
                } catch { /* ignore parse error */ }
                throw new Error(msg);
            }

            setLiveFeedback({ tone: 'success', message: 'Organización eliminada.' });
            await Swal.fire({ icon: 'success', title: 'Eliminada', text: 'La organización fue eliminada correctamente.', timer: 1500, showConfirmButton: false });
            fetchDespachos();
        } catch (error) {
            console.error('Error:', error);
            setLiveFeedback({ tone: 'error', message: `No se pudo eliminar la organización: ${(error as Error).message}` });
            await Swal.fire({ icon: 'error', title: 'No se pudo eliminar', text: (error as Error).message, confirmButtonColor: '#2563eb' });
        } finally {
            setDeletingId(null);
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
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(184,137,70,0.12),transparent_38%),linear-gradient(180deg,#f7f2e8_0%,#f3efe6_24%,#f8f6f1_100%)] p-6 sm:p-8">
            <div className="max-w-7xl mx-auto">
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

                <div className="surface-panel-strong mb-8 rounded-[32px] p-6 sm:p-8">
                    <p className="eyebrow-shell">Supervisión de organizaciones</p>
                    <h1 className="mt-3 font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[var(--fiscal-ink)]">
                        Administración de Organizaciones
                    </h1>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                        Gestiona despachos contables y grupos corporativos con una vista de capacidad, accesos y operación global.
                    </p>
                </div>

                {liveFeedback && (
                    <div
                        role={liveFeedback.tone === 'error' ? 'alert' : 'status'}
                        aria-live={liveFeedback.tone === 'error' ? 'assertive' : 'polite'}
                        className={`mb-6 rounded-[24px] border px-4 py-3 text-sm ${
                            liveFeedback.tone === 'success'
                                ? 'border-[rgba(31,122,90,0.18)] bg-[var(--fiscal-success-soft)] text-[var(--fiscal-success)]'
                                : liveFeedback.tone === 'error'
                                    ? 'border-[rgba(160,67,61,0.22)] bg-[var(--fiscal-danger-soft)] text-[var(--fiscal-danger)]'
                                    : 'border-[rgba(45,91,136,0.18)] bg-[var(--fiscal-accent-soft)] text-[var(--fiscal-accent)]'
                        }`}
                    >
                        {liveFeedback.message}
                    </div>
                )}

                {authError && (
                    <div className="mb-8 rounded-[28px] border border-red-200 bg-[linear-gradient(180deg,rgba(254,242,242,1),rgba(255,255,255,0.92))] p-8 shadow-[0_20px_50px_rgba(127,29,29,0.10)]">
                        <div className="flex items-start gap-6">
                            <div className="rounded-2xl bg-red-100 p-4 text-red-600">
                                <AlertTriangle className="w-8 h-8" />
                            </div>
                            <div className="flex-1">
                                <h2 className="mb-3 font-display text-2xl font-semibold tracking-tight text-[var(--fiscal-ink)]">
                                    Necesitas actualizar tu sesión
                                </h2>
                                <p className="mb-4 text-slate-700">
                                    Tu token de autenticación fue generado con una versión anterior del sistema.
                                    Para acceder a esta sección, necesitas <strong>cerrar sesión y volver a iniciar</strong>
                                    para obtener un token actualizado.
                                </p>
                                <div className="mb-4 rounded-2xl border border-[rgba(25,36,52,0.08)] bg-white p-4">
                                    <h3 className="mb-2 font-semibold text-[var(--fiscal-ink)]">
                                        Solución rápida
                                    </h3>
                                    <ol className="list-decimal list-inside space-y-2 text-slate-700">
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
                                        className="button-institutional"
                                    >
                                        Cerrar Sesión y Volver a Entrar
                                    </button>
                                    <button
                                        onClick={() => window.history.back()}
                                        className="rounded-full border border-[rgba(25,36,52,0.12)] bg-white px-6 py-3 font-semibold text-slate-700 transition hover:border-[rgba(184,137,70,0.28)] hover:text-[var(--fiscal-ink)]"
                                    >
                                        ← Volver al Dashboard
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

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

                <div className="surface-panel mb-6 rounded-[28px] border-[rgba(25,36,52,0.08)] p-6">
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                        <div className="flex-1 relative w-full md:max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Buscar organizaciones..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white py-3 pl-10 pr-4 text-slate-900 focus:border-[var(--fiscal-gold)] focus:outline-none"
                            />
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <select
                                value={filterTipo}
                                onChange={(e) => setFilterTipo(e.target.value as any)}
                                className="rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white px-4 py-3 text-slate-900 focus:border-[var(--fiscal-gold)] focus:outline-none"
                            >
                                <option value="all">Todos</option>
                                <option value="despacho">Despachos</option>
                                <option value="corporativo">Corporativos</option>
                            </select>

                            {user?.is_superuser && (
                                <button
                                    onClick={() => {
                                        setEditingDespacho(null);
                                        setShowModal(true);
                                    }}
                                    className="button-institutional"
                                >
                                    <Plus className="w-5 h-5" />
                                    Nueva Organización
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="surface-panel rounded-[28px] border-[rgba(25,36,52,0.08)] p-4 sm:p-5">
                    <MobileDataList
                        items={filteredDespachos}
                        getKey={(despacho) => despacho.id}
                        empty={(
                            <div className="rounded-2xl border border-dashed border-[rgba(25,36,52,0.12)] bg-[rgba(246,242,235,0.48)] px-5 py-10 text-center text-slate-500">
                                {loading ? 'Cargando...' : 'No se encontraron organizaciones'}
                            </div>
                        )}
                        renderItem={(despacho) => (
                            <article className="rounded-[1.4rem] border border-[rgba(25,36,52,0.08)] bg-white p-4 shadow-sm">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <div className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center ${despacho.tipo === 'despacho'
                                            ? 'bg-[rgba(184,137,70,0.12)] text-[var(--fiscal-gold)]'
                                            : 'bg-[rgba(25,36,52,0.08)] text-[var(--fiscal-ink)]'
                                            }`}>
                                            <Building2 className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate font-semibold text-[var(--fiscal-ink)]">{despacho.nombre}</p>
                                            <p className="mt-1 text-xs text-slate-500 truncate">{despacho.notas || 'Sin notas registradas'}</p>
                                        </div>
                                    </div>
                                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${despacho.tipo === 'despacho'
                                        ? 'bg-[rgba(184,137,70,0.12)] text-[var(--fiscal-ink)]'
                                        : 'bg-[rgba(25,36,52,0.08)] text-[var(--fiscal-ink)]'
                                        }`}>
                                        {despacho.tipo === 'despacho' ? 'Despacho' : 'Corporativo'}
                                    </span>
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-3">
                                    <div className="rounded-2xl bg-[rgba(246,242,235,0.52)] px-3 py-3">
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Contacto</p>
                                        <p className="mt-1 break-all text-sm text-[var(--fiscal-ink)]">{despacho.contacto_email || 'Sin correo'}</p>
                                        <p className="mt-1 text-xs text-slate-500">{despacho.contacto_telefono || 'Sin teléfono'}</p>
                                    </div>
                                    <div className="rounded-2xl bg-[rgba(246,242,235,0.52)] px-3 py-3">
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Clientes / Empresas</p>
                                        <div className="mt-2 flex items-center gap-2">
                                            <Users className="w-4 h-4 text-slate-400" />
                                            <span className="text-lg font-semibold text-[var(--fiscal-ink)]">{despacho.total_tenants}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 flex items-center justify-end gap-2">
                                    <button
                                        onClick={() => {
                                            window.location.href = `/dashboard/admin/organizaciones/${despacho.id}`;
                                        }}
                                        className="min-h-[44px] min-w-[44px] rounded-lg p-2 text-[var(--fiscal-ink)] transition-colors hover:bg-[rgba(184,137,70,0.12)]"
                                        title="Ver detalles"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </button>
                                    {user?.is_superuser && (
                                        <>
                                            <button
                                                onClick={() => {
                                                    setEditingDespacho(despacho);
                                                    setShowModal(true);
                                                }}
                                                className="min-h-[44px] min-w-[44px] rounded-lg p-2 text-slate-600 transition-colors hover:bg-[rgba(25,36,52,0.08)]"
                                                title="Editar"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(despacho.id)}
                                                disabled={deletingId === despacho.id}
                                                aria-disabled={deletingId === despacho.id}
                                                aria-busy={deletingId === despacho.id}
                                                className="min-h-[44px] min-w-[44px] rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                                                title="Eliminar"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </article>
                        )}
                    />

                    <div className="hidden overflow-x-auto lg:block">
                        <table className="w-full">
                            <thead className="bg-[rgba(246,242,235,0.72)]">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                        Organización
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                        Tipo
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                        Contacto
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                        Clientes / Empresas
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[rgba(25,36,52,0.08)]">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                            Cargando...
                                        </td>
                                    </tr>
                                ) : filteredDespachos.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                            No se encontraron organizaciones
                                        </td>
                                    </tr>
                                ) : (
                                    filteredDespachos.map((despacho) => (
                                        <tr
                                            key={despacho.id}
                                            className="transition-colors hover:bg-[rgba(246,242,235,0.48)]"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${despacho.tipo === 'despacho'
                                                        ? 'bg-[rgba(184,137,70,0.12)] text-[var(--fiscal-gold)]'
                                                        : 'bg-[rgba(25,36,52,0.08)] text-[var(--fiscal-ink)]'
                                                        }`}>
                                                        <Building2 className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-[var(--fiscal-ink)]">
                                                            {despacho.nombre}
                                                        </div>
                                                        {despacho.notas && (
                                                            <div className="text-sm text-slate-500 truncate max-w-xs">
                                                                {despacho.notas}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${despacho.tipo === 'despacho'
                                                    ? 'bg-[rgba(184,137,70,0.12)] text-[var(--fiscal-ink)]'
                                                    : 'bg-[rgba(25,36,52,0.08)] text-[var(--fiscal-ink)]'
                                                    }`}>
                                                    {despacho.tipo === 'despacho' ? 'Despacho' : 'Corporativo'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-[var(--fiscal-ink)]">
                                                    {despacho.contacto_email}
                                                </div>
                                                {despacho.contacto_telefono && (
                                                    <div className="text-sm text-slate-500">
                                                        {despacho.contacto_telefono}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Users className="w-4 h-4 text-slate-400" />
                                                    <span className="text-sm font-medium text-[var(--fiscal-ink)]">
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
                                                        className="min-h-[44px] min-w-[44px] rounded-lg p-2 text-[var(--fiscal-ink)] transition-colors hover:bg-[rgba(184,137,70,0.12)]"
                                                        title="Ver detalles"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    {user?.is_superuser && (
                                                        <>
                                                            <button
                                                                onClick={() => {
                                                                    setEditingDespacho(despacho);
                                                                    setShowModal(true);
                                                                }}
                                                                className="min-h-[44px] min-w-[44px] rounded-lg p-2 text-slate-600 transition-colors hover:bg-[rgba(25,36,52,0.08)]"
                                                                title="Editar"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(despacho.id)}
                                                                disabled={deletingId === despacho.id}
                                                                aria-disabled={deletingId === despacho.id}
                                                                aria-busy={deletingId === despacho.id}
                                                                className="min-h-[44px] min-w-[44px] rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                                                                title="Eliminar"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
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
        blue: 'bg-[rgba(184,137,70,0.12)] text-[var(--fiscal-gold)]',
        purple: 'bg-[rgba(25,36,52,0.08)] text-[var(--fiscal-ink)]',
        green: 'bg-emerald-50 text-emerald-700',
    };

    return (
        <div className="surface-panel rounded-[28px] border-[rgba(25,36,52,0.08)] p-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="mb-1 text-sm font-medium text-slate-500">{title}</p>
                    <p className="font-display text-3xl font-semibold text-[var(--fiscal-ink)]">{value}</p>
                </div>
                <div className={`${colorClasses[color as keyof typeof colorClasses]} rounded-2xl p-4`}>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.42)] p-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[30px] border border-[rgba(25,36,52,0.08)] bg-[linear-gradient(180deg,#fffdf9_0%,#ffffff_100%)] shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
                <div className="border-b border-[rgba(25,36,52,0.08)] p-6">
                    <h2 className="font-display text-2xl font-semibold tracking-tight text-[var(--fiscal-ink)]">
                        {despacho ? 'Editar Organización' : 'Nueva Organización'}
                    </h2>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {error && (
                        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                            <p className="text-red-800">{error}</p>
                        </div>
                    )}

                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                            Nombre *
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.nombre}
                            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                            className="w-full rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white px-4 py-3 text-slate-900 focus:border-[var(--fiscal-gold)] focus:outline-none"
                            placeholder="Nombre del despacho o corporativo"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                            Tipo *
                        </label>
                        <select
                            required
                            value={formData.tipo}
                            onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                            className="w-full rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white px-4 py-3 text-slate-900 focus:border-[var(--fiscal-gold)] focus:outline-none"
                        >
                            <option value="despacho">Despacho Contable</option>
                            <option value="corporativo">Grupo Corporativo</option>
                        </select>
                        <p className="mt-2 text-sm text-slate-500">
                            {formData.tipo === 'despacho'
                                ? 'Los despachos agrupan a sus clientes. Cada cliente tendrá su espacio independiente.'
                                : 'Los corporativos agrupan a las empresas del grupo y permiten gestionar transacciones intercompañía.'}
                        </p>
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                            Email de Contacto
                        </label>
                        <input
                            type="email"
                            value={formData.contacto_email}
                            onChange={(e) => setFormData({ ...formData, contacto_email: e.target.value })}
                            className="w-full rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white px-4 py-3 text-slate-900 focus:border-[var(--fiscal-gold)] focus:outline-none"
                            placeholder="contacto@ejemplo.com"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                            Teléfono de Contacto
                        </label>
                        <input
                            type="tel"
                            value={formData.contacto_telefono}
                            onChange={(e) => setFormData({ ...formData, contacto_telefono: e.target.value })}
                            className="w-full rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white px-4 py-3 text-slate-900 focus:border-[var(--fiscal-gold)] focus:outline-none"
                            placeholder="+52 55 1234 5678"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                            Notas
                        </label>
                        <textarea
                            value={formData.notas}
                            onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                            rows={4}
                            className="w-full rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white px-4 py-3 text-slate-900 focus:border-[var(--fiscal-gold)] focus:outline-none"
                            placeholder="Notas adicionales..."
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 rounded-full border border-[rgba(25,36,52,0.12)] bg-white px-4 py-3 text-slate-700 transition-colors hover:border-[rgba(184,137,70,0.28)] hover:text-[var(--fiscal-ink)]"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="button-institutional flex-1 justify-center disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading ? 'Guardando...' : despacho ? 'Actualizar' : 'Crear'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
