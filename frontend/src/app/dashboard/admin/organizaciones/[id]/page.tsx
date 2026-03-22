/**
 * Página de detalle de una organización (Despacho o Corporativo)
 * Muestra tenants y transacciones intercompañía (solo para corporativos)
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
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
    Home,
    Edit2,
    Power,
    Trash2,
    X,
    Check,
} from 'lucide-react';
import Link from 'next/link';
import Swal from 'sweetalert2';

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

    const getAuthToken = () => {
        const session = loadSession();
        return session?.accessToken;
    };

    const fetchDespachoDetail = useCallback(async () => {
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
            router.push('/login');
        }
    }, [id, router]);

    const fetchTenants = useCallback(async () => {
        try {
            const token = getAuthToken();
            if (!token) return;

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/tenancy/admin/despachos/${id}/tenants/?include_inactive=true`,
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
    }, [id]);

    const fetchStats = useCallback(async () => {
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
    }, [id]);

    useEffect(() => {
        if (id) {
            void fetchDespachoDetail();
            void fetchTenants();
            void fetchStats();
        }
    }, [id, fetchDespachoDetail, fetchTenants, fetchStats]);

    if (loading || !despacho) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(184,137,70,0.12),transparent_36%),linear-gradient(180deg,#f7f2e8_0%,#f3efe6_24%,#f8f6f1_100%)]">
                <div className="text-[var(--fiscal-muted)]">Cargando...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(184,137,70,0.12),transparent_36%),linear-gradient(180deg,#f7f2e8_0%,#f3efe6_24%,#f8f6f1_100%)] p-6 sm:p-8">
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
                    <button
                        onClick={() => router.back()}
                        className="mb-5 flex items-center gap-2 text-sm text-[var(--fiscal-muted)] transition-colors hover:text-[var(--fiscal-accent)]"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Volver
                    </button>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div
                                className={`flex h-16 w-16 items-center justify-center rounded-2xl ${despacho.tipo === 'despacho'
                                    ? 'bg-[rgba(184,137,70,0.12)] text-[var(--fiscal-gold)]'
                                    : 'bg-[rgba(25,36,52,0.08)] text-[var(--fiscal-ink)]'
                                    } shadow-panel`}
                            >
                                <Building2 className="w-8 h-8" />
                            </div>
                            <div>
                                <p className="eyebrow-shell text-[var(--fiscal-accent)]">Detalle de organización</p>
                                <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-[var(--fiscal-ink)]">
                                    {despacho.nombre}
                                </h1>
                                <p className="mt-2 text-sm text-[var(--fiscal-muted)]">
                                    {despacho.tipo === 'despacho' ? 'Despacho Contable' : 'Grupo Corporativo'}
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => router.push(`/dashboard/admin/organizaciones/${id}/edit`)}
                            className="button-institutional rounded-full px-6 py-3 text-sm font-semibold"
                        >
                            Editar
                        </button>
                    </div>
                </div>

                {/* Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <InfoCard
                        title={despacho.tipo === 'despacho' ? 'Clientes del Despacho' : 'Empresas del Grupo'}
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

                <div className="surface-panel mb-6 rounded-[30px] border-[rgba(25,36,52,0.08)]">
                    <div className="border-b border-[rgba(25,36,52,0.08)]">
                        <div className="flex">
                            <button
                                onClick={() => setActiveTab('tenants')}
                                className={`px-6 py-4 font-medium transition-colors ${activeTab === 'tenants'
                                    ? 'border-b-2 border-[var(--fiscal-gold)] text-[var(--fiscal-ink)]'
                                    : 'text-[var(--fiscal-muted)] hover:text-[var(--fiscal-ink)]'
                                    }`}
                            >
                                {despacho.tipo === 'despacho' ? 'Clientes' : 'Empresas'} ({tenants.length})
                            </button>
                            {despacho.tipo === 'corporativo' && (
                                <button
                                    onClick={() => setActiveTab('intercompany')}
                                    className={`px-6 py-4 font-medium transition-colors ${activeTab === 'intercompany'
                                        ? 'border-b-2 border-[var(--fiscal-gold)] text-[var(--fiscal-ink)]'
                                        : 'text-[var(--fiscal-muted)] hover:text-[var(--fiscal-ink)]'
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
                            <TenantsTab tenants={tenants} despachoId={id} tipo={despacho.tipo} onRefresh={() => { fetchTenants(); fetchStats(); }} />
                        )}
                        {activeTab === 'intercompany' && despacho.tipo === 'corporativo' && (
                            <IntercompanyTab despachoId={id} />
                        )}
                    </div>
                </div>

                {despacho.notas && (
                    <div className="surface-panel rounded-[28px] border-[rgba(25,36,52,0.08)] p-6">
                        <h3 className="mb-3 font-display text-xl font-semibold text-[var(--fiscal-ink)]">
                            Notas
                        </h3>
                        <p className="whitespace-pre-wrap text-[var(--fiscal-muted)]">
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
        blue: 'bg-[rgba(184,137,70,0.12)] text-[var(--fiscal-gold)]',
        green: 'bg-[var(--fiscal-success-soft)] text-[var(--fiscal-success)]',
        purple: 'bg-[var(--fiscal-accent-soft)] text-[var(--fiscal-accent)]',
    };

    return (
        <div className="surface-panel rounded-[28px] border-[rgba(25,36,52,0.08)] p-6">
            <div className="flex items-start justify-between mb-3">
                <p className="text-sm font-medium text-[var(--fiscal-muted)]">{title}</p>
                <div
                    className={`${colorClasses[color as keyof typeof colorClasses]} rounded-lg p-2`}
                >
                    {icon}
                </div>
            </div>
            <p className={`${valueClass} mb-1 font-display font-semibold text-[var(--fiscal-ink)]`}>{value}</p>
            {subtitle && <p className="text-sm text-[var(--fiscal-muted)]">{subtitle}</p>}
        </div>
    );
}

function TenantsTab({ tenants, despachoId, tipo, onRefresh }: { tenants: Tenant[]; despachoId: string; tipo: 'despacho' | 'corporativo'; onRefresh: () => void }) {
    const entityLabel = tipo === 'despacho' ? 'Cliente del Despacho' : 'Empresa del Grupo';
    const pluralLabel = tipo === 'despacho' ? 'Clientes del Despacho' : 'Empresas del Grupo';

    const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
    const [editName, setEditName] = useState('');
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [liveFeedback, setLiveFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null);

    const getToken = () => {
        const session = loadSession();
        return session?.accessToken;
    };

    const handleEdit = (tenant: Tenant) => {
        setEditingTenant(tenant);
        setEditName(tenant.name);
    };

    const handleSaveEdit = async () => {
        if (!editingTenant || !editName.trim()) return;
        setActionLoading(editingTenant.id);
        try {
            const token = getToken();
            if (!token) throw new Error('Sin sesión');

            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/tenancy/admin/despachos/${despachoId}/tenants/${editingTenant.id}/`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ name: editName.trim() }),
                }
            );
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || 'Error al actualizar');
            }
            setEditingTenant(null);
            setLiveFeedback({ tone: 'success', message: 'Nombre del tenant actualizado.' });
            onRefresh();
        } catch (err: any) {
            setLiveFeedback({ tone: 'error', message: `No se pudo actualizar el tenant: ${err.message}` });
            await Swal.fire({ icon: 'error', title: 'Error al actualizar', text: err.message, confirmButtonColor: '#2563eb' });
        } finally {
            setActionLoading(null);
        }
    };

    const handleToggleActive = async (tenant: Tenant) => {
        const action = tenant.is_active ? 'desactivar' : 'activar';
        const conf = await Swal.fire({ title: `¿${action.charAt(0).toUpperCase() + action.slice(1)} "${tenant.name}"?`, icon: 'question', showCancelButton: true, confirmButtonText: 'Sí', cancelButtonText: 'Cancelar', confirmButtonColor: '#2563eb' });
        if (!conf.isConfirmed) return;
        setActionLoading(tenant.id);
        try {
            const token = getToken();
            if (!token) throw new Error('Sin sesión');

            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/tenancy/admin/despachos/${despachoId}/tenants/${tenant.id}/toggle-active/`,
                {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || 'Error');
            }
            setLiveFeedback({ tone: 'success', message: `Tenant ${tenant.is_active ? 'desactivado' : 'activado'}.` });
            onRefresh();
        } catch (err: any) {
            setLiveFeedback({ tone: 'error', message: `No se pudo ${tenant.is_active ? 'desactivar' : 'activar'} el tenant: ${err.message}` });
            await Swal.fire({ icon: 'error', title: `Error al ${tenant.is_active ? 'desactivar' : 'activar'}`, text: err.message, confirmButtonColor: '#2563eb' });
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteRequest = (tenant: Tenant) => {
        if (tenant.is_active) {
            setLiveFeedback({ tone: 'info', message: 'Desactiva el tenant antes de eliminarlo.' });
            void Swal.fire({ icon: 'warning', title: 'Tenant activo', text: 'Debes desactivar el tenant antes de eliminarlo.', confirmButtonColor: '#2563eb' });
            return;
        }
        setDeleteTarget(tenant);
        setDeleteConfirmText('');
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setActionLoading(deleteTarget.id);
        try {
            const token = getToken();
            if (!token) throw new Error('Sin sesión');

            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/tenancy/admin/despachos/${despachoId}/tenants/${deleteTarget.id}/delete/?confirm=true`,
                {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || 'Error al eliminar');
            }
            setDeleteTarget(null);
            setLiveFeedback({ tone: 'success', message: 'Tenant eliminado.' });
            onRefresh();
        } catch (err: any) {
            setLiveFeedback({ tone: 'error', message: `No se pudo eliminar el tenant: ${err.message}` });
            await Swal.fire({ icon: 'error', title: 'No se pudo eliminar', text: err.message, confirmButtonColor: '#2563eb' });
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="space-y-4">
            {liveFeedback && (
                <div
                    role={liveFeedback.tone === 'error' ? 'alert' : 'status'}
                    aria-live={liveFeedback.tone === 'error' ? 'assertive' : 'polite'}
                    className={`rounded-[22px] border px-4 py-3 text-sm ${
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
            <div className="mb-6 flex items-center justify-between">
                <h3 className="font-display text-xl font-semibold text-[var(--fiscal-ink)]">
                    {pluralLabel}
                </h3>
                <button
                    onClick={() =>
                        (window.location.href = `/dashboard/admin/organizaciones/${despachoId}/tenants/new?tipo=${tipo}`)
                    }
                    className="button-institutional inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
                >
                    <Plus className="w-4 h-4" />
                    {`Nuevo ${entityLabel}`}
                </button>
            </div>

            {tenants.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-[rgba(200,192,177,0.72)] bg-[rgba(244,242,237,0.45)] py-12 text-center text-[var(--fiscal-muted)]">
                    <Building2 className="mx-auto mb-4 h-16 w-16 opacity-50" />
                    <p>{`No hay ${pluralLabel.toLowerCase()} en esta organización`}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tenants.map((tenant) => (
                        <div
                            key={tenant.id}
                            className={`rounded-2xl border p-4 transition-colors ${
                                tenant.is_active
                                    ? 'border-[rgba(25,36,52,0.08)] bg-white hover:border-[rgba(184,137,70,0.28)]'
                                    : 'border-[rgba(166,103,31,0.26)] bg-[var(--fiscal-warning-soft)]/55'
                            }`}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                    {/* Inline edit mode */}
                                    {editingTenant?.id === tenant.id ? (
                                        <div className="flex items-center gap-2 mb-1">
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="flex-1 rounded-lg border border-[rgba(45,91,136,0.34)] bg-white px-2 py-1 text-sm font-semibold text-[var(--fiscal-ink)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSaveEdit();
                                                    if (e.key === 'Escape') setEditingTenant(null);
                                                }}
                                            />
                                            <button
                                                onClick={handleSaveEdit}
                                                disabled={actionLoading === tenant.id}
                                                aria-disabled={actionLoading === tenant.id}
                                                aria-busy={actionLoading === tenant.id}
                                                className="rounded p-1 text-[var(--fiscal-success)] hover:bg-[var(--fiscal-success-soft)]"
                                                title="Guardar"
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setEditingTenant(null)}
                                                className="rounded p-1 text-[var(--fiscal-muted)] hover:bg-[rgba(244,242,237,0.88)]"
                                                title="Cancelar"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <h4 className="mb-1 truncate font-semibold text-[var(--fiscal-ink)]">
                                            {tenant.name}
                                        </h4>
                                    )}
                                    <p className="mb-2 text-sm text-[var(--fiscal-muted)]">
                                        Slug: <code className="rounded bg-[rgba(244,242,237,0.88)] px-2 py-1">{tenant.slug}</code>
                                    </p>
                                    <p className="text-xs text-[var(--fiscal-muted)]">
                                        Base de datos: {tenant.db_name}
                                    </p>
                                    <p className="mt-1 text-xs text-[var(--fiscal-muted)]">
                                        Creado: {new Date(tenant.created_at).toLocaleDateString('es-MX')}
                                    </p>
                                </div>
                                <span
                                    className={`ml-2 shrink-0 px-2 py-1 rounded-full text-xs font-medium ${tenant.is_active
                                        ? 'bg-[var(--fiscal-success-soft)] text-[var(--fiscal-success)]'
                                        : 'bg-[var(--fiscal-warning-soft)] text-[var(--fiscal-warning)]'
                                        }`}
                                >
                                    {tenant.is_active ? 'Activo' : 'Inactivo'}
                                </span>
                            </div>

                            {/* Action buttons */}
                            <div className="mt-3 flex items-center gap-2 border-t border-[rgba(25,36,52,0.08)] pt-3">
                                <button
                                    onClick={() => handleEdit(tenant)}
                                    disabled={actionLoading === tenant.id}
                                    aria-disabled={actionLoading === tenant.id}
                                    aria-busy={actionLoading === tenant.id}
                                    className="flex items-center gap-1 rounded-lg bg-[var(--fiscal-accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--fiscal-accent)] transition-colors hover:bg-[var(--fiscal-accent-soft)]/80"
                                    title="Editar nombre"
                                >
                                    <Edit2 className="w-3.5 h-3.5" />
                                    Editar
                                </button>
                                <button
                                    onClick={() => handleToggleActive(tenant)}
                                    disabled={actionLoading === tenant.id}
                                    aria-disabled={actionLoading === tenant.id}
                                    aria-busy={actionLoading === tenant.id}
                                    className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                        tenant.is_active
                                                ? 'bg-[var(--fiscal-warning-soft)] text-[var(--fiscal-warning)] hover:bg-[var(--fiscal-warning-soft)]/80'
                                                : 'bg-[var(--fiscal-success-soft)] text-[var(--fiscal-success)] hover:bg-[var(--fiscal-success-soft)]/80'
                                    }`}
                                    title={tenant.is_active ? 'Desactivar' : 'Activar'}
                                >
                                    <Power className="w-3.5 h-3.5" />
                                    {tenant.is_active ? 'Desactivar' : 'Activar'}
                                </button>
                                {!tenant.is_active && (
                                    <button
                                        onClick={() => handleDeleteRequest(tenant)}
                                        disabled={actionLoading === tenant.id}
                                        aria-disabled={actionLoading === tenant.id}
                                        aria-busy={actionLoading === tenant.id}
                                        className="flex items-center gap-1 rounded-lg bg-[var(--fiscal-danger-soft)] px-3 py-1.5 text-xs font-medium text-[var(--fiscal-danger)] transition-colors hover:bg-[var(--fiscal-danger-soft)]/80"
                                        title="Eliminar (requiere estar desactivado)"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Eliminar
                                    </button>
                                )}
                                {actionLoading === tenant.id && (
                                    <span className="ml-auto animate-pulse text-xs text-[var(--fiscal-muted)]">Procesando…</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Delete confirmation modal */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.42)] p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-[28px] border border-[rgba(25,36,52,0.08)] bg-[linear-gradient(180deg,#fffdf9_0%,#ffffff_100%)] p-6 shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="rounded-lg bg-[var(--fiscal-danger-soft)] p-2">
                                <Trash2 className="w-6 h-6 text-[var(--fiscal-danger)]" />
                            </div>
                            <h3 className="font-display text-xl font-semibold text-[var(--fiscal-ink)]">
                                Eliminar tenant
                            </h3>
                        </div>
                        <p className="mb-2 text-sm text-[var(--fiscal-muted)]">
                            Esta acción es <strong>irreversible</strong>. Se eliminará el registro de <strong>{deleteTarget.name}</strong> del sistema.
                            La base de datos del tenant <em>no</em> será eliminada.
                        </p>
                        <p className="mb-4 text-sm text-[var(--fiscal-muted)]">
                            Escribe <code className="rounded bg-[var(--fiscal-danger-soft)] px-1.5 py-0.5 font-mono text-xs text-[var(--fiscal-danger)]">ELIMINAR</code> para confirmar:
                        </p>
                        <input
                            type="text"
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            placeholder="Escribe ELIMINAR"
                            className="mb-4 w-full rounded-lg border border-[rgba(25,36,52,0.12)] bg-white px-3 py-2 text-sm text-[var(--fiscal-ink)] focus:outline-none focus:ring-2 focus:ring-[rgba(160,67,61,0.18)]"
                            autoFocus
                        />
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="rounded-full border border-[rgba(25,36,52,0.12)] bg-white px-4 py-2 text-sm font-medium text-[var(--fiscal-ink)] transition-colors hover:border-[rgba(184,137,70,0.28)]"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDeleteConfirm}
                                disabled={deleteConfirmText !== 'ELIMINAR' || actionLoading === deleteTarget.id}
                                className="rounded-full bg-[var(--fiscal-danger)] px-4 py-2 text-sm font-medium text-white transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {actionLoading === deleteTarget.id ? 'Eliminando…' : 'Confirmar eliminación'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function IntercompanyTab({ despachoId }: { despachoId: string }) {
    return (
        <div className="space-y-4">
            <div className="mb-6 flex items-center justify-between">
                <h3 className="font-display text-xl font-semibold text-[var(--fiscal-ink)]">
                    Transacciones Intercompañía
                </h3>
                <button
                    onClick={() =>
                        (window.location.href = `/dashboard/admin/organizaciones/${despachoId}/intercompany/new`)
                    }
                    className="button-institutional inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
                >
                    <Plus className="w-4 h-4" />
                    Nueva Transacción
                </button>
            </div>

            <div className="rounded-[28px] border border-[rgba(45,91,136,0.18)] bg-[linear-gradient(180deg,rgba(219,230,240,0.55),rgba(255,255,255,0.92))] p-6">
                <div className="flex items-start gap-4">
                    <div className="rounded-xl bg-[rgba(184,137,70,0.12)] p-3 text-[var(--fiscal-gold)]">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <h4 className="mb-2 font-display text-xl font-semibold text-[var(--fiscal-ink)]">
                            Monitor de Transacciones Intercompañía 2026
                        </h4>
                        <p className="mb-3 text-sm text-[var(--fiscal-muted)]">
                            Los préstamos y transacciones entre empresas del mismo grupo corporativo requieren{' '}
                            <strong>documentación rigurosa</strong> para evitar problemas fiscales:
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-[var(--fiscal-muted)]">
                            <li>Contratos con fecha cierta y razón de negocios clara</li>
                            <li>Tasas de interés a valor de mercado (arm&apos;s length)</li>
                            <li>Estudio de precios de transferencia cuando aplique</li>
                            <li>Justificación del beneficio al grupo corporativo</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Placeholder for transactions list - This would connect to the backend endpoint */}
            <div className="rounded-[28px] border border-dashed border-[rgba(200,192,177,0.72)] bg-[rgba(244,242,237,0.45)] py-12 text-center text-[var(--fiscal-muted)]">
                <DollarSign className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="mb-2">No hay transacciones intercompañía registradas</p>
                <p className="text-sm">
                    Las transacciones aparecerán aquí una vez que se creen desde el sistema de operaciones
                </p>
            </div>
        </div>
    );
}
