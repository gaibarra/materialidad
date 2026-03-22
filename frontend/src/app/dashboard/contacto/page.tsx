"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FileBadge2, GraduationCap, Mail, MessageCircle, Phone, UserRound } from "lucide-react";

import { DashboardShell } from "../../../components/DashboardShell";
import { useAuthContext } from "../../../context/AuthContext";

const CONTACT_ITEMS = [
  {
    title: "Desarrollador del proyecto",
    value: "C.P. Gonzalo Arturo Ibarra Mendoza",
    icon: UserRound,
    tone: "bg-[rgba(45,91,136,0.10)] text-[var(--fiscal-accent)]",
  },
  {
    title: "Cédula profesional",
    value: "5051388 · Licenciatura como Contador Público",
    icon: FileBadge2,
    tone: "bg-[rgba(184,137,70,0.12)] text-[var(--fiscal-gold)]",
  },
  {
    title: "Universidad",
    value: "Universidad Autónoma de Yucatán",
    icon: GraduationCap,
    tone: "bg-[var(--fiscal-success-soft)] text-[var(--fiscal-success)]",
  },
];

export default function ContactoPage() {
  const router = useRouter();
  const { isAuthenticated, isProfileLoaded } = useAuthContext();

  useEffect(() => {
    if (!isProfileLoaded) return;
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isProfileLoaded, router]);

  if (!isProfileLoaded) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[rgba(184,137,70,0.22)] border-t-[var(--fiscal-accent)]" />
            <p className="text-sm text-[var(--fiscal-muted)]">Cargando contacto…</p>
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
      <div className="space-y-6">
        <section className="surface-panel-strong rounded-[32px] p-8">
          <p className="eyebrow-shell">Contacto</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-[var(--fiscal-ink)]">
            Información de contacto del proyecto
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--fiscal-muted)]">
            Este espacio concentra los datos del desarrollador responsable para consultas, seguimiento y comunicación directa sobre la plataforma.
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {CONTACT_ITEMS.map(({ title, value, icon: Icon, tone }) => (
            <article key={title} className="surface-panel rounded-[28px] p-6">
              <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${tone}`}>
                <Icon className="h-6 w-6" />
              </div>
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--fiscal-muted)]">{title}</p>
              <p className="mt-3 text-lg font-semibold leading-7 text-[var(--fiscal-ink)]">{value}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="surface-panel rounded-[30px] p-7">
            <p className="kicker-label mb-3">Canales directos</p>
            <div className="space-y-4">
              <div className="rounded-2xl border border-[rgba(25,36,52,0.08)] bg-white/75 p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(37,211,102,0.12)] text-[#128C7E]">
                    <MessageCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--fiscal-ink)]">WhatsApp</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--fiscal-muted)]">
                      Canal recomendado para contacto ágil y coordinación operativa.
                    </p>
                    <Link
                      href="https://wa.me/526535388499"
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--fiscal-accent)] transition-colors hover:text-[var(--fiscal-success)]"
                    >
                      <Phone className="h-4 w-4" />
                      6535388499
                    </Link>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[rgba(25,36,52,0.08)] bg-white/75 p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(45,91,136,0.10)] text-[var(--fiscal-accent)]">
                    <Mail className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--fiscal-ink)]">Correo electrónico</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--fiscal-muted)]">
                      Útil para seguimiento formal, envío de información y coordinación de avances del proyecto.
                    </p>
                    <Link
                      href="mailto:proyectog40@gmail.com"
                      className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--fiscal-accent)] transition-colors hover:text-[var(--fiscal-success)]"
                    >
                      <Mail className="h-4 w-4" />
                      proyectog40@gmail.com
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <article className="surface-panel rounded-[30px] p-7">
            <p className="kicker-label mb-3">Referencia profesional</p>
            <div className="rounded-[24px] border border-[rgba(184,137,70,0.28)] bg-[rgba(184,137,70,0.08)] p-5 text-sm leading-7 text-[var(--fiscal-ink)]">
              C.P. Gonzalo Arturo Ibarra Mendoza cuenta con cédula profesional <span className="font-semibold">5051388</span> correspondiente a la Licenciatura como Contador Público por la <span className="font-semibold">Universidad Autónoma de Yucatán</span>.
            </div>
            {/* <div className="mt-5 rounded-[24px] border border-[rgba(25,36,52,0.08)] bg-white/75 p-5 text-sm leading-7 text-[var(--fiscal-muted)]">
              Si lo deseas, esta sección puede evolucionar después para incluir horario de atención, enlaces a documentos de soporte o canales institucionales adicionales.
            </div> */}
          </article>
        </section>
      </div>
    </DashboardShell>
  );
}
