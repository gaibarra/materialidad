"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/* ── Types ── */

type GuiaStep = {
    title: string;
    description: string;
};

type GuiaConcept = {
    term: string;
    definition: string;
};

export type GuiaContadorProps = {
    /** Section subtitle shown above the title */
    section: string;
    /** Steps with numbered instructions */
    steps: GuiaStep[];
    /** Key concepts for this section */
    concepts?: GuiaConcept[];
    /** Practical recommendations */
    tips?: string[];
    /** Default open state */
    defaultOpen?: boolean;
    /** Callback when user closes the guide (used when controlled by parent) */
    onClose?: () => void;
    /** Display mode for the guide body */
    variant?: "inline" | "modal";
};

function GuiaContadorContent({
    section,
    steps,
    concepts,
    tips,
}: {
    section: string;
    steps: GuiaStep[];
    concepts: GuiaConcept[];
    tips: string[];
}) {
    return (
        <>
            <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[rgba(143,240,224,0.22)] bg-[rgba(142,231,218,0.12)] font-display text-sm font-semibold text-[var(--fiscal-gold)]">
                    GC
                </span>
                <div>
                    <p className="kicker-label">Criterio operativo</p>
                    <h3 className="mt-2 font-display text-lg font-semibold tracking-tight text-[var(--fiscal-ink)]">
                        Guía rápida — {section}
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm text-slate-600">
                        Orden sugerido para capturar evidencia suficiente, mantener trazabilidad y evitar huecos en la defensa documental.
                    </p>
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                {steps.map((step, i) => (
                    <div
                        key={i}
                        className="rounded-2xl border border-[rgba(25,36,52,0.08)] bg-white/90 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)]"
                    >
                        <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[rgba(143,240,224,0.18)] bg-[rgba(142,231,218,0.12)] text-xs font-bold text-[var(--fiscal-gold)]">
                                {i + 1}
                            </span>
                            <p className="text-sm font-semibold text-[var(--fiscal-ink)]">
                                {step.title}
                            </p>
                        </div>
                        <p
                            className="mt-2 text-sm leading-6 text-slate-600"
                            dangerouslySetInnerHTML={{ __html: step.description }}
                        />
                    </div>
                ))}
            </div>

            {concepts.length > 0 && (
                <div className="rounded-2xl border border-[rgba(143,240,224,0.2)] bg-[linear-gradient(180deg,rgba(142,231,218,0.10),rgba(255,255,255,0.88))] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--fiscal-gold)]">
                        Conceptos clave
                    </p>
                    <ul className="mt-3 space-y-2 text-sm text-slate-600">
                        {concepts.map((c, i) => (
                            <li key={i}>
                                <strong className="text-[var(--fiscal-ink)]">{c.term}</strong> — {" "}
                                {c.definition}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {tips.length > 0 && (
                <div className="rounded-2xl border border-[rgba(25,36,52,0.1)] bg-white/85 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                        Recomendaciones
                    </p>
                    <ul className="mt-3 space-y-2 text-sm text-slate-600">
                        {tips.map((tip, i) => (
                            <li
                                key={i}
                                dangerouslySetInnerHTML={{ __html: `• ${tip}` }}
                            />
                        ))}
                    </ul>
                </div>
            )}
        </>
    );
}

/* ── Component ── */

export function GuiaContador({
    section,
    steps,
    concepts = [],
    tips = [],
    defaultOpen = false,
    onClose,
    variant = "inline",
}: GuiaContadorProps) {
    const [open, setOpen] = useState(defaultOpen);

    useEffect(() => {
        if (!open || variant !== "modal") return;

        const previousOverflow = document.body.style.overflow;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setOpen(false);
                onClose?.();
            }
        };

        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [open, onClose, variant]);

    const handleToggle = () => {
        const next = !open;
        setOpen(next);
        if (!next && onClose) onClose();
    };

    const modalContent = open && variant === "modal" ? (
        <div className="fixed inset-0 z-[240] flex items-center justify-center bg-[rgba(15,23,42,0.52)] px-4 py-6 backdrop-blur-sm" onClick={() => {
            setOpen(false);
            onClose?.();
        }}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label={`Guía del contador: ${section}`}
                className="surface-panel relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[32px] border-[rgba(143,240,224,0.2)] p-5 shadow-[0_36px_120px_rgba(15,23,42,0.22)] sm:p-6"
                onClick={(event) => event.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={() => {
                        setOpen(false);
                        onClose?.();
                    }}
                    className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(25,36,52,0.12)] bg-white/90 text-slate-500 transition hover:border-[rgba(143,240,224,0.24)] hover:text-[var(--fiscal-ink)]"
                    aria-label="Cerrar guía"
                >
                    <X className="h-4 w-4" />
                </button>

                <div className="space-y-5 pr-10">
                    <GuiaContadorContent
                        section={section}
                        steps={steps}
                        concepts={concepts}
                        tips={tips}
                    />
                </div>
            </div>
        </div>
    ) : null;

    return (
        <>
            <button
                type="button"
                onClick={handleToggle}
                aria-expanded={open}
                className={`inline-flex items-center gap-3 rounded-full border px-4 py-2.5 text-sm font-semibold shadow-sm transition-all ${open
                        ? "border-[rgba(143,240,224,0.35)] bg-[rgba(142,231,218,0.12)] text-[var(--fiscal-ink)]"
                        : "border-[rgba(25,36,52,0.12)] bg-white/90 text-slate-700 hover:border-[rgba(143,240,224,0.28)] hover:text-[var(--fiscal-ink)]"
                    }`}
            >
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[rgba(143,240,224,0.2)] bg-[rgba(142,231,218,0.12)] text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--fiscal-gold)]">
                    GC
                </span>
                {open ? "Ocultar guía" : "Guía del contador"}
            </button>

            {open && variant === "inline" && (
                <div className="surface-panel col-span-full space-y-5 rounded-[28px] border-[rgba(143,240,224,0.18)] p-5 sm:p-6">
                    <GuiaContadorContent
                        section={section}
                        steps={steps}
                        concepts={concepts}
                        tips={tips}
                    />
                </div>
            )}

            {modalContent && typeof document !== "undefined" ? createPortal(modalContent, document.body) : null}
        </>
    );
}
