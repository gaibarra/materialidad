"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardShell } from "../../../../components/DashboardShell";
import { useAuthContext } from "../../../../context/AuthContext";
import { alertError, alertSuccess } from "../../../../lib/alerts";
import {
  TenantLimitInfo,
  TenantProvisionPayload,
  TenantProvisionResponse,
  Despacho,
  fetchTenantLimits,
  fetchDespachos,
  provisionTenant,
} from "../../../../lib/admin";

const INITIAL_FORM: TenantProvisionPayload = {
  name: "",
  slug: "",
  despacho: undefined,
  db_name: "",
  db_user: "",
  db_password: "",
  db_host: "localhost",
  db_port: 5432,
  default_currency: "MXN",
  create_database: true,
  admin_email: "",
  admin_password: "",
  admin_name: "",
};

export default function TenantProvisionPage() {
  const router = useRouter();
  const { isAuthenticated, isProfileLoaded, user } = useAuthContext();

  const [form, setForm] = useState<TenantProvisionPayload>(INITIAL_FORM);
  const [limits, setLimits] = useState<TenantLimitInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [result, setResult] = useState<TenantProvisionResponse | null>(null);
  const [despachos, setDespachos] = useState<Despacho[]>([]);

  const loadLimits = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTenantLimits();
      setLimits(data);
    } catch (error) {
      void alertError("No pudimos leer los límites", (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isProfileLoaded) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (user && !user.is_staff) {
      setBlockedReason("Solo administradores de clientes corporativos pueden aprovisionar nuevos clientes");
      setLoading(false);
      return;
    }
    setBlockedReason(null);
    void loadLimits();
    if (user?.is_superuser) {
      void fetchDespachos()
        .then(setDespachos)
        .catch((error) => void alertError("No pudimos cargar despachos", (error as Error).message));
    }
  }, [isAuthenticated, isProfileLoaded, user, router, loadLimits]);

  const hasCapacity = useMemo(() => limits?.has_capacity ?? true, [limits?.has_capacity]);

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const target = event.currentTarget;
    const { name, type, value } = target;
    const isCheckbox = target instanceof HTMLInputElement && type === "checkbox";

    setForm((prev) => ({
      ...prev,
      [name]: isCheckbox
        ? target.checked
        : name === "db_port" || name === "despacho"
          ? value === "" ? undefined : Number(value)
          : value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasCapacity) {
      await alertError("Límite alcanzado", "No puedes crear más clientes en este plan");
      return;
    }

    setSaving(true);
    try {
      const payload: TenantProvisionPayload = {
        ...form,
        despacho: user?.is_superuser ? form.despacho : user?.despacho_id ?? undefined,
        name: form.name.trim(),
        slug: form.slug.trim(),
        db_name: form.db_name.trim(),
        db_user: form.db_user.trim(),
        db_password: form.db_password,
        db_host: form.db_host.trim(),
        default_currency: form.default_currency?.trim() || "MXN",
        admin_email: form.admin_email.trim(),
        admin_password: form.admin_password,
        admin_name: form.admin_name?.trim() || "",
      };

      const response = await provisionTenant(payload);
      setResult(response);
      await alertSuccess(
        "Cliente aprovisionado",
        `Se aprovisionó ${response.name} (${response.slug}). Crea las DNS y revisa el onboarding.`
      );
      setForm(INITIAL_FORM);
      await loadLimits();
    } catch (error) {
      void alertError("No pudimos crear el cliente", (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const renderLimitCard = () => (
    <div className="surface-panel flex flex-col gap-2 rounded-[28px] border-[rgba(25,36,52,0.08)] p-5 text-sm text-slate-700">
      <p className="kicker-label">Capacidad</p>
      {loading ? (
        <p className="text-slate-500">Calculando límite...</p>
      ) : limits ? (
        <>
          <p className="font-display text-2xl font-semibold tracking-tight text-[var(--fiscal-ink)]">
            {limits.active_tenants} / {limits.limit ?? "∞"} clientes activos
          </p>
          <p className="text-slate-600">
            {limits.has_capacity
              ? "Aún puedes crear un cliente dentro del plan actual."
              : "Se alcanzó el límite gratuito; aumenta el plan o desactiva alguno."}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void loadLimits()}
              className="min-h-[44px] rounded-full border border-[rgba(25,36,52,0.12)] px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-[rgba(184,137,70,0.28)] hover:text-[var(--fiscal-ink)]"
            >
              Actualizar
            </button>
          </div>
        </>
      ) : (
        <p className="text-slate-500">No se pudo recuperar el límite.</p>
      )}
    </div>
  );

  if (!isAuthenticated) {
    return null;
  }

  return (
    <DashboardShell>
      <div className="flex flex-col gap-8">
        <div className="surface-panel-strong flex flex-col gap-3 rounded-[32px] p-6 sm:p-8">
          <p className="eyebrow-shell">
            Administración corporativa
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--fiscal-ink)]">Aprovisionar cliente</h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-600">
            Da de alta una nueva operación con base dedicada, credenciales iniciales y parámetros mínimos para arranque controlado.
          </p>
        </div>

        {blockedReason ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
            {blockedReason}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <form
                onSubmit={handleSubmit}
                className="surface-panel space-y-6 rounded-[30px] border-[rgba(25,36,52,0.08)] p-6"
              >
                {user?.is_superuser && (
                  <div>
                    <label className="text-xs uppercase tracking-[0.35em] text-slate-500">Despacho / corporativo</label>
                    <select
                      name="despacho"
                      value={(form as any).despacho || ""}
                      onChange={handleChange}
                      required
                      className="mt-2 w-full rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[var(--fiscal-gold)]"
                    >
                      <option value="">Selecciona despacho</option>
                      {despachos.map((d) => (
                        <option key={d.id} value={d.id}>{`${d.nombre} · ${d.tipo}`}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-[0.35em] text-slate-500">Nombre legal</label>
                    <input
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      required
                      className="mt-2 w-full rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[var(--fiscal-gold)]"
                      placeholder="Cliente Demo, S.A. de C.V."
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.35em] text-slate-500">Slug</label>
                    <input
                      name="slug"
                      value={form.slug}
                      onChange={handleChange}
                      required
                      className="mt-2 w-full rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[var(--fiscal-gold)]"
                      placeholder="cliente-demo"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-[0.35em] text-slate-500">Base de datos</label>
                    <input
                      name="db_name"
                      value={form.db_name}
                      onChange={handleChange}
                      required
                      className="mt-2 w-full rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[var(--fiscal-gold)]"
                      placeholder="cliente_demo_db"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.35em] text-slate-500">Usuario DB</label>
                    <input
                      name="db_user"
                      value={form.db_user}
                      onChange={handleChange}
                      required
                      className="mt-2 w-full rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[var(--fiscal-gold)]"
                      placeholder="cliente_user"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-[0.35em] text-slate-500">Password DB</label>
                    <input
                      type="password"
                      name="db_password"
                      value={form.db_password}
                      onChange={handleChange}
                      required
                      className="mt-2 w-full rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[var(--fiscal-gold)]"
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.35em] text-slate-500">Host y puerto</label>
                    <div className="mt-2 grid grid-cols-[2fr,1fr] gap-2">
                      <input
                        name="db_host"
                        value={form.db_host}
                        onChange={handleChange}
                        required
                        className="w-full rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[var(--fiscal-gold)]"
                        placeholder="localhost"
                      />
                      <input
                        type="number"
                        name="db_port"
                        value={form.db_port}
                        onChange={handleChange}
                        min={1}
                        max={65535}
                        className="w-full rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[var(--fiscal-gold)]"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-[0.35em] text-slate-500">Moneda por defecto</label>
                    <input
                      name="default_currency"
                      value={form.default_currency}
                      onChange={handleChange}
                      className="mt-2 w-full rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[var(--fiscal-gold)]"
                      placeholder="MXN"
                      maxLength={3}
                    />
                  </div>
                  <div className="flex items-end gap-3">
                    <label className="text-xs uppercase tracking-[0.35em] text-slate-500">Provisionar DB</label>
                    <input
                      type="checkbox"
                      name="create_database"
                      checked={form.create_database}
                      onChange={handleChange}
                      className="h-5 w-5 rounded border-slate-300 bg-white text-[var(--fiscal-gold)]"
                    />
                    <p className="text-xs text-slate-500">
                      Desactiva si la base ya existe (managed Postgres sin permisos CREATE DATABASE).
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-[0.35em] text-slate-500">Correo admin</label>
                    <input
                      type="email"
                      name="admin_email"
                      value={form.admin_email}
                      onChange={handleChange}
                      required
                      className="mt-2 w-full rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[var(--fiscal-gold)]"
                      placeholder="admin@cliente.com"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.35em] text-slate-500">Password admin</label>
                    <input
                      type="password"
                      name="admin_password"
                      value={form.admin_password}
                      onChange={handleChange}
                      required
                      className="mt-2 w-full rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[var(--fiscal-gold)]"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs uppercase tracking-[0.35em] text-slate-500">Nombre admin (opcional)</label>
                  <input
                    name="admin_name"
                    value={form.admin_name}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-2xl border border-[rgba(25,36,52,0.12)] bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[var(--fiscal-gold)]"
                    placeholder="Nombre y Apellidos"
                  />
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-[rgba(184,137,70,0.26)] bg-[linear-gradient(180deg,rgba(184,137,70,0.10),rgba(255,255,255,0.82))] p-4 text-xs text-slate-700">
                  <p className="font-semibold text-[var(--fiscal-ink)]">Requisitos de la base de control</p>
                  <p>
                    El usuario de la base de control debe tener permisos para crear roles y bases de datos.
                    En proveedores administrados (RDS, AlloyDB, Cloud SQL) desactiva &quot;Provisionar DB&quot; y
                    apunta a una base previamente creada con el rol ya existente.
                  </p>
                  <p>
                    El endpoint usa `/api/tenancy/provision/` con permisos de superusuario o staff sin cliente asignado.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={saving || !hasCapacity}
                  className="button-institutional w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Aprovisionando..." : hasCapacity ? "Crear cliente" : "Límite alcanzado"}
                </button>
              </form>
            </div>
            <div className="space-y-4">
              {renderLimitCard()}
              {result && (
                <div className="surface-panel rounded-[28px] border-[rgba(25,36,52,0.08)] p-5 text-sm text-slate-700">
                  <p className="kicker-label">Último resultado</p>
                  <p className="mt-2 font-display text-xl font-semibold tracking-tight text-[var(--fiscal-ink)]">{result.name}</p>
                  <p className="text-slate-600">Slug {result.slug}</p>
                  <p className="text-slate-500">DB {result.db_name} @ {result.db_host}:{result.db_port}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
