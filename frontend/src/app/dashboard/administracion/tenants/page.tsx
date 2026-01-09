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
  const { isAuthenticated, user } = useAuthContext();

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
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (user && (!user.is_staff || user.tenant_slug)) {
      setBlockedReason("Solo staff corporativo sin cliente asignado puede aprovisionar nuevos clientes");
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
  }, [isAuthenticated, user, router, loadLimits]);

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
        despacho: user?.is_superuser ? form.despacho : undefined,
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
    <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
      <p className="text-[11px] uppercase tracking-[0.35em] text-emerald-300">Capacidad</p>
      {loading ? (
        <p className="text-slate-400">Calculando límite...</p>
      ) : limits ? (
        <>
          <p className="text-lg font-semibold text-white">
            {limits.active_tenants} / {limits.limit ?? "∞"} clientes activos
          </p>
          <p className="text-slate-400">
            {limits.has_capacity
              ? "Aún puedes crear un cliente dentro del plan actual."
              : "Se alcanzó el límite gratuito; aumenta el plan o desactiva alguno."}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void loadLimits()}
              className="rounded-full border border-white/30 px-3 py-1 text-xs font-semibold text-white transition hover:border-emerald-300"
            >
              Actualizar
            </button>
          </div>
        </>
      ) : (
        <p className="text-slate-400">No se pudo recuperar el límite.</p>
      )}
    </div>
  );

  if (!isAuthenticated) {
    return null;
  }

  return (
    <DashboardShell>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">
            Administración corporativa
          </p>
          <h1 className="text-2xl font-semibold text-white">Aprovisionar cliente</h1>
          <p className="text-sm text-slate-300">
            Crea la base dedicada, ejecuta migraciones y genera la cuenta admin inicial.
          </p>
        </div>

        {blockedReason ? (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
            {blockedReason}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <form
                onSubmit={handleSubmit}
                className="space-y-6 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-slate-900/20 p-6 shadow-2xl shadow-black/30"
              >
                {user?.is_superuser && (
                  <div>
                    <label className="text-xs uppercase tracking-[0.35em] text-slate-400">Despacho / corporativo</label>
                    <select
                      name="despacho"
                      value={(form as any).despacho || ""}
                      onChange={handleChange}
                      required
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
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
                    <label className="text-xs uppercase tracking-[0.35em] text-slate-400">Nombre legal</label>
                    <input
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      required
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                      placeholder="Cliente Demo, S.A. de C.V."
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.35em] text-slate-400">Slug</label>
                    <input
                      name="slug"
                      value={form.slug}
                      onChange={handleChange}
                      required
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                      placeholder="cliente-demo"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-[0.35em] text-slate-400">Base de datos</label>
                    <input
                      name="db_name"
                      value={form.db_name}
                      onChange={handleChange}
                      required
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                      placeholder="cliente_demo_db"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.35em] text-slate-400">Usuario DB</label>
                    <input
                      name="db_user"
                      value={form.db_user}
                      onChange={handleChange}
                      required
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                      placeholder="cliente_user"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-[0.35em] text-slate-400">Password DB</label>
                    <input
                      type="password"
                      name="db_password"
                      value={form.db_password}
                      onChange={handleChange}
                      required
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.35em] text-slate-400">Host y puerto</label>
                    <div className="mt-2 grid grid-cols-[2fr,1fr] gap-2">
                      <input
                        name="db_host"
                        value={form.db_host}
                        onChange={handleChange}
                        required
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                        placeholder="localhost"
                      />
                      <input
                        type="number"
                        name="db_port"
                        value={form.db_port}
                        onChange={handleChange}
                        min={1}
                        max={65535}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-[0.35em] text-slate-400">Moneda por defecto</label>
                    <input
                      name="default_currency"
                      value={form.default_currency}
                      onChange={handleChange}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                      placeholder="MXN"
                      maxLength={3}
                    />
                  </div>
                  <div className="flex items-end gap-3">
                    <label className="text-xs uppercase tracking-[0.35em] text-slate-400">Provisionar DB</label>
                    <input
                      type="checkbox"
                      name="create_database"
                      checked={form.create_database}
                      onChange={handleChange}
                      className="h-5 w-5 rounded border-white/30 bg-white/10 text-emerald-400"
                    />
                    <p className="text-xs text-slate-400">
                      Desactiva si la base ya existe (managed Postgres sin permisos CREATE DATABASE).
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-[0.35em] text-slate-400">Correo admin</label>
                    <input
                      type="email"
                      name="admin_email"
                      value={form.admin_email}
                      onChange={handleChange}
                      required
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                      placeholder="admin@cliente.com"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.35em] text-slate-400">Password admin</label>
                    <input
                      type="password"
                      name="admin_password"
                      value={form.admin_password}
                      onChange={handleChange}
                      required
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs uppercase tracking-[0.35em] text-slate-400">Nombre admin (opcional)</label>
                  <input
                    name="admin_name"
                    value={form.admin_name}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                    placeholder="Nombre y Apellidos"
                  />
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-100">
                  <p className="font-semibold text-amber-200">Requisitos de la base de control</p>
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
                  className="w-full rounded-2xl bg-emerald-400 px-5 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-500 disabled:text-slate-200"
                >
                  {saving ? "Aprovisionando..." : hasCapacity ? "Crear cliente" : "Límite alcanzado"}
                </button>
              </form>
            </div>
            <div className="space-y-4">
              {renderLimitCard()}
              {result && (
                <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                  <p className="text-[11px] uppercase tracking-[0.35em] text-emerald-300">Último resultado</p>
                  <p className="mt-2 text-lg font-semibold text-white">{result.name}</p>
                  <p className="text-emerald-100/80">Slug {result.slug}</p>
                  <p className="text-emerald-100/70">DB {result.db_name} @ {result.db_host}:{result.db_port}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
