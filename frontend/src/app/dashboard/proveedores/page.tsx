"use client";

import { useEffect, useMemo, useState } from "react";

import { DashboardShell } from "../../../components/DashboardShell";
import { alertError, alertInfo, alertSuccess } from "../../../lib/alerts";
import {
  EmpresaLite,
  Proveedor,
  fetchEmpresas,
  fetchProviders,
  createProveedor,
  updateProveedor,
  requestProveedorValidacion,
} from "../../../lib/providers";

const STATUS_STYLES: Record<string, string> = {
  SIN_COINCIDENCIA: "bg-emerald-500/15 text-emerald-200 border-emerald-300/40",
  PRESUNTO: "bg-amber-500/15 text-amber-200 border-amber-300/40",
  DEFINITIVO: "bg-red-500/15 text-red-200 border-red-300/40",
};

function Badge({ label, tone }: { label: string; tone?: keyof typeof STATUS_STYLES }) {
  const cls = tone && STATUS_STYLES[tone] ? STATUS_STYLES[tone] : "bg-white/10 text-white border-white/20";
  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>{label}</span>;
}

function formatDate(value?: string | null) {
  if (!value) return "Sin registro";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric" });
}

function countItems(value?: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaLite[]>([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [requestingId, setRequestingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Proveedor | null>(null);
  const [form, setForm] = useState<Partial<Proveedor>>({
    razon_social: "",
    rfc: "",
    pais: "",
    estado: "",
    ciudad: "",
    actividad_principal: "",
    correo_contacto: "",
    telefono_contacto: "",
    reps_registro: "",
    imss_patronal: "",
    activos_relevantes: [],
    personal_clave: [],
    fotos_domicilio: [],
    sitio_web: "",
    sitio_web_capturas: [],
    notas_capacidad: "",
  });

  const load = async () => {
    setIsLoading(true);
    try {
      const [prov, emps] = await Promise.all([fetchProviders(), fetchEmpresas()]);
      setProveedores(prov);
      setEmpresas(emps);
      setSelectedEmpresa((prev) => prev ?? (emps[0]?.id ?? null));
    } catch (e) {
      await alertError("No pudimos cargar proveedores", (e as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const proveedoresEnRiesgo = useMemo(
    () => proveedores.filter((p) => p.estatus_69b && p.estatus_69b !== "SIN_COINCIDENCIA"),
    [proveedores]
  );

  const resetForm = () => {
    setEditing(null);
    setForm({
      razon_social: "",
      rfc: "",
      pais: "",
      estado: "",
      ciudad: "",
      actividad_principal: "",
      correo_contacto: "",
      telefono_contacto: "",
      reps_registro: "",
      imss_patronal: "",
      activos_relevantes: [],
      personal_clave: [],
      fotos_domicilio: [],
      sitio_web: "",
      sitio_web_capturas: [],
      notas_capacidad: "",
    });
  };

  const handleEdit = (prov: Proveedor) => {
    setEditing(prov);
    setForm({
      razon_social: prov.razon_social,
      rfc: prov.rfc,
      pais: prov.pais,
      estado: prov.estado || "",
      ciudad: prov.ciudad || "",
      actividad_principal: prov.actividad_principal || "",
      correo_contacto: prov.correo_contacto || "",
      telefono_contacto: prov.telefono_contacto || "",
      reps_registro: prov.reps_registro || "",
      imss_patronal: prov.imss_patronal || "",
      activos_relevantes: prov.activos_relevantes || [],
      personal_clave: prov.personal_clave || [],
      fotos_domicilio: prov.fotos_domicilio || [],
      sitio_web: prov.sitio_web || "",
      sitio_web_capturas: prov.sitio_web_capturas || [],
      notas_capacidad: prov.notas_capacidad || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleArrayField = (name: keyof Proveedor, value: string) => {
    setForm((prev) => ({
      ...prev,
      [name]: value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (editing) {
        const updated = await updateProveedor(editing.id, payload);
        setProveedores((prev) => prev.map((p) => (p.id === editing.id ? updated : p)));
        await alertSuccess("Proveedor actualizado", "La capacidad operativa quedó registrada");
      } else {
        const created = await createProveedor(payload as any);
        setProveedores((prev) => [created, ...prev]);
        await alertSuccess("Proveedor creado", "Se registró la capacidad operativa");
      }
      resetForm();
    } catch (e) {
      await alertError("No pudimos guardar el proveedor", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleValidar = async (proveedor: Proveedor) => {
    if (!selectedEmpresa) {
      await alertInfo("Selecciona empresa", "Elige una empresa para enviar la validación a n8n");
      return;
    }
    setRequestingId(proveedor.id);
    try {
      await requestProveedorValidacion(proveedor.id, selectedEmpresa);
      await alertInfo("Validación enviada", "El flujo n8n devolverá el resultado con alertas 69-B");
    } catch (e) {
      await alertError("No pudimos solicitar la validación", (e as Error).message);
    } finally {
      setRequestingId(null);
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6 text-white">
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/30"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Capacidad del proveedor</p>
              <h2 className="text-2xl font-semibold text-white">
                {editing ? `Editar ${editing.razon_social}` : "Nuevo proveedor"}
              </h2>
              <p className="text-sm text-slate-300">Captura datos de capacidad operativa y presencia.</p>
            </div>
            {editing && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-emerald-300"
              >
                Cancelar edición
              </button>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm text-slate-200">
              Razón social
              <input
                name="razon_social"
                value={form.razon_social || ""}
                onChange={handleChange}
                required
                className="mt-1 w-full rounded-xl border border-white/20 bg-slate-950/60 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="text-sm text-slate-200">
              RFC
              <input
                name="rfc"
                value={form.rfc || ""}
                onChange={handleChange}
                required
                className="mt-1 w-full rounded-xl border border-white/20 bg-slate-950/60 px-3 py-2 text-sm text-white uppercase"
              />
            </label>
            <label className="text-sm text-slate-200">
              Actividad principal
              <input
                name="actividad_principal"
                value={form.actividad_principal || ""}
                onChange={handleChange}
                className="mt-1 w-full rounded-xl border border-white/20 bg-slate-950/60 px-3 py-2 text-sm text-white"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm text-slate-200">
              País
              <input
                name="pais"
                value={form.pais || ""}
                onChange={handleChange}
                required
                className="mt-1 w-full rounded-xl border border-white/20 bg-slate-950/60 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="text-sm text-slate-200">
              Estado
              <input
                name="estado"
                value={form.estado || ""}
                onChange={handleChange}
                className="mt-1 w-full rounded-xl border border-white/20 bg-slate-950/60 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="text-sm text-slate-200">
              Ciudad
              <input
                name="ciudad"
                value={form.ciudad || ""}
                onChange={handleChange}
                className="mt-1 w-full rounded-xl border border-white/20 bg-slate-950/60 px-3 py-2 text-sm text-white"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-200">
              Correo de contacto
              <input
                type="email"
                name="correo_contacto"
                value={form.correo_contacto || ""}
                onChange={handleChange}
                className="mt-1 w-full rounded-xl border border-white/20 bg-slate-950/60 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="text-sm text-slate-200">
              Teléfono
              <input
                name="telefono_contacto"
                value={form.telefono_contacto || ""}
                onChange={handleChange}
                className="mt-1 w-full rounded-xl border border-white/20 bg-slate-950/60 px-3 py-2 text-sm text-white"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-200">
              Registro REPS/IMSS
              <input
                name="reps_registro"
                value={form.reps_registro || ""}
                onChange={handleChange}
                className="mt-1 w-full rounded-xl border border-white/20 bg-slate-950/60 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="text-sm text-slate-200">
              Registro patronal IMSS
              <input
                name="imss_patronal"
                value={form.imss_patronal || ""}
                onChange={handleChange}
                className="mt-1 w-full rounded-xl border border-white/20 bg-slate-950/60 px-3 py-2 text-sm text-white"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-200">
              Activos relevantes (separa con coma)
              <input
                name="activos_relevantes"
                value={(form.activos_relevantes as string[])?.join(", ") || ""}
                onChange={(e) => handleArrayField("activos_relevantes", e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/20 bg-slate-950/60 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="text-sm text-slate-200">
              Personal clave (nombres separados por coma)
              <input
                name="personal_clave"
                value={(form.personal_clave as string[])?.join(", ") || ""}
                onChange={(e) => handleArrayField("personal_clave", e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/20 bg-slate-950/60 px-3 py-2 text-sm text-white"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-200">
              Fotos domicilio (URLs separadas por coma)
              <input
                name="fotos_domicilio"
                value={(form.fotos_domicilio as string[])?.join(", ") || ""}
                onChange={(e) => handleArrayField("fotos_domicilio", e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/20 bg-slate-950/60 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="text-sm text-slate-200">
              Sitio web
              <input
                name="sitio_web"
                value={form.sitio_web || ""}
                onChange={handleChange}
                className="mt-1 w-full rounded-xl border border-white/20 bg-slate-950/60 px-3 py-2 text-sm text-white"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-200">
              Capturas web (URLs separadas por coma)
              <input
                name="sitio_web_capturas"
                value={(form.sitio_web_capturas as string[])?.join(", ") || ""}
                onChange={(e) => handleArrayField("sitio_web_capturas", e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/20 bg-slate-950/60 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="text-sm text-slate-200">
              Notas de capacidad
              <textarea
                name="notas_capacidad"
                value={form.notas_capacidad || ""}
                onChange={handleChange}
                className="mt-1 w-full rounded-xl border border-white/20 bg-slate-950/60 px-3 py-2 text-sm text-white"
                rows={2}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Guardando…" : editing ? "Actualizar proveedor" : "Crear proveedor"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white transition hover:border-emerald-300"
            >
              Limpiar
            </button>
          </div>
        </form>

        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/40 to-emerald-900/30 p-6 shadow-2xl shadow-emerald-500/20">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Due diligence</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Proveedores y alertas 69-B</h1>
          <p className="mt-2 text-sm text-slate-200">
            Consulta estatus SAT, alertas del artículo 69-B y envía validaciones al flujo n8n.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
              <p className="text-slate-300">Proveedores registrados</p>
              <p className="text-2xl font-semibold text-white">{proveedores.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
              <p className="text-slate-300">Alertas 69-B</p>
              <p className="text-2xl font-semibold text-white">{proveedoresEnRiesgo.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
              <p className="text-slate-300">Empresa para validar</p>
              <select
                className="mt-1 w-full rounded-xl border border-white/20 bg-slate-900/60 px-3 py-2 text-white"
                value={selectedEmpresa ?? ""}
                onChange={(e) => setSelectedEmpresa(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Selecciona empresa</option>
                {empresas.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.razon_social} — {emp.rfc}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        <section className="space-y-4">
          <div className="flex items-center justify-between text-sm text-slate-300">
            <p>{isLoading ? "Cargando proveedores…" : `Proveedores (${proveedores.length})`}</p>
            {selectedEmpresa && (
              <p className="text-xs text-emerald-200">Validar con empresa ID {selectedEmpresa}</p>
            )}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {proveedores.map((prov) => (
              <article
                key={prov.id}
                className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm shadow-2xl shadow-black/30"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-white">{prov.razon_social}</p>
                    <p className="text-xs text-slate-300">RFC {prov.rfc}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge label={prov.estatus_sat || "Sin estatus SAT"} />
                    <Badge
                      label={prov.estatus_69b ? prov.estatus_69b.replace("_", " ") : "69-B sin revisar"}
                      tone={(prov.estatus_69b as keyof typeof STATUS_STYLES) || undefined}
                    />
                    <Badge label={prov.riesgo_fiscal ? `Riesgo ${prov.riesgo_fiscal}` : "Riesgo N/D"} />
                  </div>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                    <p className="text-xs uppercase text-slate-400">Última validación SAT</p>
                    <p className="text-sm text-white">{formatDate(prov.ultima_validacion_sat)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                    <p className="text-xs uppercase text-slate-400">Última validación 69-B</p>
                    <p className="text-sm text-white">{formatDate(prov.ultima_validacion_69b)}</p>
                  </div>
                </div>

                {prov.riesgos_detectados && prov.riesgos_detectados.length > 0 && (
                  <div className="mt-3 rounded-2xl border border-amber-300/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                    <p className="font-semibold text-amber-200">Riesgos detectados</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {prov.riesgos_detectados.map((r, idx) => (
                        <li key={`${prov.id}-riesgo-${idx}`}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-xs text-slate-200">
                    <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Capacidad operativa</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      <li>REPS/IMSS: {prov.reps_registro || "N/D"}</li>
                      <li>Registro patronal: {prov.imss_patronal || "N/D"}</li>
                      <li>Activos relevantes: {countItems(prov.activos_relevantes)}</li>
                      <li>Personal clave: {countItems(prov.personal_clave)}</li>
                      <li>Fotos domicilio: {countItems(prov.fotos_domicilio)}</li>
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-xs text-slate-200">
                    <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Presencia y notas</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      <li>
                        Sitio web: {prov.sitio_web ? (
                          <a href={prov.sitio_web} target="_blank" rel="noreferrer" className="text-emerald-200 underline">
                            {prov.sitio_web}
                          </a>
                        ) : (
                          "N/D"
                        )}
                      </li>
                      <li>Capturas web: {countItems(prov.sitio_web_capturas)}</li>
                      {prov.notas_capacidad && <li className="text-slate-300">{prov.notas_capacidad}</li>}
                    </ul>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void handleValidar(prov)}
                    disabled={requestingId === prov.id}
                    className="rounded-xl border border-emerald-300/60 bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:border-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {requestingId === prov.id ? "Enviando…" : "Solicitar validación"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEdit(prov)}
                    className="rounded-xl border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-emerald-200"
                  >
                    Editar
                  </button>
                  <span className="text-xs text-slate-400">Los resultados se guardarán con alertas 69-B</span>
                </div>
              </article>
            ))}
            {!isLoading && proveedores.length === 0 && (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-sm text-slate-300">
                No hay proveedores registrados todavía.
              </div>
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
