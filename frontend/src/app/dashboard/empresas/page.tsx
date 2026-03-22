"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, RefreshCw } from "lucide-react";

import { DataCardsSkeleton, InlineEmptyState } from "../../../components/DataState";
import { DashboardShell } from "../../../components/DashboardShell";
import { useAuthContext } from "../../../context/AuthContext";
import { GuiaContador } from "../../../components/GuiaContador";
import { MobileDataList } from "../../../components/MobileDataList";
import { alertError, alertSuccess, alertConfirm, alertInfo } from "../../../lib/alerts";
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
  "rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-4 sm:p-5";

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

function mapEmpresaToPayload(emp: Empresa): EmpresaPayload {
  return {
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
  };
}

export default function EmpresasPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<Empresa | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EmpresaPayload>({ ...EMPTY_FORM });
  const [initialForm, setInitialForm] = useState<EmpresaPayload>({ ...EMPTY_FORM });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const isPF = form.tipo_persona === "FISICA";
  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm]
  );

  const { user } = useAuthContext();
  const isAdmin = user?.is_staff || false;
  const isEditingMode = Boolean(editing?.id);
  const requiredFieldLabels = isPF
    ? ["Nombre", "Apellido paterno", "Razón social", "RFC", "Régimen fiscal", "Estado"]
    : ["Razón social", "RFC", "Régimen fiscal", "Estado"];

  const inputClass = (fieldName: string) =>
    `${INPUT} ${fieldErrors[fieldName] ? "border-rose-400 bg-rose-50/40 focus:border-rose-500 focus:ring-rose-200/70" : ""}`;

  const labelClass = (fieldName: string) =>
    `${LABEL} ${fieldErrors[fieldName] ? "text-rose-700" : ""}`;

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

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!showForm || !isDirty || saving) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [showForm, isDirty, saving]);

  const resetForm = async ({ skipConfirm = false }: { skipConfirm?: boolean } = {}) => {
    if (!skipConfirm && showForm && isDirty && !saving) {
      const leave = await alertConfirm(
        "Tienes cambios sin guardar",
        "Si sales ahora, perderás la información capturada."
      );
      if (!leave) return;
    }
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setInitialForm({ ...EMPTY_FORM });
    setFieldErrors({});
    setFormError("");
    setShowForm(false);
  };

  const handleEdit = (emp: Empresa) => {
    if (showForm && isDirty && !saving) {
      void alertInfo("Cambios pendientes", "Guarda o cancela antes de editar otro registro.");
      return;
    }
    const nextForm = mapEmpresaToPayload(emp);
    setEditing(emp);
    setForm(nextForm);
    setInitialForm(nextForm);
    setFieldErrors({});
    setFormError("");
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
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const parseApiFormError = (error: Error) => {
    const fallback = { detail: error.message, field_errors: {} as Record<string, string[]> };
    try {
      const parsed = JSON.parse(error.message) as {
        detail?: string;
        field_errors?: Record<string, string[] | string>;
        status?: number;
        code?: string;
      };
      const normalized: Record<string, string[]> = {};
      Object.entries(parsed.field_errors || {}).forEach(([key, value]) => {
        normalized[key] = Array.isArray(value) ? value : [String(value)];
      });

      let detail = parsed.detail || fallback.detail;
      const isGeneric =
        !detail ||
        detail === "Ocurrió un error al procesar la solicitud." ||
        detail.startsWith("Error API");

      if (isGeneric && Object.keys(normalized).length > 0) {
        const summary = Object.entries(normalized)
          .slice(0, 4)
          .map(([field, messages]) => `${field}: ${messages[0] || "valor inválido"}`)
          .join(" · ");
        detail = `Corrige los campos marcados. ${summary}`;
      }

      if (parsed.status && !detail.includes(`HTTP ${parsed.status}`)) {
        detail = `${detail} (HTTP ${parsed.status})`;
      }

      return { detail, field_errors: normalized };
    } catch {
      return fallback;
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    const rfc = String(form.rfc || "").trim().toUpperCase();
    const razonSocial = String(form.razon_social || "").trim();
    const regimenFiscal = String(form.regimen_fiscal || "").trim();
    const estado = String(form.estado || "").trim();
    const contactoEmail = String(form.contacto_email || "").trim();

    if (!razonSocial) errors.razon_social = "La razón social es obligatoria.";
    if (!regimenFiscal) errors.regimen_fiscal = "El régimen fiscal es obligatorio.";
    if (!estado) errors.estado = "El estado es obligatorio.";
    if (!rfc) {
      errors.rfc = "El RFC es obligatorio.";
    } else if (!/^([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})$/.test(rfc)) {
      errors.rfc = "El RFC no tiene un formato válido (12 o 13 caracteres).";
    }
    if (contactoEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactoEmail)) {
      errors.contacto_email = "El correo de contacto no tiene un formato válido.";
    }
    if (isPF && !String(form.nombre || "").trim()) {
      errors.nombre = "El nombre es obligatorio para persona física.";
    }
    if (isPF && !String(form.apellido_paterno || "").trim()) {
      errors.apellido_paterno = "El apellido paterno es obligatorio para persona física.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCSFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadCSFEmpresa(file);
      const d = result.datos_extraidos;

      const newFormState = {
        ...form,
        tipo_persona: (d.tipo_persona as TipoPersona) || form.tipo_persona,
        rfc: d.rfc || form.rfc,
        razon_social: d.razon_social || form.razon_social,
        regimen_fiscal: d.regimen_fiscal || form.regimen_fiscal,
        actividad_economica: d.actividad_economica || form.actividad_economica,
        nombre: d.nombre || form.nombre,
        apellido_paterno: d.apellido_paterno || form.apellido_paterno,
        apellido_materno: d.apellido_materno || form.apellido_materno,
        curp: d.curp || form.curp,
        calle: d.calle || form.calle,
        no_exterior: d.no_exterior || form.no_exterior,
        no_interior: d.no_interior || form.no_interior,
        colonia: d.colonia || form.colonia,
        codigo_postal: d.codigo_postal || form.codigo_postal,
        municipio: d.municipio || form.municipio,
        estado: d.estado || form.estado,
        ciudad: d.ciudad || form.ciudad,
        fecha_constitucion: d.fecha_constitucion || form.fecha_constitucion,
      };

      setForm(newFormState);

      // Auto-save flow
      setSaving(true);
      try {
        if (editing) {
          const updated = await updateEmpresa(editing.id, newFormState);
          setEmpresas((prev) => prev.map((emp) => (emp.id === editing.id ? updated : emp)));
          await alertSuccess("Actualizada por CSF", "Los datos de la CSF se extrajeron y la empresa fue actualizada automáticamente.");
        } else {
          const created = await createEmpresa(newFormState);
          setEmpresas((prev) => [created, ...prev]);
          await alertSuccess("Creada por CSF", "Los datos de la CSF se extrajeron y la empresa fue registrada automáticamente.");
          await alertInfo("Siguiente paso", "Ahora puedes registrar los proveedores de este cliente.");
        }
        await resetForm({ skipConfirm: true });
      } catch (saveError) {
        const parsed = parseApiFormError(saveError as Error);
        setFormError(parsed.detail || "Error al auto-guardar tras leer la CSF.");
        const nextFieldErrors: Record<string, string> = {};
        Object.entries(parsed.field_errors || {}).forEach(([key, value]) => {
          nextFieldErrors[key] = value[0] || "Campo inválido.";
        });
        if (Object.keys(nextFieldErrors).length > 0) setFieldErrors(nextFieldErrors);
        await alertError("Datos extraídos, pero hubo un error al guardar", parsed.detail || "Revisa los campos faltantes e intenta guardar manualmente.");
      } finally {
        setSaving(false);
      }

    } catch (e) {
      await alertError("Error al procesar CSF", (e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!validateForm()) {
      setFormError("Revisa los campos marcados antes de guardar.");
      return;
    }
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
        await alertInfo("Siguiente paso recomendado", "Ahora registra los proveedores de este cliente para completar el flujo.");
      }
      await resetForm({ skipConfirm: true });
    } catch (e) {
      const parsed = parseApiFormError(e as Error);
      setFormError(parsed.detail || "No se pudo guardar la información.");
      const nextFieldErrors: Record<string, string> = {};
      Object.entries(parsed.field_errors || {}).forEach(([key, value]) => {
        nextFieldErrors[key] = value[0] || "Campo inválido.";
      });
      if (Object.keys(nextFieldErrors).length > 0) setFieldErrors(nextFieldErrors);
      await alertError("Error al guardar", parsed.detail || "No se pudo guardar la empresa.");
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
            {!showForm && isAdmin && (
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
          <form onSubmit={handleSubmit} aria-busy={saving || uploading} className="space-y-5 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">
                  {editing ? `Editar empresa: ${editing.razon_social}` : "Nueva empresa"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">Completa identidad fiscal, domicilio y contacto para dejar el expediente operativo listo desde móvil.</p>
              </div>
              <div className="grid w-full gap-2 sm:w-auto sm:grid-flow-col">
                <button type="button" onClick={() => { void resetForm(); }} className="min-h-[44px] rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-rose-300 hover:text-rose-600">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !isDirty}
                  aria-disabled={saving || !isDirty}
                  aria-busy={saving}
                  className={`min-h-[44px] rounded-full px-5 py-2 text-xs font-semibold text-white shadow disabled:cursor-not-allowed disabled:opacity-50 ${isEditingMode
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                >
                  {saving ? "Guardando…" : isEditingMode ? "Actualizar empresa" : "Guardar empresa"}
                </button>
              </div>
            </div>
            {showForm && (
              <p className="text-xs font-medium text-slate-500">
                {isDirty ? "Tienes cambios sin guardar." : "Sin cambios pendientes."}
              </p>
            )}
            <p className="text-[11px] text-slate-500">Los campos con <span className="text-rose-600">*</span> son obligatorios.</p>
            <p className="text-[11px] text-slate-600">
              Obligatorios en este formulario: <span className="font-medium">{requiredFieldLabels.join(", ")}</span>.
            </p>
            {formError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
                {formError}
              </div>
            )}

            {/* CSF Upload */}
            <div aria-busy={uploading} className="flex flex-col gap-4 rounded-xl border border-dashed border-sky-300 bg-sky-50/50 p-4 sm:flex-row sm:items-center">
              <div className="flex-1">
                <p className="text-sm font-semibold text-sky-700">📄 Constancia de Situación Fiscal</p>
                <p className="text-xs text-sky-600">Sube el PDF o imagen de la CSF para extraer datos automáticamente.</p>
              </div>
              <label aria-busy={uploading} className="flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-sky-700 sm:w-auto">
                {uploading ? "Procesando…" : "Subir CSF"}
                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleCSFUpload} disabled={uploading} className="hidden" />
              </label>
            </div>

            {/* Tipo persona toggle */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span className={LABEL}>Tipo de persona:</span>
              <div className="grid w-full grid-cols-2 rounded-full border border-slate-200 bg-slate-50 p-0.5 sm:flex sm:w-auto">
                {(["MORAL", "FISICA"] as TipoPersona[]).map((t) => (
                  <button key={t} type="button" onClick={() => setForm((prev) => ({ ...prev, tipo_persona: t }))}
                    className={`min-h-[44px] rounded-full px-4 py-1.5 text-xs font-semibold transition ${form.tipo_persona === t ? "bg-sky-600 text-white shadow" : "text-slate-500 hover:text-slate-700"}`}>
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
                      <label className={labelClass("nombre")}>Nombre(s) <span className="text-rose-600">*</span><input name="nombre" value={form.nombre || ""} onChange={handleChange} className={inputClass("nombre")} required />{fieldErrors.nombre && <span className="mt-1 block text-[11px] font-medium text-rose-600">{fieldErrors.nombre}</span>}</label>
                      <label className={labelClass("apellido_paterno")}>Apellido paterno <span className="text-rose-600">*</span><input name="apellido_paterno" value={form.apellido_paterno || ""} onChange={handleChange} className={inputClass("apellido_paterno")} required />{fieldErrors.apellido_paterno && <span className="mt-1 block text-[11px] font-medium text-rose-600">{fieldErrors.apellido_paterno}</span>}</label>
                      <label className={LABEL}>Apellido materno<input name="apellido_materno" value={form.apellido_materno || ""} onChange={handleChange} className={INPUT} /></label>
                      <label className={LABEL}>CURP<input name="curp" value={form.curp || ""} onChange={handleChange} className={`${INPUT} uppercase`} maxLength={18} /></label>
                    </>
                  )}
                  <label className={`${labelClass("razon_social")} ${isPF ? "" : "md:col-span-2"}`}>
                    {isPF ? "Nombre completo (como en CSF)" : "Razón social"} <span className="text-rose-600">*</span>
                    <input name="razon_social" value={form.razon_social || ""} onChange={handleChange} className={inputClass("razon_social")} required />
                    {fieldErrors.razon_social && <span className="mt-1 block text-[11px] font-medium text-rose-600">{fieldErrors.razon_social}</span>}
                  </label>
                  <label className={labelClass("rfc")}>RFC <span className="text-rose-600">*</span><input name="rfc" value={form.rfc || ""} onChange={handleChange} className={`${inputClass("rfc")} uppercase`} required maxLength={13} />{fieldErrors.rfc && <span className="mt-1 block text-[11px] font-medium text-rose-600">{fieldErrors.rfc}</span>}</label>
                  <label className={labelClass("regimen_fiscal")}>Régimen fiscal <span className="text-rose-600">*</span><input name="regimen_fiscal" value={form.regimen_fiscal || ""} onChange={handleChange} className={inputClass("regimen_fiscal")} required />{fieldErrors.regimen_fiscal && <span className="mt-1 block text-[11px] font-medium text-rose-600">{fieldErrors.regimen_fiscal}</span>}</label>
                  <label className={LABEL}>Actividad económica<input name="actividad_economica" value={form.actividad_economica || ""} onChange={handleChange} className={INPUT} /></label>
                  <label className={labelClass("fecha_constitucion")}>{isPF ? "Inicio de actividades" : "Fecha de constitución"} <span className="text-slate-400">(opcional)</span><input type="date" name="fecha_constitucion" value={form.fecha_constitucion || ""} onChange={handleChange} className={inputClass("fecha_constitucion")} />{fieldErrors.fecha_constitucion && <span className="mt-1 block text-[11px] font-medium text-rose-600">{fieldErrors.fecha_constitucion}</span>}<span className="mt-1 block text-[11px] text-slate-500">Formato esperado: YYYY-MM-DD.</span></label>
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
                  <label className={labelClass("estado")}>Estado <span className="text-rose-600">*</span><input name="estado" value={form.estado || ""} onChange={handleChange} className={inputClass("estado")} required />{fieldErrors.estado && <span className="mt-1 block text-[11px] font-medium text-rose-600">{fieldErrors.estado}</span>}</label>
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

            <div className="grid gap-2 border-t border-slate-100 pt-4 sm:flex sm:flex-wrap sm:items-center">
              <button
                type="submit"
                disabled={saving || !isDirty}
                aria-disabled={saving || !isDirty}
                aria-busy={saving}
                className={`min-h-[44px] rounded-full px-5 py-2 text-xs font-semibold text-white shadow disabled:cursor-not-allowed disabled:opacity-50 ${isEditingMode
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
              >
                {saving && <RefreshCw className="mr-2 inline h-3.5 w-3.5 animate-spin" />}
                {saving ? "Guardando…" : isEditingMode ? "Actualizar empresa" : "Guardar empresa"}
              </button>
              <button
                type="button"
                onClick={() => { void resetForm(); }}
                className="min-h-[44px] rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-rose-300 hover:text-rose-600"
              >
                Cancelar
              </button>
              <p className="text-xs text-slate-500 sm:ml-auto">El cierre del formulario queda accesible sin volver al encabezado.</p>
            </div>
          </form>
        )}

        {/* List */}
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
          {isLoading ? (
            <DataCardsSkeleton cards={3} className="xl:grid-cols-3" />
          ) : empresas.length === 0 ? (
            <InlineEmptyState
              icon={<Building2 className="h-6 w-6" />}
              title="No hay empresas registradas"
              description="Crea la primera empresa para comenzar la captura fiscal y administrativa desde móvil sin quedarte en una pantalla vacía."
            />
          ) : (
            <>
              <MobileDataList
                items={empresas}
                getKey={(emp) => emp.id}
                empty={
                  <InlineEmptyState
                    icon={<Building2 className="h-6 w-6" />}
                    title="No hay empresas registradas"
                    description="Agrega la primera empresa para empezar con la operación del expediente."
                  />
                }
                className="space-y-3"
                renderItem={(emp) => (
                  <article className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{emp.display_name || emp.razon_social}</p>
                        <p className="mt-1 font-mono text-xs text-slate-500">{emp.rfc}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${emp.tipo_persona === "FISICA" ? "bg-amber-50 text-amber-600" : "bg-sky-50 text-sky-600"}`}>
                          {emp.tipo_persona === "FISICA" ? "PF" : "PM"}
                        </span>
                        <span className={emp.activo ? "rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-blue-600" : "rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-600"}>
                          {emp.activo ? "Activa" : "Inactiva"}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Régimen</p>
                        <p className="mt-1 text-slate-900">{emp.regimen_fiscal || "Sin captura"}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Estado</p>
                        <p className="mt-1 text-slate-900">{emp.estado || "Sin captura"}</p>
                      </div>
                    </div>
                    {(emp.contacto_nombre || emp.contacto_email || emp.contacto_telefono) && (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Contacto principal</p>
                        <p className="mt-1 text-slate-900">{emp.contacto_nombre || "Sin nombre"}</p>
                        <p className="mt-1 text-xs text-slate-500">{[emp.contacto_email, emp.contacto_telefono].filter(Boolean).join(" · ") || "Sin medios registrados"}</p>
                      </div>
                    )}
                    {isAdmin && (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <button onClick={() => handleEdit(emp)} className="min-h-[44px] rounded-full border border-sky-200 px-4 py-2 text-xs font-semibold text-sky-600 hover:border-sky-300 hover:text-sky-800">Editar</button>
                        <button onClick={() => void handleDelete(emp)} className="min-h-[44px] rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-500 hover:border-rose-300 hover:text-rose-700">Eliminar</button>
                      </div>
                    )}
                  </article>
                )}
              />
              <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="py-3 pr-4">Nombre / Razón social</th>
                    <th className="py-3 pr-4">Tipo</th>
                    <th className="py-3 pr-4">RFC</th>
                    <th className="py-3 pr-4">Régimen</th>
                    <th className="py-3 pr-4">Estado</th>
                    <th className="py-3 pr-4">Estatus</th>
                    {isAdmin && <th className="py-3 text-right">Acciones</th>}
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
                        <span className={emp.activo ? "rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-blue-600" : "rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-600"}>
                          {emp.activo ? "Activa" : "Inactiva"}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="py-3 text-right">
                          <button onClick={() => handleEdit(emp)} className="min-h-[44px] mr-2 text-xs font-semibold text-sky-600 hover:text-sky-800">Editar</button>
                          <button onClick={() => void handleDelete(emp)} className="min-h-[44px] text-xs font-semibold text-rose-500 hover:text-rose-700">Eliminar</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
