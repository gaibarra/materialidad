"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { DashboardShell } from "../../../components/DashboardShell";
import { GuiaContador } from "../../../components/GuiaContador";
import { alertError, alertInfo, alertSuccess } from "../../../lib/alerts";
import {
  EmpresaLite,
  Proveedor,
  TipoPersona,
  fetchEmpresas,
  fetchProviders,
  createProveedor,
  updateProveedor,
  requestProveedorValidacion,
  uploadCSFProveedor,
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
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Partial<Proveedor>>({
    tipo_persona: "MORAL",
    razon_social: "",
    rfc: "",
    nombre: "",
    apellido_paterno: "",
    apellido_materno: "",
    curp: "",
    calle: "",
    no_exterior: "",
    no_interior: "",
    colonia: "",
    codigo_postal: "",
    municipio: "",
    pais: "México",
    estado: "",
    ciudad: "",
    actividad_principal: "",
    regimen_fiscal: "",
    contacto_nombre: "",
    contacto_puesto: "",
    contacto_email: "",
    contacto_telefono: "",
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

  const isPF = form.tipo_persona === "FISICA";

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
      tipo_persona: "MORAL",
      razon_social: "",
      rfc: "",
      nombre: "",
      apellido_paterno: "",
      apellido_materno: "",
      curp: "",
      calle: "",
      no_exterior: "",
      no_interior: "",
      colonia: "",
      codigo_postal: "",
      municipio: "",
      pais: "México",
      estado: "",
      ciudad: "",
      actividad_principal: "",
      regimen_fiscal: "",
      contacto_nombre: "",
      contacto_puesto: "",
      contacto_email: "",
      contacto_telefono: "",
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
      tipo_persona: prov.tipo_persona || "MORAL",
      razon_social: prov.razon_social,
      rfc: prov.rfc,
      nombre: prov.nombre || "",
      apellido_paterno: prov.apellido_paterno || "",
      apellido_materno: prov.apellido_materno || "",
      curp: prov.curp || "",
      calle: prov.calle || "",
      no_exterior: prov.no_exterior || "",
      no_interior: prov.no_interior || "",
      colonia: prov.colonia || "",
      codigo_postal: prov.codigo_postal || "",
      municipio: prov.municipio || "",
      pais: prov.pais || "México",
      estado: prov.estado || "",
      ciudad: prov.ciudad || "",
      actividad_principal: prov.actividad_principal || "",
      regimen_fiscal: prov.regimen_fiscal || "",
      contacto_nombre: prov.contacto_nombre || "",
      contacto_puesto: prov.contacto_puesto || "",
      contacto_email: prov.contacto_email || "",
      contacto_telefono: prov.contacto_telefono || "",
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

  const handleCSFUpload = async (file: File) => {
    setUploading(true);
    try {
      const res = await uploadCSFProveedor(file, editing?.id);
      if (res.datos_extraidos) {
        const d = res.datos_extraidos;
        setForm((prev) => ({
          ...prev,
          tipo_persona: (d.tipo_persona as TipoPersona) || prev.tipo_persona,
          razon_social: d.razon_social || prev.razon_social,
          rfc: d.rfc || prev.rfc,
          nombre: d.nombre || prev.nombre,
          apellido_paterno: d.apellido_paterno || prev.apellido_paterno,
          apellido_materno: d.apellido_materno || prev.apellido_materno,
          curp: d.curp || prev.curp,
          regimen_fiscal: d.regimen_fiscal || prev.regimen_fiscal,
          actividad_principal: d.actividad_economica || prev.actividad_principal,
          calle: d.calle || prev.calle,
          no_exterior: d.no_exterior || prev.no_exterior,
          no_interior: d.no_interior || prev.no_interior,
          colonia: d.colonia || prev.colonia,
          codigo_postal: d.codigo_postal || prev.codigo_postal,
          municipio: d.municipio || prev.municipio,
          estado: d.estado || prev.estado,
          ciudad: d.ciudad || prev.ciudad,
        }));
        await alertSuccess("CSF procesada", "Datos extraídos automáticamente de la Constancia de Situación Fiscal");
      }
      if (editing && res.registro) {
        setProveedores((prev) => prev.map((p) => (p.id === editing.id ? res.registro! : p)));
      }
    } catch (e) {
      await alertError("Error al procesar CSF", (e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
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
      <div className="space-y-8 text-slate-900">
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl shadow-slate-200/60"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-500">Capacidad del proveedor</p>
              <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">
                {editing ? `Editar ${editing.display_name || editing.razon_social}` : "Nuevo proveedor"}
              </h2>
              <p className="text-sm text-slate-500">Captura datos de capacidad operativa y presencia.</p>
            </div>
            {editing && (
              <button
                type="button"
                onClick={resetForm}
                className="min-h-[44px] rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-600"
              >
                Cancelar edición
              </button>
            )}
          </div>

          {/* ── Tipo de persona ── */}
          <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1 w-fit">
            {(["MORAL", "FISICA"] as TipoPersona[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm((p) => ({ ...p, tipo_persona: t }))}
                className={`rounded-full px-5 py-2 text-xs font-semibold transition ${form.tipo_persona === t
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                  }`}
              >
                {t === "MORAL" ? "Persona Moral" : "Persona Física"}
              </button>
            ))}
          </div>

          {/* ── CSF upload ── */}
          <div
            className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-6 text-center transition hover:border-emerald-300 cursor-pointer"
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleCSFUpload(f);
              }}
            />
            {uploading ? (
              <p className="text-sm text-emerald-600 animate-pulse">Procesando Constancia de Situación Fiscal…</p>
            ) : (
              <>
                <p className="text-sm font-medium text-slate-700">📄 Subir Constancia de Situación Fiscal</p>
                <p className="mt-1 text-xs text-slate-400">PDF o imagen — los datos se extraerán automáticamente</p>
              </>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* ── Datos generales ── */}
            <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                {isPF ? "Datos de la persona física" : "Datos de la persona moral"}
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {!isPF && (
                  <label className="text-sm text-slate-600 md:col-span-2">
                    Razón social
                    <input
                      name="razon_social"
                      value={form.razon_social || ""}
                      onChange={handleChange}
                      required={!isPF}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/60"
                    />
                  </label>
                )}
                {isPF && (
                  <>
                    <label className="text-sm text-slate-600">
                      Nombre(s)
                      <input
                        name="nombre"
                        value={form.nombre || ""}
                        onChange={handleChange}
                        required
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/60"
                      />
                    </label>
                    <label className="text-sm text-slate-600">
                      Apellido paterno
                      <input
                        name="apellido_paterno"
                        value={form.apellido_paterno || ""}
                        onChange={handleChange}
                        required
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/60"
                      />
                    </label>
                    <label className="text-sm text-slate-600">
                      Apellido materno
                      <input
                        name="apellido_materno"
                        value={form.apellido_materno || ""}
                        onChange={handleChange}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/60"
                      />
                    </label>
                    <label className="text-sm text-slate-600">
                      CURP
                      <input
                        name="curp"
                        value={form.curp || ""}
                        onChange={handleChange}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 uppercase shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/60"
                      />
                    </label>
                  </>
                )}
                <label className="text-sm text-slate-600">
                  RFC
                  <input
                    name="rfc"
                    value={form.rfc || ""}
                    onChange={handleChange}
                    required
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 uppercase shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/60"
                  />
                </label>
                <label className="text-sm text-slate-600">
                  Actividad principal
                  <input
                    name="actividad_principal"
                    value={form.actividad_principal || ""}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/60"
                  />
                </label>
                <label className="text-sm text-slate-600">
                  Régimen fiscal
                  <input
                    name="regimen_fiscal"
                    value={form.regimen_fiscal || ""}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/60"
                  />
                </label>
              </div>
            </div>

            {/* ── Domicilio fiscal ── */}
            <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Domicilio fiscal</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm text-slate-600 md:col-span-2">
                  Calle
                  <input name="calle" value={form.calle || ""} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/60" />
                </label>
                <label className="text-sm text-slate-600">
                  No. exterior
                  <input name="no_exterior" value={form.no_exterior || ""} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/60" />
                </label>
                <label className="text-sm text-slate-600">
                  No. interior
                  <input name="no_interior" value={form.no_interior || ""} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/60" />
                </label>
                <label className="text-sm text-slate-600">
                  Colonia
                  <input name="colonia" value={form.colonia || ""} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/60" />
                </label>
                <label className="text-sm text-slate-600">
                  C.P.
                  <input name="codigo_postal" value={form.codigo_postal || ""} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/60" />
                </label>
                <label className="text-sm text-slate-600">
                  Municipio / Alcaldía
                  <input name="municipio" value={form.municipio || ""} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/60" />
                </label>
                <label className="text-sm text-slate-600">
                  Estado
                  <input name="estado" value={form.estado || ""} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/60" />
                </label>
                <label className="text-sm text-slate-600">
                  País
                  <input name="pais" value={form.pais || ""} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/60" />
                </label>
              </div>
            </div>
          </div>

          {/* ── Contacto principal ── */}
          <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Contacto principal</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm text-slate-600">
                Nombre
                <input name="contacto_nombre" value={form.contacto_nombre || ""} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/60" />
              </label>
              <label className="text-sm text-slate-600">
                Puesto
                <input name="contacto_puesto" value={form.contacto_puesto || ""} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/60" />
              </label>
              <label className="text-sm text-slate-600">
                Email
                <input type="email" name="contacto_email" value={form.contacto_email || ""} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/60" />
              </label>
              <label className="text-sm text-slate-600">
                Teléfono
                <input name="contacto_telefono" value={form.contacto_telefono || ""} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/60" />
              </label>
            </div>
          </div>

          {/* ── Capacidad, Presencia, Evidencias (collapsible) ── */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <details open className="group rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-800">
                  <span>Capacidad</span>
                  <span className="text-xs text-slate-400 group-open:rotate-180 transition">▾</span>
                </summary>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="text-sm text-slate-600">
                    Registro REPS/IMSS
                    <input
                      name="reps_registro"
                      value={form.reps_registro || ""}
                      onChange={handleChange}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/60"
                    />
                  </label>
                  <label className="text-sm text-slate-600">
                    Registro patronal IMSS
                    <input
                      name="imss_patronal"
                      value={form.imss_patronal || ""}
                      onChange={handleChange}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/60"
                    />
                  </label>
                  <label className="text-sm text-slate-600">
                    Activos relevantes (separa con coma)
                    <input
                      name="activos_relevantes"
                      value={(form.activos_relevantes as string[])?.join(", ") || ""}
                      onChange={(e) => handleArrayField("activos_relevantes", e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/60"
                    />
                  </label>
                  <label className="text-sm text-slate-600">
                    Personal clave (nombres separados por coma)
                    <input
                      name="personal_clave"
                      value={(form.personal_clave as string[])?.join(", ") || ""}
                      onChange={(e) => handleArrayField("personal_clave", e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/60"
                    />
                  </label>
                </div>
              </details>

              <details className="group rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-800">
                  <span>Presencia</span>
                  <span className="text-xs text-slate-400 group-open:rotate-180 transition">▾</span>
                </summary>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="text-sm text-slate-600">
                    Sitio web
                    <input
                      name="sitio_web"
                      value={form.sitio_web || ""}
                      onChange={handleChange}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/60"
                    />
                  </label>
                  <label className="text-sm text-slate-600">
                    Capturas web (URLs separadas por coma)
                    <input
                      name="sitio_web_capturas"
                      value={(form.sitio_web_capturas as string[])?.join(", ") || ""}
                      onChange={(e) => handleArrayField("sitio_web_capturas", e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/60"
                    />
                  </label>
                  <label className="text-sm text-slate-600 md:col-span-2">
                    Notas de capacidad
                    <textarea
                      name="notas_capacidad"
                      value={form.notas_capacidad || ""}
                      onChange={handleChange}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/60"
                      rows={2}
                    />
                  </label>
                </div>
              </details>

              <details className="group rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-800">
                  <span>Evidencias</span>
                  <span className="text-xs text-slate-400 group-open:rotate-180 transition">▾</span>
                </summary>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="text-sm text-slate-600">
                    Fotos domicilio (URLs separadas por coma)
                    <input
                      name="fotos_domicilio"
                      value={(form.fotos_domicilio as string[])?.join(", ") || ""}
                      onChange={(e) => handleArrayField("fotos_domicilio", e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/60"
                    />
                  </label>
                </div>
              </details>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Guardando…" : editing ? "Actualizar proveedor" : "Crear proveedor"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-600"
            >
              Limpiar
            </button>
          </div>
        </form>

        <header className="rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl shadow-slate-200/60">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-500">Due diligence</p>
              <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-900">Proveedores y alertas 69-B</h1>
              <p className="mt-2 text-sm text-slate-500">
                Consulta estatus SAT, alertas del artículo 69-B y envía validaciones al flujo n8n.
              </p>
            </div>
            <GuiaContador
              section="Proveedores y due diligence"
              steps={[
                { title: "Registra al proveedor", description: "Captura <strong>RFC</strong>, razón social, domicilio y datos de contacto. Puedes subir la <strong>CSF</strong> para auto-extraer datos." },
                { title: "Documenta capacidad operativa", description: "Registra <strong>REPS/IMSS</strong>, activos relevantes, personal clave y evidencias fotográficas del domicilio fiscal." },
                { title: "Valida contra listas SAT", description: "Selecciona tu empresa y haz clic en <strong>Solicitar validación</strong>. El sistema consultará listas 69-B y regresará el estatus." },
                { title: "Revisa alertas y riesgos", description: "Verifica el <strong>estatus 69-B</strong> (Sin coincidencia, Presunto, Definitivo) y los riesgos detectados para cada proveedor." },
              ]}
              concepts={[
                { term: "Art. 69-B CFF", definition: "Lista del SAT de contribuyentes que emiten comprobantes de operaciones simuladas (EFOS). Operar con ellos pone en riesgo tus deducciones." },
                { term: "Due diligence", definition: "Proceso de investigación y verificación del proveedor antes de contratar, para demostrar materialidad y buena fe." },
                { term: "REPS", definition: "Registro de Prestadoras de Servicios Especializados u Obras Especializadas ante la STPS (Art. 15 LFT)." },
                { term: "Capacidad operativa", definition: "Evidencia de que el proveedor tiene infraestructura, personal y activos para prestar realmente el servicio contratado." },
              ]}
              tips={[
                "Valida al proveedor <strong>antes de emitir el primer pago</strong> o firmar contrato.",
                "Guarda capturas de pantalla del sitio web y fotos del domicilio como <strong>soporte de materialidad</strong>.",
                "Revisa periódicamente las listas 69-B — un proveedor puede aparecer después de haberte facturado.",
                "Si un proveedor aparece como PRESUNTO, documenta por escrito tu análisis de riesgo.",
              ]}
            />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm">
              <p className="text-slate-500">Proveedores registrados</p>
              <p className="text-2xl font-semibold text-slate-900">{proveedores.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm">
              <p className="text-slate-500">Alertas 69-B</p>
              <p className="text-2xl font-semibold text-slate-900">{proveedoresEnRiesgo.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm">
              <p className="text-slate-500">Empresa para validar</p>
              <select
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/60"
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
          <div className="flex items-center justify-between text-sm text-slate-500">
            <p>{isLoading ? "Cargando proveedores…" : `Proveedores (${proveedores.length})`}</p>
            {selectedEmpresa && (
              <p className="text-xs text-emerald-600">Validar con empresa ID {selectedEmpresa}</p>
            )}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {proveedores.map((prov) => (
              <article
                key={prov.id}
                className="rounded-3xl border border-slate-100 bg-white p-5 text-sm shadow-xl shadow-slate-200/60"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-semibold text-slate-900">{prov.display_name || prov.razon_social}</p>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide ${prov.tipo_persona === "FISICA"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-sky-100 text-sky-700"
                        }`}>
                        {prov.tipo_persona === "FISICA" ? "PF" : "PM"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">RFC {prov.rfc}</p>
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
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs uppercase text-slate-400">Última validación SAT</p>
                    <p className="text-sm text-slate-900">{formatDate(prov.ultima_validacion_sat)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs uppercase text-slate-400">Última validación 69-B</p>
                    <p className="text-sm text-slate-900">{formatDate(prov.ultima_validacion_69b)}</p>
                  </div>
                </div>

                {prov.riesgos_detectados && prov.riesgos_detectados.length > 0 && (
                  <div className="mt-3 rounded-2xl border border-amber-200/60 bg-amber-50 p-3 text-xs text-amber-700">
                    <p className="font-semibold text-amber-700">Riesgos detectados</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {prov.riesgos_detectados.map((r, idx) => (
                        <li key={`${prov.id}-riesgo-${idx}`}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                    <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Capacidad operativa</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      <li>REPS/IMSS: {prov.reps_registro || "N/D"}</li>
                      <li>Registro patronal: {prov.imss_patronal || "N/D"}</li>
                      <li>Activos relevantes: {countItems(prov.activos_relevantes)}</li>
                      <li>Personal clave: {countItems(prov.personal_clave)}</li>
                      <li>Fotos domicilio: {countItems(prov.fotos_domicilio)}</li>
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                    <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Presencia y notas</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      <li>
                        Sitio web: {prov.sitio_web ? (
                          <a href={prov.sitio_web} target="_blank" rel="noreferrer" className="text-emerald-600 underline">
                            {prov.sitio_web}
                          </a>
                        ) : (
                          "N/D"
                        )}
                      </li>
                      <li>Capturas web: {countItems(prov.sitio_web_capturas)}</li>
                      {prov.notas_capacidad && <li className="text-slate-500">{prov.notas_capacidad}</li>}
                    </ul>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void handleValidar(prov)}
                    disabled={requestingId === prov.id}
                    className="min-h-[44px] rounded-xl border border-emerald-300/60 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {requestingId === prov.id ? "Enviando…" : "Solicitar validación"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEdit(prov)}
                    className="min-h-[44px] rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-600"
                  >
                    Editar
                  </button>
                  <span className="text-xs text-slate-400">Los resultados se guardarán con alertas 69-B</span>
                </div>
              </article>
            ))}
            {!isLoading && proveedores.length === 0 && (
              <div className="rounded-3xl border border-slate-100 bg-white p-6 text-center text-sm text-slate-500">
                No hay proveedores registrados todavía.
              </div>
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
