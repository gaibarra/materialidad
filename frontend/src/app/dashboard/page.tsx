"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Building2, Users } from "lucide-react";

import { DashboardShell } from "../../components/DashboardShell";
import { useAuthContext } from "../../context/AuthContext";
import { ExecutiveOverview } from "./(components)/ExecutiveOverview";

export default function DashboardPage() {
  const { isAuthenticated, user, tenant, isProfileLoaded } = useAuthContext();
  const router = useRouter();

  const isGlobalAdmin = isAuthenticated && user?.is_superuser && !tenant;

  useEffect(() => {
    if (isProfileLoaded && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isProfileLoaded, router]);

  if (!isProfileLoaded) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[rgba(142,231,218,0.22)] border-t-[var(--fiscal-accent)]" />
            <p className="text-sm text-[var(--fiscal-muted)]">Cargando perfil…</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (isGlobalAdmin) {
    return (
      <DashboardShell>
        <div className="space-y-8">
          <section className="surface-panel-strong rounded-[2rem] p-7 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)] lg:items-end">
              <div>
                <p className="kicker-label">Administración global</p>
                <h2 className="mt-3 font-display text-4xl font-semibold text-[var(--fiscal-ink)] sm:text-5xl">
                  Administra organizaciones, accesos y operación global.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--fiscal-muted)] sm:text-lg">
                  Desde aquí controlas tenants, usuarios y seguimiento transversal de la plataforma desde un solo panel.
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-[rgba(200,192,177,0.72)] bg-[rgba(255,255,255,0.72)] px-5 py-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">Alcance</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <div>
                    <p className="text-sm font-semibold text-[var(--fiscal-ink)]">Organizaciones</p>
                    <p className="mt-1 text-sm text-[var(--fiscal-muted)]">Alta, estructura y tenants.</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--fiscal-ink)]">Operación global</p>
                    <p className="mt-1 text-sm text-[var(--fiscal-muted)]">Accesos, monitoreo y seguimiento transversal.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/dashboard/admin/organizaciones"
              className="surface-panel group rounded-[1.6rem] p-6 transition hover:-translate-y-0.5 hover:shadow-fiscal"
            >
              <div>
                <div className="mb-4 h-px w-full bg-[rgba(200,192,177,0.82)]" />
                <div className="mb-4 inline-flex rounded-xl bg-[rgba(45,91,136,0.12)] p-3 text-[var(--fiscal-accent)]">
                  <Building2 className="h-8 w-8" />
                </div>
                <h3 className="font-display text-2xl font-semibold text-[var(--fiscal-ink)]">Organizaciones</h3>
                <p className="mt-2 text-[var(--fiscal-muted)]">
                  Gestiona despachos contables y corporativos. Crea nuevos tenants y administra sus accesos desde un solo flujo.
                </p>
                <div className="mt-4 flex items-center text-sm font-semibold text-[var(--fiscal-accent)]">
                  Abrir gestión <span className="ml-2 transition-transform group-hover:translate-x-1">→</span>
                </div>
              </div>
            </Link>

            <div className="surface-panel rounded-[1.6rem] p-6 opacity-70">
              <div>
                <div className="mb-4 h-px w-full bg-[rgba(200,192,177,0.82)]" />
                <div className="mb-4 inline-flex rounded-xl bg-[rgba(142,231,218,0.12)] p-3 text-[var(--fiscal-gold)]">
                  <Users className="h-8 w-8" />
                </div>
                <h3 className="font-display text-2xl font-semibold text-[var(--fiscal-ink)]">Usuarios Globales</h3>
                <p className="mt-2 text-[var(--fiscal-muted)]">
                  Administra superusuarios y staff que sostienen la operación transversal de la plataforma.
                </p>
                <div className="mt-4 text-xs font-medium uppercase tracking-wide text-[var(--fiscal-muted)]">
                  Próximamente
                </div>
              </div>
            </div>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <DashboardShell>
      <ExecutiveOverview />
    </DashboardShell>
  );
}


