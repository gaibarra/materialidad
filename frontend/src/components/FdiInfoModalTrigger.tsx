"use client";

import type { LucideIcon } from "lucide-react";
import {
  BookOpenCheck,
  FileSearch,
  FileText,
  Layers3,
  Scale,
  SearchCheck,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

const SECTION_CARD =
  "rounded-2xl border border-[rgba(200,192,177,0.65)] bg-[rgba(255,255,255,0.88)] p-4 shadow-sm";

const TRIGGER_CLASSNAME =
  "inline rounded-md font-medium text-[var(--fiscal-ink)] no-underline transition-colors hover:text-[var(--fiscal-accent)] hover:underline hover:decoration-[rgba(45,91,136,0.28)] hover:underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fiscal-accent)] focus-visible:ring-offset-2";

type HighlightTone = "blue" | "green" | "gold";

interface HighlightItem {
  title: string;
  description: string;
  icon: LucideIcon;
  tone: HighlightTone;
}

interface InlineInfoModalTriggerProps {
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  highlights: HighlightItem[];
  sectionTitle: string;
  sectionDescription: string;
  sectionItems: string[];
  utilityTitle: string;
  utilityParagraphs: string[];
  summary: string;
}

function toneClasses(tone: HighlightTone) {
  if (tone === "green") {
    return "bg-[var(--fiscal-success-soft)] text-[var(--fiscal-success)]";
  }
  if (tone === "gold") {
    return "bg-[rgba(142,231,218,0.12)] text-[var(--fiscal-gold)]";
  }
  return "bg-[var(--fiscal-accent-soft)] text-[var(--fiscal-accent)]";
}

function InlineInfoModalTrigger({
  label,
  eyebrow,
  title,
  description,
  highlights,
  sectionTitle,
  sectionDescription,
  sectionItems,
  utilityTitle,
  utilityParagraphs,
  summary,
}: InlineInfoModalTriggerProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className={TRIGGER_CLASSNAME}>
          {label}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto rounded-[28px] border-[rgba(200,192,177,0.82)] bg-[var(--fiscal-canvas)] p-0 shadow-2xl">
        <div className="border-b border-[rgba(200,192,177,0.65)] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(243,239,231,0.92))] px-6 py-5 sm:px-8">
          <p className="kicker-label mb-2">{eyebrow}</p>
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="font-display text-2xl font-semibold text-[var(--fiscal-ink)] sm:text-3xl">
              {title}
            </DialogTitle>
            <DialogDescription className="max-w-2xl text-sm leading-6 text-[var(--fiscal-muted)] sm:text-base">
              {description}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5 px-6 py-6 sm:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            {highlights.map(({ title: highlightTitle, description: highlightDescription, icon: Icon, tone }) => (
              <div key={highlightTitle} className={SECTION_CARD}>
                <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${toneClasses(tone)}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-[var(--fiscal-ink)]">{highlightTitle}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--fiscal-muted)]">{highlightDescription}</p>
              </div>
            ))}
          </div>

          <section className={SECTION_CARD}>
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(45,91,136,0.08)] text-[var(--fiscal-accent)]">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--fiscal-ink)]">{sectionTitle}</h3>
                <p className="text-sm text-[var(--fiscal-muted)]">{sectionDescription}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {sectionItems.map((item) => (
                <div key={item} className="rounded-xl border border-[rgba(25,36,52,0.08)] bg-white/85 px-4 py-3 text-sm leading-6 text-[var(--fiscal-muted)]">
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className={SECTION_CARD}>
            <h3 className="text-lg font-semibold text-[var(--fiscal-ink)]">{utilityTitle}</h3>
            <div className="mt-3 space-y-3 text-sm leading-6 text-[var(--fiscal-muted)]">
              {utilityParagraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-[rgba(143,240,224,0.28)] bg-[rgba(142,231,218,0.08)] px-4 py-3 text-sm leading-6 text-[var(--fiscal-ink)]">
              {summary}
            </div>
          </section>

          <div className="flex justify-end pb-1">
            <DialogClose asChild>
              <button
                type="button"
                className="button-institutional inline-flex min-h-[44px] items-center justify-center rounded-xl px-5 text-sm font-semibold"
              >
                Entendido
              </button>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function FdiInfoModalTrigger() {
  return (
    <InlineInfoModalTrigger
      label="FDI Índice de Defensa Fiscal"
      eyebrow="Defensa fiscal"
      title="FDI Índice de Defensa Fiscal"
      description="Es una lectura estructurada para explicar por qué una operación sí tiene sustancia, soporte y coherencia frente a una revisión interna, externa o fiscal."
      highlights={[
        {
          title: "Qué integra",
          description: "Reúne contrato, operación real, evidencia documental, contexto de negocio y criterios fiscales en una sola lectura.",
          icon: Layers3,
          tone: "blue",
        },
        {
          title: "Qué explica",
          description: "Ordena la narrativa fiscal para que la postura no dependa de memoria, correos o interpretaciones aisladas.",
          icon: Scale,
          tone: "green",
        },
        {
          title: "Para qué sirve",
          description: "Reduce improvisación al momento de responder revisiones, comités, auditorías o requerimientos de autoridad.",
          icon: ShieldCheck,
          tone: "gold",
        },
      ]}
      sectionTitle="Cómo se conforma"
      sectionDescription="El FDI toma piezas operativas y fiscales para ordenar el caso y medir qué tan bien está soportado."
      sectionItems={[
        "Contrato y alcance real de la relación comercial.",
        "Evidencia de ejecución: entregables, comunicación, CFDI, pagos y soporte documental.",
        "Contexto de negocio: necesidad, lógica económica y trazabilidad de la decisión.",
        "Consulta fiscal aplicada al caso y postura lista para revisión.",
      ]}
      utilityTitle="Utilidad práctica"
      utilityParagraphs={[
        "Permite que dirección, auditoría, fiscal y despacho lean la misma historia con distintos niveles de detalle, pero sin contradicciones.",
        "También facilita identificar vacíos de soporte, reforzar la explicación del caso y preparar una mejor respuesta antes de una revisión formal.",
      ]}
      summary="En resumen: el FDI reúne información operativa y fiscal para explicar el caso, detectar huecos y priorizar acciones."
    />
  );
}

export function ConsultaLegalInfoModalTrigger() {
  return (
    <InlineInfoModalTrigger
      label="Consulta Legal"
      eyebrow="Criterio aplicado"
      title="Consulta Legal"
      description="Es el módulo donde una duda concreta se transforma en un criterio utilizable, documentado y conectado con la operación real que necesita respaldo."
      highlights={[
        {
          title: "Qué recibe",
          description: "Parte de una pregunta específica, el contexto del caso y la información operativa disponible al momento de la consulta.",
          icon: SearchCheck,
          tone: "blue",
        },
        {
          title: "Qué produce",
          description: "Devuelve una respuesta accionable con enfoque práctico, vinculada con riesgos, postura y necesidad documental.",
          icon: FileSearch,
          tone: "green",
        },
        {
          title: "Qué aporta",
          description: "Evita respuestas aisladas y ayuda a que la interpretación fiscal quede conectada con la ejecución del caso.",
          icon: ShieldCheck,
          tone: "gold",
        },
      ]}
      sectionTitle="Cómo se conforma"
      sectionDescription="La Consulta Legal combina pregunta, contexto y criterio para volver útil la respuesta desde el primer momento."
      sectionItems={[
        "Descripción concreta del caso, riesgo o duda que necesita resolverse.",
        "Contexto documental y operativo disponible al momento de la revisión.",
        "Respuesta con criterio fiscal aplicable, observaciones y línea de acción sugerida.",
        "Vinculación con contratos, expedientes, evidencia o postura del caso cuando corresponde.",
      ]}
      utilityTitle="Utilidad práctica"
      utilityParagraphs={[
        "Ayuda a responder más rápido y con mejor fundamento, sin separar el criterio técnico de la realidad operativa del caso.",
        "También deja registro de por qué se tomó una postura y qué soporte debe acompañarla."
      ]}
      summary="En resumen: la Consulta Legal convierte dudas puntuales en criterios claros, accionables y trazables."
    />
  );
}

export function MaterialidadAuditoriaInfoModalTrigger() {
  return (
    <InlineInfoModalTrigger
      label="Materialidad de Auditoría"
      eyebrow="Juicio profesional"
      title="Materialidad de Auditoría"
      description="Es la capacidad de traducir benchmarks, umbrales y hallazgos en un expediente estructurado para planear, discutir y documentar el juicio de auditoría."
      highlights={[
        {
          title: "Qué determina",
          description: "Ayuda a definir materialidad global, materialidad de ejecución y umbrales de manera consistente con el contexto del encargo.",
          icon: Scale,
          tone: "blue",
        },
        {
          title: "Qué documenta",
          description: "Ordena hallazgos, severidad, narrativa, sensibilidad y soporte en una sola vista de trabajo.",
          icon: BookOpenCheck,
          tone: "green",
        },
        {
          title: "Qué facilita",
          description: "Prepara revisiones internas, auditor externo y comité sin rehacer papeles de trabajo en cada sesión.",
          icon: Sparkles,
          tone: "gold",
        },
      ]}
      sectionTitle="Cómo se conforma"
      sectionDescription="La Materialidad de Auditoría articula criterio cuantitativo y hallazgos cualitativos para dejar trazabilidad del juicio."
      sectionItems={[
        "Selección del benchmark más representativo según utilidad, ingresos, activos, capital o gasto.",
        "Definición de materialidad global, de ejecución y claramente trivial con sustento visible.",
        "Registro de hallazgos con monto, severidad, impacto cualitativo y recomendación.",
        "Historial, versión y exportables listos para revisión, comité o archivo de auditoría.",
      ]}
      utilityTitle="Utilidad práctica"
      utilityParagraphs={[
        "Permite defender por qué se eligió cierto benchmark y cómo se priorizaron hallazgos dentro del expediente de auditoría.",
        "También mejora la conversación entre equipo, revisores y comité porque todos parten del mismo marco documentado."
      ]}
      summary="En resumen: la Materialidad de Auditoría convierte juicio técnico en un expediente claro, consistente y listo para revisión."
    />
  );
}
