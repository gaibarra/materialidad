"use client";

import { useState } from "react";

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
};

/* ── Component ── */

export function GuiaContador({
    section,
    steps,
    concepts = [],
    tips = [],
    defaultOpen = false,
}: GuiaContadorProps) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold shadow-sm transition-all ${open
                        ? "border-sky-400 bg-sky-50 text-sky-700 hover:bg-sky-100"
                        : "border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-600"
                    }`}
            >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-600">
                    ?
                </span>
                {open ? "Ocultar guía" : "Guía del contador"}
            </button>

            {open && (
                <div className="col-span-full space-y-4 rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm">
                    {/* Title */}
                    <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-lg">
                            📘
                        </span>
                        <div>
                            <h3 className="text-base font-semibold text-sky-900">
                                Guía rápida — {section}
                            </h3>
                            <p className="text-xs text-sky-600">
                                Sigue estos pasos para completar esta sección correctamente.
                            </p>
                        </div>
                    </div>

                    {/* Steps */}
                    <div className="grid gap-3 sm:grid-cols-2">
                        {steps.map((step, i) => (
                            <div
                                key={i}
                                className="rounded-xl border border-sky-100 bg-white p-3"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                                        {i + 1}
                                    </span>
                                    <p className="text-sm font-semibold text-slate-800">
                                        {step.title}
                                    </p>
                                </div>
                                <p
                                    className="mt-1.5 text-xs text-slate-500"
                                    dangerouslySetInnerHTML={{ __html: step.description }}
                                />
                            </div>
                        ))}
                    </div>

                    {/* Concepts */}
                    {concepts.length > 0 && (
                        <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                                💡 Conceptos clave
                            </p>
                            <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
                                {concepts.map((c, i) => (
                                    <li key={i}>
                                        <strong className="text-slate-800">{c.term}</strong> —{" "}
                                        {c.definition}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Tips */}
                    {tips.length > 0 && (
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                                ✅ Recomendaciones
                            </p>
                            <ul className="mt-2 space-y-1 text-xs text-slate-600">
                                {tips.map((tip, i) => (
                                    <li
                                        key={i}
                                        dangerouslySetInnerHTML={{ __html: `• ${tip}` }}
                                    />
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
