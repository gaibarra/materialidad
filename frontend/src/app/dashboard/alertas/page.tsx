"use client";

import { DashboardShell } from "../../../components/DashboardShell";

export default function AlertasPage() {
  const alertas = [] as Array<{ titulo: string; detalle: string; nivel: "BAJO" | "MEDIO" | "ALTO" }>;

  return (
    <DashboardShell>
      <div className="space-y-6 text-slate-900">
        <header className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-sky-50 to-emerald-50 p-6 shadow-lg">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-700">ESG</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Alertas ESG</h1>
          <p className="mt-2 text-sm text-slate-600">Riesgos e incidencias ambientales, sociales y de gobernanza detectadas en el cliente.</p>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 text-sm shadow-sm">
          {alertas.length === 0 ? (
            <p className="text-slate-700">No hay alertas activas. Cuando se detecten riesgos ESG aparecerán aquí.</p>
          ) : (
            <div className="space-y-3">
              {alertas.map((a, idx) => (
                <div key={idx} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-base font-semibold text-slate-900">{a.titulo}</p>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{a.nivel}</span>
                  </div>
                  <p className="mt-1 text-slate-700">{a.detalle}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
