"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

import { useAuthContext } from "../context/AuthContext";

type NavLink = {
  label: string;
  href: string;
  requiresStaff?: boolean;
  requiresSuperuser?: boolean;
};

const NAV_LINKS: NavLink[] = [
  { label: "Inteligencia fiscal", href: "/dashboard" },
  { label: "Generador de contratos", href: "/dashboard/contratos" },
  { label: "Validador CFDI/SPEI", href: "/dashboard/validador" },
  { label: "Operaciones", href: "/dashboard/operaciones" },
  { label: "Finanzas", href: "/dashboard/finanzas" },
  { label: "Firma y fecha cierta", href: "/dashboard/firma-logistica" },
  { label: "Razón de negocio", href: "/dashboard/razon-negocio" },
  { label: "Comparador de precios", href: "/dashboard/comparador-precios" },
  { label: "Proveedores", href: "/dashboard/proveedores" },
  { label: "Biblioteca legal", href: "/dashboard/fuentes" },
  { label: "Consulta legal", href: "/dashboard/consultas" },
  { label: "Checklist", href: "/dashboard/checklists" },
  { label: "Alertas ESG", href: "/dashboard/alertas" },
  { label: "Expedientes digitales", href: "/dashboard/expedientes" },
  { label: "Organizaciones", href: "/dashboard/admin/organizaciones", requiresSuperuser: true },
  { label: "Administración", href: "/dashboard/administracion", requiresStaff: true },
  { label: "Auditoría", href: "/dashboard/administracion/auditoria", requiresStaff: true },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuthContext();
  const pathname = usePathname();

  const roleLabel = user?.is_superuser ? "Superusuario" : user?.is_staff ? "Despacho" : "Cliente";
  const orgLabel = user?.tenant_slug
    ? `Cliente ${user.tenant_slug}`
    : user?.despacho_slug
      ? `Despacho ${user.despacho_slug}`
      : "Sin cliente asignado";

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-sky-50 via-white to-emerald-50 text-slate-900">
      <aside className="hidden flex-col border-r border-slate-100 bg-white/90 px-7 pb-10 pt-12 shadow-xl shadow-slate-200/70 backdrop-blur lg:flex lg:w-72">
        <div>
          <p className="text-[11px] uppercase tracking-[0.35em] text-sky-500">Materialidad</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Command Center</h1>
          <p className="mt-1 text-sm text-slate-500">{orgLabel}</p>
        </div>
        <nav className="mt-10 space-y-2 text-base">
          {NAV_LINKS.filter((item) => {
            if (item.requiresSuperuser && !user?.is_superuser) return false;
            if (item.requiresStaff && !user?.is_staff) return false;
            return true;
          }).map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center justify-between rounded-xl px-4 py-3 transition",
                  isActive
                    ? "bg-gradient-to-r from-sky-500 to-emerald-400 text-white shadow-lg shadow-sky-200"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <span className="font-medium">{item.label}</span>
                <span className="text-xs">→</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700 shadow-sm">
          <p className="text-[12px] uppercase tracking-[0.3em] text-sky-500">Sesión activa</p>
          <p className="mt-1 text-base font-semibold text-slate-900">{user?.full_name || user?.email}</p>
          <p className="mt-2 text-slate-600">{orgLabel}</p>
          <p className="text-[12px] uppercase tracking-[0.28em] text-emerald-600">{roleLabel}</p>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="border-b border-slate-100 bg-white/80 px-8 py-5 backdrop-blur-md shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-sky-500">Panel ejecutivo</p>
              <h2 className="text-3xl font-semibold text-slate-900">Materialidad 360°</h2>
              <p className="text-lg text-slate-600">Orquestación fiscal y ESG en un solo tablero.</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right text-base">
                <p className="font-semibold text-slate-900">{user?.full_name || user?.email}</p>
                <p className="text-slate-600">{orgLabel}</p>
                <p className="text-sm uppercase tracking-[0.28em] text-emerald-600">{roleLabel}</p>
              </div>
              <button
                onClick={logout}
                className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-6 py-10 lg:px-10">
          <div className="rounded-3xl border border-slate-100 bg-white/90 p-8 shadow-2xl shadow-slate-200/70 backdrop-blur-sm">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
