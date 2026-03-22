"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, HelpCircle, Lightbulb, ListChecks } from "lucide-react";

interface HelpGuideProps {
  steps?: string[];
  concepts?: { term: string; definition: string }[];
  tips?: string[];
}

/**
 * Collapsible contextual-help widget used across dashboard pages.
 * Shows numbered steps, key concepts, and actionable tips.
 */
export default function HelpGuide({ steps = [], concepts = [], tips = [] }: HelpGuideProps) {
  const [open, setOpen] = useState(false);

  const hasContent = steps.length > 0 || concepts.length > 0 || tips.length > 0;
  if (!hasContent) return null;

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left select-none"
      >
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-500">
          <HelpCircle className="h-4 w-4" />
          Guía rápida
        </span>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
        />
      </button>

      {open && (
        <div className="space-y-5 px-4 pb-5">
          {/* Steps */}
          {steps.length > 0 && (
            <div>
              <h4 className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
                <ListChecks className="h-4 w-4 text-blue-500" />
                Pasos a seguir
              </h4>
              <ol className="space-y-2 pl-1">
                {steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                      {i + 1}
                    </span>
                    <span className="text-sm text-slate-600 leading-snug">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Concepts */}
          {concepts.length > 0 && (
            <div>
              <h4 className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
                <BookOpen className="h-4 w-4 text-amber-500" />
                Conceptos clave
              </h4>
              <dl className="space-y-2 pl-1">
                {concepts.map((c, i) => (
                  <div key={i}>
                    <dt className="text-sm font-semibold text-slate-800">{c.term}</dt>
                    <dd className="text-sm text-slate-500 leading-snug">{c.definition}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Tips */}
          {tips.length > 0 && (
            <div>
              <h4 className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Consejos prácticos
              </h4>
              <ul className="space-y-1.5 pl-1">
                {tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
