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
    <div className="flex min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <aside className="hidden flex-col border-r border-white/10 bg-gradient-to-b from-slate-900 to-slate-950 px-6 pb-8 pt-10 lg:flex lg:w-72">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-300">Materialidad</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Command Center</h1>
          <p className="mt-1 text-sm text-slate-400">{orgLabel}</p>
        </div>
        <nav className="mt-10 space-y-2 text-sm">
          {NAV_LINKS.filter((item) => !item.requiresStaff || user?.is_staff).map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center justify-between rounded-2xl px-4 py-3 transition", 
                  isActive
                    ? "bg-white/10 text-white shadow-lg shadow-emerald-500/20"
                    : "text-slate-400 hover:bg-white/5"
                )}
              >
                <span>{item.label}</span>
                <span className="text-xs">→</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-3xl border border-white/10 bg-white/5 p-4 text-xs text-slate-200">
          <p className="text-[11px] uppercase tracking-[0.35em] text-emerald-300">Sesión activa</p>
          <p className="mt-1 text-sm font-semibold text-white">{user?.full_name || user?.email}</p>
          <p className="mt-2 text-slate-400">{orgLabel}</p>
          <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-300">{roleLabel}</p>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="border-b border-white/10 bg-white/5 px-6 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-emerald-300">Panel ejecutivo</p>
              <h2 className="text-2xl font-semibold text-white">Materialidad 360°</h2>
              <p className="text-sm text-slate-300">Orquestación fiscal y ESG en un solo tablero.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right text-sm">
                <p className="font-semibold text-white">{user?.full_name || user?.email}</p>
                <p className="text-slate-400">{orgLabel}</p>
                <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-300">{roleLabel}</p>
              </div>
              <button
                onClick={logout}
                className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-emerald-300 hover:text-emerald-300"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-6 py-10">
          <div className="rounded-3xl border border-white/5 bg-white/5 p-8 shadow-2xl shadow-black/30">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
