"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { Home, Menu, X } from "lucide-react";

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
  { type: "link", label: "Contingencias CSD", href: "/dashboard/alertas-csd" },

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

/* ── Sidebar navigation (scrollable) ── */
function SidebarNav({
  user,
  orgLabel,
  pathname,
  onNavigate,
}: {
  user: any;
  orgLabel: string;
  pathname: string | null;
  onNavigate?: () => void;
}) {
  const filteredItems = NAV_ITEMS.filter((item) => {
    if (item.type === "header") return true;
    if (item.requiresSuperuser && !user?.is_superuser) return false;
    if (item.requiresStaff && !user?.is_staff) return false;
    return true;
  });

  return (
    <>
      <div>
        <p className="text-[11px] uppercase tracking-[0.35em] text-sky-500">Materialidad</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900 lg:text-2xl">Command Center</h1>
        <p className="mt-1 text-sm text-slate-500">{orgLabel}</p>
      </div>
      <nav className="mt-8 space-y-1.5 text-base lg:mt-10 lg:space-y-2">
        {filteredItems.map((item, index, items) => {
          if (item.type === "header") {
            const nextItem = items[index + 1];
            if (nextItem && nextItem.type === "header") return null;
            return (
              <p
                key={`header-${item.label}`}
                className="mt-5 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400 lg:mt-6"
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
              onClick={onNavigate}
              className={clsx(
                "flex min-h-[44px] items-center justify-between rounded-xl px-4 py-3 transition",
                isActive
                  ? "bg-gradient-to-r from-sky-500 to-emerald-400 text-white shadow-lg shadow-sky-200"
                  : "text-slate-600 hover:bg-slate-100 active:bg-slate-200"
              )}
            >
              <span className="font-medium">{item.label}</span>
              <span className="text-xs">→</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

/* ── Session info card ── */
function SidebarSessionCard({
  user,
  orgLabel,
  roleLabel,
}: {
  user: any;
  orgLabel: string;
  roleLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700 shadow-sm">
      <p className="text-[12px] uppercase tracking-[0.3em] text-sky-500">Sesión activa</p>
      <p className="mt-1 text-base font-semibold text-slate-900">{user?.full_name || user?.email}</p>
      <p className="mt-2 text-slate-600">{orgLabel}</p>
      <p className="text-[12px] uppercase tracking-[0.28em] text-emerald-600">{roleLabel}</p>
    </div>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuthContext();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  /* Close drawer on route change */
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  /* Prevent body scroll when drawer is open */
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <div className="flex min-h-[100dvh] bg-gradient-to-br from-sky-50 via-white to-emerald-50 text-slate-900">
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden flex-col border-r border-slate-100 bg-white/90 px-7 pb-10 pt-12 shadow-xl shadow-slate-200/70 backdrop-blur lg:flex lg:w-72">
        <SidebarNav user={user} orgLabel={orgLabel} pathname={pathname} />
        <div className="mt-auto">
          <SidebarSessionCard user={user} orgLabel={orgLabel} roleLabel={roleLabel} />
        </div>
      </aside>

      {/* ── Mobile Drawer Overlay ── */}
      {mounted && (
        <div
          className={clsx(
            "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 lg:pointer-events-none lg:hidden",
            drawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile Drawer ── */}
      {mounted && (
        <aside
          className={clsx(
            "fixed left-0 top-0 z-50 h-[100dvh] w-[85vw] max-w-[320px] overflow-hidden bg-white shadow-2xl transition-transform duration-300 ease-in-out lg:pointer-events-none lg:hidden",
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex h-full min-h-0 flex-col px-5 pb-8 pt-6">
            <div className="mb-4 flex shrink-0 items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-500">Menú</p>
              <button
                onClick={closeDrawer}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 active:bg-slate-200"
                aria-label="Cerrar menú"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [touch-action:pan-y] [-webkit-overflow-scrolling:touch]">
              <SidebarNav
                user={user}
                orgLabel={orgLabel}
                pathname={pathname}
                onNavigate={closeDrawer}
              />
              <div className="mt-4 space-y-3 border-t border-slate-100 pb-[max(0px,env(safe-area-inset-bottom))] pt-4">
                <SidebarSessionCard user={user} orgLabel={orgLabel} roleLabel={roleLabel} />
                <button
                  onClick={() => { closeDrawer(); logout(); }}
                  className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition active:bg-slate-700"
                >
                  Cerrar sesión
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}

      <div className="flex flex-1 flex-col">
        {/* ── Header ── */}
        <header className="border-b border-slate-100 bg-white/80 px-4 py-3 backdrop-blur-md shadow-sm sm:px-6 lg:px-8 lg:py-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => setDrawerOpen(true)}
                className={clsx(
                  "flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 active:bg-slate-200 lg:hidden",
                  !mounted && "invisible"
                )}
                aria-label="Abrir menú"
              >
                <Menu className="h-6 w-6" />
              </button>
              <Link
                href="/dashboard"
                className="flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-400 px-3 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-200/50 transition hover:-translate-y-0.5 hover:shadow-xl sm:px-4"
                title="Inicio – Inteligencia Fiscal"
              >
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">Inicio</span>
              </Link>
              <div className="hidden sm:block">
                <p className="text-xs uppercase tracking-[0.35em] text-sky-500 sm:text-sm">Panel ejecutivo</p>
                <h2 className="text-lg font-semibold text-slate-900 sm:text-xl lg:text-3xl">Materialidad 360°</h2>
                <p className="hidden text-sm text-slate-600 lg:block">Orquestación fiscal y ESG en un solo tablero.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden text-right text-sm sm:block lg:text-base">
                <p className="font-semibold text-slate-900">{user?.full_name || user?.email}</p>
                <p className="text-slate-600">{orgLabel}</p>
                <p className="text-xs uppercase tracking-[0.28em] text-emerald-600 sm:text-sm">{roleLabel}</p>
              </div>
              <button
                onClick={logout}
                className="hidden min-h-[44px] items-center rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800 lg:flex"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </header>

        {/* ── Main content ── */}
        <main className="flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-10">
          <div className="rounded-2xl border border-slate-100 bg-white/90 p-3 shadow-2xl shadow-slate-200/70 backdrop-blur-sm sm:p-6 lg:rounded-3xl lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
