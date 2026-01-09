"use client";

import { DashboardShell } from "../../../components/DashboardShell";

export default function AlertasPage() {
  const alertas = [] as Array<{ titulo: string; detalle: string; nivel: "BAJO" | "MEDIO" | "ALTO" }>;

  return (
    <DashboardShell>
      <div className="space-y-6 text-white">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/40 to-emerald-900/30 p-6 shadow-2xl shadow-emerald-500/20">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">ESG</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Alertas ESG</h1>
          <p className="mt-2 text-sm text-slate-200">Riesgos e incidencias ambientales, sociales y de gobernanza detectadas en el cliente.</p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm">
          {alertas.length === 0 ? (
            <p className="text-slate-300">No hay alertas activas. Cuando se detecten riesgos ESG aparecerán aquí.</p>
          ) : (
            <div className="space-y-3">
              {alertas.map((a, idx) => (
                <div key={idx} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-base font-semibold text-white">{a.titulo}</p>
                    <span className="rounded-full border border-emerald-300/60 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">{a.nivel}</span>
                  </div>
                  <p className="mt-1 text-slate-200">{a.detalle}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
