"use client";

import { useState } from "react";

import { DashboardShell } from "../../../components/DashboardShell";
import { alertError } from "../../../lib/alerts";
import { compararPrecios, Cotizacion, ComparativoResponse } from "../../../lib/precios";

const MONEDAS: Array<Cotizacion["moneda"]> = ["MXN", "USD", "EUR"];

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
      {label}
    </span>
  );
}

export default function ComparadorPreciosPage() {
  const [concepto, setConcepto] = useState("");
  const [items, setItems] = useState<Cotizacion[]>([
    { descripcion: "", proveedor: "", precio: 0, moneda: "MXN" },
    { descripcion: "", proveedor: "", precio: 0, moneda: "MXN" },
  ]);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ComparativoResponse | null>(null);

  const updateItem = (idx: number, data: Partial<Cotizacion>) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...data };
    setItems(next);
  };

  const addItem = () => setItems([...items, { descripcion: "", proveedor: "", precio: 0, moneda: "MXN" }]);

  const handleSubmit = async () => {
    if (!concepto.trim()) {
      await alertError("Falta concepto", "Describe el bien o servicio que estás comparando");
      return;
    }
    if (items.length < 2) {
      await alertError("Faltan cotizaciones", "Captura al menos dos proveedores");
      return;
    }
    if (items.some((i) => !i.proveedor.trim() || !i.descripcion.trim() || !i.precio)) {
      await alertError("Datos incompletos", "Completa proveedor, descripción y precio en cada fila");
      return;
    }
    setLoading(true);
    try {
      const res = await compararPrecios({ concepto: concepto.trim(), items });
      setResultado(res);
    } catch (e) {
      await alertError("No pudimos comparar", (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6 text-slate-900">
        <header className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-sky-50 to-emerald-50 p-6 shadow-lg">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-700">Compras</p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-900">Comparador de precios</h1>
          <p className="mt-2 text-sm text-slate-600">Carga cotizaciones de proveedores y obtén la mejor opción con ahorros calculados.</p>
        </header>

        <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-6 text-sm shadow-sm">
          <div>
            <p className="text-xs text-slate-600">Concepto</p>
            <input
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Ej. Servicio de auditoría, equipo de cómputo"
            />
          </div>
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
                <input
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  placeholder="Proveedor"
                  value={item.proveedor}
                  onChange={(e) => updateItem(idx, { proveedor: e.target.value })}
                />
                <input
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  placeholder="Descripción"
                  value={item.descripcion}
                  onChange={(e) => updateItem(idx, { descripcion: e.target.value })}
                />
                <input
                  type="number"
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  placeholder="Precio"
                  value={item.precio}
                  onChange={(e) => updateItem(idx, { precio: Number(e.target.value) })}
                />
                <select
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  value={item.moneda}
                  onChange={(e) => updateItem(idx, { moneda: e.target.value as Cotizacion["moneda"] })}
                >
                  {MONEDAS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <button type="button" className="text-xs font-semibold text-emerald-700 hover:text-emerald-600" onClick={addItem}>
            + Añadir cotización
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleSubmit()}
            className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-base font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Calculando…" : "Comparar"}
          </button>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm shadow-sm">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-600">Resultado</p>
          {!resultado && <p className="mt-3 text-slate-700">Carga al menos dos cotizaciones y ejecuta la comparación.</p>}
          {resultado && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge label={`Mejor: ${resultado.mejor_opcion.proveedor} (${resultado.mejor_opcion.precio} ${resultado.mejor_opcion.moneda})`} />
                <Badge label={`Peor: ${resultado.peor_opcion.proveedor}`} />
              </div>
              <p className="text-xl sm:text-2xl font-semibold text-slate-900">Ahorro vs. promedio: {resultado.ahorro_vs_promedio.toFixed(2)} {resultado.mejor_opcion.moneda}</p>
              <p className="text-slate-700">Diferencia entre mejor y peor: {resultado.diferencia_porcentual.toFixed(2)}%</p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {resultado.items_ordenados.map((item, idx) => (
                  <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="text-sm font-semibold text-slate-900">{item.proveedor}</p>
                    <p className="text-xs text-slate-600">{item.descripcion}</p>
                    <p className="mt-1 text-slate-900">{item.precio} {item.moneda}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
