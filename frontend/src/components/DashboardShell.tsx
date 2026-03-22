"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import CommandPalette, { useCommandPalette } from "./CommandPalette";
import { TenantFirstStepsCard } from "./TenantFirstStepsCard";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
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
  Landmark,
  LogOut,
  Mail,
  Menu,
  Scale,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  Users,
  X,
  Zap
} from "lucide-react";

import { useAuthContext } from "../context/AuthContext";
import { getAlertasCSD } from "../lib/alerta-csd";
import { fetchEmpresas } from "../lib/providers";
import { getUserVariant, type UserVariant } from "../hooks/useUserVariant";

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

/* ── Primary: always-visible quick-access links (no category wrapper) ── */
const PRIMARY_LINKS: (NavLink & { type?: "featured"; badge?: string; description?: string })[] = [
  { label: "Centro de Operaciones", href: "/dashboard", icon: <BarChart3 className="h-4 w-4" /> },
  {
    type: "featured",
    label: "Operaciones",
    href: "/dashboard/operaciones",
    icon: <Activity className="h-5 w-5 text-blue-400" />,
    badge: "CORE",
    description: "Origen operativo que alimenta la lectura institucional",
  },
  {
    type: "featured",
    label: "Expedientes digitales",
    href: "/dashboard/expedientes",
    icon: <FolderOpenDot className="h-5 w-5 text-indigo-400" />,
    badge: "OUTPUT",
    description: "Soporte probatorio que sostiene el FDI",
  },
  {
    type: "featured",
    label: "Materialidad de auditoría",
    href: "/dashboard/materialidad-auditoria",
    icon: <Scale className="h-5 w-5 text-amber-400" />,
    badge: "AUDIT",
    description: "Criterio NIA 320/450, cálculo MG/MET y expediente preliminar por ejercicio",
  },
  {
    type: "featured",
    label: "Historial FDI",
    href: "/dashboard/fdi-history",
    icon: <Hexagon className="h-5 w-5 text-emerald-400" />,
    badge: "TREND",
    description: "Serie histórica del índice y quiebres por periodo, empresa y nivel",
  },
];

/* ── Secondary: collapsible category groups ── */
const NAV_ITEMS: NavItem[] = [
  {
    type: "category",
    label: "Actores",
    icon: <Building2 className="h-4 w-4" />,
    items: [
      { label: "Empresas", href: "/dashboard/empresas", icon: <Building2 className="h-4 w-4" /> },
      { label: "Proveedores", href: "/dashboard/proveedores", icon: <Users className="h-4 w-4" /> },
    ],
  },
  { type: "divider" },
  {
    type: "category",
    label: "Soporte del FDI",
    icon: <FileEdit className="h-4 w-4" />,
    items: [
      { label: "Generador de contratos", href: "/dashboard/contratos", icon: <FileEdit className="h-4 w-4" /> },
      { label: "Firma y fecha cierta", href: "/dashboard/firma-logistica", icon: <FileText className="h-4 w-4" /> },
      { label: "Entregables (Checklist)", href: "/dashboard/checklists", icon: <CheckSquare className="h-4 w-4" /> },
      { label: "Validador CFDI/SPEI", href: "/dashboard/validador", icon: <ShieldCheck className="h-4 w-4" /> },
    ],
  },
  { type: "divider" },
  {
    type: "category",
    label: "Señales del FDI",
    icon: <Scale className="h-4 w-4" />,
    items: [
      { label: "Razón de negocio", href: "/dashboard/razon-negocio", icon: <TrendingDown className="h-4 w-4" /> },
      { label: "Comparador de precios", href: "/dashboard/comparador-precios", icon: <Scale className="h-4 w-4" /> },
      { label: "Finanzas", href: "/dashboard/finanzas", icon: <BarChart3 className="h-4 w-4" /> },
    ],
  },
  { type: "divider" },
  {
    type: "category",
    label: "Exposición y control",
    icon: <ShieldAlert className="h-4 w-4" />,
    items: [
      { label: "Contingencias CSD", href: "/dashboard/alertas-csd", icon: <ShieldAlert className="h-4 w-4" /> },
      { label: "Alertas ESG", href: "/dashboard/alertas", icon: <AlertTriangle className="h-4 w-4" /> },
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
        requiresStaff: true,
      },
      {
        label: "Monitoreo tenants",
        href: "/dashboard/administracion/monitoreo-tenants",
        icon: <BarChart3 className="h-4 w-4" />,
        requiresSuperuser: true,
      },
      { label: "Administración", href: "/dashboard/administracion", icon: <Settings className="h-4 w-4" />, requiresStaff: true },
      { label: "Auditoría", href: "/dashboard/administracion/auditoria", icon: <Zap className="h-4 w-4" />, requiresStaff: true },
    ],
  },
  { type: "divider" },
  { type: "link", label: "Contacto", href: "/dashboard/contacto", icon: <Mail className="h-4 w-4" /> },
];

/* ── Sidebar navigation (scrollable) ── */
function SidebarNav({
  user,
  orgLabel,
  pathname,
  onNavigate,
  csdAlertCount = 0,
  variant = "corporativo",
}: {
  user: any;
  orgLabel: string;
  pathname: string | null;
  onNavigate?: () => void;
  csdAlertCount?: number;
  variant?: UserVariant;
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
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[rgba(143,240,224,0.28)] bg-[linear-gradient(180deg,rgba(142,231,218,0.22),rgba(255,255,255,0.05))] shadow-lg shadow-[rgba(3,31,28,0.22)]">
          <Landmark className="h-5 w-5 text-[var(--fiscal-gold)]" />
        </div>
        <div>
          <p className="eyebrow-shell">Centro FDI institucional</p>
          <h1 className="font-display text-[1.3rem] font-semibold tracking-tight text-white">Materialidad</h1>
          <p className="text-xs font-medium text-[rgba(219,255,249,0.74)]">{orgLabel}</p>
        </div>
      </div>

      {/* ── Primary Quick-Access Links ── */}
      <div className="mb-2 space-y-1">
        {PRIMARY_LINKS.map((link) => {
          const isActive = pathname === link.href || (link.href !== "/dashboard" && pathname?.startsWith(link.href));
          if ((link as any).type === "featured") {
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onNavigate}
                className={clsx(
                  "group relative flex flex-col rounded-xl border px-3 py-2.5 transition-all duration-300",
                  isActive
                    ? "border-[rgba(143,240,224,0.34)] bg-[rgba(142,231,218,0.12)] shadow-[0_0_18px_rgba(120,229,210,0.14)]"
                    : "border-white/5 bg-white/[0.02] hover:border-[rgba(143,240,224,0.22)] hover:bg-white/[0.04]"
                )}
              >
                <div className="flex items-center gap-2">
                  <div className={clsx(
                    "flex h-7 w-7 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110",
                    isActive ? "bg-[rgba(142,231,218,0.16)]" : "bg-white/5"
                  )}>
                    {link.icon}
                  </div>
                  <span className={clsx(
                    "text-sm font-semibold tracking-tight",
                    isActive ? "text-[var(--fiscal-gold)]" : "text-[rgba(226,255,251,0.82)] group-hover:text-[rgba(247,255,253,0.98)]"
                  )}>
                    {link.label}
                  </span>
                </div>
                {(link as any).description && (
                  <p className="mt-1 pl-9 text-[10px] font-medium leading-snug text-[rgba(208,247,240,0.68)]">
                    {(link as any).description}
                  </p>
                )}
              </Link>
            );
          }
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              className={clsx(
                "group flex items-center gap-2 rounded-lg px-3 py-2.5 transition-all duration-200",
                isActive
                  ? "bg-[rgba(142,231,218,0.12)] text-[var(--fiscal-gold)]"
                  : "text-[rgba(204,245,239,0.72)] hover:bg-white/5 hover:text-[rgba(247,255,253,0.98)]"
              )}
            >
              <span className={clsx(isActive ? "text-[var(--fiscal-gold)]" : "text-[rgba(152,218,208,0.56)] group-hover:text-[rgba(214,250,244,0.84)]")}>
                {link.icon}
              </span>
              <span className="text-sm font-semibold">{link.label}</span>
              {isActive && <div className="ml-auto h-3 w-1 rounded-full bg-[var(--fiscal-gold)] shadow-[0_0_10px_rgba(120,229,210,0.55)]" />}
            </Link>
          );
        })}
      </div>

      <hr className="my-3 border-white/5" />

      {/* Variant badge */}
      <div className="mb-3 flex items-center gap-2 px-2">
        <span className={clsx(
          "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
          variant === "despacho" ? "bg-[rgba(142,231,218,0.12)] text-[var(--fiscal-gold)]" : "bg-[rgba(17,150,136,0.18)] text-[rgba(222,255,250,0.95)]"
        )}>
          {variant === "despacho" ? "Despacho" : "Corporativo"}
        </span>
        <span className="text-[10px] text-[rgba(196,242,234,0.52)]">Navegación</span>
      </div>

      {/* ── Secondary Collapsible Categories ── */}
      <nav className="space-y-1">
        {NAV_ITEMS.map((item, index) => {
          if (item.type === "divider") {
            return <hr key={`divider-${index}`} className="my-3 border-white/5" />;
          }

          if (item.type === "link") {
            if (!checkAccess(item)) return null;

            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={clsx(
                  "group flex items-center gap-3 rounded-lg px-2 py-2 transition-all duration-200",
                  isActive
                    ? "bg-[rgba(142,231,218,0.12)] text-[var(--fiscal-gold)]"
                    : "text-[rgba(191,236,229,0.66)] hover:bg-white/5 hover:text-[rgba(228,255,250,0.9)]"
                )}
              >
                <span className={clsx(
                  isActive ? "text-[var(--fiscal-gold)]" : "text-[rgba(145,212,202,0.52)] group-hover:text-[rgba(213,249,243,0.82)]"
                )}>
                  {item.icon}
                </span>
                <span className="text-xs font-bold uppercase tracking-wider">{item.label}</span>
                {isActive && <div className="ml-auto h-3 w-1 rounded-full bg-[var(--fiscal-gold)] shadow-[0_0_10px_rgba(120,229,210,0.55)]" />}
              </Link>
            );
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
                    hasActiveChild && !isExpanded ? "text-[var(--fiscal-gold)]" : "text-[rgba(191,236,229,0.66)] hover:bg-white/5 hover:text-[rgba(228,255,250,0.9)]"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className={clsx("transition-transform", hasActiveChild && !isExpanded ? "text-[var(--fiscal-gold)]" : "text-[rgba(145,212,202,0.52)] group-hover:text-[rgba(213,249,243,0.82)]")}>
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
                                ? "border-[rgba(143,240,224,0.34)] bg-[rgba(142,231,218,0.12)] shadow-[0_0_15px_rgba(120,229,210,0.14)]"
                                : "border-white/5 bg-white/[0.02] hover:border-[rgba(143,240,224,0.22)] hover:bg-white/[0.04]"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={clsx(
                                  "flex h-7 w-7 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110",
                                  isActive ? "bg-[rgba(142,231,218,0.16)]" : "bg-white/5"
                                )}>
                                  {child.icon}
                                </div>
                                <span className={clsx(
                                  "text-sm font-semibold tracking-tight",
                                  isActive ? "text-[var(--fiscal-gold)]" : "text-[rgba(226,255,251,0.82)] group-hover:text-[rgba(247,255,253,0.98)]"
                                )}>
                                  {child.label}
                                </span>
                              </div>
                            </div>
                            {child.description && (
                              <p className="mt-2 pl-9 text-[10px] font-medium leading-snug text-[rgba(208,247,240,0.68)]">
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
                              ? "bg-[rgba(142,231,218,0.12)] text-[var(--fiscal-gold)]"
                              : "text-[rgba(191,236,229,0.66)] hover:bg-white/5 hover:text-[rgba(228,255,250,0.9)]"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className={clsx(
                              isActive ? "text-[var(--fiscal-gold)]" : "text-[rgba(135,199,190,0.46)] group-hover:text-[rgba(205,247,240,0.78)]"
                            )}>
                              {child.icon}
                            </span>
                            <span className="text-sm font-medium">{child.label}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {child.href === "/dashboard/alertas-csd" && csdAlertCount > 0 && (
                              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white animate-pulse">
                                {csdAlertCount}
                              </span>
                            )}
                            {isActive && (
                              <div className="h-3 w-1 rounded-full bg-[var(--fiscal-gold)] shadow-[0_0_10px_rgba(120,229,210,0.55)]" />
                            )}
                          </div>
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
    <div className="group relative flex w-full items-center justify-between rounded-xl border border-[rgba(143,240,224,0.14)] bg-white/5 p-3 outline-none transition-all hover:border-[rgba(143,240,224,0.24)] hover:bg-white/10">
      <div className="flex items-center gap-3 truncate">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(120,229,210,0.22)] bg-[linear-gradient(135deg,rgba(23,181,163,0.95),rgba(13,109,102,0.96))] text-xs font-bold text-white shadow-inner">
          {initials}
        </div>
        <div className="truncate text-left">
          <p className="truncate text-sm font-semibold text-[rgba(228,255,251,0.86)]">
            {user?.full_name || user?.email}
          </p>
          <p className="truncate text-xs font-medium tracking-wide text-[var(--fiscal-gold)]">
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
  const [csdAlertCount, setCsdAlertCount] = useState(0);
  const cmdPalette = useCommandPalette();
  const isLegalConsultationActive = pathname === "/dashboard/consultas";
  const showCompactOnboarding = Boolean(user?.tenant_slug) && Boolean(pathname?.startsWith("/dashboard/"));

  useEffect(() => {
    setMounted(true);
  }, []);

  /* ── CSD alert badge: count ACTIVA + REVOCADO alerts ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const empresas = await fetchEmpresas();
        if (cancelled || !empresas.length) return;
        const raw = await getAlertasCSD(empresas[0].id);
        if (cancelled) return;
        const alertas = Array.isArray(raw) ? raw : (raw as any).results ?? [];
        const critical = (alertas as any[]).filter(
          (a) => a.estatus === "ACTIVA" || a.estatus === "REVOCADO"
        );
        setCsdAlertCount(critical.length);
      } catch {
        /* silently ignore – sidebar badge is non-critical */
      }
    })();
    return () => { cancelled = true; };
  }, [pathname]); /* re-check on navigation so it updates after saving */

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
    <div className="flex min-h-[100dvh] bg-[var(--fiscal-canvas)] text-[var(--fiscal-ink)]">
      {/* ── Command Palette (Ctrl+K) ── */}
      <CommandPalette open={cmdPalette.open} onClose={() => cmdPalette.setOpen(false)} />

      {/* ── Desktop Sidebar (Dark Glass) ── */}
      <aside className="surface-shell hidden flex-col border-r relative lg:flex lg:w-[292px]">
        {/* Subtle glow effect behind sidebar */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(161,255,242,0.16),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))]" />

        <div className="flex-1 overflow-y-auto px-5 py-8 custom-scrollbar relative z-10">
          <SidebarNav user={user} orgLabel={orgLabel} pathname={pathname} csdAlertCount={csdAlertCount} variant={getUserVariant(user)} />
        </div>

        <div className="relative z-10 border-t border-white/10 bg-[rgba(7,95,88,0.42)] p-4 backdrop-blur-md">
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
            "surface-shell fixed left-0 top-0 z-50 h-[100dvh] w-[85vw] max-w-[320px] overflow-hidden border-r shadow-2xl transition-transform duration-300 ease-in-out lg:pointer-events-none lg:hidden",
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(161,255,242,0.16),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))]" />

          <div className="flex h-full min-h-0 flex-col relative z-10">
            <div className="flex shrink-0 items-center justify-between p-5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-[var(--fiscal-gold)]" />
                <span className="text-sm font-semibold tracking-wider text-white">DEFENSA</span>
              </div>
              <button
                onClick={closeDrawer}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-[rgba(197,242,235,0.7)] hover:bg-white/10 hover:text-[rgba(247,255,253,0.98)] transition-colors"
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
                csdAlertCount={csdAlertCount}
                variant={getUserVariant(user)}
              />
            </div>

            <div className="border-t border-white/10 bg-[rgba(7,95,88,0.42)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md">
              <SidebarSessionCard user={user} roleLabel={roleLabel} onLogout={() => { closeDrawer(); logout(); }} />
            </div>
          </div>
        </aside>
      )}

      <div className="relative flex flex-1 flex-col overflow-hidden bg-transparent">
        {/* Decorative Background Elements */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[linear-gradient(180deg,rgba(255,255,255,0.55),rgba(244,242,237,0))]" />
        <div className="pointer-events-none absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-[rgba(15,127,115,0.10)] blur-[120px]" />
        <div className="pointer-events-none absolute -top-24 left-[20%] h-[260px] w-[260px] rounded-full bg-[rgba(142,231,218,0.10)] blur-[90px]" />

        {/* ── Header ── */}
        <header className="relative z-20 border-b border-[rgba(200,192,177,0.6)] bg-[rgba(251,250,247,0.82)] px-4 py-3 shadow-[0_4px_30px_rgba(15,23,36,0.03)] backdrop-blur-xl sm:px-6 lg:px-8 lg:py-4">
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
                <p className="kicker-label flex items-center gap-1.5 sm:text-[11px]">
                  <span className="inline-flex h-2 w-2 rounded-full bg-[var(--fiscal-gold)] shadow-[0_0_8px_rgba(120,229,210,0.5)]"></span>
                  Centro de defensa fiscal
                </p>
                <h2 className="mt-1 font-display text-[1.35rem] font-semibold tracking-tight text-[var(--fiscal-ink)] sm:text-[1.45rem] lg:text-[1.6rem]">
                  Materialidad <span className="text-[var(--fiscal-accent)]">Institucional</span>
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Search button → opens CommandPalette */}
              <button
                type="button"
                onClick={() => cmdPalette.setOpen(true)}
                className="hidden h-9 items-center gap-2 rounded-lg border border-[rgba(200,192,177,0.7)] bg-[rgba(255,255,255,0.75)] px-3 text-xs text-[var(--fiscal-muted)] shadow-sm transition-colors hover:border-[var(--fiscal-accent)]/40 hover:text-[var(--fiscal-ink)] md:flex"
                aria-label="Buscar módulos (Ctrl+K)"
                title="Buscar módulos (Ctrl+K)"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Buscar…</span>
                <kbd className="ml-1 hidden h-5 items-center rounded border border-[rgba(200,192,177,0.7)] bg-[rgba(244,242,237,0.95)] px-1.5 text-[10px] font-medium text-[var(--fiscal-muted)] lg:inline-flex">⌘K</kbd>
              </button>

              {/* Notification bell */}
              <Link
                href="/dashboard/alertas-csd"
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[rgba(200,192,177,0.7)] bg-[rgba(255,255,255,0.75)] text-[var(--fiscal-muted)] shadow-sm transition-colors hover:border-[var(--fiscal-accent)]/40 hover:text-[var(--fiscal-accent)]"
                title="Alertas"
              >
                <Bell className="h-4 w-4" />
                {csdAlertCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white animate-pulse">
                    {csdAlertCount}
                  </span>
                )}
              </Link>

              <div className="text-right max-w-[200px] sm:max-w-sm">
                <p className="truncate text-xs font-bold text-[var(--fiscal-ink)] sm:text-[13px]">{user?.full_name || user?.email}</p>
                <p className="truncate text-[10px] font-medium text-[var(--fiscal-muted)] sm:text-[11px]">{orgLabel}</p>
              </div>
              <button
                onClick={logout}
                className="group relative hidden h-9 items-center justify-center gap-2 overflow-hidden rounded-lg bg-white px-4 text-xs font-semibold text-[var(--fiscal-ink)] shadow-sm ring-1 ring-[rgba(200,192,177,0.7)] transition-all hover:bg-[rgba(247,221,218,0.55)] hover:text-[var(--fiscal-danger)] hover:ring-[rgba(160,67,61,0.24)] hover:shadow-md lg:flex"
              >
                <span className="relative z-10">Cerrar sesión</span>
                <LogOut className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                <div className="absolute inset-0 -z-10 bg-gradient-to-r from-red-500/0 via-red-500/5 to-red-500/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </button>
            </div>
          </div>
        </header>

        {/* ── Main content ── */}
        <main className="relative z-10 flex-1 overflow-y-auto px-3 py-5 sm:px-4 lg:px-6 lg:py-6 xl:px-7">
          <div className="mx-auto max-w-[96rem] space-y-5">
            {showCompactOnboarding && (
              <TenantFirstStepsCard
                user={user}
                tenant={user?.tenant_slug ?? null}
                summary={null}
                variant="compact"
                currentPathname={pathname}
              />
            )}
            {children}
          </div>
        </main>

        <Link
          href="/dashboard/consultas"
          className={clsx(
            "fixed bottom-5 right-4 z-30 inline-flex items-center gap-3 rounded-full border px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(37,99,235,0.35)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_24px_55px_rgba(37,99,235,0.45)] focus:outline-none focus:ring-4 focus:ring-blue-300/40 sm:bottom-6 sm:right-6",
            isLegalConsultationActive
              ? "border-blue-300 bg-blue-700"
              : "border-blue-400/80 bg-blue-600"
          )}
          aria-label="Abrir Consulta Legal"
          title="Abrir Consulta Legal"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/18 backdrop-blur-sm">
            <Gavel className="h-5 w-5" />
          </span>
          <span className="flex flex-col leading-tight">
            <span>Consulta Legal</span>
            <span className="text-[11px] font-medium text-blue-100">
              {isLegalConsultationActive ? "Disponible ahora" : "Acceso inmediato"}
            </span>
          </span>
        </Link>
      </div>
    </div>
  );
}
