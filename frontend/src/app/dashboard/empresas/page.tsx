"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { DashboardShell } from "../../../components/DashboardShell";
import { GuiaContador } from "../../../components/GuiaContador";
import { alertError, alertSuccess, alertConfirm } from "../../../lib/alerts";
import {
  Empresa,
  EmpresaPayload,
  TipoPersona,
  fetchEmpresas,
  createEmpresa,
  updateEmpresa,
  deleteEmpresa,
  uploadCSFEmpresa,
} from "../../../lib/empresas";

const INPUT =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200/60";
const LABEL = "text-xs font-medium text-slate-500";
const SECTION =
  "rounded-2xl border border-slate-100 bg-slate-50/60 p-5 space-y-4";

const EMPTY_FORM: EmpresaPayload = {
  tipo_persona: "MORAL",
  razon_social: "",
  rfc: "",
  regimen_fiscal: "",
  actividad_economica: "",
  fecha_constitucion: "",
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
  estado: "",
  ciudad: "",
  pais: "México",
  contacto_nombre: "",
  contacto_puesto: "",
  contacto_email: "",
  contacto_telefono: "",
  activo: true,
};

export default function EmpresasPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<Empresa | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EmpresaPayload>({ ...EMPTY_FORM });
  const fileRef = useRef<HTMLInputElement>(null);

  const isPF = form.tipo_persona === "FISICA";

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setEmpresas(await fetchEmpresas());
    } catch (e) {
      await alertError("Error", (e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(false);
  };

  const handleEdit = (emp: Empresa) => {
    setEditing(emp);
    setForm({
      tipo_persona: emp.tipo_persona || "MORAL",
      razon_social: emp.razon_social,
      rfc: emp.rfc,
      regimen_fiscal: emp.regimen_fiscal,
      actividad_economica: emp.actividad_economica || "",
      fecha_constitucion: emp.fecha_constitucion || "",
      nombre: emp.nombre || "",
      apellido_paterno: emp.apellido_paterno || "",
      apellido_materno: emp.apellido_materno || "",
      curp: emp.curp || "",
      calle: emp.calle || "",
      no_exterior: emp.no_exterior || "",
      no_interior: emp.no_interior || "",
      colonia: emp.colonia || "",
      codigo_postal: emp.codigo_postal || "",
      municipio: emp.municipio || "",
      estado: emp.estado || "",
      ciudad: emp.ciudad || "",
      pais: emp.pais || "México",
      contacto_nombre: emp.contacto_nombre || "",
      contacto_puesto: emp.contacto_puesto || "",
      contacto_email: emp.contacto_email || "",
      contacto_telefono: emp.contacto_telefono || "",
      activo: emp.activo,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (emp: Empresa) => {
    const ok = await alertConfirm("¿Eliminar empresa?", `Se eliminará "${emp.razon_social}" permanentemente.`);
    if (!ok) return;
    try {
      await deleteEmpresa(emp.id);
      setEmpresas((prev) => prev.filter((e) => e.id !== emp.id));
      await alertSuccess("Eliminada", "La empresa fue eliminada.");
    } catch (e) {
      await alertError("Error", (e as Error).message);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCSFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadCSFEmpresa(file, editing?.id);
      const d = result.datos_extraidos;
      setForm((prev) => ({
        ...prev,
        tipo_persona: (d.tipo_persona as TipoPersona) || prev.tipo_persona,
        rfc: d.rfc || prev.rfc,
        razon_social: d.razon_social || prev.razon_social,
        regimen_fiscal: d.regimen_fiscal || prev.regimen_fiscal,
        actividad_economica: d.actividad_economica || prev.actividad_economica,
        nombre: d.nombre || prev.nombre,
        apellido_paterno: d.apellido_paterno || prev.apellido_paterno,
        apellido_materno: d.apellido_materno || prev.apellido_materno,
        curp: d.curp || prev.curp,
        calle: d.calle || prev.calle,
        no_exterior: d.no_exterior || prev.no_exterior,
        no_interior: d.no_interior || prev.no_interior,
        colonia: d.colonia || prev.colonia,
        codigo_postal: d.codigo_postal || prev.codigo_postal,
        municipio: d.municipio || prev.municipio,
        estado: d.estado || prev.estado,
        ciudad: d.ciudad || prev.ciudad,
        fecha_constitucion: d.fecha_constitucion || prev.fecha_constitucion,
      }));
      if (result.registro) {
        setEmpresas((prev) => prev.map((emp) => (emp.id === result.registro!.id ? result.registro! : emp)));
      }
      await alertSuccess("CSF procesada", "Los datos fueron extraídos automáticamente. Revisa y guarda.");
    } catch (e) {
      await alertError("Error al procesar CSF", (e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateEmpresa(editing.id, form);
        setEmpresas((prev) => prev.map((emp) => (emp.id === editing.id ? updated : emp)));
        await alertSuccess("Actualizada", "La empresa fue actualizada.");
      } else {
        const created = await createEmpresa(form);
        setEmpresas((prev) => [created, ...prev]);
        await alertSuccess("Creada", "La empresa fue registrada.");
      }
      resetForm();
    } catch (e) {
      await alertError("Error", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-500">Base operativa</p>
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">Empresas</h2>
            <p className="text-sm text-slate-500">Gestiona las empresas del grupo corporativo.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <GuiaContador
              section="Empresas del grupo"
              steps={[
                { title: "Registra la empresa", description: "Captura los datos fiscales: <strong>razón social</strong>, <strong>RFC</strong>, <strong>régimen fiscal</strong> y <strong>actividad económica</strong>. Distingue si es persona física o moral." },
                { title: "Sube la CSF", description: "Carga la <strong>Constancia de Situación Fiscal</strong> (PDF o imagen) y los datos se extraerán automáticamente con IA. Revisa y guarda." },
                { title: "Completa el domicilio", description: "Registra el <strong>domicilio fiscal</strong> tal como aparece en la CSF: calle, C.P., colonia, municipio, estado y país." },
                { title: "Agrega el contacto", description: "Registra al <strong>contacto principal</strong> de la empresa: nombre, puesto, email y teléfono para coordinar operaciones." },
              ]}
              concepts={[
                { term: "Razón social", definition: "Nombre legal con el que la empresa está inscrita ante el SAT y en el acta constitutiva." },
                { term: "RFC", definition: "Registro Federal de Contribuyentes. Identificador único de 12 (PM) o 13 (PF) caracteres." },
                { term: "CSF", definition: "Constancia de Situación Fiscal emitida por el SAT que acredita el domicilio y régimen de un contribuyente." },
                { term: "Régimen fiscal", definition: "Clasificación que determina las obligaciones tributarias del contribuyente (LISR Art. 7)." },
              ]}
              tips={[
                "Mantén la <strong>CSF actualizada</strong> — el SAT la modifica cuando cambian datos del contribuyente.",
                "Verifica que el <strong>RFC y domicilio</strong> coincidan con los CFDI emitidos y recibidos.",
                "Si la empresa cambia de régimen fiscal, actualiza aquí para mantener la coherencia del expediente.",
              ]}
            />
            {!showForm && (
              <button
                onClick={() => { resetForm(); setShowForm(true); }}
                className="rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-200/60 transition hover:bg-sky-700"
              >
                + Nueva empresa
              </button>
            )}
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-800">
                {editing ? `Editar: ${editing.razon_social}` : "Nueva empresa"}
              </h3>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={resetForm} className="min-h-[44px] rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-rose-300 hover:text-rose-600">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="min-h-[44px] rounded-full bg-sky-600 px-5 py-2 text-xs font-semibold text-white shadow hover:bg-sky-700 disabled:opacity-50">
                  {saving ? "Guardando…" : editing ? "Actualizar" : "Crear empresa"}
                </button>
              </div>
            </div>

            {/* CSF Upload */}
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed border-sky-300 bg-sky-50/50 p-4">
              <div className="flex-1">
                <p className="text-sm font-semibold text-sky-700">📄 Constancia de Situación Fiscal</p>
                <p className="text-xs text-sky-600">Sube el PDF o imagen de la CSF para extraer datos automáticamente.</p>
              </div>
              <label className="min-h-[44px] flex items-center cursor-pointer rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-sky-700">
                {uploading ? "Procesando…" : "Subir CSF"}
                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleCSFUpload} disabled={uploading} className="hidden" />
              </label>
            </div>

            {/* Tipo persona toggle */}
            <div className="flex items-center gap-4">
              <span className={LABEL}>Tipo de persona:</span>
              <div className="flex rounded-full border border-slate-200 bg-slate-50 p-0.5">
                {(["MORAL", "FISICA"] as TipoPersona[]).map((t) => (
                  <button key={t} type="button" onClick={() => setForm((prev) => ({ ...prev, tipo_persona: t }))}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${form.tipo_persona === t ? "bg-sky-600 text-white shadow" : "text-slate-500 hover:text-slate-700"}`}>
                    {t === "MORAL" ? "Persona moral" : "Persona física"}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {/* Datos generales */}
              <div className={SECTION}>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                  {isPF ? "Datos del contribuyente (PF)" : "Datos de la empresa (PM)"}
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  {isPF && (
                    <>
                      <label className={LABEL}>Nombre(s)<input name="nombre" value={form.nombre || ""} onChange={handleChange} className={INPUT} required /></label>
                      <label className={LABEL}>Apellido paterno<input name="apellido_paterno" value={form.apellido_paterno || ""} onChange={handleChange} className={INPUT} required /></label>
                      <label className={LABEL}>Apellido materno<input name="apellido_materno" value={form.apellido_materno || ""} onChange={handleChange} className={INPUT} /></label>
                      <label className={LABEL}>CURP<input name="curp" value={form.curp || ""} onChange={handleChange} className={`${INPUT} uppercase`} maxLength={18} /></label>
                    </>
                  )}
                  <label className={`${LABEL} ${isPF ? "" : "md:col-span-2"}`}>
                    {isPF ? "Nombre completo (como en CSF)" : "Razón social"}
                    <input name="razon_social" value={form.razon_social || ""} onChange={handleChange} className={INPUT} required />
                  </label>
                  <label className={LABEL}>RFC<input name="rfc" value={form.rfc || ""} onChange={handleChange} className={`${INPUT} uppercase`} required maxLength={13} /></label>
                  <label className={LABEL}>Régimen fiscal<input name="regimen_fiscal" value={form.regimen_fiscal || ""} onChange={handleChange} className={INPUT} required /></label>
                  <label className={LABEL}>Actividad económica<input name="actividad_economica" value={form.actividad_economica || ""} onChange={handleChange} className={INPUT} /></label>
                  <label className={LABEL}>{isPF ? "Inicio de actividades" : "Fecha de constitución"}<input type="date" name="fecha_constitucion" value={form.fecha_constitucion || ""} onChange={handleChange} className={INPUT} /></label>
                </div>
              </div>

              {/* Domicilio fiscal */}
              <div className={SECTION}>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Domicilio fiscal</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className={`${LABEL} md:col-span-2`}>Calle<input name="calle" value={form.calle || ""} onChange={handleChange} className={INPUT} /></label>
                  <label className={LABEL}>No. exterior<input name="no_exterior" value={form.no_exterior || ""} onChange={handleChange} className={INPUT} /></label>
                  <label className={LABEL}>No. interior<input name="no_interior" value={form.no_interior || ""} onChange={handleChange} className={INPUT} /></label>
                  <label className={LABEL}>Colonia<input name="colonia" value={form.colonia || ""} onChange={handleChange} className={INPUT} /></label>
                  <label className={LABEL}>Código postal<input name="codigo_postal" value={form.codigo_postal || ""} onChange={handleChange} className={INPUT} maxLength={5} /></label>
                  <label className={LABEL}>Municipio / Alcaldía<input name="municipio" value={form.municipio || ""} onChange={handleChange} className={INPUT} /></label>
                  <label className={LABEL}>Estado<input name="estado" value={form.estado || ""} onChange={handleChange} className={INPUT} /></label>
                  <label className={LABEL}>Ciudad<input name="ciudad" value={form.ciudad || ""} onChange={handleChange} className={INPUT} /></label>
                  <label className={LABEL}>País<input name="pais" value={form.pais || "México"} onChange={handleChange} className={INPUT} /></label>
                </div>
              </div>
            </div>

            {/* Contacto principal */}
            <div className={SECTION}>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Contacto principal</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className={LABEL}>Nombre<input name="contacto_nombre" value={form.contacto_nombre || ""} onChange={handleChange} className={INPUT} /></label>
                <label className={LABEL}>Puesto<input name="contacto_puesto" value={form.contacto_puesto || ""} onChange={handleChange} className={INPUT} /></label>
                <label className={LABEL}>Email<input type="email" name="contacto_email" value={form.contacto_email || ""} onChange={handleChange} className={INPUT} /></label>
                <label className={LABEL}>Teléfono<input name="contacto_telefono" value={form.contacto_telefono || ""} onChange={handleChange} className={INPUT} /></label>
              </div>
            </div>
          </form>
        )}

        {/* List */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          {isLoading ? (
            <p className="text-slate-500">Cargando empresas…</p>
          ) : empresas.length === 0 ? (
            <p className="text-slate-500">No hay empresas registradas. Crea la primera.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="py-3 pr-4">Nombre / Razón social</th>
                    <th className="py-3 pr-4">Tipo</th>
                    <th className="py-3 pr-4">RFC</th>
                    <th className="py-3 pr-4">Régimen</th>
                    <th className="py-3 pr-4">Estado</th>
                    <th className="py-3 pr-4">Estatus</th>
                    <th className="py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {empresas.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50">
                      <td className="py-3 pr-4">
                        <span className="font-semibold text-slate-900">{emp.display_name || emp.razon_social}</span>
                        {emp.contacto_nombre && <span className="ml-2 text-xs text-slate-400">· {emp.contacto_nombre}</span>}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${emp.tipo_persona === "FISICA" ? "bg-amber-50 text-amber-600" : "bg-sky-50 text-sky-600"}`}>
                          {emp.tipo_persona === "FISICA" ? "PF" : "PM"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-slate-600">{emp.rfc}</td>
                      <td className="py-3 pr-4 text-slate-600">{emp.regimen_fiscal}</td>
                      <td className="py-3 pr-4 text-slate-600">{emp.estado}</td>
                      <td className="py-3 pr-4">
                        <span className={emp.activo ? "rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-600" : "rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-600"}>
                          {emp.activo ? "Activa" : "Inactiva"}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button onClick={() => handleEdit(emp)} className="min-h-[44px] mr-2 text-xs font-semibold text-sky-600 hover:text-sky-800">Editar</button>
                        <button onClick={() => void handleDelete(emp)} className="min-h-[44px] text-xs font-semibold text-rose-500 hover:text-rose-700">Eliminar</button>
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
