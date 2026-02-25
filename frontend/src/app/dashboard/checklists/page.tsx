"use client";

import { useEffect, useMemo, useState } from "react";

import { DashboardShell } from "../../../components/DashboardShell";
import { GuiaContador } from "../../../components/GuiaContador";
import { alertError, alertSuccess } from "../../../lib/alerts";
import {
  Checklist,
  ChecklistItem,
  ITEM_STATES,
  PILLARS,
  createChecklist,
  updateChecklistItem,
  fetchChecklists,
  fetchDeliverableRequirements,
  createDeliverableRequirement,
  DeliverableRequirement,
} from "../../../lib/checklists";

type DraftItem = {
  pillar: string;
  titulo: string;
  descripcion?: string;
  requerido: boolean;
  estado: string;
  vence_el?: string;
  responsable?: string;
};

type DraftChecklist = {
  nombre: string;
  tipo_gasto: string;
  vigente: boolean;
  items: DraftItem[];
};

type DeliverableDraft = {
  tipo_gasto: string;
  codigo: string;
  titulo: string;
  descripcion?: string;
  pillar: string;
  requerido: boolean;
};

const EMPTY_ITEM: DraftItem = {
  pillar: "ENTREGABLES",
  titulo: "",
  descripcion: "",
  requerido: true,
  estado: "PENDIENTE",
  vence_el: "",
  responsable: "",
};

export default function ChecklistsPage() {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [deliverables, setDeliverables] = useState<DeliverableRequirement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingDeliverable, setIsSavingDeliverable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftChecklist>({ nombre: "", tipo_gasto: "", vigente: true, items: [EMPTY_ITEM] });
  const [deliverableDraft, setDeliverableDraft] = useState<DeliverableDraft>({
    tipo_gasto: "",
    codigo: "",
    titulo: "",
    descripcion: "",
    pillar: "ENTREGABLES",
    requerido: true,
  });

  const load = async () => {
    setIsLoading(true);
    try {
      const [data, deliverablesCatalog] = await Promise.all([
        fetchChecklists(),
        fetchDeliverableRequirements(),
      ]);
      setChecklists(data);
      setDeliverables(deliverablesCatalog);
      setError(null);
    } catch (e) {
      setError("No pudimos cargar los checklists");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreate = async () => {
    if (!draft.nombre.trim()) {
      await alertError("Falta nombre", "Asigna un nombre al checklist");
      return;
    }
    setIsSaving(true);
    try {
      await createChecklist({
        ...draft,
        items: draft.items.map((item) => ({
          ...item,
          titulo: item.titulo.trim(),
          descripcion: (item.descripcion || "").trim(),
          responsable: (item.responsable || "").trim(),
          vence_el: item.vence_el || undefined,
        })),
      });
      setDraft({ nombre: "", tipo_gasto: "", vigente: true, items: [EMPTY_ITEM] });
      await alertSuccess("Checklist creado", "Agrega estatus a cada tarea conforme avances");
      void load();
    } catch (e) {
      await alertError("No pudimos crear el checklist", (e as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStateChange = async (id: number, estado: string) => {
    try {
      await updateChecklistItem(id, { estado });
      void load();
    } catch (e) {
      await alertError("No pudimos actualizar la tarea", (e as Error).message);
    }
  };

  const handleCreateDeliverable = async () => {
    if (!deliverableDraft.tipo_gasto.trim() || !deliverableDraft.codigo.trim() || !deliverableDraft.titulo.trim()) {
      await alertError("Faltan datos", "Tipo de gasto, código y título son obligatorios");
      return;
    }
    setIsSavingDeliverable(true);
    try {
      await createDeliverableRequirement({
        ...deliverableDraft,
        tipo_gasto: deliverableDraft.tipo_gasto.trim(),
        codigo: deliverableDraft.codigo.trim(),
        titulo: deliverableDraft.titulo.trim(),
        descripcion: (deliverableDraft.descripcion || "").trim(),
      });
      await alertSuccess("Entregable guardado", "Se agregó al catálogo");
      setDeliverableDraft({ ...deliverableDraft, codigo: "", titulo: "", descripcion: "" });
      void load();
    } catch (e) {
      await alertError("No pudimos guardar el entregable", (e as Error).message);
    } finally {
      setIsSavingDeliverable(false);
    }
  };

  const addDeliverableToDraft = (ent: DeliverableRequirement) => {
    const items = [...draft.items, {
      pillar: ent.pillar,
      titulo: ent.titulo,
      descripcion: ent.descripcion || "",
      requerido: ent.requerido,
      estado: "PENDIENTE",
      vence_el: "",
      responsable: "",
    }];
    setDraft({ ...draft, tipo_gasto: draft.tipo_gasto || ent.tipo_gasto, items });
  };

  const filteredDeliverables = useMemo(() => {
    if (!draft.tipo_gasto) return deliverables;
    return deliverables.filter((d) => d.tipo_gasto === draft.tipo_gasto);
  }, [deliverables, draft.tipo_gasto]);

  const completedSummary = useMemo(() => {
    return checklists.map((c) => {
      const total = c.items?.length || 0;
      const done = c.items?.filter((i) => i.estado === "COMPLETO").length || 0;
      return { id: c.id, label: `${done}/${total} completado`, total, done };
    });
  }, [checklists]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <header className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-emerald-600 font-semibold">Checklist</p>
              <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900">Pilares de cumplimiento</h1>
              <p className="mt-2 text-sm text-slate-500">Controla entregables por gasto y marca avance por pilar.</p>
            </div>
            <GuiaContador
              section="Checklists de cumplimiento"
              steps={[
                { title: "Crea un checklist", description: "Asigna un <strong>nombre</strong> y un <strong>tipo de gasto</strong> al checklist. Agrega las tareas requeridas por pilar." },
                { title: "Agrega entregables del catálogo", description: "Usa el <strong>catálogo de entregables</strong> para añadir tareas predefinidas con pilar, código y descripción." },
                { title: "Asigna responsable y fecha", description: "Cada tarea puede tener un <strong>responsable</strong> y una <strong>fecha de vencimiento</strong> para dar seguimiento." },
                { title: "Marca avance", description: "Cambia el estado de cada tarea: <strong>Pendiente → En proceso → Completo</strong>. El resumen muestra el porcentaje de avance." },
              ]}
              concepts={[
                { term: "Pilar de cumplimiento", definition: "Categoría o eje temático para agrupar entregables: Entregables, Fiscal, Legal, Operativo, Financiero." },
                { term: "Tipo de gasto", definition: "Clasificación del gasto que agrupa los entregables requeridos: CapEx, OpEx, viáticos, honorarios, etc." },
                { term: "Catálogo de entregables", definition: "Biblioteca reutilizable de tareas estándar por tipo de gasto que puedes agregar a cualquier checklist." },
                { term: "Trazabilidad", definition: "Capacidad de rastrear quién, cuándo y cómo se completó cada entregable para efectos de auditoría." },
              ]}
              tips={[
                "Crea un checklist por cada <strong>tipo de gasto recurrente</strong> para estandarizar los entregables.",
                "Usa el catálogo para <strong>no reinventar tareas</strong> — agrega entregables probados con un clic.",
                "Revisa los checklists <strong>antes del cierre mensual</strong> para identificar tareas vencidas.",
                "Asigna fechas de vencimiento <strong>5 días antes</strong> del cierre real para tener margen de maniobra.",
              ]}
            />
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.5fr,1fr]">
          <section className="space-y-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-3">Nuevo checklist</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <input
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-shadow"
                placeholder="Nombre del Checklist"
                value={draft.nombre}
                onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
              />
              <input
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-shadow"
                placeholder="Tipo de gasto (opcional)"
                value={draft.tipo_gasto}
                onChange={(e) => setDraft({ ...draft, tipo_gasto: e.target.value })}
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Catálogo de Entregables</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                  placeholder="Tipo de gasto"
                  value={deliverableDraft.tipo_gasto}
                  onChange={(e) => setDeliverableDraft({ ...deliverableDraft, tipo_gasto: e.target.value })}
                />
                <input
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                  placeholder="Código identificador"
                  value={deliverableDraft.codigo}
                  onChange={(e) => setDeliverableDraft({ ...deliverableDraft, codigo: e.target.value })}
                />
                <input
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                  placeholder="Título del entregable"
                  value={deliverableDraft.titulo}
                  onChange={(e) => setDeliverableDraft({ ...deliverableDraft, titulo: e.target.value })}
                />
                <select
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                  value={deliverableDraft.pillar}
                  onChange={(e) => setDeliverableDraft({ ...deliverableDraft, pillar: e.target.value })}
                >
                  {PILLARS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <textarea
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                placeholder="Descripción general"
                rows={2}
                value={deliverableDraft.descripcion}
                onChange={(e) => setDeliverableDraft({ ...deliverableDraft, descripcion: e.target.value })}
              />
              <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deliverableDraft.requerido}
                    onChange={(e) => setDeliverableDraft({ ...deliverableDraft, requerido: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Obligatorio
                </label>
                <button
                  type="button"
                  disabled={isSavingDeliverable}
                  onClick={() => void handleCreateDeliverable()}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSavingDeliverable ? "Guardando…" : "Guardar en catálogo"}
                </button>
              </div>

              {/* Lista filtrada del catálogo */}
              <div className="space-y-2 mt-4">
                {filteredDeliverables.length === 0 && <p className="text-sm text-slate-400 italic">No hay entregables catalogados para este gasto.</p>}
                {filteredDeliverables.slice(0, 6).map((ent) => (
                  <div key={ent.id || ent.codigo} className="group rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:border-emerald-300 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{ent.codigo} · {ent.titulo}</p>
                        <p className="text-emerald-700 text-xs font-medium uppercase tracking-wider mt-0.5">{PILLARS.find((p) => p.value === ent.pillar)?.label}</p>
                      </div>
                      <button
                        type="button"
                        className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors"
                        onClick={() => addDeliverableToDraft(ent)}
                      >
                        Añadir al checklist
                      </button>
                    </div>
                    {ent.descripcion && <p className="mt-2 text-slate-500 text-xs leading-relaxed">{ent.descripcion}</p>}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <h3 className="text-sm font-semibold text-slate-900">Tareas del Checklist</h3>
              {draft.items.map((item, idx) => (
                <div key={idx} className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="grid gap-3 md:grid-cols-2">
                    <select
                      className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                      value={item.pillar}
                      onChange={(e) => {
                        const items = [...draft.items];
                        items[idx] = { ...items[idx], pillar: e.target.value };
                        setDraft({ ...draft, items });
                      }}
                    >
                      {PILLARS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                    <input
                      className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                      placeholder="Título de la tarea"
                      value={item.titulo}
                      onChange={(e) => {
                        const items = [...draft.items];
                        items[idx] = { ...items[idx], titulo: e.target.value };
                        setDraft({ ...draft, items });
                      }}
                    />
                  </div>
                  <textarea
                    className="mt-3 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                    placeholder="Descripción o instrucciones de la tarea"
                    rows={2}
                    value={item.descripcion}
                    onChange={(e) => {
                      const items = [...draft.items];
                      items[idx] = { ...items[idx], descripcion: e.target.value };
                      setDraft({ ...draft, items });
                    }}
                  />
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <input
                      className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                      placeholder="Responsable asignado"
                      value={item.responsable}
                      onChange={(e) => {
                        const items = [...draft.items];
                        items[idx] = { ...items[idx], responsable: e.target.value };
                        setDraft({ ...draft, items });
                      }}
                    />
                    <input
                      type="date"
                      className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                      value={item.vence_el || ""}
                      onChange={(e) => {
                        const items = [...draft.items];
                        items[idx] = { ...items[idx], vence_el: e.target.value };
                        setDraft({ ...draft, items });
                      }}
                    />
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="rounded-lg text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition"
                  onClick={() => setDraft({ ...draft, items: [...draft.items, { ...EMPTY_ITEM }] })}
                >
                  + Añadir otra tarea al checklist
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void handleCreate()}
                className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-md transition disabled:cursor-not-allowed disabled:opacity-50 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:shadow-lg hover:-translate-y-0.5"
              >
                {isSaving ? "Creando..." : "Finalizar y Crear Checklist"}
              </button>
            </div>
          </section>

          {/* Panel Informativo Lateral */}
          <aside className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm h-fit">
            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">Resumen de Pilares</h3>
            <p className="text-sm text-slate-500 mt-3 mb-4">Clasifica el marco normativo de tus entregables en:</p>
            <ul className="space-y-3">
              {PILLARS.map((p) => (
                <li key={p.value} className="flex flex-col">
                  <span className="font-semibold text-slate-800 text-sm">{p.label}</span>
                </li>
              ))}
            </ul>
          </aside>
        </div>

        {/* Sección Checklists Activos */}
        <section className="space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="text-xl font-bold text-slate-900">
              {isLoading ? "Cargando checklists…" : `Checklists Activos (${checklists.length})`}
            </h2>
            {error && <span className="rounded-md bg-red-50 px-3 py-1 text-sm font-medium text-red-700 border border-red-200">{error}</span>}
          </div>

          <div className="grid gap-6">
            {checklists.map((c) => {
              const summary = completedSummary.find((s) => s.id === c.id);
              return (
                <article key={c.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-5 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">{c.nombre}</h3>
                      <p className="text-slate-500 text-sm font-medium mt-1">{c.tipo_gasto || "Gasto General"}</p>
                    </div>
                    {summary && (
                      <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 border border-emerald-100">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></span>
                        <span className="text-sm font-bold text-emerald-800 tracking-wide">
                          {summary.label}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3">
                    {c.items?.map((item) => (
                      <div key={item.id || item.titulo} className="group flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 transition-colors hover:border-emerald-200 hover:bg-white hover:shadow-sm">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-200/50 px-2 py-0.5 rounded-md">
                              {PILLARS.find((p) => p.value === item.pillar)?.label}
                            </span>
                          </div>
                          <p className="text-slate-900 font-semibold text-base">{item.titulo}</p>
                          {item.descripcion && <p className="mt-1 text-slate-600 text-sm">{item.descripcion}</p>}

                          <div className="flex flex-wrap items-center gap-4 mt-3">
                            {item.responsable && (
                              <p className="text-slate-500 text-xs flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                {item.responsable}
                              </p>
                            )}
                            {item.vence_el && (
                              <p className="text-slate-500 text-xs flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
                                {item.vence_el}
                              </p>
                            )}
                          </div>
                        </div>

                        {item.id && (
                          <div className="flex-shrink-0 md:ml-4">
                            <select
                              className={`rounded-lg border px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors ${item.estado === 'COMPLETO' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 focus:ring-emerald-500' :
                                  item.estado === 'EN_PROCESO' ? 'bg-amber-50 border-amber-200 text-amber-700 focus:ring-amber-500' :
                                    'bg-white border-slate-300 text-slate-700 focus:ring-slate-500'
                                }`}
                              value={item.estado}
                              onChange={(e) => void handleStateChange(item.id!, e.target.value)}
                            >
                              {ITEM_STATES.map((s) => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
