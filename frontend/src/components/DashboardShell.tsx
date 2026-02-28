"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  FileEdit,
  FileText,
  FolderOpenDot,
  Gavel,
  Hexagon,
  Home,
  LogOut,
  Menu,
  Scale,
  Settings,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  Users,
  X,
  Zap
} from "lucide-react";

import { useAuthContext } from "../context/AuthContext";

type NavLink = {
  label: string;
  href: string;
  icon: ReactNode;
  requiresStaff?: boolean;
  requiresSuperuser?: boolean;
};

type NavCategory = {
  type: "category";
  label: string;
  icon?: ReactNode;
  items: (NavLink | ({ type: "featured" } & NavLink & { badge?: string; description?: string }))[];
};

type NavItem =
  | NavCategory
  | { type: "divider" }
  | ({ type: "link" } & NavLink)
  | ({ type: "featured" } & NavLink & { badge?: string; description?: string });

const NAV_ITEMS: NavItem[] = [
  {
    type: "category",
    label: "Inicio",
    icon: <Home className="h-4 w-4" />,
    items: [
      { label: "Inteligencia fiscal", href: "/dashboard", icon: <BarChart3 className="h-4 w-4" /> },
    ],
  },
  { type: "divider" },
  {
    type: "category",
    label: "Base operativa",
    icon: <Building2 className="h-4 w-4" />,
    items: [
      { label: "Empresas", href: "/dashboard/empresas", icon: <Building2 className="h-4 w-4" /> },
      { label: "Proveedores", href: "/dashboard/proveedores", icon: <Users className="h-4 w-4" /> },
    ],
  },
  { type: "divider" },
  {
    type: "category",
    label: "Contratación",
    icon: <FileEdit className="h-4 w-4" />,
    items: [
      { label: "Generador de contratos", href: "/dashboard/contratos", icon: <FileEdit className="h-4 w-4" /> },
      { label: "Firma y fecha cierta", href: "/dashboard/firma-logistica", icon: <FileText className="h-4 w-4" /> },
      { label: "Razón de negocio", href: "/dashboard/razon-negocio", icon: <TrendingDown className="h-4 w-4" /> },
    ],
  },
  { type: "divider" },
  {
    type: "category",
    label: "Ejecución",
    icon: <Activity className="h-4 w-4" />,
    items: [
      {
        type: "featured",
        label: "Operaciones",
        href: "/dashboard/operaciones",
        icon: <Activity className="h-5 w-5 animate-pulse text-emerald-400" />,
        badge: "CORE",
        description: "Trazabilidad · Entregables · SAT",
      },
      { label: "Expedientes digitales", href: "/dashboard/expedientes", icon: <FolderOpenDot className="h-4 w-4" /> },
    ],
  },
  { type: "divider" },
  {
    type: "category",
    label: "Fiscal y financiero",
    icon: <ShieldCheck className="h-4 w-4" />,
    items: [
      { label: "Validador CFDI/SPEI", href: "/dashboard/validador", icon: <ShieldCheck className="h-4 w-4" /> },
      { label: "Finanzas", href: "/dashboard/finanzas", icon: <BarChart3 className="h-4 w-4" /> },
      { label: "Comparador de precios", href: "/dashboard/comparador-precios", icon: <Scale className="h-4 w-4" /> },
    ],
  },
  { type: "divider" },
  {
    type: "category",
    label: "Cumplimiento y Legal",
    icon: <Gavel className="h-4 w-4" />,
    items: [
      { label: "Checklist", href: "/dashboard/checklists", icon: <CheckSquare className="h-4 w-4" /> },
      { label: "Alertas ESG", href: "/dashboard/alertas", icon: <AlertTriangle className="h-4 w-4" /> },
      { label: "Contingencias CSD", href: "/dashboard/alertas-csd", icon: <ShieldAlert className="h-4 w-4" /> },
      { label: "Consulta legal", href: "/dashboard/consultas", icon: <Gavel className="h-4 w-4" /> },
    ],
  },
  { type: "divider" },
  {
    type: "category",
    label: "Administración",
    icon: <Settings className="h-4 w-4" />,
    items: [
      {
        label: "Organizaciones",
        href: "/dashboard/admin/organizaciones",
        icon: <Building2 className="h-4 w-4" />,
        requiresSuperuser: true,
      },
      { label: "Administración", href: "/dashboard/administracion", icon: <Settings className="h-4 w-4" />, requiresStaff: true },
      { label: "Auditoría", href: "/dashboard/administracion/auditoria", icon: <Zap className="h-4 w-4" />, requiresStaff: true },
    ],
  },
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
  const activeItemRef = useRef<HTMLAnchorElement>(null);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});

  // Auto-expandir la categoría inicial según la ruta
  useEffect(() => {
    if (!pathname) return;

    setExpandedCats((prev) => {
      const newExpanded = { ...prev };
      let changed = false;

      NAV_ITEMS.forEach((item) => {
        if (item.type === "category") {
          const hasActiveChild = item.items.some((child) =>
            pathname === child.href || (child.href !== "/dashboard" && pathname?.startsWith(child.href))
          );
          // Solo la abrimos automáticamente la primera vez si no estaba registrada
          if (hasActiveChild && prev[item.label] === undefined) {
            newExpanded[item.label] = true;
            changed = true;
          }
        }
      });

      return changed ? newExpanded : prev;
    });
  }, [pathname]);

  const toggleCategory = (label: string) => {
    setExpandedCats((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  useEffect(() => {
    if (activeItemRef.current) {
      // Usar su contenedor local (`nav`) en lugar del documento general 
      // para evitar que la página entera baje.
      const el = activeItemRef.current;
      const navContainer = el.closest('nav');
      const overflowContainer = navContainer?.parentElement; // Es el div con overflow-y-auto general

      if (overflowContainer) {
        // Cálculo del centro del elemento respecto a la altura completa del sidebar visible.
        const centerPos =
          el.offsetTop - overflowContainer.clientHeight / 2 + el.clientHeight / 2;

        overflowContainer.scrollTo({
          top: centerPos > 0 ? centerPos : 0,
          behavior: "smooth",
        });
      }
    }
  }, [pathname]);

  const checkAccess = (item: NavLink | any) => {
    if (item.requiresSuperuser && !user?.is_superuser) return false;
    if (item.requiresStaff && !user?.is_staff) return false;
    return true;
  };

  return (
    <>
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg shadow-emerald-500/20">
          <Hexagon className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white">Command Center</h1>
          <p className="text-xs font-medium text-slate-400">{orgLabel}</p>
        </div>
      </div>

      <nav className="space-y-1">
        {NAV_ITEMS.map((item, index) => {
          if (item.type === "divider") {
            return <hr key={`divider-${index}`} className="my-3 border-white/5" />;
          }

          if (item.type === "category") {
            // Filtrar hijos según roles
            const validChildren = item.items.filter(checkAccess);
            if (validChildren.length === 0) return null;

            const isExpanded = !!expandedCats[item.label];
            const hasActiveChild = validChildren.some((child) =>
              pathname === child.href || (child.href !== "/dashboard" && pathname?.startsWith(child.href))
            );

            return (
              <div key={item.label} className="flex flex-col">
                <button
                  onClick={() => toggleCategory(item.label)}
                  className={clsx(
                    "group flex w-full items-center justify-between rounded-lg px-2 py-2 transition-all duration-200",
                    hasActiveChild && !isExpanded ? "text-emerald-400" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className={clsx("transition-transform", hasActiveChild && !isExpanded ? "text-emerald-400" : "text-slate-500 group-hover:text-slate-300")}>
                      {item.icon}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider">{item.label}</span>
                  </div>
                  <ChevronDown
                    className={clsx(
                      "h-4 w-4 transition-transform duration-300",
                      !isExpanded && "-rotate-90"
                    )}
                  />
                </button>

                <div
                  className={clsx(
                    "grid transition-all duration-300 ease-in-out",
                    isExpanded ? "grid-rows-[1fr] opacity-100 mt-1" : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <div className="overflow-hidden space-y-0.5">
                    {validChildren.map((child: any) => {
                      const isActive = pathname === child.href || (child.href !== "/dashboard" && pathname?.startsWith(child.href));

                      if (child.type === "featured") {
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={onNavigate}
                            className={clsx(
                              "group relative ml-[18px] my-2 flex flex-col rounded-xl border px-3 py-3 transition-all duration-300",
                              isActive
                                ? "border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                                : "border-white/5 bg-white/[0.02] hover:border-emerald-500/30 hover:bg-emerald-500/5"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={clsx(
                                  "flex h-7 w-7 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110",
                                  isActive ? "bg-emerald-500/20" : "bg-white/5"
                                )}>
                                  {child.icon}
                                </div>
                                <span className={clsx(
                                  "text-sm font-semibold tracking-tight",
                                  isActive ? "text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-teal-200" : "text-slate-200 group-hover:text-white"
                                )}>
                                  {child.label}
                                </span>
                              </div>
                            </div>
                            {child.description && (
                              <p className="mt-2 text-[10px] font-medium leading-snug text-slate-400 pl-9">
                                {child.description}
                              </p>
                            )}
                          </Link>
                        );
                      }

                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={onNavigate}
                          className={clsx(
                            "group flex min-h-[36px] items-center justify-between rounded-lg pl-9 pr-3 py-1.5 transition-all duration-200",
                            isActive
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className={clsx(
                              isActive ? "text-emerald-400" : "text-slate-600 group-hover:text-slate-400"
                            )}>
                              {child.icon}
                            </span>
                            <span className="text-sm font-medium">{child.label}</span>
                          </div>

                          {isActive && (
                            <div className="w-1 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          }

          return null;
        })}
      </nav>
    </>
  );
}

/* ── Session info card ── */
function SidebarSessionCard({
  user,
  roleLabel,
  onLogout,
}: {
  user: any;
  roleLabel: string;
  onLogout: () => void;
}) {
  const initials = user?.full_name
    ? user.full_name.split(" ").slice(0, 2).map((n: string) => n[0]).join("")
    : user?.email?.substring(0, 2).toUpperCase() || "US";

  return (
    <div className="group relative flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 outline-none transition-all hover:border-white/20 hover:bg-white/10">
      <div className="flex items-center gap-3 truncate">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 text-xs font-bold text-white shadow-inner">
          {initials}
        </div>
        <div className="truncate text-left">
          <p className="truncate text-sm font-semibold text-slate-200">
            {user?.full_name || user?.email}
          </p>
          <p className="truncate text-xs font-medium text-emerald-400/90 tracking-wide">
            {roleLabel}
          </p>
        </div>
      </div>

      <button
        onClick={onLogout}
        className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-500/20 hover:text-red-400"
        title="Cerrar sesión"
      >
        <LogOut className="h-4 w-4" />
      </button>
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
    <div className="flex min-h-[100dvh] bg-slate-50 text-slate-900">
      {/* ── Desktop Sidebar (Dark Glass) ── */}
      <aside className="hidden flex-col border-r border-white/10 bg-[#0B1120] relative lg:flex lg:w-[280px]">
        {/* Subtle glow effect behind sidebar */}
        <div className="absolute inset-0 bg-gradient-to-b from-sky-900/10 via-transparent to-emerald-900/10 pointer-events-none" />

        <div className="flex-1 overflow-y-auto px-5 py-8 custom-scrollbar relative z-10">
          <SidebarNav user={user} orgLabel={orgLabel} pathname={pathname} />
        </div>

        <div className="border-t border-white/5 bg-[#0B1120]/80 backdrop-blur-md p-4 relative z-10">
          <SidebarSessionCard user={user} roleLabel={roleLabel} onLogout={logout} />
        </div>
      </aside>

      {/* ── Mobile Drawer Overlay ── */}
      {mounted && (
        <div
          className={clsx(
            "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:pointer-events-none lg:hidden",
            drawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile Drawer (Dark Glass) ── */}
      {mounted && (
        <aside
          className={clsx(
            "fixed left-0 top-0 z-50 h-[100dvh] w-[85vw] max-w-[320px] overflow-hidden bg-[#0B1120] border-r border-white/10 shadow-2xl transition-transform duration-300 ease-in-out lg:pointer-events-none lg:hidden",
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-sky-900/10 via-transparent to-emerald-900/10 pointer-events-none" />

          <div className="flex h-full min-h-0 flex-col relative z-10">
            <div className="flex shrink-0 items-center justify-between p-5 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Hexagon className="h-5 w-5 text-emerald-400" />
                <span className="text-sm font-semibold tracking-wider text-white">MENÚ</span>
              </div>
              <button
                onClick={closeDrawer}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-6">
              <SidebarNav
                user={user}
                orgLabel={orgLabel}
                pathname={pathname}
                onNavigate={closeDrawer}
              />
            </div>

            <div className="border-t border-white/5 bg-[#0B1120]/80 backdrop-blur-md p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <SidebarSessionCard user={user} roleLabel={roleLabel} onLogout={() => { closeDrawer(); logout(); }} />
            </div>
          </div>
        </aside>
      )}

      <div className="flex flex-1 flex-col overflow-hidden bg-[#FAFAFA] relative">
        {/* Decorative Background Elements */}
        <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-slate-200/50 to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-400/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -top-40 right-40 w-[300px] h-[300px] bg-sky-400/10 rounded-full blur-[80px] pointer-events-none" />

        {/* ── Header ── */}
        <header className="relative z-20 border-b border-white/40 bg-white/60 px-4 py-3 shadow-[0_4px_30px_rgba(0,0,0,0.02)] backdrop-blur-xl sm:px-6 lg:px-8 lg:py-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                onClick={() => setDrawerOpen(true)}
                className={clsx(
                  "flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200/60 bg-white/50 text-slate-600 shadow-sm backdrop-blur-md transition-all hover:bg-white active:scale-95 lg:hidden",
                  !mounted && "invisible"
                )}
                aria-label="Abrir menú"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="hidden sm:block">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-600 sm:text-[11px]">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                  </span>
                  Sistema Central
                </p>
                <h2 className="mt-0.5 text-lg font-extrabold tracking-tight text-slate-800 sm:text-xl lg:text-[22px]">
                  Materialidad <span className="text-emerald-500">360°</span>
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden text-right sm:block">
                <p className="text-[13px] font-bold text-slate-800">{user?.full_name || user?.email}</p>
                <p className="text-[11px] font-medium text-slate-500">{orgLabel}</p>
              </div>
              <button
                onClick={logout}
                className="group relative hidden h-9 items-center justify-center gap-2 overflow-hidden rounded-lg bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/60 transition-all hover:bg-slate-50 hover:text-red-500 hover:ring-red-200 hover:shadow-md lg:flex"
              >
                <span className="relative z-10">Cerrar sesión</span>
                <LogOut className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                <div className="absolute inset-0 -z-10 bg-gradient-to-r from-red-500/0 via-red-500/5 to-red-500/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </button>
            </div>
          </div>
        </header>

        {/* ── Main content ── */}
        <main className="relative z-10 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
