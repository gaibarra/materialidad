"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DeliverableRequirement } from "../lib/checklists";

interface Props {
  requisitos: DeliverableRequirement[];
  value: number | null;
  onChange: (id: string) => void;
}

export function RequisitoCombobox({ requisitos, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Label del ítem seleccionado
  const selectedLabel = useMemo(() => {
    if (!value) return "";
    const req = requisitos.find((r) => r.id === value);
    return req ? `${req.codigo} · ${req.titulo}` : "";
  }, [value, requisitos]);

  // Opciones filtradas y agrupadas por tipo_gasto
  const groups = useMemo(() => {
    const q = query.toLowerCase().trim();
    const filtered = q
      ? requisitos.filter(
          (r) =>
            r.codigo.toLowerCase().includes(q) ||
            r.titulo.toLowerCase().includes(q) ||
            r.tipo_gasto.toLowerCase().includes(q) ||
            (r.descripcion ?? "").toLowerCase().includes(q)
        )
      : requisitos;

    const map = new Map<string, DeliverableRequirement[]>();
    for (const r of filtered) {
      const key = r.tipo_gasto || "General";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [requisitos, query]);

  const totalFiltered = groups.reduce((acc, [, items]) => acc + items.length, 0);

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    setOpen(true);
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleOpen}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm transition text-left ${
          open
            ? "border-emerald-400 ring-1 ring-emerald-400/30 bg-slate-700/80"
            : "border-white/15 bg-slate-700/60 hover:border-white/30"
        }`}
      >
        <span className={selectedLabel ? "text-white truncate" : "text-slate-500"}>
          {selectedLabel || "Sin plantilla — escribe para buscar…"}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {value && (
            <span
              role="button"
              onClick={handleClear}
              className="flex h-4 w-4 items-center justify-center rounded-full bg-white/15 text-[10px] text-slate-300 hover:bg-white/25 hover:text-white"
              title="Limpiar selección"
            >
              ✕
            </span>
          )}
          <svg
            className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-white/15 bg-slate-800 shadow-2xl shadow-black/50">
          {/* Search input */}
          <div className="border-b border-white/10 p-2">
            <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-slate-700/60 px-3 py-2">
              <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por código, título o tipo de gasto…"
                className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} className="text-slate-400 hover:text-white">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <p className="mt-1 px-1 text-[10px] text-slate-500">
              {totalFiltered} plantilla{totalFiltered !== 1 ? "s" : ""}
              {query ? ` para "${query}"` : " disponibles"}
            </p>
          </div>

          {/* Options list */}
          <div className="max-h-72 overflow-y-auto">
            {/* Opción limpiar */}
            <button
              type="button"
              onClick={() => handleSelect("")}
              className={`w-full px-3 py-2 text-left text-xs transition hover:bg-white/8 ${
                !value ? "bg-emerald-500/10 text-emerald-300" : "text-slate-400"
              }`}
            >
              — Sin plantilla
            </button>

            {groups.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-slate-500 italic">
                Sin resultados para &quot;{query}&quot;
              </p>
            )}

            {groups.map(([tipoGasto, items]) => (
              <div key={tipoGasto}>
                {/* Group header */}
                <div className="sticky top-0 bg-slate-750 border-y border-white/8 bg-slate-800/95 px-3 py-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-400">
                    {tipoGasto}
                    <span className="ml-2 text-slate-500 normal-case tracking-normal font-normal">
                      ({items.length})
                    </span>
                  </p>
                </div>
                {/* Items */}
                {items.map((req) => {
                  const isSelected = req.id === value;
                  return (
                    <button
                      key={req.id}
                      type="button"
                      onClick={() => handleSelect(String(req.id))}
                      className={`w-full px-3 py-2.5 text-left transition hover:bg-white/8 ${
                        isSelected ? "bg-emerald-500/15" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 shrink-0 rounded bg-slate-600/60 px-1.5 py-0.5 text-[10px] font-bold text-slate-300 font-mono">
                          {req.codigo}
                        </span>
                        <div className="min-w-0">
                          <p className={`text-xs font-semibold leading-snug truncate ${isSelected ? "text-emerald-300" : "text-white"}`}>
                            {req.titulo}
                          </p>
                          {req.descripcion && (
                            <p className="mt-0.5 text-[11px] text-slate-400 line-clamp-1 leading-snug">
                              {req.descripcion}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <span className="ml-auto shrink-0 text-emerald-400 text-xs">✓</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
