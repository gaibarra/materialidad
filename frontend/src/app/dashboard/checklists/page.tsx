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
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/40 to-emerald-900/20 p-6 shadow-2xl shadow-emerald-500/20">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-emerald-300">Checklist</p>
              <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-white">Pilares de cumplimiento</h1>
              <p className="mt-2 text-sm text-slate-300">Controla entregables por gasto y marca avance por pilar.</p>
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

        <div className="grid gap-6 lg:grid-cols-[1.5fr,1fr]">
          <section className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white shadow-2xl shadow-black/30">
            <h2 className="text-lg font-semibold text-white">Nuevo checklist</h2>
            <input
              className="w-full rounded-2xl border border-white/20 bg-slate-950/40 px-4 py-2 text-white focus:border-emerald-300 focus:outline-none"
              placeholder="Nombre"
              value={draft.nombre}
              onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
            />
            <input
              className="w-full rounded-2xl border border-white/20 bg-slate-950/40 px-4 py-2 text-white focus:border-emerald-300 focus:outline-none"
              placeholder="Tipo de gasto (opcional)"
              value={draft.tipo_gasto}
              onChange={(e) => setDraft({ ...draft, tipo_gasto: e.target.value })}
            />
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Catálogo de entregables</p>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="rounded-2xl border border-white/20 bg-slate-900/60 px-3 py-2 text-white"
                  placeholder="Tipo de gasto"
                  value={deliverableDraft.tipo_gasto}
                  onChange={(e) => setDeliverableDraft({ ...deliverableDraft, tipo_gasto: e.target.value })}
                />
                <input
                  className="rounded-2xl border border-white/20 bg-slate-900/60 px-3 py-2 text-white"
                  placeholder="Código"
                  value={deliverableDraft.codigo}
                  onChange={(e) => setDeliverableDraft({ ...deliverableDraft, codigo: e.target.value })}
                />
                <input
                  className="rounded-2xl border border-white/20 bg-slate-900/60 px-3 py-2 text-white"
                  placeholder="Título"
                  value={deliverableDraft.titulo}
                  onChange={(e) => setDeliverableDraft({ ...deliverableDraft, titulo: e.target.value })}
                />
                <select
                  className="rounded-2xl border border-white/20 bg-slate-900/60 px-3 py-2 text-white"
                  value={deliverableDraft.pillar}
                  onChange={(e) => setDeliverableDraft({ ...deliverableDraft, pillar: e.target.value })}
                >
                  {PILLARS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <textarea
                className="w-full rounded-2xl border border-white/20 bg-slate-900/60 px-3 py-2 text-white"
                placeholder="Descripción"
                value={deliverableDraft.descripcion}
                onChange={(e) => setDeliverableDraft({ ...deliverableDraft, descripcion: e.target.value })}
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-slate-200">
                  <input
                    type="checkbox"
                    checked={deliverableDraft.requerido}
                    onChange={(e) => setDeliverableDraft({ ...deliverableDraft, requerido: e.target.checked })}
                    className="h-4 w-4"
                  />
                  Requerido
                </label>
                <button
                  type="button"
                  disabled={isSavingDeliverable}
                  onClick={() => void handleCreateDeliverable()}
                  className="rounded-xl border border-emerald-400/60 bg-emerald-500/10 px-3 py-2 min-h-[44px] text-xs font-semibold text-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingDeliverable ? "Guardando…" : "Guardar en catálogo"}
                </button>
              </div>
              <div className="space-y-2 text-xs text-slate-200">
                {filteredDeliverables.length === 0 && <p className="text-slate-400">Sin entregables en este tipo de gasto</p>}
                {filteredDeliverables.slice(0, 6).map((ent) => (
                  <div key={ent.id || ent.codigo} className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-white">{ent.codigo} · {ent.titulo}</p>
                        <p className="text-slate-400">{PILLARS.find((p) => p.value === ent.pillar)?.label}</p>
                      </div>
                      <button
                        type="button"
                        className="rounded-lg border border-emerald-300/60 px-3 py-1 min-h-[44px] text-[11px] font-semibold text-emerald-200 hover:border-emerald-200"
                        onClick={() => addDeliverableToDraft(ent)}
                      >
                        Añadir al checklist
                      </button>
                    </div>
                    {ent.descripcion && <p className="mt-1 text-slate-300">{ent.descripcion}</p>}
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {draft.items.map((item, idx) => (
                <div key={idx} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <select
                      className="rounded-2xl border border-white/20 bg-slate-900/60 px-3 py-2 text-white"
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
                      className="rounded-2xl border border-white/20 bg-slate-900/60 px-3 py-2 text-white"
                      placeholder="Título"
                      value={item.titulo}
                      onChange={(e) => {
                        const items = [...draft.items];
                        items[idx] = { ...items[idx], titulo: e.target.value };
                        setDraft({ ...draft, items });
                      }}
                    />
                  </div>
                  <textarea
                    className="mt-2 w-full rounded-2xl border border-white/20 bg-slate-900/60 px-3 py-2 text-white"
                    placeholder="Descripción"
                    value={item.descripcion}
                    onChange={(e) => {
                      const items = [...draft.items];
                      items[idx] = { ...items[idx], descripcion: e.target.value };
                      setDraft({ ...draft, items });
                    }}
                  />
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <input
                      className="rounded-2xl border border-white/20 bg-slate-900/60 px-3 py-2 text-white"
                      placeholder="Responsable"
                      value={item.responsable}
                      onChange={(e) => {
                        const items = [...draft.items];
                        items[idx] = { ...items[idx], responsable: e.target.value };
                        setDraft({ ...draft, items });
                      }}
                    />
                    <input
                      type="date"
                      className="rounded-2xl border border-white/20 bg-slate-900/60 px-3 py-2 text-white"
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
              <button
                type="button"
                className="text-xs font-semibold text-emerald-300 hover:text-emerald-200"
                onClick={() => setDraft({ ...draft, items: [...draft.items, { ...EMPTY_ITEM }] })}
              >
                + Añadir tarea
              </button>
            </div>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleCreate()}
              className="rounded-2xl border border-emerald-400/60 bg-emerald-500/20 px-4 py-3 text-center text-base font-semibold text-emerald-200 transition hover:border-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "Guardando…" : "Crear checklist"}
            </button>
          </section>

          <aside className="rounded-3xl border border-white/10 bg-slate-950/40 p-6 text-sm text-white shadow-inner shadow-black/40">
            <h3 className="text-lg font-semibold text-white">Pilares</h3>
            <ul className="mt-3 space-y-1 text-slate-300">
              {PILLARS.map((p) => (
                <li key={p.value}>• {p.label}</li>
              ))}
            </ul>
          </aside>
        </div>

        <section className="space-y-4">
          <div className="flex items-center justify-between text-sm text-slate-300">
            <p>{isLoading ? "Cargando checklists…" : `Checklists (${checklists.length})`}</p>
            {error && <span className="text-amber-300">{error}</span>}
          </div>
          <div className="grid gap-4">
            {checklists.map((c) => {
              const summary = completedSummary.find((s) => s.id === c.id);
              return (
                <article key={c.id} className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white shadow-2xl shadow-black/30">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-white">{c.nombre}</p>
                      <p className="text-slate-300 text-xs">{c.tipo_gasto || "General"}</p>
                    </div>
                    {summary && (
                      <span className="rounded-full border border-emerald-300/40 px-3 py-1 text-xs text-emerald-200">
                        {summary.label}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 grid gap-2">
                    {c.items?.map((item) => (
                      <div key={item.id || item.titulo} className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-white font-semibold">{item.titulo}</p>
                            <p className="text-slate-400 text-xs">{PILLARS.find((p) => p.value === item.pillar)?.label}</p>
                            {item.responsable && <p className="text-slate-400 text-xs">Responsable: {item.responsable}</p>}
                            {item.vence_el && <p className="text-slate-400 text-xs">Vence el: {item.vence_el}</p>}
                          </div>
                          {item.id && (
                            <select
                              className="rounded-xl border border-white/20 bg-slate-900/60 px-3 py-2 text-white text-xs"
                              value={item.estado}
                              onChange={(e) => void handleStateChange(item.id!, e.target.value)}
                            >
                              {ITEM_STATES.map((s) => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                              ))}
                            </select>
                          )}
                        </div>
                        {item.descripcion && <p className="mt-1 text-slate-300 text-sm">{item.descripcion}</p>}
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
