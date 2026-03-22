import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  Landmark,
  Mail,
  MessageCircle,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Users,
  Zap,
} from 'lucide-react';

const HERO_METRICS = [
  {
    label: 'Clientes priorizados por riesgo',
    value: 'FDI',
    tone: 'text-[var(--fiscal-accent)]',
    surface: 'bg-[var(--fiscal-accent-soft)]',
  },
  {
    label: 'Expedientes listos para revisión',
    value: '24/7',
    tone: 'text-[var(--fiscal-success)]',
    surface: 'bg-[var(--fiscal-success-soft)]',
  },
  {
    label: 'Riesgos visibles y explicables',
    value: 'Claro',
    tone: 'text-[var(--fiscal-danger)]',
    surface: 'bg-[var(--fiscal-danger-soft)]',
  },
  {
    label: 'Más valor profesional cobrable',
    value: '+Valor',
    tone: 'text-[var(--fiscal-gold)]',
    surface: 'bg-[rgba(184,137,70,0.12)]',
  },
];

const PLATFORM_BLOCKS = [
  {
    title: 'Prioriza clientes con criterio',
    description:
      'Identifica qué clientes requieren revisión inmediata, dónde hay huecos documentales y qué postura fiscal necesita atención primero.',
    icon: Users,
    surface: 'bg-[var(--fiscal-accent-soft)] text-[var(--fiscal-accent)]',
  },
  {
    title: 'Expediente vivo por cliente',
    description:
      'Cada operación conserva contrato, CFDI, pagos, soporte y evidencia en un mismo flujo, sin perseguir archivos dispersos.',
    icon: FileSearch,
    surface: 'bg-[var(--fiscal-success-soft)] text-[var(--fiscal-success)]',
  },
  {
    title: 'Criterio fiscal aterrizado',
    description:
      'La consulta legal deja de estar aislada y se conecta con operaciones reales, expedientes y contexto verificable.',
    icon: Scale,
    surface: 'bg-[rgba(184,137,70,0.12)] text-[var(--fiscal-gold)]',
  },
  {
    title: 'FDI accionable',
    description:
      'El índice resume la postura fiscal del cliente y ayuda a explicar riesgos, avances y acciones prioritarias con claridad.',
    icon: Zap,
    surface: 'bg-[var(--fiscal-danger-soft)] text-[var(--fiscal-danger)]',
  },
];

const PROCESS_STEPS = [
  {
    step: '01',
    title: 'Concentra el caso',
    description:
      'Integra tercero, operación, contrato, CFDI, pagos y evidencia para que el expediente nazca ordenado desde el origen.',
  },
  {
    step: '02',
    title: 'Detecta huecos y riesgos',
    description:
      'La plataforma muestra faltantes, alertas y señales críticas para que el despacho sepa qué cliente atender primero.',
  },
  {
    step: '03',
    title: 'Explica y remedia',
    description:
      'Con el FDI y la trazabilidad documental, el despacho puede explicar postura fiscal y proponer acciones concretas al cliente.',
  },
];

const REVIEW_USE_CASES = [
  {
    title: 'Revisión mensual de clientes',
    description:
      'Ordena expedientes, prioriza atención y evita revisar a ciegas o solo por intuición.',
    icon: ClipboardCheck,
  },
  {
    title: 'Auditoría y preparación de revisión',
    description:
      'Llega con evidencia organizada, narrativa clara y una postura fiscal mejor explicada frente a terceros.',
    icon: ShieldCheck,
  },
  {
    title: 'Servicio premium para el cliente',
    description:
      'Convierte revisión, seguimiento y defensa fiscal en un entregable más claro, medible y de mayor valor.',
    icon: ShieldAlert,
  },
];

const AUDIENCES = [
  {
    title: 'Despachos contables',
    description:
      'Para priorizar clientes, ordenar expedientes y elevar el valor profesional de la revisión fiscal.',
    icon: BookOpenCheck,
  },
  {
    title: 'Áreas fiscales internas',
    description:
      'Para sostener una postura verificable y trabajar con el despacho sobre una sola fuente de verdad.',
    icon: Building2,
  },
  {
    title: 'Auditoría y compliance',
    description:
      'Para pasar del resumen ejecutivo al soporte real sin duplicar conversaciones ni reconstruir historias al final.',
    icon: BarChart3,
  },
];

const BENEFIT_POINTS = [
  'Menos tiempo persiguiendo archivos y más tiempo revisando lo importante.',
  'Más claridad para explicar al cliente por qué un caso está controlado, expuesto o crítico.',
  'Más capacidad para convertir la revisión fiscal en un servicio de mayor valor.',
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--fiscal-canvas)] text-[var(--fiscal-ink)]">
      <nav className="sticky top-0 z-50 border-b border-[rgba(200,192,177,0.75)] bg-[rgba(251,250,247,0.88)] pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex shrink-0 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(184,137,70,0.25)] bg-[linear-gradient(180deg,rgba(184,137,70,0.16),rgba(255,255,255,0.9))] shadow-panel">
                <Landmark className="h-5 w-5 text-[var(--fiscal-accent)]" />
              </div>
              <div>
                <p className="kicker-label">Despachos · revisión · defensa fiscal</p>
                <span className="font-display text-[1.35rem] font-semibold tracking-tight text-[var(--fiscal-ink)]">
                  Materialidad
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="#plataforma"
                className="hidden text-sm font-medium text-[var(--fiscal-muted)] transition-colors hover:text-[var(--fiscal-accent)] md:block"
              >
                Producto
              </a>
              <a
                href="#proceso"
                className="hidden text-sm font-medium text-[var(--fiscal-muted)] transition-colors hover:text-[var(--fiscal-accent)] md:block"
              >
                Proceso
              </a>
              <a
                href="#auditoria"
                className="hidden text-sm font-medium text-[var(--fiscal-muted)] transition-colors hover:text-[var(--fiscal-accent)] md:block"
              >
                Beneficios
              </a>
              <Link
                href="/login"
                className="button-institutional inline-flex h-10 items-center justify-center rounded-lg px-5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fiscal-accent)]"
              >
                Solicitar demostración <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-grow">
        <section className="relative overflow-hidden pt-12 pb-20 lg:pt-10 lg:pb-16">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-0 top-0 h-[420px] w-[420px] rounded-full bg-[rgba(184,137,70,0.10)] blur-[90px]" />
            <div className="absolute right-0 top-0 h-[420px] w-[420px] rounded-full bg-[rgba(45,91,136,0.08)] blur-[110px]" />
          </div>

          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-center">
              <div className="max-w-none text-center lg:max-w-[42rem] lg:text-left">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[rgba(184,137,70,0.24)] bg-[rgba(255,255,255,0.65)] px-4 py-2 text-sm font-medium text-[var(--fiscal-accent)] shadow-panel">
                  <span className="inline-flex h-2 w-2 rounded-full bg-[var(--fiscal-gold)] shadow-[0_0_10px_rgba(184,137,70,0.45)]" />
                  Diseñado para despachos que quieren revisar mejor y cobrar más valor
                </div>

                <h1 className="heading-editorial mx-auto mb-5 max-w-[11.5ch] text-[2.9rem] font-semibold leading-[0.9] text-[var(--fiscal-ink)] sm:text-[3.35rem] lg:mx-0 lg:max-w-[11.4ch] lg:text-[4.2rem] xl:text-[4.35rem]">
                  Prioriza clientes,
                  <br />
                  detecta riesgos
                  <br />
                  y fortalece su <span className="inline-block text-[var(--fiscal-success)]">defensa fiscal</span>.
                </h1>

                <p className="mx-auto mb-8 max-w-[39rem] text-lg leading-relaxed text-[var(--fiscal-muted)] sm:text-xl lg:mx-0">
                  Materialidad ayuda a los despachos contables a convertir operaciones, contratos, CFDI, pagos y evidencia
                  en expedientes vivos y en una lectura clara del riesgo fiscal para explicar, priorizar y remediar con orden.
                </p>

                <div className="surface-panel mb-8 grid gap-3 rounded-[1.5rem] p-4 sm:grid-cols-3">
                  {PROCESS_STEPS.map((step) => (
                    <div
                      key={step.step}
                      className="rounded-[1.15rem] border border-[rgba(200,192,177,0.52)] bg-white/70 px-4 py-4 text-left"
                    >
                      <p className="kicker-label mb-2">Paso {step.step}</p>
                      <p className="text-sm font-semibold leading-snug text-[var(--fiscal-ink)]">{step.title}</p>
                    </div>
                  ))}
                </div>

                <div className="mb-8 space-y-3">
                  {BENEFIT_POINTS.map((point) => (
                    <div key={point} className="flex items-start gap-3">
                      <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(45,91,136,0.08)] text-[var(--fiscal-accent)]">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </div>
                      <p className="text-sm leading-relaxed text-[var(--fiscal-muted)] sm:text-[0.96rem]">
                        {point}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start">
                  <Link
                    href="/demo"
                    className="button-institutional inline-flex h-14 items-center justify-center rounded-xl px-8 text-base font-bold transition-all hover:shadow-xl"
                  >
                    Solicitar demostración <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                  <a
                    href="#proceso"
                    className="inline-flex h-14 items-center justify-center rounded-xl border border-[rgba(200,192,177,0.85)] bg-[rgba(255,255,255,0.72)] px-8 text-base font-semibold text-[var(--fiscal-ink)] shadow-panel transition-colors hover:border-[var(--fiscal-accent)]/35 hover:text-[var(--fiscal-accent)]"
                  >
                    Ver cómo funciona
                  </a>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {HERO_METRICS.map((item) => (
                    <div key={item.label} className={`surface-panel rounded-2xl px-4 py-4 ${item.surface}`}>
                      <p className={`font-display text-2xl font-semibold ${item.tone}`}>{item.value}</p>
                      <p className="mt-1 text-xs font-medium leading-snug text-[var(--fiscal-muted)]">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative lg:pl-2">
                <div className="surface-panel-strong relative overflow-hidden rounded-[2rem] p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between gap-3 rounded-[1.2rem] border border-[rgba(200,192,177,0.65)] bg-[rgba(255,255,255,0.74)] px-4 py-3">
                    <div>
                      <p className="kicker-label mb-1">Vista para el despacho</p>
                      <p className="text-sm text-[var(--fiscal-muted)]">
                        Clientes, expedientes, FDI y acciones en una sola lectura.
                      </p>
                    </div>
                    <Users className="h-5 w-5 shrink-0 text-[var(--fiscal-accent)]" />
                  </div>

                  <div className="relative overflow-hidden rounded-[1.75rem] border border-[rgba(200,192,177,0.7)] bg-white p-3 shadow-fiscal">
                    <Image
                      src="/hero-image.webp"
                      alt="Despacho contable revisando clientes, expedientes y postura fiscal con Materialidad"
                      width={1600}
                      height={1200}
                      priority
                      sizes="(max-width: 1024px) 100vw, 720px"
                      className="h-[24rem] w-full rounded-[1.3rem] object-cover object-center sm:h-[28rem]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="plataforma" className="border-t border-[rgba(200,192,177,0.55)] py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-14 max-w-3xl">
              <p className="kicker-label mb-3">Producto</p>
              <h2 className="font-display text-4xl font-semibold text-[var(--fiscal-ink)] sm:text-5xl">
                Una plataforma para revisar mejor y explicar mejor.
              </h2>
              <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--fiscal-muted)]">
                Materialidad ayuda al despacho a concentrar expedientes, entender la postura fiscal del cliente
                y convertir revisión en un servicio más claro, trazable y rentable.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {PLATFORM_BLOCKS.map(({ title, description, icon: Icon, surface }) => (
                <div key={title} className="surface-panel-strong group rounded-panel p-7 transition-all hover:-translate-y-1 hover:shadow-fiscal">
                  <div className={`mb-6 flex h-12 w-12 items-center justify-center rounded-xl ${surface}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-2xl font-semibold text-[var(--fiscal-ink)]">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--fiscal-muted)]">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="proceso" className="border-t border-[rgba(200,192,177,0.55)] bg-[rgba(255,255,255,0.45)] py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-16 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <div>
                <p className="kicker-label mb-3">Proceso</p>
                <h2 className="font-display text-4xl font-semibold text-[var(--fiscal-ink)] sm:text-5xl">
                  Del archivo disperso a una lectura clara del cliente.
                </h2>
              </div>
              <p className="max-w-2xl text-lg leading-relaxed text-[var(--fiscal-muted)]">
                Desde la operación hasta la lectura ejecutiva, el despacho gana contexto, trazabilidad y claridad
                para explicar riesgos y siguientes pasos sin improvisar.
              </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
              <div className="surface-panel-strong overflow-hidden rounded-[2rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(243,239,231,0.94))] p-5 sm:p-6">
                <div className="overflow-hidden rounded-[1.5rem] border border-[rgba(200,192,177,0.6)] bg-white shadow-panel">
                  <Image
                    src="/executive-team-working.jpg"
                    alt="Despacho revisando información estratégica y operativa de clientes"
                    width={1600}
                    height={900}
                    sizes="(max-width: 1024px) 100vw, 760px"
                    className="h-auto w-full object-cover"
                  />
                </div>
              </div>

              <div className="surface-panel-strong rounded-[2rem] p-8">
                <div className="space-y-6">
                  {PROCESS_STEPS.map((step) => (
                    <div key={step.step} className="flex gap-4">
                      <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--fiscal-accent),#1f4468)] text-sm font-bold text-white shadow-panel">
                        {step.step}
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-[var(--fiscal-ink)]">{step.title}</h4>
                        <p className="mt-2 text-sm leading-relaxed text-[var(--fiscal-muted)]">{step.description}</p>
                      </div>
                    </div>
                  ))}

                  <div className="rounded-[1.5rem] border border-[rgba(200,192,177,0.65)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(243,239,231,0.9))] p-5">
                    <p className="kicker-label mb-3">Valor para el despacho</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-white/80 p-4 shadow-panel">
                        <CheckCircle2 className="h-5 w-5 text-[var(--fiscal-gold)]" />
                        <p className="mt-3 text-sm font-semibold text-[var(--fiscal-ink)]">Más orden</p>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--fiscal-muted)]">
                          Menos persecución de documentos y más tiempo en revisión y criterio profesional.
                        </p>
                      </div>
                      <div className="rounded-xl bg-white/80 p-4 shadow-panel">
                        <BarChart3 className="h-5 w-5 text-[var(--fiscal-accent)]" />
                        <p className="mt-3 text-sm font-semibold text-[var(--fiscal-ink)]">Más valor explicable</p>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--fiscal-muted)]">
                          El FDI ayuda a traducir la revisión en una conversación clara con el cliente.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="auditoria" className="border-t border-[rgba(200,192,177,0.55)] py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
              <div>
                <p className="kicker-label mb-3">Beneficios</p>
                <h2 className="font-display text-4xl font-semibold text-[var(--fiscal-ink)] sm:text-5xl">
                  Útil para revisión, auditoría y defensa fiscal del cliente.
                </h2>
                <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--fiscal-muted)]">
                  La plataforma le da al despacho una lectura más clara del caso, una base documental más ordenada
                  y una mejor capacidad para sostener explicaciones y remediaciones.
                </p>

                <div className="mt-8 space-y-4">
                  {REVIEW_USE_CASES.map(({ title, description, icon: Icon }) => (
                    <div key={title} className="surface-panel flex gap-4 rounded-[1.4rem] p-5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[rgba(45,91,136,0.08)] text-[var(--fiscal-accent)]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-[var(--fiscal-ink)]">{title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-[var(--fiscal-muted)]">{description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="surface-panel-strong overflow-hidden rounded-[2rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(243,239,231,0.94))] p-5 sm:p-6">
                <div className="overflow-hidden rounded-[1.5rem] border border-[rgba(200,192,177,0.6)] bg-white shadow-panel">
                  <Image
                    src="/audit-team-working.jpg"
                    alt="Despacho y equipo de revisión analizando evidencia y postura fiscal"
                    width={1600}
                    height={900}
                    sizes="(max-width: 1024px) 100vw, 760px"
                    className="h-auto w-full object-cover"
                  />
                </div>
              </div>
            </div>

            <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-3">
              {[
                {
                  title: 'Clientes mejor priorizados',
                  text: 'El despacho puede enfocar tiempo y criterio donde la postura fiscal realmente lo exige.',
                  icon: Users,
                  tone: 'text-[var(--fiscal-danger)] bg-[var(--fiscal-danger-soft)]',
                },
                {
                  title: 'Expedientes más claros',
                  text: 'La evidencia deja de estar fragmentada y se vuelve revisable, exportable y explicable.',
                  icon: FileSearch,
                  tone: 'text-[var(--fiscal-accent)] bg-[var(--fiscal-accent-soft)]',
                },
                {
                  title: 'Servicios de mayor valor',
                  text: 'La revisión fiscal se transforma en una lectura accionable que el cliente sí percibe.',
                  icon: Zap,
                  tone: 'text-[var(--fiscal-success)] bg-[var(--fiscal-success-soft)]',
                },
              ].map(({ title, text, icon: Icon, tone }) => (
                <div key={title} className="text-center">
                  <div className={`mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h4 className="text-base font-bold text-[var(--fiscal-ink)]">{title}</h4>
                  <p className="mt-2 text-sm text-[var(--fiscal-muted)]">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-[rgba(200,192,177,0.55)] bg-[rgba(255,255,255,0.45)] py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-14 text-center">
              <p className="kicker-label mb-3">Pensado para</p>
              <h2 className="font-display text-4xl font-semibold text-[var(--fiscal-ink)] sm:text-5xl">
                Equipos que quieren revisar con más contexto y explicar con más autoridad.
              </h2>
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              {AUDIENCES.map(({ title, description, icon: Icon }) => (
                <div key={title} className="surface-panel group rounded-panel p-8 text-center transition-all hover:-translate-y-1 hover:shadow-fiscal">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,rgba(45,91,136,0.10),rgba(184,137,70,0.08))]">
                    <Icon className="h-7 w-7 text-[var(--fiscal-accent)]" />
                  </div>
                  <h3 className="text-lg font-bold text-[var(--fiscal-ink)]">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--fiscal-muted)]">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="contacto" className="surface-shell relative overflow-hidden py-20">
          <div className="pointer-events-none absolute right-0 top-0 -mr-32 -mt-32 h-96 w-96 rounded-full bg-[rgba(184,137,70,0.10)] blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 -mb-20 -ml-20 h-72 w-72 rounded-full bg-[rgba(45,91,136,0.16)] blur-3xl" />
          <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <p className="eyebrow-shell mb-4 text-[rgba(184,137,70,0.82)]">Demostración</p>
            <h2 className="font-display text-4xl font-semibold text-white sm:text-5xl">
              Si tu despacho quiere revisar mejor, explicar mejor y escalar mejor, te mostramos la plataforma.
            </h2>
            <p className="mx-auto mt-4 mb-8 max-w-2xl text-lg leading-relaxed text-[rgba(216,211,200,0.78)]">
              Agenda una demostración y descubre cómo Materialidad ayuda a priorizar clientes, ordenar expedientes
              y convertir revisión fiscal en un servicio más claro y de mayor valor.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/demo"
                className="button-institutional inline-flex h-14 items-center justify-center rounded-xl px-10 text-base font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fiscal-accent)] sm:w-auto"
              >
                Quiero una demostración <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <a
                href="https://wa.me/526535388499"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-14 items-center justify-center rounded-xl border border-[rgba(216,211,200,0.18)] bg-white/8 px-8 text-base font-semibold text-white transition hover:bg-white/12"
              >
                WhatsApp <MessageCircle className="ml-2 h-4 w-4" />
              </a>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <a
                href="https://wa.me/526535388499"
                target="_blank"
                rel="noreferrer"
                className="rounded-[1.5rem] border border-[rgba(216,211,200,0.12)] bg-white/6 px-5 py-5 text-white transition hover:bg-white/10"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(37,211,102,0.16)] text-[#c8f4de]">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">WhatsApp</p>
                    <p className="text-sm text-[rgba(216,211,200,0.78)]">6535388499</p>
                  </div>
                </div>
              </a>

              <a
                href="mailto:proyectog40@gmail.com"
                className="rounded-[1.5rem] border border-[rgba(216,211,200,0.12)] bg-white/6 px-5 py-5 text-white transition hover:bg-white/10"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(45,91,136,0.18)] text-[rgba(216,232,246,0.95)]">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Correo</p>
                    <p className="text-sm text-[rgba(216,211,200,0.78)]">proyectog40@gmail.com</p>
                  </div>
                </div>
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[rgba(200,192,177,0.75)] bg-[rgba(255,255,255,0.7)] py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 text-center md:flex-row md:text-left sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(184,137,70,0.25)] bg-[linear-gradient(180deg,rgba(184,137,70,0.16),rgba(255,255,255,0.9))]">
              <Landmark className="h-4 w-4 text-[var(--fiscal-accent)]" />
            </div>
            <div>
              <p className="font-display text-lg font-semibold text-[var(--fiscal-ink)]">Materialidad</p>
              <p className="text-xs text-[var(--fiscal-muted)]">
                Una plataforma para que los despachos prioricen, expliquen y fortalezcan la postura fiscal de sus clientes.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-4 text-sm font-medium text-[var(--fiscal-muted)] sm:gap-6">
            <a href="#plataforma" className="transition-colors hover:text-[var(--fiscal-accent)]">Producto</a>
            <a href="#proceso" className="transition-colors hover:text-[var(--fiscal-accent)]">Proceso</a>
            <a href="#auditoria" className="transition-colors hover:text-[var(--fiscal-accent)]">Beneficios</a>
            <Link href="/demo" className="transition-colors hover:text-[var(--fiscal-accent)]">Demostración</Link>
          </div>

          <div className="text-sm text-[var(--fiscal-muted)]">
            &copy; {new Date().getFullYear()} Materialidad Fiscal. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}