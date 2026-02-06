"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DashboardShell } from "../../../components/DashboardShell";
import { apiFetch } from "../../../lib/api";

type Empresa = {
  id: number;
  razon_social: string;
  rfc: string;
  regimen_fiscal: string;
  estado: string;
  ciudad: string;
  activo: boolean;
};

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export default function EmpresasPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadEmpresas = async () => {
      try {
        setIsLoading(true);
        const response = await apiFetch<PaginatedResponse<Empresa>>("/api/materialidad/empresas/");
        if (isActive) {
          setEmpresas(response.results ?? []);
          setError(null);
        }
      } catch (err) {
        if (isActive) {
          setError(err instanceof Error ? err.message : "Error al cargar empresas");
        }
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    void loadEmpresas();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-sky-500">Base operativa</p>
            <h2 className="text-2xl font-semibold text-slate-900">Empresas</h2>
            <p className="text-slate-600">Listado de empresas registradas en el tenant.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          {isLoading ? (
            <p className="text-slate-500">Cargando empresas…</p>
          ) : error ? (
            <p className="text-rose-600">{error}</p>
          ) : empresas.length === 0 ? (
            <p className="text-slate-500">No hay empresas registradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="py-3 pr-4">Razón social</th>
                    <th className="py-3 pr-4">RFC</th>
                    <th className="py-3 pr-4">Régimen</th>
                    <th className="py-3 pr-4">Estado</th>
                    <th className="py-3 pr-4">Ciudad</th>
                    <th className="py-3 pr-4">Estatus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {empresas.map((empresa) => (
                    <tr key={empresa.id} className="hover:bg-slate-50">
                      <td className="py-3 pr-4">
                        <Link
                          className="font-semibold text-slate-900 hover:text-sky-600"
                          href={`/dashboard/empresas/${empresa.id}`}
                        >
                          {empresa.razon_social}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{empresa.rfc}</td>
                      <td className="py-3 pr-4 text-slate-600">{empresa.regimen_fiscal}</td>
                      <td className="py-3 pr-4 text-slate-600">{empresa.estado}</td>
                      <td className="py-3 pr-4 text-slate-600">{empresa.ciudad}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={
                            empresa.activo
                              ? "rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-600"
                              : "rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-600"
                          }
                        >
                          {empresa.activo ? "Activa" : "Inactiva"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
