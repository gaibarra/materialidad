"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardShell } from "../../../components/DashboardShell";
import { useAuthContext } from "../../../context/AuthContext";
import { alertError, alertSuccess, confirmAction } from "../../../lib/alerts";
import {
  AI_PROVIDERS,
  type AdminUser,
  type AdminUserPayload,
  type TenantAIConfigPayload,
  type TenantAIConfigResponse,
  createUser,
  deleteUser,
  fetchTenantAIConfig,
  fetchUsers,
  updateTenantAIConfig,
  updateUser,
} from "../../../lib/admin";

const DEFAULT_USER_FORM = {
  email: "",
  full_name: "",
  is_active: true,
  is_staff: false,
  password: "",
};

type AdminTab = "usuarios" | "ia";

type AiFormState = TenantAIConfigPayload & { api_key: string };

export default function AdminPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthContext();

  const [activeTab, setActiveTab] = useState<AdminTab>("usuarios");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userForm, setUserForm] = useState(DEFAULT_USER_FORM);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [userSaving, setUserSaving] = useState(false);

  const [aiConfig, setAiConfig] = useState<TenantAIConfigResponse | null>(null);
  const [aiForm, setAiForm] = useState<AiFormState>({ provider: "openai", api_key: "" });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (user && !user.is_staff) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, user, router]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const payload = await fetchUsers();
      setUsers(Array.isArray(payload) ? payload : []);
    } catch (error) {
      void alertError("No pudimos cargar los usuarios", (error as Error).message);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const loadAiConfig = useCallback(async () => {
    setAiLoading(true);
    try {
      const payload = await fetchTenantAIConfig();
      setAiConfig(payload);
      setAiForm((current) => ({ ...current, provider: payload.provider }));
    } catch (error) {
      void alertError("No pudimos cargar la configuración de IA", (error as Error).message);
    } finally {
      setAiLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user?.is_staff) {
      return;
    }
    void loadUsers();
    void loadAiConfig();
  }, [isAuthenticated, user?.is_staff, loadAiConfig, loadUsers]);

  const userStats = useMemo(() => {
    const total = users.length;
    const active = users.filter((item) => item.is_active).length;
    const staff = users.filter((item) => item.is_staff).length;
    return { total, active, inactive: total - active, staff };
  }, [users]);

  const handleUserInput = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = event.target;
    setUserForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleEditUser = (entry: AdminUser) => {
    setEditingUserId(entry.id);
    setUserForm({
      email: entry.email,
      full_name: entry.full_name ?? "",
      is_active: entry.is_active,
      is_staff: entry.is_staff,
      password: "",
    });
    setActiveTab("usuarios");
  };

  const resetUserForm = useCallback(() => {
    setEditingUserId(null);
    setUserForm(DEFAULT_USER_FORM);
  }, []);

  useEffect(() => {
    if (isAuthenticated && user?.is_staff) {
      resetUserForm();
    }
  }, [isAuthenticated, user?.is_staff, resetUserForm]);

  const handleDeleteUser = async (entry: AdminUser) => {
    const confirmation = await confirmAction({
      title: `¿Eliminar a ${entry.full_name || entry.email}?`,
      text: "Esta cuenta perderá acceso al cliente",
      confirmButtonText: "Sí, eliminar",
      icon: "warning",
    });
    if (!confirmation.isConfirmed) {
      return;
    }
    try {
      await deleteUser(entry.id);
      await alertSuccess("Usuario eliminado", "Se retiró el acceso correctamente");
      if (editingUserId === entry.id) {
        resetUserForm();
      }
      await loadUsers();
    } catch (error) {
      void alertError("No pudimos eliminar al usuario", (error as Error).message);
    }
  };

  const handleUserSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUserSaving(true);
    try {
      const basePayload: AdminUserPayload = {
        email: userForm.email.trim(),
        full_name: userForm.full_name.trim() || null,
        is_active: userForm.is_active,
        is_staff: userForm.is_staff,
      };
      const password = userForm.password.trim();

      if (!editingUserId && password.length < 8) {
        setUserSaving(false);
        await alertError("Contraseña requerida", "Define una clave de al menos 8 caracteres");
        return;
      }

      const requestPayload: AdminUserPayload = password
        ? { ...basePayload, password }
        : basePayload;

      if (editingUserId) {
        await updateUser(editingUserId, requestPayload);
        await alertSuccess("Perfil actualizado", "Los permisos se sincronizaron");
      } else {
        await createUser(requestPayload);
        await alertSuccess("Usuario creado", "Comparte las credenciales manualmente");
      }
      resetUserForm();
      await loadUsers();
    } catch (error) {
      void alertError("No pudimos guardar el usuario", (error as Error).message);
    } finally {
      setUserSaving(false);
    }
  };

  const handleAiInput = (event: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = event.target;
    setAiForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAiSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAiSaving(true);
    try {
      const payload: TenantAIConfigPayload = {
        provider: aiForm.provider,
      };
      if (aiForm.api_key.trim()) {
        payload.api_key = aiForm.api_key.trim();
      }
      const response = await updateTenantAIConfig(payload);
      setAiConfig(response);
      setAiForm((prev) => ({ ...prev, api_key: "" }));
      await alertSuccess("Configuración guardada", "El proveedor quedó listo para usarse");
    } catch (error) {
      void alertError("No pudimos guardar la configuración", (error as Error).message);
    } finally {
      setAiSaving(false);
    }
  };

  const lastUpdate = useMemo(() => {
    if (!aiConfig?.updated_at) return null;
    const date = new Date(aiConfig.updated_at);
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }, [aiConfig?.updated_at]);

  const tabButtonClasses = (tab: AdminTab) =>
    `flex-1 rounded-2xl px-6 py-3 text-center text-sm font-semibold transition ${
      activeTab === tab
        ? "bg-white text-slate-900 shadow-lg shadow-emerald-500/30"
        : "border border-white/20 text-white hover:border-emerald-300/60"
    }`;

  const renderUserList = () => (
    <div className="space-y-6 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-slate-900/20 p-6 shadow-2xl shadow-black/30">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Cuentas activas</p>
          <h3 className="text-xl font-semibold text-white">{userStats.total} usuarios en el cliente</h3>
        </div>
        <button
          type="button"
          onClick={() => void loadUsers()}
          className="rounded-full border border-white/30 px-4 py-2 text-xs font-semibold text-white transition hover:border-emerald-300"
        >
          Refrescar
        </button>
      </div>
      {usersLoading ? (
        <p className="text-sm text-slate-400">Recuperando directorio...</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-slate-400">Aún no hay usuarios registrados para este cliente.</p>
      ) : (
        <div className="divide-y divide-white/5">
          {users.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-wrap items-center gap-4 py-4 text-sm text-slate-200"
            >
              <div className="min-w-[16rem]">
                <p className="font-semibold text-white">{entry.full_name || "Sin nombre"}</p>
                <p className="text-slate-400">{entry.email}</p>
              </div>
              <div className="flex flex-1 flex-wrap items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${entry.is_active ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-500/20 text-slate-300"}`}>
                  {entry.is_active ? "Activo" : "Inactivo"}
                </span>
                {entry.is_staff && (
                  <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-200">
                    Admin
                  </span>
                )}
              </div>
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => handleEditUser(entry)}
                  className="rounded-full border border-white/30 px-4 py-2 text-xs font-semibold text-white transition hover:border-emerald-300"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteUser(entry)}
                  className="rounded-full border border-flame-400/40 px-4 py-2 text-xs font-semibold text-flame-100 transition hover:border-flame-300 hover:text-white"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderUserForm = () => (
    <form
      onSubmit={handleUserSubmit}
      autoComplete="off"
      className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-inner shadow-black/20"
    >
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-emerald-300">Nuevo acceso</p>
        <h3 className="mt-2 text-xl font-semibold text-white">
          {editingUserId ? "Editar usuario" : "Invitar usuario"}
        </h3>
      </div>
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="text-slate-300">Correo corporativo</span>
          <input
            type="email"
            name="email"
            value={userForm.email}
            onChange={handleUserInput}
            required
            autoComplete="off"
            className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-950/50 px-4 py-2 text-white focus:border-emerald-300 focus:outline-none"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-300">Nombre completo</span>
          <input
            type="text"
            name="full_name"
            value={userForm.full_name}
            onChange={handleUserInput}
            autoComplete="off"
            className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-950/50 px-4 py-2 text-white focus:border-emerald-300 focus:outline-none"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-300">Contraseña temporal</span>
          <input
            type="password"
            name="password"
            value={userForm.password}
            onChange={handleUserInput}
            placeholder={editingUserId ? "Déjalo en blanco para conservar" : "Define al menos 8 caracteres"}
            autoComplete="new-password"
            className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-950/50 px-4 py-2 text-white focus:border-emerald-300 focus:outline-none"
            minLength={editingUserId ? undefined : 8}
          />
        </label>
        <div className="flex flex-col gap-3 text-sm text-slate-200">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="is_active"
              checked={userForm.is_active}
              onChange={handleUserInput}
              className="h-4 w-4 rounded border-white/30 bg-transparent"
            />
            Activo en el cliente
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="is_staff"
              checked={userForm.is_staff}
              onChange={handleUserInput}
              className="h-4 w-4 rounded border-white/30 bg-transparent"
            />
            Acceso de administración
          </label>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={userSaving}
          className="flex-1 rounded-full bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {userSaving ? "Guardando..." : editingUserId ? "Actualizar" : "Crear usuario"}
        </button>
        {editingUserId && (
          <button
            type="button"
            onClick={resetUserForm}
            className="rounded-full border border-white/30 px-4 py-2 text-sm font-semibold text-white transition hover:border-emerald-300"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );

  const renderAiConfig = () => (
    <form
      onSubmit={handleAiSubmit}
      className="space-y-6 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 p-6 shadow-2xl shadow-black/30"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Proveedor IA</p>
          <h3 className="text-xl font-semibold text-white">Orquestación de modelos</h3>
          {lastUpdate && <p className="text-sm text-slate-400">Última actualización: {lastUpdate}</p>}
        </div>
        <span className={`rounded-full px-4 py-1 text-xs font-semibold ${aiConfig?.api_key_set ? "bg-emerald-500/20 text-emerald-200" : "bg-amber-500/20 text-amber-100"}`}>
          {aiConfig?.api_key_set ? "API Key almacenada" : "Falta API Key"}
        </span>
      </div>
      {aiLoading ? (
        <p className="text-sm text-slate-400">Sincronizando configuración...</p>
      ) : (
        <>
          <label className="block text-sm">
            <span className="text-slate-300">Selecciona el proveedor</span>
            <select
              name="provider"
              value={aiForm.provider}
              onChange={handleAiInput}
              className="mt-2 w-full rounded-2xl border border-white/20 bg-slate-950/50 px-4 py-2 text-white focus:border-emerald-300 focus:outline-none"
            >
              {AI_PROVIDERS.map((provider) => (
                <option key={provider.value} value={provider.value} className="bg-slate-900 text-white">
                  {provider.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            {AI_PROVIDERS.map((provider) => (
              <div
                key={provider.value}
                className={`rounded-2xl border p-4 text-sm transition ${
                  provider.value === aiForm.provider
                    ? "border-emerald-300/60 bg-emerald-500/5"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <p className="text-sm font-semibold text-white">{provider.label}</p>
                <p className="mt-1 text-slate-400">{provider.description}</p>
              </div>
            ))}
          </div>
          <label className="block text-sm">
            <span className="text-slate-300">API Key (opcional si no quieres cambiarla)</span>
            <input
              type="password"
              name="api_key"
              value={aiForm.api_key}
              onChange={handleAiInput}
              placeholder={aiConfig?.api_key_set ? "Mantendremos la clave actual" : "Pega tu token secreto"}
              className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-950/50 px-4 py-2 text-white focus:border-emerald-300 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={aiSaving}
            className="w-full rounded-full bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {aiSaving ? "Guardando..." : "Guardar configuración"}
          </button>
        </>
      )}
    </form>
  );

  return (
    <DashboardShell>
      <div className="space-y-8">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-r from-slate-900/80 via-slate-900/40 to-emerald-900/20 p-6 shadow-2xl shadow-emerald-500/20">
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-300">Centro de control</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Administración del cliente</h1>
          <p className="mt-2 text-sm text-slate-300">
            Gestiona accesos de usuarios y define qué proveedor de IA impulsa las automatizaciones legales.
          </p>
          <div className="mt-4 grid gap-4 text-sm text-white sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-300">Usuarios activos</p>
              <p className="mt-2 text-2xl font-semibold">{userStats.active}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-300">Administradores</p>
              <p className="mt-2 text-2xl font-semibold">{userStats.staff}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-300">Usuarios inactivos</p>
              <p className="mt-2 text-2xl font-semibold">{userStats.inactive}</p>
            </div>
          </div>
        </header>

        <div className="flex flex-wrap gap-3 rounded-3xl border border-white/10 bg-white/5 p-2 text-sm text-white">
          <button type="button" className={tabButtonClasses("usuarios")} onClick={() => setActiveTab("usuarios")}>
            Usuarios
          </button>
          <button type="button" className={tabButtonClasses("ia")} onClick={() => setActiveTab("ia")}>
            Configuración del Proveedor IA
          </button>
        </div>

        {activeTab === "usuarios" ? (
          <div className="grid gap-6 lg:grid-cols-[1.5fr,1fr]">
            {renderUserList()}
            {renderUserForm()}
          </div>
        ) : (
          renderAiConfig()
        )}
      </div>
    </DashboardShell>
  );
}
