"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { Home } from "lucide-react";

import { useAuthContext } from "../context/AuthContext";

type NavLink = {
  label: string;
  href: string;
  requiresStaff?: boolean;
  requiresSuperuser?: boolean;
};

type NavItem =
  | { type: "header"; label: string }
  | ({ type: "link" } & NavLink);

const NAV_ITEMS: NavItem[] = [
  { type: "header", label: "Inicio" },
  { type: "link", label: "Inteligencia fiscal", href: "/dashboard" },

  { type: "header", label: "Base operativa" },
  { type: "link", label: "Empresas", href: "/dashboard/empresas" },
  { type: "link", label: "Proveedores", href: "/dashboard/proveedores" },

  { type: "header", label: "Contratación" },
  { type: "link", label: "Generador de contratos", href: "/dashboard/contratos" },
  { type: "link", label: "Firma y fecha cierta", href: "/dashboard/firma-logistica" },
  { type: "link", label: "Razón de negocio", href: "/dashboard/razon-negocio" },

  { type: "header", label: "Ejecución" },
  { type: "link", label: "Operaciones", href: "/dashboard/operaciones" },

  { type: "header", label: "Fiscal y financiero" },
  { type: "link", label: "Validador CFDI/SPEI", href: "/dashboard/validador" },
  { type: "link", label: "Finanzas", href: "/dashboard/finanzas" },
  { type: "link", label: "Comparador de precios", href: "/dashboard/comparador-precios" },

  { type: "header", label: "Evidencia y cumplimiento" },
  { type: "link", label: "Expedientes digitales", href: "/dashboard/expedientes" },
  { type: "link", label: "Checklist", href: "/dashboard/checklists" },
  { type: "link", label: "Alertas ESG", href: "/dashboard/alertas" },

  { type: "header", label: "Legal e IA" },
  { type: "link", label: "Consulta legal", href: "/dashboard/consultas" },

  { type: "header", label: "Administración" },
  {
    type: "link",
    label: "Organizaciones",
    href: "/dashboard/admin/organizaciones",
    requiresSuperuser: true,
  },
  { type: "link", label: "Administración", href: "/dashboard/administracion", requiresStaff: true },
  { type: "link", label: "Auditoría", href: "/dashboard/administracion/auditoria", requiresStaff: true },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuthContext();
  const pathname = usePathname();

  const isCorporativo = user?.despacho_tipo === "corporativo";
  const roleLabel = user?.is_superuser
    ? "Superusuario"
    : user?.is_staff
      ? isCorporativo
        ? "Administrador"
        : "Despacho"
      : "Cliente";
  const orgLabel = user?.tenant_slug
    ? `${isCorporativo ? "Empresa" : "Cliente"} ${user.tenant_slug}`
    : user?.despacho_slug
      ? `${isCorporativo ? "Corporativo" : "Despacho"} ${user.despacho_slug}`
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
          {NAV_ITEMS.filter((item) => {
            if (item.type === "header") return true;
            if (item.requiresSuperuser && !user?.is_superuser) return false;
            if (item.requiresStaff && !user?.is_staff) return false;
            return true;
          }).map((item, index, items) => {
            if (item.type === "header") {
              const nextItem = items[index + 1];
              if (nextItem && nextItem.type === "header") return null;
              return (
                <p
                  key={`header-${item.label}`}
                  className="mt-6 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400"
                >
                  {item.label}
                </p>
              );
            }
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
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-400 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-200/50 transition hover:-translate-y-0.5 hover:shadow-xl"
                title="Inicio – Inteligencia Fiscal"
              >
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">Inicio</span>
              </Link>
              <div>
                <p className="text-sm uppercase tracking-[0.35em] text-sky-500">Panel ejecutivo</p>
                <h2 className="text-3xl font-semibold text-slate-900">Materialidad 360°</h2>
                <p className="text-lg text-slate-600">Orquestación fiscal y ESG en un solo tablero.</p>
              </div>
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
