"use client";

import { DashboardShell } from "../../../components/DashboardShell";

export default function ExpedientesPage() {
  const expedientes = [] as Array<{ titulo: string; estado: string; enlace?: string }>;

  return (
    <DashboardShell>
      <div className="space-y-6 text-white">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/40 to-emerald-900/30 p-6 shadow-2xl shadow-emerald-500/20">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Materialidad</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Expedientes digitales</h1>
          <p className="mt-2 text-sm text-slate-200">Aquí verás los expedientes consolidados de contratos, CFDI y evidencias por operación.</p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm">
          {expedientes.length === 0 ? (
            <p className="text-slate-300">Aún no hay expedientes generados. Cuando cierres un expediente completo aparecerá aquí con su enlace de descarga.</p>
          ) : (
            <div className="space-y-3">
              {expedientes.map((e, idx) => (
                <div key={idx} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-base font-semibold text-white">{e.titulo}</p>
                    <span className="text-xs text-emerald-200">{e.estado}</span>
                  </div>
                  {e.enlace && (
                    <a
                      href={e.enlace}
                      className="mt-2 inline-block text-xs text-emerald-300 underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver expediente
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
