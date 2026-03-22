"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Building2, FileSearch, Landmark, Plus, RefreshCw, Search, ShieldAlert, ShieldCheck } from "lucide-react";

import { DataCardsSkeleton, InlineEmptyState } from "../../../components/DataState";
import { DashboardShell } from "../../../components/DashboardShell";
import { GuiaContador } from "../../../components/GuiaContador";
import { alertConfirm, alertError, alertInfo, alertSuccess } from "../../../lib/alerts";
import Swal from "sweetalert2";
import {
  EmpresaLite,
  Proveedor,
  TipoPersona,
  fetchEmpresas,
  fetchProviders,
  createProveedor,
  deleteProveedor,
  updateProveedor,
  requestProveedorValidacion,
  uploadCSFProveedor,
} from "../../../lib/providers";

const STATUS_STYLES: Record<string, string> = {
  SIN_COINCIDENCIA: "bg-[var(--fiscal-success-soft)] text-[var(--fiscal-success)] border-[rgba(31,122,90,0.18)]",
  PRESUNTO: "bg-[var(--fiscal-warning-soft)] text-[var(--fiscal-warning)] border-[rgba(166,103,31,0.18)]",
  DEFINITIVO: "bg-[var(--fiscal-danger-soft)] text-[var(--fiscal-danger)] border-[rgba(160,67,61,0.18)]",
  VALIDADO: "bg-[var(--fiscal-success-soft)] text-[var(--fiscal-success)] border-[rgba(31,122,90,0.18)]",
  "VALIDADO CON ALERTAS": "bg-[var(--fiscal-warning-soft)] text-[var(--fiscal-warning)] border-[rgba(166,103,31,0.18)]",
};

function Badge({ label, tone }: { label: string; tone?: keyof typeof STATUS_STYLES }) {
  const cls = tone && STATUS_STYLES[tone] ? STATUS_STYLES[tone] : "bg-slate-100 text-slate-700 border-slate-200";
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

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    }),
  ]);
}

import { useSAT } from "../../../hooks/useSAT";

const EMPTY_PROVEEDOR_FORM: Partial<Proveedor> = {
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
};

function mapProveedorToForm(prov: Proveedor): Partial<Proveedor> {
  return {
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
  };
}

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaLite[]>([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [requestingId, setRequestingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Proveedor | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");

  // Custom hook para validación SAT
  const { consultarRFC } = useSAT();

  const [form, setForm] = useState<Partial<Proveedor>>({ ...EMPTY_PROVEEDOR_FORM });
  const [initialForm, setInitialForm] = useState<Partial<Proveedor>>({ ...EMPTY_PROVEEDOR_FORM });

  const isPF = form.tipo_persona === "FISICA";
  const isEditingMode = Boolean(editing?.id);
  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm]
  );
  const requiredFieldLabels = isPF
    ? ["Nombre(s)", "Apellido paterno", "RFC"]
    : ["Razón social", "RFC"];
  const requiredLabelClass = (fieldName: string) =>
    `text-sm ${fieldErrors[fieldName] ? "text-[var(--fiscal-danger)]" : "text-[var(--fiscal-muted)]"}`;
  const requiredInputClass = (fieldName: string) =>
    `mt-2 w-full rounded-2xl border bg-white px-4 py-2.5 text-sm text-[var(--fiscal-ink)] shadow-sm focus:outline-none focus:ring-2 ${
      fieldErrors[fieldName]
        ? "border-[rgba(160,67,61,0.35)] bg-[var(--fiscal-danger-soft)]/60 focus:border-[var(--fiscal-danger)] focus:ring-[rgba(160,67,61,0.16)]"
        : "border-[rgba(200,192,177,0.72)] focus:border-[var(--fiscal-accent)] focus:ring-[rgba(45,91,136,0.18)]"
    }`;

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

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isFormOpen || !isDirty || saving) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isFormOpen, isDirty, saving]);

  const filteredProveedores = useMemo(() => {
    if (!searchQuery) return proveedores;
    const lowerQuery = searchQuery.toLowerCase();
    return proveedores.filter((p) => {
      const parts = [
        p.razon_social,
        p.rfc,
        p.nombre,
        p.apellido_paterno,
        p.apellido_materno,
      ];
      return parts.some((part) => part?.toLowerCase().includes(lowerQuery));
    });
  }, [proveedores, searchQuery]);

  const proveedoresEnRiesgo = useMemo(
    () => proveedores.filter((p) => p.estatus_69b && p.estatus_69b !== "SIN_COINCIDENCIA"),
    [proveedores]
  );

  const resetForm = async ({ skipConfirm = false }: { skipConfirm?: boolean } = {}) => {
    if (!skipConfirm && isFormOpen && isDirty && !saving) {
      const leave = await alertConfirm(
        "Tienes cambios sin guardar",
        "Si sales ahora, perderás la información capturada del proveedor."
      );
      if (!leave) return;
    }
    setEditing(null);
    setIsFormOpen(false);
    const nextForm = { ...EMPTY_PROVEEDOR_FORM };
    setForm(nextForm);
    setInitialForm(nextForm);
    setFieldErrors({});
    setFormError("");
  };

  const handleEdit = (prov: Proveedor) => {
    if (isFormOpen && isDirty && !saving) {
      void alertInfo("Cambios pendientes", "Guarda o cancela antes de editar otro proveedor.");
      return;
    }
    const nextForm = mapProveedorToForm(prov);
    setEditing(prov);
    setIsFormOpen(true);
    setForm(nextForm);
    setInitialForm(nextForm);
    setFieldErrors({});
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (prov: Proveedor) => {
    const ok = await alertConfirm(
      "¿Eliminar proveedor?",
      `Se eliminará \"${prov.display_name || prov.razon_social}\" permanentemente.`
    );
    if (!ok) return;

    setDeletingId(prov.id);
    try {
      await deleteProveedor(prov.id);
      setProveedores((prev) => prev.filter((p) => p.id !== prov.id));
      if (editing?.id === prov.id) {
        await resetForm({ skipConfirm: true });
      }
      await alertSuccess("Proveedor eliminado", "El proveedor fue eliminado correctamente.");
    } catch (e) {
      await alertError("No se pudo eliminar", (e as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
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
    const nombre = String(form.nombre || "").trim();
    const apellidoPaterno = String(form.apellido_paterno || "").trim();
    const email = String(form.contacto_email || "").trim();

    if (!rfc) {
      errors.rfc = "El RFC es obligatorio.";
    } else if (!/^([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})$/.test(rfc)) {
      errors.rfc = "El RFC no tiene un formato válido (12 o 13 caracteres).";
    }

    if (isPF) {
      if (!nombre) errors.nombre = "El nombre es obligatorio para persona física.";
      if (!apellidoPaterno) errors.apellido_paterno = "El apellido paterno es obligatorio para persona física.";
    } else if (!razonSocial) {
      errors.razon_social = "La razón social es obligatoria para persona moral.";
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.contacto_email = "El correo de contacto no tiene un formato válido.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
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
      const res = await uploadCSFProveedor(file);
      if (res.datos_extraidos) {
        const d = res.datos_extraidos;
        
        const newFormState = {
          ...form,
          tipo_persona: (d.tipo_persona as TipoPersona) || form.tipo_persona,
          razon_social: d.razon_social || form.razon_social,
          rfc: d.rfc || form.rfc,
          nombre: d.nombre || form.nombre,
          apellido_paterno: d.apellido_paterno || form.apellido_paterno,
          apellido_materno: d.apellido_materno || form.apellido_materno,
          curp: d.curp || form.curp,
          regimen_fiscal: d.regimen_fiscal || form.regimen_fiscal,
          actividad_principal: d.actividad_economica || form.actividad_principal,
          calle: d.calle || form.calle,
          no_exterior: d.no_exterior || form.no_exterior,
          no_interior: d.no_interior || form.no_interior,
          colonia: d.colonia || form.colonia,
          codigo_postal: d.codigo_postal || form.codigo_postal,
          municipio: d.municipio || form.municipio,
          estado: d.estado || form.estado,
          ciudad: d.ciudad || form.ciudad,
        };

        setForm(newFormState);

        // Auto-save flow
        setSaving(true);
        try {
          if (editing) {
            const updated = await updateProveedor(editing.id, newFormState);
            setProveedores((prev) => prev.map((p) => (p.id === editing.id ? updated : p)));
            await alertSuccess("Actualizado por CSF", "Los datos de la CSF se extrajeron y el proveedor fue actualizado automáticamente.");
          } else {
            const created = await createProveedor(newFormState as any);
            setProveedores((prev) => [created, ...prev]);
            await alertSuccess("Creado por CSF", "Los datos de la CSF se extrajeron y el proveedor fue registrado automáticamente.");
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
    setFormError("");
    if (!validateForm()) {
      setFormError("Revisa los campos marcados antes de guardar.");
      return;
    }
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
      await resetForm({ skipConfirm: true });
    } catch (e) {
      const parsed = parseApiFormError(e as Error);
      setFormError(parsed.detail || "No se pudo guardar el proveedor.");
      const nextFieldErrors: Record<string, string> = {};
      Object.entries(parsed.field_errors || {}).forEach(([key, value]) => {
        nextFieldErrors[key] = value[0] || "Campo inválido.";
      });
      if (Object.keys(nextFieldErrors).length > 0) setFieldErrors(nextFieldErrors);
      await alertError("No pudimos guardar el proveedor", parsed.detail || "Corrige los campos marcados.");
    } finally {
      setSaving(false);
    }
  };

  const handleValidar = async (proveedor: Proveedor) => {
    setRequestingId(proveedor.id);
    try {
      const data = await withTimeout(
        consultarRFC(proveedor.rfc),
        15000,
        "La validación SAT está tardando demasiado. Intenta nuevamente."
      );

      let nuevoEstatus: "SIN_COINCIDENCIA" | "PRESUNTO" | "DEFINITIVO" = "SIN_COINCIDENCIA";

      if (data.encontrado && data.resultados.length > 0) {
        // Encontrar el estatus más severo. DEFINITIVO > PRESUNTO > DESVIRTUADO
        const tieneDefinitivo = data.resultados.some(r => r.estatus.toLowerCase() === "definitivo");
        const tienePresunto = data.resultados.some(r => r.estatus.toLowerCase() === "presunto");

        if (tieneDefinitivo) {
          nuevoEstatus = "DEFINITIVO";
        } else if (tienePresunto) {
          nuevoEstatus = "PRESUNTO";
        }
      }

      const updatePayload: Partial<Proveedor> = {
        estatus_sat: data.encontrado ? "Validado con Alertas" : "Validado",
        estatus_69b: nuevoEstatus,
        ultima_validacion_sat: new Date().toISOString(),
        ultima_validacion_69b: new Date().toISOString()
      };

      const updated = await withTimeout(
        updateProveedor(proveedor.id, updatePayload),
        10000,
        "No se pudo guardar el resultado de validación a tiempo. Intenta nuevamente."
      );
      setProveedores((prev) => prev.map((p) => (p.id === proveedor.id ? updated : p)));
      setRequestingId(null);

      const nombreProveedor = proveedor.display_name || proveedor.razon_social;
      const fechaBD = data.fecha_actualizacion_bd
        ? new Date(data.fecha_actualizacion_bd).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
        : "no disponible";

      if (data.encontrado) {
        await Swal.fire({
          icon: "error",
          title: "Alerta 69-B detectada",
          html: `<strong>${nombreProveedor}</strong><br/>RFC: <code>${proveedor.rfc}</code><br/><br/>Aparece en las listas del SAT con estatus: <strong>${nuevoEstatus}</strong>.<br/><br/><span style="color:#64748b;font-size:0.85em">Base de datos SAT actualizada al ${fechaBD}.</span>`,
          confirmButtonColor: "#059669",
        });
      } else {
        await Swal.fire({
          icon: "success",
          title: "Proveedor verificado",
          html: `<strong>${nombreProveedor}</strong><br/>RFC: <code>${proveedor.rfc}</code><br/><br/>NO se encuentra en las listas del 69-B ni 69-B Bis del SAT.<br/><br/><span style="color:#64748b;font-size:0.85em">Base de datos SAT actualizada al ${fechaBD}.</span>`,
          confirmButtonColor: "#059669",
        });
      }
    } catch (e) {
      // Fallback a n8n si hay error o dejar decidir al usuario
      setRequestingId(null);
      await alertError("Fallo al validar con servicio SAT local", (e as Error).message);
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-8 text-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--fiscal-ink)]">Directorio de Proveedores</h1>
          {!isFormOpen && (
            <button
              onClick={() => setIsFormOpen(true)}
              className="button-institutional inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 sm:w-auto"
            >
              <Plus className="h-4 w-4" /> Nuevo Proveedor
            </button>
          )}
        </div>

        {isFormOpen && (
          <form
            onSubmit={handleSubmit}
            aria-busy={saving || uploading}
            className="surface-panel-strong animate-in slide-in-from-top-4 fade-in space-y-6 rounded-[1.75rem] p-4 shadow-fiscal sm:p-6"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="kicker-label">Capacidad del proveedor</p>
                <h2 className="font-display text-2xl font-semibold text-[var(--fiscal-ink)] sm:text-3xl">
                  {editing ? `Editar ${editing.display_name || editing.razon_social}` : "Nuevo proveedor"}
                </h2>
                <p className="text-sm text-[var(--fiscal-muted)]">Captura datos de capacidad operativa y presencia.</p>
              </div>
              <button
                type="button"
                onClick={() => { void resetForm(); }}
                disabled={saving}
                aria-disabled={saving}
                className="min-h-[44px] w-full rounded-full border border-[rgba(200,192,177,0.72)] px-4 py-2 text-xs font-semibold text-[var(--fiscal-ink)] transition hover:border-[rgba(45,91,136,0.22)] hover:text-[var(--fiscal-accent)] sm:w-auto"
              >
                {editing ? "Cancelar edición" : "Cerrar formulario"}
              </button>
            </div>
            <div className="flex flex-col gap-2 text-xs font-medium text-[var(--fiscal-muted)] sm:flex-row sm:items-center sm:justify-between">
              <p>{isDirty ? "Tienes cambios sin guardar." : "Sin cambios pendientes."}</p>
              <p>{isPF ? "Captura requerida para persona física." : "Captura requerida para persona moral."}</p>
            </div>
            <div className="grid gap-1 rounded-2xl border border-[rgba(200,192,177,0.65)] bg-[rgba(255,255,255,0.72)] px-4 py-3 text-xs text-[var(--fiscal-muted)]">
              <p>Los campos con <span className="font-semibold text-[var(--fiscal-danger)]">*</span> son obligatorios.</p>
              <p>Obligatorios en este formulario: <span className="font-semibold text-[var(--fiscal-ink)]">{requiredFieldLabels.join(", ")}</span>.</p>
            </div>
            {formError && (
              <div className="rounded-xl border border-[rgba(160,67,61,0.22)] bg-[var(--fiscal-danger-soft)] px-4 py-3 text-xs font-medium text-[var(--fiscal-danger)]">
                {formError}
              </div>
            )}

            {/* ── Tipo de persona ── */}
            <div className="flex w-full flex-wrap items-center gap-1 rounded-full bg-[rgba(244,242,237,0.88)] p-1 sm:w-fit">
              {(["MORAL", "FISICA"] as TipoPersona[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, tipo_persona: t }))}
                  className={`min-h-[44px] flex-1 rounded-full px-5 py-2 text-xs font-semibold transition sm:flex-none ${form.tipo_persona === t
                    ? "bg-white text-[var(--fiscal-ink)] shadow-sm"
                    : "text-[var(--fiscal-muted)] hover:text-[var(--fiscal-ink)]"
                    }`}
                >
                  {t === "MORAL" ? "Persona Moral" : "Persona Física"}
                </button>
              ))}
            </div>

            {/* ── CSF upload ── */}
            <div
              role="button"
              tabIndex={uploading ? -1 : 0}
              aria-disabled={uploading}
              aria-busy={uploading}
              className="cursor-pointer rounded-2xl border-2 border-dashed border-[rgba(200,192,177,0.72)] bg-[rgba(255,255,255,0.68)] p-6 text-center transition hover:border-[rgba(45,91,136,0.22)]"
              onClick={() => fileRef.current?.click()}
              onKeyDown={(event) => {
                if (uploading) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  fileRef.current?.click();
                }
              }}
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
                <p className="text-sm text-[var(--fiscal-accent)] animate-pulse">Procesando Constancia de Situación Fiscal…</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-[var(--fiscal-ink)]">Subir Constancia de Situación Fiscal</p>
                  <p className="mt-1 text-xs text-[var(--fiscal-muted)]">PDF o imagen — los datos se extraerán automáticamente</p>
                </>
              )}
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-2xl border border-[rgba(45,91,136,0.18)] bg-[var(--fiscal-accent-soft)]/70 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 shadow-panel">
                    <Landmark className="h-5 w-5 text-[var(--fiscal-accent)]" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--fiscal-accent)]">Identidad fiscal</p>
                    <p className="mt-1 text-sm font-medium text-[var(--fiscal-ink)]">Confirma RFC, régimen y trazabilidad básica antes de pasar al análisis operativo.</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-[rgba(143,240,224,0.18)] bg-[rgba(142,231,218,0.10)] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 shadow-panel">
                    <FileSearch className="h-5 w-5 text-[var(--fiscal-gold)]" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--fiscal-gold)]">Diligencia documental</p>
                    <p className="mt-1 text-sm font-medium text-[var(--fiscal-ink)]">La captura debe dejar evidencia suficiente para justificar pagos, contratos y continuidad operativa.</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-[rgba(31,122,90,0.18)] bg-[var(--fiscal-success-soft)] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 shadow-panel">
                    <ShieldCheck className="h-5 w-5 text-[var(--fiscal-success)]" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--fiscal-success)]">Control previo a pago</p>
                    <p className="mt-1 text-sm font-medium text-[var(--fiscal-ink)]">Mientras más completo quede este expediente, más defendible será la relación frente a una revisión.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* ── Datos generales ── */}
              <div className="rounded-[1.6rem] border border-[rgba(200,192,177,0.72)] bg-[rgba(244,242,237,0.62)] p-5">
                <p className="kicker-label">
                  {isPF ? "Datos de la persona física" : "Datos de la persona moral"}
                </p>
                <p className="mt-2 text-sm text-[var(--fiscal-muted)]">Este bloque fija la identidad legal que se utilizará para validar CFDI, contratos y consistencia contra SAT.</p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {!isPF && (
                    <label className={`${requiredLabelClass("razon_social")} md:col-span-2`}>
                      Razón social <span className="text-[var(--fiscal-danger)]">*</span>
                      <input
                        name="razon_social"
                        value={form.razon_social || ""}
                        onChange={handleChange}
                        required={!isPF}
                        className={requiredInputClass("razon_social")}
                      />
                      {fieldErrors.razon_social && <span className="mt-1 block text-[11px] font-medium text-[var(--fiscal-danger)]">{fieldErrors.razon_social}</span>}
                    </label>
                  )}
                  {isPF && (
                    <>
                      <label className={requiredLabelClass("nombre")}>
                        Nombre(s) <span className="text-[var(--fiscal-danger)]">*</span>
                        <input
                          name="nombre"
                          value={form.nombre || ""}
                          onChange={handleChange}
                          required
                          className={requiredInputClass("nombre")}
                        />
                        {fieldErrors.nombre && <span className="mt-1 block text-[11px] font-medium text-[var(--fiscal-danger)]">{fieldErrors.nombre}</span>}
                      </label>
                      <label className={requiredLabelClass("apellido_paterno")}>
                        Apellido paterno <span className="text-[var(--fiscal-danger)]">*</span>
                        <input
                          name="apellido_paterno"
                          value={form.apellido_paterno || ""}
                          onChange={handleChange}
                          required
                          className={requiredInputClass("apellido_paterno")}
                        />
                        {fieldErrors.apellido_paterno && <span className="mt-1 block text-[11px] font-medium text-[var(--fiscal-danger)]">{fieldErrors.apellido_paterno}</span>}
                      </label>
                      <label className="text-sm text-[var(--fiscal-muted)]">
                        Apellido materno
                        <input
                          name="apellido_materno"
                          value={form.apellido_materno || ""}
                          onChange={handleChange}
                          className="mt-2 w-full rounded-2xl border border-[rgba(200,192,177,0.72)] bg-white px-4 py-2.5 text-sm text-[var(--fiscal-ink)] shadow-sm focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]"
                        />
                      </label>
                      <label className="text-sm text-[var(--fiscal-muted)]">
                        CURP
                        <input
                          name="curp"
                          value={form.curp || ""}
                          onChange={handleChange}
                          className="mt-2 w-full rounded-2xl border border-[rgba(200,192,177,0.72)] bg-white px-4 py-2.5 text-sm text-[var(--fiscal-ink)] uppercase shadow-sm focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]"
                        />
                      </label>
                    </>
                  )}
                  <label className={requiredLabelClass("rfc")}>
                    RFC <span className="text-[var(--fiscal-danger)]">*</span>
                    <input
                      name="rfc"
                      value={form.rfc || ""}
                      onChange={handleChange}
                      required
                      className={`${requiredInputClass("rfc")} uppercase`}
                    />
                    {fieldErrors.rfc && <span className="mt-1 block text-[11px] font-medium text-[var(--fiscal-danger)]">{fieldErrors.rfc}</span>}
                  </label>
                  <label className="text-sm text-[var(--fiscal-muted)]">
                    Actividad principal
                    <input
                      name="actividad_principal"
                      value={form.actividad_principal || ""}
                      onChange={handleChange}
                      className="mt-2 w-full rounded-2xl border border-[rgba(200,192,177,0.72)] bg-white px-4 py-2.5 text-sm text-[var(--fiscal-ink)] shadow-sm focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]"
                    />
                  </label>
                  <label className="text-sm text-[var(--fiscal-muted)]">
                    Régimen fiscal
                    <input
                      name="regimen_fiscal"
                      value={form.regimen_fiscal || ""}
                      onChange={handleChange}
                      className="mt-2 w-full rounded-2xl border border-[rgba(200,192,177,0.72)] bg-white px-4 py-2.5 text-sm text-[var(--fiscal-ink)] shadow-sm focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]"
                    />
                  </label>
                </div>
              </div>

              {/* ── Domicilio fiscal ── */}
              <div className="rounded-[1.6rem] border border-[rgba(200,192,177,0.72)] bg-[rgba(244,242,237,0.62)] p-5">
                <p className="kicker-label">Domicilio fiscal</p>
                <p className="mt-2 text-sm text-[var(--fiscal-muted)]">Ubica el punto físico que respalda la operación. Este bloque es clave para contrastar presencia real y coherencia documental.</p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="text-sm text-[var(--fiscal-muted)] md:col-span-2">
                    Calle
                    <input name="calle" value={form.calle || ""} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-[rgba(200,192,177,0.72)] bg-white px-4 py-2.5 text-sm text-[var(--fiscal-ink)] shadow-sm focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]" />
                  </label>
                  <label className="text-sm text-[var(--fiscal-muted)]">
                    No. exterior
                    <input name="no_exterior" value={form.no_exterior || ""} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-[rgba(200,192,177,0.72)] bg-white px-4 py-2.5 text-sm text-[var(--fiscal-ink)] shadow-sm focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]" />
                  </label>
                  <label className="text-sm text-[var(--fiscal-muted)]">
                    No. interior
                    <input name="no_interior" value={form.no_interior || ""} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-[rgba(200,192,177,0.72)] bg-white px-4 py-2.5 text-sm text-[var(--fiscal-ink)] shadow-sm focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]" />
                  </label>
                  <label className="text-sm text-[var(--fiscal-muted)]">
                    Colonia
                    <input name="colonia" value={form.colonia || ""} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-[rgba(200,192,177,0.72)] bg-white px-4 py-2.5 text-sm text-[var(--fiscal-ink)] shadow-sm focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]" />
                  </label>
                  <label className="text-sm text-[var(--fiscal-muted)]">
                    C.P.
                    <input name="codigo_postal" value={form.codigo_postal || ""} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-[rgba(200,192,177,0.72)] bg-white px-4 py-2.5 text-sm text-[var(--fiscal-ink)] shadow-sm focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]" />
                  </label>
                  <label className="text-sm text-[var(--fiscal-muted)]">
                    Municipio / Alcaldía
                    <input name="municipio" value={form.municipio || ""} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-[rgba(200,192,177,0.72)] bg-white px-4 py-2.5 text-sm text-[var(--fiscal-ink)] shadow-sm focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]" />
                  </label>
                  <label className="text-sm text-[var(--fiscal-muted)]">
                    Estado
                    <input name="estado" value={form.estado || ""} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-[rgba(200,192,177,0.72)] bg-white px-4 py-2.5 text-sm text-[var(--fiscal-ink)] shadow-sm focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]" />
                  </label>
                  <label className="text-sm text-[var(--fiscal-muted)]">
                    País
                    <input name="pais" value={form.pais || ""} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-[rgba(200,192,177,0.72)] bg-white px-4 py-2.5 text-sm text-[var(--fiscal-ink)] shadow-sm focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]" />
                  </label>
                </div>
              </div>
            </div>

            {/* ── Contacto principal ── */}
            <div className="rounded-[1.6rem] border border-[rgba(200,192,177,0.72)] bg-[rgba(244,242,237,0.62)] p-5">
              <p className="kicker-label">Contacto principal</p>
              <p className="mt-2 text-sm text-[var(--fiscal-muted)]">Define al responsable operativo que puede responder por entregables, aclaraciones y seguimiento documental.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-sm text-[var(--fiscal-muted)]">
                  Nombre
                  <input name="contacto_nombre" value={form.contacto_nombre || ""} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-[rgba(200,192,177,0.72)] bg-white px-4 py-2.5 text-sm text-[var(--fiscal-ink)] shadow-sm focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]" />
                </label>
                <label className="text-sm text-[var(--fiscal-muted)]">
                  Puesto
                  <input name="contacto_puesto" value={form.contacto_puesto || ""} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-[rgba(200,192,177,0.72)] bg-white px-4 py-2.5 text-sm text-[var(--fiscal-ink)] shadow-sm focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]" />
                </label>
                <label className="text-sm text-[var(--fiscal-muted)]">
                  Email
                  <input type="email" name="contacto_email" value={form.contacto_email || ""} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-[rgba(200,192,177,0.72)] bg-white px-4 py-2.5 text-sm text-[var(--fiscal-ink)] shadow-sm focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]" />
                  {fieldErrors.contacto_email && <span className="mt-1 block text-[11px] font-medium text-[var(--fiscal-danger)]">{fieldErrors.contacto_email}</span>}
                </label>
                <label className="text-sm text-[var(--fiscal-muted)]">
                  Teléfono
                  <input name="contacto_telefono" value={form.contacto_telefono || ""} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-[rgba(200,192,177,0.72)] bg-white px-4 py-2.5 text-sm text-[var(--fiscal-ink)] shadow-sm focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]" />
                </label>
              </div>
            </div>

            {/* ── Capacidad, Presencia, Evidencias (collapsible) ── */}
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <details open className="group rounded-[1.6rem] border border-[rgba(200,192,177,0.72)] bg-white p-5 shadow-panel">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-[var(--fiscal-ink)]">
                    <span>Capacidad</span>
                    <span className="text-xs text-[var(--fiscal-muted)] transition group-open:rotate-180">▾</span>
                  </summary>
                  <p className="mt-3 text-sm text-[var(--fiscal-muted)]">Registra señales que soporten que el proveedor realmente puede ejecutar el servicio que factura.</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="text-sm text-[var(--fiscal-muted)]">
                      Registro REPS/IMSS
                      <input
                        name="reps_registro"
                        value={form.reps_registro || ""}
                        onChange={handleChange}
                        className="mt-2 w-full rounded-2xl border border-[rgba(200,192,177,0.72)] bg-[rgba(244,242,237,0.35)] px-4 py-2.5 text-sm text-[var(--fiscal-ink)] shadow-sm focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]"
                      />
                    </label>
                    <label className="text-sm text-[var(--fiscal-muted)]">
                      Registro patronal IMSS
                      <input
                        name="imss_patronal"
                        value={form.imss_patronal || ""}
                        onChange={handleChange}
                        className="mt-2 w-full rounded-2xl border border-[rgba(200,192,177,0.72)] bg-[rgba(244,242,237,0.35)] px-4 py-2.5 text-sm text-[var(--fiscal-ink)] shadow-sm focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]"
                      />
                    </label>
                    <label className="text-sm text-[var(--fiscal-muted)]">
                      Activos relevantes (separa con coma)
                      <input
                        name="activos_relevantes"
                        value={(form.activos_relevantes as string[])?.join(", ") || ""}
                        onChange={(e) => handleArrayField("activos_relevantes", e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-[rgba(200,192,177,0.72)] bg-[rgba(244,242,237,0.35)] px-4 py-2.5 text-sm text-[var(--fiscal-ink)] shadow-sm focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]"
                      />
                    </label>
                    <label className="text-sm text-[var(--fiscal-muted)]">
                      Personal clave (nombres separados por coma)
                      <input
                        name="personal_clave"
                        value={(form.personal_clave as string[])?.join(", ") || ""}
                        onChange={(e) => handleArrayField("personal_clave", e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-[rgba(200,192,177,0.72)] bg-[rgba(244,242,237,0.35)] px-4 py-2.5 text-sm text-[var(--fiscal-ink)] shadow-sm focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]"
                      />
                    </label>
                  </div>
                </details>

                <details className="group rounded-[1.6rem] border border-[rgba(200,192,177,0.72)] bg-white p-5 shadow-panel">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-[var(--fiscal-ink)]">
                    <span>Presencia</span>
                    <span className="text-xs text-[var(--fiscal-muted)] transition group-open:rotate-180">▾</span>
                  </summary>
                  <p className="mt-3 text-sm text-[var(--fiscal-muted)]">Documenta huellas públicas y observaciones internas que ayuden a separar proveedor real de proveedor de alto ruido.</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="text-sm text-[var(--fiscal-muted)]">
                      Sitio web
                      <input
                        name="sitio_web"
                        value={form.sitio_web || ""}
                        onChange={handleChange}
                        className="mt-2 w-full rounded-2xl border border-[rgba(200,192,177,0.72)] bg-[rgba(244,242,237,0.35)] px-4 py-2.5 text-sm text-[var(--fiscal-ink)] shadow-sm focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]"
                      />
                    </label>
                    <label className="text-sm text-[var(--fiscal-muted)]">
                      Capturas web (URLs separadas por coma)
                      <input
                        name="sitio_web_capturas"
                        value={(form.sitio_web_capturas as string[])?.join(", ") || ""}
                        onChange={(e) => handleArrayField("sitio_web_capturas", e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-[rgba(200,192,177,0.72)] bg-[rgba(244,242,237,0.35)] px-4 py-2.5 text-sm text-[var(--fiscal-ink)] shadow-sm focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]"
                      />
                    </label>
                    <label className="text-sm text-[var(--fiscal-muted)] md:col-span-2">
                      Notas de capacidad
                      <textarea
                        name="notas_capacidad"
                        value={form.notas_capacidad || ""}
                        onChange={handleChange}
                        className="mt-2 w-full rounded-2xl border border-[rgba(200,192,177,0.72)] bg-[rgba(244,242,237,0.35)] px-4 py-2.5 text-sm text-[var(--fiscal-ink)] shadow-sm focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]"
                        rows={2}
                      />
                    </label>
                  </div>
                </details>

                <details className="group rounded-[1.6rem] border border-[rgba(200,192,177,0.72)] bg-white p-5 shadow-panel">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-[var(--fiscal-ink)]">
                    <span>Evidencias</span>
                    <span className="text-xs text-[var(--fiscal-muted)] transition group-open:rotate-180">▾</span>
                  </summary>
                  <p className="mt-3 text-sm text-[var(--fiscal-muted)]">Adjunta o referencia materiales que acrediten existencia, domicilio y capacidad observable.</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="text-sm text-[var(--fiscal-muted)]">
                      Fotos domicilio (URLs separadas por coma)
                      <input
                        name="fotos_domicilio"
                        value={(form.fotos_domicilio as string[])?.join(", ") || ""}
                        onChange={(e) => handleArrayField("fotos_domicilio", e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-[rgba(200,192,177,0.72)] bg-[rgba(244,242,237,0.35)] px-4 py-2.5 text-sm text-[var(--fiscal-ink)] shadow-sm focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]"
                      />
                    </label>
                  </div>
                </details>
              </div>
            </div>

            <div className="grid gap-2 border-t border-[rgba(200,192,177,0.65)] pt-5 sm:flex sm:flex-wrap sm:items-center">
              <button
                type="submit"
                disabled={saving || !isDirty}
                aria-disabled={saving || !isDirty}
                aria-busy={saving}
                className={`min-h-[44px] rounded-full px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${
                  isEditingMode
                    ? "bg-[var(--fiscal-gold)] hover:bg-[var(--fiscal-gold-strong)]"
                    : "bg-[var(--fiscal-success)] hover:brightness-95"
                }`}
              >
                {saving ? "Guardando…" : isEditingMode ? "Actualizar proveedor" : "Guardar proveedor"}
              </button>
              <button
                type="button"
                onClick={() => { void resetForm(); }}
                className="min-h-[44px] rounded-full border border-[rgba(200,192,177,0.72)] px-5 py-2 text-sm font-semibold text-[var(--fiscal-ink)] transition hover:border-[rgba(45,91,136,0.22)] hover:text-[var(--fiscal-accent)]"
              >
                Limpiar
              </button>
              <p className="text-xs text-[var(--fiscal-muted)] sm:ml-auto">La captura queda pensada como expediente previo a pago, no como simple alta administrativa.</p>
            </div>
          </form>
        )}

        <header className="surface-panel-strong rounded-[1.75rem] p-6 shadow-fiscal">
          {/* Banner de alerta Reforma 2026 */}
          {proveedoresEnRiesgo.length > 0 && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[rgba(160,67,61,0.22)] bg-[var(--fiscal-danger-soft)] px-5 py-4">
              <ShieldAlert className="mt-0.5 h-6 w-6 text-[var(--fiscal-danger)]" />
              <div>
                <p className="text-sm font-bold text-[var(--fiscal-danger)]">
                  {proveedoresEnRiesgo.length} proveedor{proveedoresEnRiesgo.length > 1 ? "es" : ""} con alerta 69-B activa — Riesgo Reforma 2026
                </p>
                <p className="mt-1 text-xs text-[var(--fiscal-danger)]">
                  Operar con EFOS <strong>definitivos</strong> implica pérdida de deducciones y puede desencadenar bloqueo de CSD (Art. 17-H Bis CFF reformado 2026). Documenta tu análisis de riesgo por escrito y notifica a dirección.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {proveedoresEnRiesgo.map((p) => (
                    <span key={p.id} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${p.estatus_sat === "DEFINITIVO"
                      ? "border-[rgba(160,67,61,0.22)] bg-[var(--fiscal-danger-soft)] text-[var(--fiscal-danger)]"
                      : "border-[rgba(166,103,31,0.22)] bg-[var(--fiscal-warning-soft)] text-[var(--fiscal-warning)]"
                      }`}>
                      {p.estatus_sat === "DEFINITIVO" ? "⛔" : "⚠️"} {p.razon_social} — {p.estatus_sat}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div>
              <p className="kicker-label">Due diligence</p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--fiscal-ink)] sm:text-[2.8rem]">Proveedores y alertas 69-B</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--fiscal-muted)] sm:text-base">
                Consulta estatus SAT, alertas Art. 69-B y documenta el due diligence requerido por la Reforma 2026.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <div className="rounded-full border border-[rgba(45,91,136,0.18)] bg-[var(--fiscal-accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--fiscal-accent)]">
                  Vigilancia fiscal por proveedor
                </div>
                <div className="rounded-full border border-[rgba(143,240,224,0.22)] bg-[rgba(142,231,218,0.12)] px-3 py-2 text-xs font-semibold text-[var(--fiscal-gold)]">
                  Expediente documental de diligencia debida
                </div>
              </div>
            </div>
            <div className="surface-shell rounded-[1.5rem] p-5 text-white">
              <p className="eyebrow-shell">Mesa de vigilancia</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-white">Cada proveedor debe leerse como un expediente de riesgo verificable</h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-[rgba(220,255,250,0.78)]">
                La interfaz debe dejar claro quién está validado, quién está en observación y qué evidencia falta para sostener una decisión de negocio.
              </p>
              <div className="mt-4 flex justify-end">
                <GuiaContador
                  section="Proveedores y due diligence — Reforma 2026"
                  steps={[
                    { title: "1. Registra y documenta al proveedor", description: "Captura <strong>RFC</strong>, razón social, domicilio y datos de contacto. Sube la <strong>CSF</strong> para auto-extraer datos. <strong>Reforma 2026:</strong> la CSF debe tener menos de 3 meses de antigüedad." },
                    { title: "2. Verifica capacidad operativa real", description: "Registra <strong>REPS/IMSS</strong>, activos relevantes, personal clave y fotos del domicilio fiscal. El SAT verificará si el proveedor puede prestar realmente el servicio (Art. 69-B bis reformado)." },
                    { title: "3. Valida PROACTIVAMENTE contra 69-B", description: "Selecciona tu empresa y haz clic en <strong>Solicitar validación</strong>. No esperes a que el SAT te notifique — la Reforma 2026 exige due diligence previo a cada pago relevante." },
                    { title: "4. Documenta el análisis de riesgo", description: "Si el proveedor aparece como PRESUNTO, crea un <strong>memo de análisis de riesgo</strong> firmado por compliance y guarda la evidencia de proveedor bonafide antes de continuar operando." },
                  ]}
                  concepts={[
                    { term: "Art. 69-B CFF (Reforma 2026)", definition: "Sanciones penales de 2-9 años de prisión por CFDI simulado. Se amplió para incluir a quienes RECIBEN el CFDI sabiendo que la operación es simulada (EDO — Empresa que Deduce Operaciones simuladas)." },
                    { term: "EFOS / EDO", definition: "EFOS: Empresa que Factura Operaciones Simuladas. EDO: Empresa que Deduce Operaciones Simuladas. La Reforma 2026 equipara la responsabilidad del emisor y receptor del CFDI falso." },
                    { term: "Art. 17-H Bis CFF", definition: "El SAT puede restringir (no solo cancelar) el CSD cuando detecte que recibes CFDIs de EFOS, aunque el proceso de 69-B aún esté en etapa presunta." },
                    { term: "Due diligence documental", definition: "Expediente obligatorio por proveedor: CSF, REPS, IMSS patronal, fotos domicilio, evidencia de capacidad, contratos y memo de análisis de riesgo 69-B." },
                  ]}
                  tips={[
                    "<strong>⚠️ Reforma 2026:</strong> Recepcionar CFDIs de EFOS DEFINITIVOS puede configurar el delito fiscal como EDO — penalmente perseguible.",
                    "Valida al proveedor <strong>antes de emitir el primer pago</strong> Y cada trimestre después. Un proveedor puede aparecer en 69-B meses después.",
                    "Si aparece como PRESUNTO: crea memo de riesgo, notifica a dirección y retén del 10-16% del IVA como precaución.",
                    "Guarda capturas de la página del SAT con <strong>fecha y hora</strong> como evidencia de due diligence en tiempo real.",
                  ]}
                />
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="surface-panel rounded-panel p-4 text-sm shadow-panel">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--fiscal-accent-soft)] shadow-panel">
                  <Building2 className="h-5 w-5 text-[var(--fiscal-accent)]" />
                </div>
                <div>
                  <p className="text-[var(--fiscal-muted)]">Proveedores registrados</p>
                  <p className="font-display text-3xl font-semibold text-[var(--fiscal-ink)]">{proveedores.length}</p>
                </div>
              </div>
            </div>
            <div className="surface-panel rounded-panel p-4 text-sm shadow-panel">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--fiscal-danger-soft)] shadow-panel">
                  <AlertTriangle className="h-5 w-5 text-[var(--fiscal-danger)]" />
                </div>
                <div>
                  <p className="text-[var(--fiscal-muted)]">Alertas 69-B</p>
                  <p className="font-display text-3xl font-semibold text-[var(--fiscal-ink)]">{proveedoresEnRiesgo.length}</p>
                </div>
              </div>
            </div>
            <div className="surface-panel rounded-panel p-4 text-sm shadow-panel">
              <p className="text-[var(--fiscal-muted)]">Empresa para validar</p>
              <select
                className="mt-2 w-full rounded-xl border border-[rgba(200,192,177,0.72)] bg-white px-3 py-2 text-[var(--fiscal-ink)] shadow-sm focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]"
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
          <div className="flex flex-col gap-4 text-sm text-[var(--fiscal-muted)] sm:flex-row sm:items-center sm:justify-between">
            <p>{isLoading ? "Cargando proveedores…" : `Mostrando ${filteredProveedores.length} proveedores`}</p>
            <div className="flex w-full flex-col sm:w-auto sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fiscal-muted)]" />
                <input
                  type="search"
                  placeholder="Buscar por RFC o razón social..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-full border border-[rgba(200,192,177,0.72)] bg-white py-2 pl-11 pr-4 text-sm text-[var(--fiscal-ink)] shadow-sm focus:border-[var(--fiscal-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.18)]"
                />
              </div>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="min-h-[44px] rounded-full border border-[rgba(200,192,177,0.72)] px-4 py-2 text-xs font-semibold text-[var(--fiscal-ink)] transition hover:border-[rgba(45,91,136,0.22)] hover:text-[var(--fiscal-accent)]"
                >
                  Limpiar búsqueda
                </button>
              )}
              {selectedEmpresa && (
                <p className="text-xs text-[var(--fiscal-accent)] shrink-0">Validar con ID {selectedEmpresa}</p>
              )}
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {isLoading ? (
              <DataCardsSkeleton cards={4} className="lg:col-span-2 lg:grid-cols-2" />
            ) : filteredProveedores.length === 0 ? (
              <InlineEmptyState
                icon={searchQuery ? <Search className="h-6 w-6" /> : <Building2 className="h-6 w-6" />}
                title={searchQuery || selectedEmpresa ? "No hubo coincidencias con los filtros" : "No hay proveedores registrados"}
                description={searchQuery || selectedEmpresa
                  ? "Ajusta la búsqueda o cambia la empresa seleccionada para volver a ver resultados en móvil."
                  : "Registra el primer proveedor para iniciar validaciones SAT, riesgo 69-B y capacidad operativa."
                }
                className="lg:col-span-2"
              />
            ) : filteredProveedores.map((prov) => (
              <article
                key={prov.id}
                className="rounded-[1.75rem] border border-[rgba(200,192,177,0.72)] bg-white p-4 text-sm shadow-fiscal sm:p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-semibold text-[var(--fiscal-ink)]">{prov.display_name || prov.razon_social}</p>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide ${prov.tipo_persona === "FISICA"
                        ? "bg-[var(--fiscal-warning-soft)] text-[var(--fiscal-warning)]"
                        : "bg-[var(--fiscal-accent-soft)] text-[var(--fiscal-accent)]"
                        }`}>
                        {prov.tipo_persona === "FISICA" ? "PF" : "PM"}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--fiscal-muted)]">RFC {prov.rfc}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      label={prov.estatus_sat || "Sin estatus SAT"}
                      tone={prov.estatus_sat ? prov.estatus_sat.toUpperCase() as keyof typeof STATUS_STYLES : undefined}
                    />
                    <Badge
                      label={prov.estatus_69b ? prov.estatus_69b.replace("_", " ") : "69-B sin revisar"}
                      tone={(prov.estatus_69b as keyof typeof STATUS_STYLES) || undefined}
                    />
                    <Badge label={prov.riesgo_fiscal ? `Riesgo ${prov.riesgo_fiscal}` : "Riesgo N/D"} />
                  </div>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-[rgba(200,192,177,0.55)] bg-[rgba(244,242,237,0.62)] p-3">
                    <p className="text-xs uppercase text-[var(--fiscal-muted)]">Última validación SAT</p>
                    <p className="text-sm text-[var(--fiscal-ink)]">{formatDate(prov.ultima_validacion_sat)}</p>
                  </div>
                  <div className="rounded-2xl border border-[rgba(200,192,177,0.55)] bg-[rgba(244,242,237,0.62)] p-3">
                    <p className="text-xs uppercase text-[var(--fiscal-muted)]">Última validación 69-B</p>
                    <p className="text-sm text-[var(--fiscal-ink)]">{formatDate(prov.ultima_validacion_69b)}</p>
                  </div>
                </div>

                {prov.riesgos_detectados && prov.riesgos_detectados.length > 0 && (
                  <div className="mt-3 rounded-2xl border border-[rgba(166,103,31,0.22)] bg-[var(--fiscal-warning-soft)] p-3 text-xs text-[var(--fiscal-warning)]">
                    <p className="font-semibold text-[var(--fiscal-warning)]">Riesgos detectados</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {prov.riesgos_detectados.map((r, idx) => (
                        <li key={`${prov.id}-riesgo-${idx}`}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-[rgba(200,192,177,0.55)] bg-[rgba(244,242,237,0.62)] p-3 text-xs text-[var(--fiscal-muted)]">
                    <p className="text-[11px] uppercase tracking-[0.35em] text-[var(--fiscal-muted)]">Capacidad operativa</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      <li>REPS/IMSS: {prov.reps_registro || "N/D"}</li>
                      <li>Registro patronal: {prov.imss_patronal || "N/D"}</li>
                      <li>Activos relevantes: {countItems(prov.activos_relevantes)}</li>
                      <li>Personal clave: {countItems(prov.personal_clave)}</li>
                      <li>Fotos domicilio: {countItems(prov.fotos_domicilio)}</li>
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-[rgba(200,192,177,0.55)] bg-[rgba(244,242,237,0.62)] p-3 text-xs text-[var(--fiscal-muted)]">
                    <p className="text-[11px] uppercase tracking-[0.35em] text-[var(--fiscal-muted)]">Presencia y notas</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      <li>
                        Sitio web: {prov.sitio_web ? (
                          <a href={prov.sitio_web} target="_blank" rel="noreferrer" className="text-[var(--fiscal-accent)] underline">
                            {prov.sitio_web}
                          </a>
                        ) : (
                          "N/D"
                        )}
                      </li>
                      <li>Capturas web: {countItems(prov.sitio_web_capturas)}</li>
                      {prov.notas_capacidad && <li className="text-[var(--fiscal-muted)]">{prov.notas_capacidad}</li>}
                    </ul>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleValidar(prov)}
                      disabled={requestingId === prov.id}
                      aria-disabled={requestingId === prov.id}
                      aria-busy={requestingId === prov.id}
                      className="min-h-[44px] rounded-xl border border-[rgba(31,122,90,0.22)] bg-[var(--fiscal-success-soft)] px-4 py-2 text-xs font-semibold text-[var(--fiscal-success)] transition hover:border-[rgba(45,91,136,0.22)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {requestingId === prov.id && <RefreshCw className="mr-1 inline h-3.5 w-3.5 animate-spin" />}
                      {requestingId === prov.id ? "Enviando…" : "Solicitar validación"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEdit(prov)}
                      className="min-h-[44px] rounded-xl border border-[rgba(200,192,177,0.72)] px-4 py-2 text-xs font-semibold text-[var(--fiscal-ink)] transition hover:border-[rgba(45,91,136,0.22)] hover:text-[var(--fiscal-accent)]"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(prov)}
                      disabled={deletingId === prov.id}
                      aria-disabled={deletingId === prov.id}
                      aria-busy={deletingId === prov.id}
                      className="min-h-[44px] rounded-xl border border-[rgba(160,67,61,0.22)] bg-[var(--fiscal-danger-soft)] px-4 py-2 text-xs font-semibold text-[var(--fiscal-danger)] transition hover:border-[rgba(160,67,61,0.32)] hover:bg-[var(--fiscal-danger-soft)]/80 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingId === prov.id && <RefreshCw className="mr-1 inline h-3.5 w-3.5 animate-spin" />}
                      {deletingId === prov.id ? "Eliminando…" : "Eliminar proveedor"}
                    </button>
                  </div>
                  <span className="block text-xs text-[var(--fiscal-muted)]">Los resultados se guardarán con alertas 69-B</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
