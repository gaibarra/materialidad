"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Fedatario,
  FedatarioPayload,
  fetchFedatarios,
  createFedatario,
  updateFedatario,
  deleteFedatario,
  TipoFedatario,
} from "../lib/fedatarios";
import { alertError, alertSuccess } from "../lib/alerts";

const TIPOS: Array<{ value: TipoFedatario; label: string }> = [
  { value: "NOTARIO", label: "Notario público" },
  { value: "CORREDOR", label: "Corredor público" },
  { value: "OTRO", label: "Otro fedatario" },
];

const EMPTY: Partial<FedatarioPayload> = {
  nombre: "",
  tipo: "NOTARIO",
  numero_notaria: "",
  estado: "",
  ciudad: "",
  direccion: "",
  telefono: "",
  telefono_alterno: "",
  email: "",
  rfc: "",
  cedula_profesional: "",
  horario_atencion: "",
  contacto_asistente: "",
  contacto_asistente_tel: "",
  contacto_asistente_email: "",
  notas: "",
  activo: true,
};

const INPUT =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called when fedatarios list changes so parent can refresh its dropdown */
  onChanged?: () => void;
}

export function FedatarioModal({ open, onClose, onChanged }: Props) {
  const [fedatarios, setFedatarios] = useState<Fedatario[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [view, setView] = useState<"list" | "form">("list");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<FedatarioPayload>>({ ...EMPTY });

  const loadFedatarios = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchFedatarios();
      setFedatarios(list);
    } catch (e) {
      await alertError("Error", (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void loadFedatarios();
  }, [open, loadFedatarios]);

  const filtered = fedatarios.filter((f) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      f.nombre.toLowerCase().includes(q) ||
      f.numero_notaria.toLowerCase().includes(q) ||
      f.estado.toLowerCase().includes(q) ||
      f.ciudad.toLowerCase().includes(q) ||
      f.email.toLowerCase().includes(q)
    );
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY });
    setView("form");
  };

  const openEdit = (f: Fedatario) => {
    setEditingId(f.id);
    setForm({
      nombre: f.nombre,
      tipo: f.tipo,
      numero_notaria: f.numero_notaria,
      estado: f.estado,
      ciudad: f.ciudad,
      direccion: f.direccion,
      telefono: f.telefono,
      telefono_alterno: f.telefono_alterno,
      email: f.email,
      rfc: f.rfc,
      cedula_profesional: f.cedula_profesional,
      horario_atencion: f.horario_atencion,
      contacto_asistente: f.contacto_asistente,
      contacto_asistente_tel: f.contacto_asistente_tel,
      contacto_asistente_email: f.contacto_asistente_email,
      notas: f.notas,
      activo: f.activo,
    });
    setView("form");
  };

  const handleDelete = async (f: Fedatario) => {
    if (!confirm(`¿Eliminar al fedatario "${f.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteFedatario(f.id);
      await alertSuccess("Eliminado", `${f.nombre} fue eliminado`);
      await loadFedatarios();
      onChanged?.();
    } catch (e) {
      await alertError("Error", (e as Error).message);
    }
  };

  const handleSave = async () => {
    if (!form.nombre?.trim()) {
      await alertError("Campo requerido", "El nombre del fedatario es obligatorio");
      return;
    }
    if (!form.estado?.trim()) {
      await alertError("Campo requerido", "La entidad federativa es obligatoria");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateFedatario(editingId, form);
        await alertSuccess("Actualizado", "Fedatario actualizado correctamente");
      } else {
        await createFedatario(form);
        await alertSuccess("Creado", "Fedatario registrado correctamente");
      }
      setView("list");
      await loadFedatarios();
      onChanged?.();
    } catch (e) {
      await alertError("Error", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const setField = (key: keyof FedatarioPayload, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-600">Catálogo</p>
            <h2 className="text-xl font-semibold text-slate-900">
              {view === "list" ? "Fedatarios" : editingId ? "Editar fedatario" : "Nuevo fedatario"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {view === "list" ? (
            <div className="space-y-4">
              {/* Search + Add */}
              <div className="flex items-center gap-3">
                <input
                  className={INPUT + " flex-1"}
                  placeholder="Buscar por nombre, notaría, estado…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button
                  onClick={openCreate}
                  className="whitespace-nowrap rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-emerald-700 transition"
                >
                  + Nuevo
                </button>
              </div>

              {loading && <p className="text-sm text-slate-400">Cargando fedatarios…</p>}

              {!loading && filtered.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
                  {searchTerm ? "Sin resultados para tu búsqueda" : "Aún no hay fedatarios registrados. Haz clic en + Nuevo para agregar uno."}
                </div>
              )}

              {/* List */}
              <div className="space-y-2">
                {filtered.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:border-emerald-200 hover:bg-emerald-50/30"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{f.nombre}</p>
                      <p className="text-xs text-slate-500">
                        {f.tipo === "NOTARIO" ? "Notario" : f.tipo === "CORREDOR" ? "Corredor" : "Otro"}
                        {f.numero_notaria ? ` · Notaría ${f.numero_notaria}` : ""}
                        {f.estado ? ` · ${f.estado}` : ""}
                        {f.ciudad ? `, ${f.ciudad}` : ""}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                        {f.telefono && <span>📞 {f.telefono}</span>}
                        {f.email && <span>✉ {f.email}</span>}
                        {f.horario_atencion && <span>🕐 {f.horario_atencion}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(f)}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 transition"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => void handleDelete(f)}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* ── FORM VIEW ── */
            <div className="space-y-5">
              <button
                onClick={() => setView("list")}
                className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition"
              >
                ← Volver al listado
              </button>

              {/* Row 1: Nombre + Tipo */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-slate-500">Nombre completo *</label>
                  <input className={INPUT} value={form.nombre || ""} onChange={(e) => setField("nombre", e.target.value)} placeholder="Lic. Juan Pérez López" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Tipo</label>
                  <select className={INPUT} value={form.tipo || "NOTARIO"} onChange={(e) => setField("tipo", e.target.value)}>
                    {TIPOS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Notaría + Estado + Ciudad */}
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-xs font-medium text-slate-500">No. de notaría</label>
                  <input className={INPUT} value={form.numero_notaria || ""} onChange={(e) => setField("numero_notaria", e.target.value)} placeholder="Ej. 123" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Entidad federativa *</label>
                  <input className={INPUT} value={form.estado || ""} onChange={(e) => setField("estado", e.target.value)} placeholder="Ciudad de México" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Ciudad</label>
                  <input className={INPUT} value={form.ciudad || ""} onChange={(e) => setField("ciudad", e.target.value)} placeholder="Alcaldía / municipio" />
                </div>
              </div>

              {/* Row 3: Dirección */}
              <div>
                <label className="text-xs font-medium text-slate-500">Dirección</label>
                <input className={INPUT} value={form.direccion || ""} onChange={(e) => setField("direccion", e.target.value)} placeholder="Calle, número, colonia, CP" />
              </div>

              {/* Row 4: Teléfonos + Email */}
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-xs font-medium text-slate-500">Teléfono</label>
                  <input className={INPUT} value={form.telefono || ""} onChange={(e) => setField("telefono", e.target.value)} placeholder="55 1234 5678" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Teléfono alterno</label>
                  <input className={INPUT} value={form.telefono_alterno || ""} onChange={(e) => setField("telefono_alterno", e.target.value)} placeholder="Otro teléfono" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Email</label>
                  <input type="email" className={INPUT} value={form.email || ""} onChange={(e) => setField("email", e.target.value)} placeholder="notario@ejemplo.com" />
                </div>
              </div>

              {/* Row 5: RFC + Cédula + Horario */}
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-xs font-medium text-slate-500">RFC</label>
                  <input className={INPUT} value={form.rfc || ""} onChange={(e) => setField("rfc", e.target.value.toUpperCase())} placeholder="XAXX010101000" maxLength={13} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Cédula profesional</label>
                  <input className={INPUT} value={form.cedula_profesional || ""} onChange={(e) => setField("cedula_profesional", e.target.value)} placeholder="No. de cédula" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Horario de atención</label>
                  <input className={INPUT} value={form.horario_atencion || ""} onChange={(e) => setField("horario_atencion", e.target.value)} placeholder="L-V 9:00-18:00" />
                </div>
              </div>

              {/* Contacto asistente card */}
              <div className="rounded-2xl border border-sky-200 bg-sky-50/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-sky-700">Contacto alterno / asistente</p>
                <div className="mt-3 grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="text-xs font-medium text-slate-500">Nombre</label>
                    <input className={INPUT} value={form.contacto_asistente || ""} onChange={(e) => setField("contacto_asistente", e.target.value)} placeholder="Nombre del asistente" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">Teléfono</label>
                    <input className={INPUT} value={form.contacto_asistente_tel || ""} onChange={(e) => setField("contacto_asistente_tel", e.target.value)} placeholder="Teléfono" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">Email</label>
                    <input type="email" className={INPUT} value={form.contacto_asistente_email || ""} onChange={(e) => setField("contacto_asistente_email", e.target.value)} placeholder="asistente@ejemplo.com" />
                  </div>
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="text-xs font-medium text-slate-500">Observaciones</label>
                <textarea
                  rows={3}
                  className={INPUT}
                  value={form.notas || ""}
                  onChange={(e) => setField("notas", e.target.value)}
                  placeholder="Experiencia previa, recomendaciones, disponibilidad especial…"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.activo ?? true}
                  onChange={(e) => setField("activo", e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Fedatario activo
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        {view === "form" && (
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button
              onClick={() => setView("list")}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              disabled={saving}
              onClick={() => void handleSave()}
              className="rounded-xl bg-emerald-600 px-6 py-2 text-sm font-semibold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 transition"
            >
              {saving ? "Guardando…" : editingId ? "Actualizar" : "Crear fedatario"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
