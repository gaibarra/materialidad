"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuthContext } from "../context/AuthContext";
import type { Organization } from "../context/AuthContext";
import { alertError } from "../lib/alerts";
import {
  ShieldCheck,
  Eye,
  EyeOff,
  Building2,
  ArrowLeft,
  ChevronRight,
  Landmark,
  Scale,
  FileText,
  Users2,
  Mail,
  MessageCircle,
} from "lucide-react";
import { CONTACT_CHANNELS, PROFESSIONAL_PROFILE } from "../lib/marketing-contact";

const ACCESS_NOTES = [
  {
    title: "Prioriza clientes con claridad",
    description:
      "Entra a la organización correcta y revisa su contexto fiscal, operativo y documental sin perder el hilo del caso.",
    icon: Users2,
  },
  {
    title: "FDI y riesgos visibles",
    description:
      "Consulta el índice, los huecos documentales y los riesgos relevantes desde el mismo flujo de revisión.",
    icon: Scale,
  },
  {
    title: "Expediente listo para seguimiento",
    description:
      "La evidencia, el soporte y la trazabilidad quedan centralizados para revisión, remediación y defensa fiscal.",
    icon: FileText,
  },
];

const LAST_EMAIL_KEY = "materialidad.lastEmail";

function getLastEmail(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(LAST_EMAIL_KEY) ?? "";
}

function saveLastEmail(email: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_EMAIL_KEY, email);
}

type LoginStep = "credentials" | "select-org";

type ContactProfilePanelProps = {
  className?: string;
  tone?: "light" | "dark";
  density?: "regular" | "compact";
};

function ContactProfilePanel({ className = "", tone = "dark", density = "regular" }: ContactProfilePanelProps) {
  const isDark = tone === "dark";
  const isCompact = density === "compact";

  return (
    <div
      className={[
        isCompact
          ? "grid gap-2.5 rounded-[1.1rem] p-3 backdrop-blur-sm"
          : "grid gap-3 rounded-[1.25rem] p-3.5 backdrop-blur-sm sm:rounded-[1.5rem] sm:p-4",
        isDark
          ? "border border-[rgba(143,240,224,0.16)] bg-white/6"
          : "border border-[rgba(200,192,177,0.72)] bg-[rgba(255,255,255,0.84)] shadow-panel",
        className,
      ].join(" ").trim()}
    >
      <div>
        <p className={isDark ? "eyebrow-shell" : "kicker-label text-[var(--fiscal-accent)]"}>Contacto directo</p>
        <h2 className={`mt-2 font-semibold ${isCompact ? "text-base sm:text-lg" : "text-lg sm:text-2xl"} ${isDark ? "text-white" : "text-[var(--fiscal-ink)]"}`}>
          {PROFESSIONAL_PROFILE.fullName}
        </h2>
      </div>

      <div className={`grid gap-2.5 ${isCompact ? "xl:grid-cols-2" : "sm:grid-cols-2"} sm:gap-3`}>
        {CONTACT_CHANNELS.map((channel) => {
          const isWhatsApp = channel.kind === "whatsapp";
          const Icon = isWhatsApp ? MessageCircle : Mail;

          return (
            <a
              key={channel.label}
              href={channel.href}
              target={isWhatsApp ? "_blank" : undefined}
              rel={isWhatsApp ? "noreferrer" : undefined}
              className={[
                isCompact
                  ? "rounded-[0.95rem] px-3 py-2.5 transition"
                  : "rounded-[1rem] px-3.5 py-3 transition sm:rounded-[1.15rem] sm:px-4",
                isDark
                  ? "border border-[rgba(143,240,224,0.14)] bg-white/7 text-white hover:bg-white/10"
                  : "border border-[rgba(200,192,177,0.62)] bg-white text-[var(--fiscal-ink)] hover:bg-[rgba(244,242,237,0.7)]",
              ].join(" ")}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${
                    isWhatsApp
                      ? "bg-[rgba(37,211,102,0.16)] text-[#c8f4de]"
                      : "bg-[rgba(45,91,136,0.18)] text-[rgba(216,232,246,0.95)]"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className={`${isCompact ? "text-[13px]" : "text-sm"} font-semibold ${isDark ? "text-white" : "text-[var(--fiscal-ink)]"}`}>{channel.label}</p>
                  <p className={`${isCompact ? "text-[13px]" : "text-sm"} ${isDark ? "text-[rgba(215,252,246,0.72)]" : "text-[var(--fiscal-muted)]"}`}>{channel.value}</p>
                </div>
              </div>
            </a>
          );
        })}
      </div>

      <div className={`grid gap-2.5 ${isCompact ? "xl:grid-cols-2" : "sm:grid-cols-2"} sm:gap-3`}>
        <div className={[
          isCompact
            ? "rounded-[0.95rem] px-3 py-2.5"
            : "rounded-[1rem] px-3.5 py-3 sm:rounded-[1.15rem] sm:px-4",
          isDark
            ? "border border-[rgba(143,240,224,0.14)] bg-white/7"
            : "border border-[rgba(200,192,177,0.62)] bg-white",
        ].join(" ")}>
          <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${isDark ? "text-[rgba(194,244,236,0.62)]" : "text-[var(--fiscal-muted)]"}`}>
            {PROFESSIONAL_PROFILE.licenseLabel}
          </p>
          <p className={`mt-1 ${isCompact ? "text-sm" : "text-base"} font-semibold ${isDark ? "text-white" : "text-[var(--fiscal-ink)]"}`}>{PROFESSIONAL_PROFILE.licenseNumber}</p>
          <p className={`mt-1 ${isCompact ? "text-[13px]" : "text-sm"} ${isDark ? "text-[rgba(215,252,246,0.72)]" : "text-[var(--fiscal-muted)]"}`}>Tipo: {PROFESSIONAL_PROFILE.licenseType}</p>
        </div>

        <div className={[
          isCompact
            ? "rounded-[0.95rem] px-3 py-2.5"
            : "rounded-[1rem] px-3.5 py-3 sm:rounded-[1.15rem] sm:px-4",
          isDark
            ? "border border-[rgba(143,240,224,0.14)] bg-white/7"
            : "border border-[rgba(200,192,177,0.62)] bg-white",
        ].join(" ")}>
          <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${isDark ? "text-[rgba(194,244,236,0.62)]" : "text-[var(--fiscal-muted)]"}`}>
            {PROFESSIONAL_PROFILE.studiesLabel}
          </p>
          <p className={`mt-1 ${isCompact ? "text-sm" : "text-base"} font-semibold ${isDark ? "text-white" : "text-[var(--fiscal-ink)]"}`}>{PROFESSIONAL_PROFILE.degree}</p>
        </div>
      </div>
    </div>
  );
}

export function LoginForm() {
  const { login, discoverOrganizations } = useAuthContext();
  const router = useRouter();

  const [step, setStep] = useState<LoginStep>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showTransition, setShowTransition] = useState(false);

  useEffect(() => {
    const last = getLastEmail();
    if (last) setEmail(last);
  }, []);

  const doLogin = async (tenantSlug?: string) => {
    const payload: { email: string; password: string; tenant?: string } = {
      email,
      password,
    };

    if (tenantSlug) payload.tenant = tenantSlug;

    await login(payload);
    saveLastEmail(email);

    setShowTransition(true);
    setTimeout(() => {
      router.push("/dashboard");
    }, 800);
  };

  const handleCredentialsSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      const orgs = await discoverOrganizations(email, password);

      if (orgs.length === 0) {
        await doLogin();
        return;
      }

      if (orgs.length === 1) {
        await doLogin(orgs[0].slug);
        return;
      }

      setOrganizations(orgs);
      setStep("select-org");
    } catch (err) {
      void alertError("No pudimos iniciar sesión", (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOrgSelect = async (slug: string) => {
    setIsLoading(true);

    try {
      await doLogin(slug);
    } catch (err) {
      void alertError("No pudimos iniciar sesión", (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep("credentials");
    setOrganizations([]);
  };

  if (showTransition) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--fiscal-canvas)]">
        <div className="animate-in fade-in duration-300 flex flex-col items-center gap-4 py-16">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[rgba(184,137,70,0.22)] border-t-[var(--fiscal-accent)]" />
          <p className="animate-pulse text-sm font-medium text-[var(--fiscal-muted)]">
            Abriendo tu cartera de revisión…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--fiscal-canvas)]">
      <div className="pointer-events-none absolute right-[-8rem] top-[-5rem] h-80 w-80 rounded-full bg-[rgba(142,231,218,0.12)] blur-[90px]" />
      <div className="pointer-events-none absolute bottom-[-6rem] left-[-4rem] h-72 w-72 rounded-full bg-[rgba(17,150,136,0.12)] blur-[90px]" />

      <div className="relative mx-auto grid min-h-[100svh] max-w-7xl gap-5 px-4 py-4 sm:gap-6 sm:px-6 sm:py-8 lg:grid-cols-[0.9fr_minmax(360px,0.9fr)] lg:items-center lg:px-8 lg:py-10">
        <div className="surface-shell relative hidden overflow-hidden rounded-[2rem] p-6 sm:p-7 lg:flex lg:p-8">
          <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 translate-x-16 -translate-y-10 rounded-full bg-[rgba(142,231,218,0.14)] blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-56 w-56 -translate-x-10 translate-y-10 rounded-full bg-[rgba(17,150,136,0.18)] blur-3xl" />

          <div className="relative z-10 flex h-full flex-col justify-between gap-6">
            <div>
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(143,240,224,0.28)] bg-[linear-gradient(180deg,rgba(142,231,218,0.18),rgba(255,255,255,0.05))] shadow-lg shadow-[rgba(3,31,28,0.22)]">
                  <ShieldCheck className="h-4.5 w-4.5 text-[var(--fiscal-gold)]" />
                </div>
                <div>
                  <span className="font-display text-[1.2rem] font-semibold tracking-tight text-white">
                    Materialidad
                  </span>
                  <p className="eyebrow-shell mt-1">Acceso para despachos contables</p>
                </div>
              </div>

              <p className="eyebrow-shell mb-3">Revisión, priorización y defensa fiscal</p>
                <h1 className="heading-editorial max-w-[10ch] text-[1.325rem] font-semibold leading-[0.95] text-white xl:text-[1.675rem]">
                Entra para revisar clientes, FDI y expedientes con contexto real.
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-[rgba(220,255,250,0.78)] xl:text-[15px]">
                Accede al entorno donde cada organización conserva su operación, su evidencia y su postura fiscal
                para que el despacho pueda revisar, explicar y dar seguimiento con orden.
              </p>
            </div>

            <div className="grid gap-2.5">
              {ACCESS_NOTES.map(({ title, description, icon: Icon }) => (
                <div
                  key={title}
                  className="rounded-[1.1rem] border border-[rgba(143,240,224,0.16)] bg-white/6 px-3.5 py-3 backdrop-blur-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgba(255,255,255,0.08)] text-[var(--fiscal-gold)]">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-white">{title}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-[rgba(215,252,246,0.72)]">
                        {description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <ContactProfilePanel tone="dark" density="compact" />
          </div>
        </div>

        <div className="flex items-start justify-center px-0 py-1 sm:px-1 sm:py-2 lg:items-center lg:px-4">
          <div className="w-full max-w-md space-y-4 sm:space-y-6">
            <div className="text-center lg:hidden">
              <div className="mb-2 flex items-center justify-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(143,240,224,0.22)] bg-[linear-gradient(180deg,rgba(142,231,218,0.16),rgba(255,255,255,0.82))]">
                  <ShieldCheck className="h-4.5 w-4.5 text-[var(--fiscal-accent)]" />
                </div>
                <span className="font-display text-xl font-semibold tracking-tight text-[var(--fiscal-ink)]">
                  Materialidad
                </span>
              </div>
              <p className="kicker-label">Acceso seguro</p>
            </div>

            <ContactProfilePanel className="lg:hidden" tone="light" />

            {step === "credentials" && (
              <div className="surface-panel-strong animate-in fade-in rounded-[1.65rem] p-5 duration-200 sm:rounded-[2rem] sm:p-8">
                <div className="mb-5 sm:mb-7">
                  <p className="kicker-label mb-2">Ingreso al despacho</p>
                  <h2 className="font-display text-[1.75rem] font-semibold tracking-tight text-[var(--fiscal-ink)] sm:text-[2.25rem]">
                    Abre tu espacio de revisión.
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--fiscal-muted)]">
                    Usa tus credenciales para entrar a la cartera de clientes, revisar FDI, riesgos, evidencia y
                    seguimiento sin salir del mismo contexto.
                  </p>
                </div>

                <div className="mb-5 grid gap-2 sm:mb-6 sm:grid-cols-3 sm:gap-3">
                  {[
                    { label: "Clientes", value: "priorizados" },
                    { label: "FDI", value: "visible" },
                    { label: "Expediente", value: "listo" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-[1rem] border border-[rgba(200,192,177,0.68)] bg-[rgba(255,255,255,0.78)] px-3 py-2.5 text-center sm:rounded-[1.1rem] sm:py-3"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">
                        {item.label}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[var(--fiscal-ink)]">{item.value}</p>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleCredentialsSubmit} aria-busy={isLoading} className="space-y-4 sm:space-y-5">
                  <div>
                    <label htmlFor="login-email" className="mb-1.5 block text-sm font-semibold text-[var(--fiscal-ink)]">
                      Correo electrónico
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      disabled={isLoading}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="tu@despacho.com"
                      className="w-full rounded-[1rem] border border-[rgba(200,192,177,0.9)] bg-white px-4 py-3 text-sm text-[var(--fiscal-ink)] transition-colors placeholder:text-[rgba(91,102,120,0.6)] focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.14)]"
                    />
                  </div>

                  <div>
                    <label htmlFor="login-password" className="mb-1.5 block text-sm font-semibold text-[var(--fiscal-ink)]">
                      Contraseña
                    </label>
                    <div className="relative">
                      <input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        required
                        autoComplete="current-password"
                        value={password}
                        disabled={isLoading}
                        onChange={(event) => setPassword(event.target.value)}
                        className="w-full rounded-[1rem] border border-[rgba(200,192,177,0.9)] bg-white px-4 py-3 pr-11 text-sm text-[var(--fiscal-ink)] transition-colors focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.14)]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        disabled={isLoading}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fiscal-muted)] transition-colors hover:text-[var(--fiscal-accent)]"
                        tabIndex={-1}
                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    aria-disabled={isLoading}
                    aria-busy={isLoading}
                    className="button-institutional w-full rounded-[1rem] px-4 py-3 text-sm font-bold text-white transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-70 active:scale-[0.98] sm:py-3.5"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Validando acceso…
                      </span>
                    ) : (
                      "Abrir cartera de revisión"
                    )}
                  </button>
                </form>
              </div>
            )}

            {step === "select-org" && (
              <div aria-busy={isLoading} className="surface-panel-strong animate-in fade-in slide-in-from-right-4 rounded-[1.65rem] p-5 duration-300 sm:rounded-[2rem] sm:p-8">
                <div className="mb-5 sm:mb-6">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="mb-4 flex items-center gap-1 text-sm text-[var(--fiscal-muted)] transition-colors hover:text-[var(--fiscal-accent)]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Volver
                  </button>
                  <p className="kicker-label mb-2">Selecciona organización</p>
                  <h2 className="font-display text-[1.75rem] font-semibold tracking-tight text-[var(--fiscal-ink)] sm:text-[2.2rem]">
                    Elige el cliente que quieres abrir.
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--fiscal-muted)]">
                    Tienes acceso a {organizations.length} organizaciones. Selecciona una para continuar con su
                    expediente, postura fiscal y seguimiento.
                  </p>
                </div>

                <div className="max-h-[360px] space-y-2.5 overflow-y-auto pr-1 sm:max-h-[400px] sm:space-y-3">
                  {organizations.map((org) => (
                    <button
                      key={org.slug}
                      type="button"
                      disabled={isLoading}
                      aria-disabled={isLoading}
                      aria-busy={isLoading}
                      onClick={() => handleOrgSelect(org.slug)}
                      className="group flex w-full items-center gap-3 rounded-[1rem] border border-[rgba(200,192,177,0.8)] bg-white px-3.5 py-3.5 text-left transition-all hover:border-[rgba(45,91,136,0.34)] hover:bg-[rgba(219,230,240,0.35)] active:scale-[0.99] disabled:opacity-60 sm:gap-4 sm:rounded-[1.1rem] sm:px-4 sm:py-4"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(180deg,rgba(45,91,136,0.10),rgba(184,137,70,0.08))] transition-colors group-hover:bg-[linear-gradient(180deg,rgba(45,91,136,0.14),rgba(184,137,70,0.12))]">
                        <Building2 className="h-5 w-5 text-[var(--fiscal-accent)]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--fiscal-ink)]">{org.name}</p>
                        {org.despacho && (
                          <p className="truncate text-xs text-[var(--fiscal-muted)]">{org.despacho}</p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[rgba(91,102,120,0.45)] transition-colors group-hover:text-[var(--fiscal-accent)]" />
                    </button>
                  ))}
                </div>

                {isLoading && (
                  <div role="status" aria-live="polite" className="mt-4 flex items-center justify-center gap-2 text-sm text-[var(--fiscal-muted)]">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[rgba(184,137,70,0.22)] border-t-[var(--fiscal-accent)]" />
                    Abriendo revisión del cliente…
                  </div>
                )}
              </div>
            )}

            <p className="text-center text-xs leading-relaxed text-[var(--fiscal-muted)]/80">
              Acceso exclusivo para usuarios autorizados del despacho.
              <br />
              Protegido con autenticación JWT y cifrado TLS.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}