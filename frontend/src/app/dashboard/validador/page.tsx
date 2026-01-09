"use client";

import { useState } from "react";

import { DashboardShell } from "../../../components/DashboardShell";
import { alertError } from "../../../lib/alerts";
import { validarCfdiSpei, ValidacionCFDISPEI } from "../../../lib/validador";

const STATUS_MAP: Record<string, { label: string; tone: string }> = {
  PENDIENTE: { label: "Pendiente", tone: "border-white/20 text-white" },
  VALIDO: { label: "Válido", tone: "border-emerald-300/60 text-emerald-200 bg-emerald-500/10" },
  INVALIDO: { label: "Inválido", tone: "border-red-300/60 text-red-200 bg-red-500/10" },
  VALIDADO: { label: "Validado", tone: "border-emerald-300/60 text-emerald-200 bg-emerald-500/10" },
  NO_ENCONTRADO: { label: "No encontrado", tone: "border-amber-300/60 text-amber-200 bg-amber-500/10" },
};

function Badge({ status }: { status: string }) {
  const data = STATUS_MAP[status] || { label: status, tone: "border-white/20 text-white" };
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${data.tone}`}>
      {data.label}
    </span>
  );
}

export default function ValidadorCFDISPEI() {
  const [uuid, setUuid] = useState("");
  const [referencia, setReferencia] = useState("");
  const [monto, setMonto] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ValidacionCFDISPEI | null>(null);

  const handleValidate = async () => {
    if (!uuid && !referencia) {
      await alertError("Faltan datos", "Captura UUID de CFDI o referencia SPEI");
      return;
    }
    setLoading(true);
    try {
      const res = await validarCfdiSpei({ uuid_cfdi: uuid || undefined, referencia_spei: referencia || undefined, monto: monto || undefined });
      setResultado(res);
    } catch (e) {
      await alertError("No pudimos validar", (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6 text-white">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/40 to-emerald-900/30 p-6 shadow-2xl shadow-emerald-500/20">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Validador</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">CFDI / SPEI</h1>
          <p className="mt-2 text-sm text-slate-200">Verifica UUID de CFDI y referencia SPEI en un solo paso.</p>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.3fr,1fr]">
          <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs text-slate-300">UUID CFDI</p>
                <input
                  className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-950/60 px-3 py-2 text-white"
                  value={uuid}
                  onChange={(e) => setUuid(e.target.value)}
                  placeholder="UUID del CFDI"
                />
              </div>
              <div>
                <p className="text-xs text-slate-300">Referencia SPEI</p>
                <input
                  className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-950/60 px-3 py-2 text-white"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder="Referencia de pago"
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-xs text-slate-300">Monto (opcional)</p>
                <input
                  className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-950/60 px-3 py-2 text-white"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="md:col-span-2 flex items-end">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void handleValidate()}
                  className="w-full rounded-2xl border border-emerald-400/60 bg-emerald-500/15 px-4 py-3 text-base font-semibold text-emerald-200 hover:border-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Validando…" : "Validar"}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-6 text-sm">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-300">Resultado</p>
            {!resultado && <p className="mt-3 text-slate-300">Ingresa datos y ejecuta la validación.</p>}
            {resultado && (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge status={resultado.cfdi_estatus} />
                  <Badge status={resultado.spei_estatus} />
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-slate-200">
                  <p><span className="text-slate-400">UUID:</span> {resultado.uuid_cfdi || "N/D"}</p>
                  <p><span className="text-slate-400">Referencia SPEI:</span> {resultado.referencia_spei || "N/D"}</p>
                  <p><span className="text-slate-400">Monto:</span> {resultado.monto || "N/D"}</p>
                  {resultado.operacion_id && (
                    <p className="text-emerald-200 mt-1">Guardado en operación #{resultado.operacion_id}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
