"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { DashboardShell } from "../../../../components/DashboardShell";
import { useAuthContext } from "../../../../context/AuthContext";
import { apiFetch } from "../../../../lib/api";
import {
  alertError,
  alertInfo,
  alertSuccess,
  confirmAction,
} from "../../../../lib/alerts";

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type EmpresaDetail = {
  id: number;
  razon_social: string;
  rfc: string;
  regimen_fiscal: string;
  fecha_constitucion: string;
  pais: string;
  estado: string;
  ciudad: string;
  email_contacto: string;
  telefono_contacto: string;
  activo: boolean;
};

type Contrato = {
  id: number;
  nombre: string;
  categoria: string;
  proceso: string;
  tipo_empresa: string;
  proveedor: number | null;
  proveedor_nombre: string | null;
  fecha_firma: string | null;
  vigencia_inicio: string | null;
  vigencia_fin: string | null;
  descripcion: string;
  razon_negocio?: string;
  beneficio_economico_esperado?: string | null;
  beneficio_fiscal_estimado?: string | null;
  es_marco: boolean;
  soporte_documental: string;
  expediente_externo: string;
  template: number | null;
  template_clave: string | null;
  template_nombre: string | null;
  campos_configurables: string[];
  campos_faltantes: string[];
  estado_configuracion: string;
  activo: boolean;
};

type ContratoTemplate = {
  id: number;
  clave: string;
  nombre: string;
  categoria: string;
  proceso: string;
  tipo_empresa: string;
  descripcion: string;
  es_marco: boolean;
  requiere_proveedor: boolean;
  campos_configurables: string[];
  orden: number;
};

type Proveedor = {
  id: number;
  razon_social: string;
  rfc: string;
  pais: string;
  estado: string;
  ciudad: string;
  actividad_principal: string;
  estatus_sat: string;
  correo_contacto: string;
  telefono_contacto: string;
};

type Operacion = {
  id: number;
  proveedor: number;
  proveedor_nombre: string;
  contrato: number | null;
  contrato_nombre: string | null;
  monto: string;
  moneda: string;
  fecha_operacion: string;
  tipo_operacion: string;
  concepto: string;
  nif_aplicable?: string;
  poliza_contable?: string | null;
  observacion_contable?: string;
  estatus_validacion: string;
};

const contratoCategorias = [
  { value: "BASE_CORPORATIVA", label: "Base corporativa" },
  { value: "CLIENTES", label: "Clientes / ingresos" },
  { value: "PROVEEDORES", label: "Proveedores / egresos" },
  { value: "CAPITAL_HUMANO", label: "Capital humano" },
  { value: "FINANCIERO", label: "Financiero / crédito" },
  { value: "ACTIVOS", label: "Activos fijos e intangibles" },
  { value: "PARTES_RELACIONADAS", label: "Partes relacionadas" },
];

const procesosNegocio = [
  { value: "COMPRAS", label: "Compras" },
  { value: "VENTAS", label: "Ventas" },
  { value: "NOMINA", label: "Nómina" },
  { value: "TESORERIA", label: "Tesorería" },
  { value: "OPERACIONES", label: "Operaciones" },
  { value: "GOBIERNO_CORPORATIVO", label: "Gobierno corporativo" },
];

const tiposEmpresa = [
  { value: "COMERCIAL", label: "Comercial" },
  { value: "INDUSTRIAL", label: "Industrial" },
  { value: "SERVICIOS", label: "Servicios" },
  { value: "MIXTA", label: "Mixta" },
];

const monedas = [
  { value: "MXN", label: "Peso mexicano" },
  { value: "USD", label: "Dólar estadounidense" },
  { value: "EUR", label: "Euro" },
];

const tiposOperacion = [
  { value: "COMPRA", label: "Compra" },
  { value: "SERVICIO", label: "Servicio" },
  { value: "ARRENDAMIENTO", label: "Arrendamiento" },
  { value: "OTRO", label: "Otro" },
];

const templateFieldLabels: Record<string, string> = {
  proveedor: "Proveedor vinculado",
  fecha_firma: "Fecha de firma",
  vigencia_inicio: "Vigencia inicial",
  vigencia_fin: "Vigencia final",
  descripcion: "Notas internas",
  expediente_externo: "Expediente externo",
  soporte_documental: "Soporte documental",
};

const formatTemplateFieldLabel = (field: string) =>
  templateFieldLabels[field] ?? field.replace(/_/g, " ");

const proveedorInitial = {
  razon_social: "",
  rfc: "",
  pais: "",
  estado: "",
  ciudad: "",
  actividad_principal: "",
  correo_contacto: "",
  telefono_contacto: "",
};

const contratoInitial = {
  template: "",
  nombre: "",
  categoria: contratoCategorias[0]?.value ?? "BASE_CORPORATIVA",
  proceso: procesosNegocio[0]?.value ?? "COMPRAS",
  tipo_empresa: tiposEmpresa[0]?.value ?? "MIXTA",
  proveedor: "",
  fecha_firma: "",
  vigencia_inicio: "",
  vigencia_fin: "",
  descripcion: "",
   razon_negocio: "",
   beneficio_economico_esperado: "",
   beneficio_fiscal_estimado: "",
  soporte_documental: "",
  expediente_externo: "",
};

const operacionInitial = {
  proveedor: "",
  contrato: "",
  monto: "0",
  moneda: monedas[0]?.value ?? "MXN",
  fecha_operacion: "",
  tipo_operacion: tiposOperacion[0]?.value ?? "COMPRA",
  concepto: "",
  nif_aplicable: "",
  poliza_contable: null as File | null,
  observacion_contable: "",
};

export default function EmpresaMaterialidadPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, isProfileLoaded } = useAuthContext();
  const empresaId = Number(params?.id ?? 0);

  const [empresa, setEmpresa] = useState<EmpresaDetail | null>(null);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [contratoTemplates, setContratoTemplates] = useState<ContratoTemplate[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [operaciones, setOperaciones] = useState<Operacion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [proveedorForm, setProveedorForm] = useState(proveedorInitial);
  const [contratoForm, setContratoForm] = useState(contratoInitial);
  const [operacionForm, setOperacionForm] = useState(operacionInitial);
  const [operacionFileReset, setOperacionFileReset] = useState(0);
  const [saving, setSaving] = useState<{ section: string | null }>({ section: null });

  const selectedTemplate = useMemo(() => {
    if (!contratoForm.template) return null;
    return (
      contratoTemplates.find((template) => String(template.id) === contratoForm.template) ?? null
    );
  }, [contratoForm.template, contratoTemplates]);

  const contratoMissingFields = useMemo(() => {
    if (!selectedTemplate || selectedTemplate.campos_configurables.length === 0) {
      return [] as string[];
    }
    const pending: string[] = [];
    for (const field of selectedTemplate.campos_configurables) {
      if (field === "proveedor" && !contratoForm.proveedor) {
        pending.push(field);
        continue;
      }
      const value = (contratoForm as Record<string, string>)[field];
      if (!value) {
        pending.push(field);
      }
    }
    return pending;
  }, [contratoForm, selectedTemplate]);

  useEffect(() => {
    if (isProfileLoaded && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isProfileLoaded, router]);

  const loadData = useCallback(async () => {
    if (!empresaId) {
      return;
    }
    setIsLoading(true);
    try {
      const [empresaRes, contratosRes, proveedoresRes, operacionesRes, templatesRes] =
        await Promise.all([
        apiFetch<EmpresaDetail>(`/api/materialidad/empresas/${empresaId}/`),
        apiFetch<PaginatedResponse<Contrato>>(
          `/api/materialidad/contratos/?empresa=${empresaId}`
        ),
        apiFetch<PaginatedResponse<Proveedor>>(`/api/materialidad/proveedores/`),
        apiFetch<PaginatedResponse<Operacion>>(
          `/api/materialidad/operaciones/?empresa=${empresaId}`
        ),
          apiFetch<ContratoTemplate[]>(`/api/materialidad/contrato-templates/`),
        ]);
      setEmpresa(empresaRes);
      setContratos(contratosRes.results);
      setProveedores(proveedoresRes.results);
      setOperaciones(operacionesRes.results);
      setContratoTemplates(templatesRes);
    } catch (err) {
      void alertError("No pudimos cargar la información", (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    if (!isAuthenticated || !empresaId) return;
    void loadData();
  }, [empresaId, isAuthenticated, loadData]);

  const handleProveedorChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setProveedorForm((prev) => ({ ...prev, [name]: name === "rfc" ? value.toUpperCase() : value }));
  };

  const handleContratoChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setContratoForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleContratoTemplateChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target;
    if (!value) {
      setContratoForm(contratoInitial);
      return;
    }
    const template = contratoTemplates.find((item) => String(item.id) === value);
    if (!template) {
      setContratoForm((prev) => ({ ...prev, template: value }));
      return;
    }
    setContratoForm({
      ...contratoInitial,
      template: value,
      nombre: template.nombre,
      categoria: template.categoria,
      proceso: template.proceso,
      tipo_empresa: template.tipo_empresa,
      descripcion: template.descripcion,
    });
  };

  const handleOperacionChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setOperacionForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleOperacionFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setOperacionForm((prev) => ({ ...prev, poliza_contable: file }));
  };

  const submitProveedor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving({ section: "proveedor" });
    try {
      await apiFetch<Proveedor>("/api/materialidad/proveedores/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proveedorForm),
      });
      await alertSuccess("Proveedor registrado", "Ahora puedes ligarlo a contratos y operaciones");
      setProveedorForm(proveedorInitial);
      await loadData();
    } catch (err) {
      void alertError("No pudimos crear el proveedor", (err as Error).message);
    } finally {
      setSaving({ section: null });
    }
  };

  const submitContrato = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving({ section: "contrato" });
    try {
      const payload = {
        ...contratoForm,
        empresa: empresaId,
        proveedor: contratoForm.proveedor ? Number(contratoForm.proveedor) : null,
        template: contratoForm.template ? Number(contratoForm.template) : null,
        fecha_firma: contratoForm.fecha_firma || null,
        vigencia_inicio: contratoForm.vigencia_inicio || null,
        vigencia_fin: contratoForm.vigencia_fin || null,
        razon_negocio: contratoForm.razon_negocio,
        beneficio_economico_esperado: contratoForm.beneficio_economico_esperado
          ? Number(contratoForm.beneficio_economico_esperado)
          : null,
        beneficio_fiscal_estimado: contratoForm.beneficio_fiscal_estimado
          ? Number(contratoForm.beneficio_fiscal_estimado)
          : null,
      };
      await apiFetch<Contrato>("/api/materialidad/contratos/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await alertSuccess("Contrato registrado", "Recuerda adjuntar la evidencia legal en el expediente");
      setContratoForm(contratoInitial);
      await loadData();
    } catch (err) {
      void alertError("No pudimos crear el contrato", (err as Error).message);
    } finally {
      setSaving({ section: null });
    }
  };

  const submitOperacion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving({ section: "operacion" });
    try {
      const payload = new FormData();
      payload.append("empresa", String(empresaId));
      payload.append("proveedor", operacionForm.proveedor);
      if (operacionForm.contrato) {
        payload.append("contrato", operacionForm.contrato);
      }
      payload.append("monto", operacionForm.monto);
      payload.append("moneda", operacionForm.moneda);
      payload.append("fecha_operacion", operacionForm.fecha_operacion);
      payload.append("tipo_operacion", operacionForm.tipo_operacion);
      payload.append("concepto", operacionForm.concepto);
      if (operacionForm.nif_aplicable) {
        payload.append("nif_aplicable", operacionForm.nif_aplicable);
      }
      if (operacionForm.poliza_contable) {
        payload.append("poliza_contable", operacionForm.poliza_contable);
      }
      if (operacionForm.observacion_contable) {
        payload.append("observacion_contable", operacionForm.observacion_contable);
      }

      await apiFetch<Operacion>("/api/materialidad/operaciones/", {
        method: "POST",
        body: payload,
      });
      await alertSuccess("Operación registrada", "Se programará la validación de materialidad");
      setOperacionForm(operacionInitial);
      setOperacionFileReset((prev) => prev + 1);
      await loadData();
    } catch (err) {
      void alertError("No pudimos crear la operación", (err as Error).message);
    } finally {
      setSaving({ section: null });
    }
  };

  const handleValidarProveedor = async (proveedor: Proveedor) => {
    const result = await confirmAction({
      title: `Validar a ${proveedor.razon_social}?`,
      text: "Enviaremos la solicitud al flujo de n8n",
      confirmButtonText: "Enviar validación",
    });
    if (!result.isConfirmed) return;
    try {
      await apiFetch(`/api/materialidad/proveedores/${proveedor.id}/validaciones/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresa: empresaId }),
      });
      await alertInfo("Validación en proceso", "El estatus se actualizará cuando el flujo termine");
    } catch (err) {
      void alertError("No pudimos iniciar la validación", (err as Error).message);
    }
  };

  const readinessScore = useMemo(() => {
    const contratosActivos = contratos.filter((c) => c.activo).length;
    const proveedoresConEstatus = proveedores.filter((p) => p.estatus_sat).length;
    const validadas = operaciones.filter((op) => op.estatus_validacion === "VALIDADO").length;
    const totalOperaciones = operaciones.length || 1;
    const ratioContratos = contratosActivos > 0 ? 1 : 0;
    const ratioProveedores = proveedoresConEstatus > 0 ? 1 : 0;
    const ratioOperaciones = validadas / totalOperaciones;
    return Math.round(((ratioContratos + ratioProveedores + ratioOperaciones) / 3) * 100);
  }, [contratos, operaciones, proveedores]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <DashboardShell>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/dashboard" className="text-sm text-jade-600">← Regresar</Link>
            <h1 className="text-3xl font-semibold text-ink-500">
              {empresa?.razon_social ?? "Empresa"}
            </h1>
            <p className="text-sm text-slate-500">RFC {empresa?.rfc}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase text-slate-500">Índice de materialidad</p>
            <p className="text-3xl font-semibold text-jade-600">{readinessScore}%</p>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Contratos activos</p>
            <p className="text-2xl font-semibold text-ink-500">{contratos.filter((c) => c.activo).length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Proveedores con validación</p>
            <p className="text-2xl font-semibold text-ink-500">
              {proveedores.filter((p) => p.estatus_sat).length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Operaciones validadas</p>
            <p className="text-2xl font-semibold text-ink-500">
              {
                operaciones.filter((op) => op.estatus_validacion === "VALIDADO").length
              }
            </p>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          <form
            onSubmit={submitProveedor}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div>
              <p className="text-sm text-slate-500">Paso 1</p>
              <h2 className="text-xl font-semibold text-ink-500">Proveedores confiables</h2>
              <p className="text-sm text-slate-500">
                Crea proveedores con datos de contacto y solicita validación con un clic.
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-ink-500">Razón social</label>
                <input
                  name="razon_social"
                  required
                  value={proveedorForm.razon_social}
                  onChange={handleProveedorChange}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-ink-500">RFC</label>
                <input
                  name="rfc"
                  required
                  maxLength={13}
                  value={proveedorForm.rfc}
                  onChange={handleProveedorChange}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase focus:border-jade-500 focus:outline-none"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-ink-500">País</label>
                  <input
                    name="pais"
                    required
                    value={proveedorForm.pais}
                    onChange={handleProveedorChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-ink-500">Estado</label>
                  <input
                    name="estado"
                    value={proveedorForm.estado}
                    onChange={handleProveedorChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-ink-500">Ciudad</label>
                <input
                  name="ciudad"
                  value={proveedorForm.ciudad}
                  onChange={handleProveedorChange}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-ink-500">Actividad principal</label>
                <input
                  name="actividad_principal"
                  value={proveedorForm.actividad_principal}
                  onChange={handleProveedorChange}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-ink-500">Correo</label>
                  <input
                    type="email"
                    name="correo_contacto"
                    value={proveedorForm.correo_contacto}
                    onChange={handleProveedorChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-ink-500">Teléfono</label>
                  <input
                    name="telefono_contacto"
                    value={proveedorForm.telefono_contacto}
                    onChange={handleProveedorChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={saving.section === "proveedor"}
              className="w-full rounded-lg bg-jade-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-jade-600 disabled:opacity-70"
            >
              {saving.section === "proveedor" ? "Guardando..." : "Registrar proveedor"}
            </button>
          </form>

          <form
            onSubmit={submitContrato}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div>
              <p className="text-sm text-slate-500">Paso 2</p>
              <h2 className="text-xl font-semibold text-ink-500">Contratos y expedientes</h2>
              <p className="text-sm text-slate-500">
                Define el marco jurídico que respalda las operaciones con clientes y proveedores.
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-ink-500">Plantilla del catálogo</label>
                <select
                  name="template"
                  value={contratoForm.template}
                  onChange={handleContratoTemplateChange}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                >
                  <option value="">Selecciona una plantilla sugerida</option>
                  {contratoTemplates.map((template) => (
                    <option key={template.id} value={String(template.id)}>
                      {template.nombre} · {template.proceso}
                    </option>
                  ))}
                </select>
              </div>
              {selectedTemplate && (
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                  <p className="font-semibold text-ink-500">{selectedTemplate.nombre}</p>
                  <p className="text-xs uppercase text-slate-500">
                    Proceso {selectedTemplate.proceso} • Tipo {selectedTemplate.tipo_empresa}
                  </p>
                  <p className="mt-2">{selectedTemplate.descripcion}</p>
                  {selectedTemplate.campos_configurables.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedTemplate.campos_configurables.map((field) => {
                        const pending = contratoMissingFields.includes(field);
                        return (
                          <span
                            key={field}
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${pending ? "bg-flame-100 text-flame-600" : "bg-jade-500/10 text-jade-600"}`}
                          >
                            {formatTemplateFieldLabel(field)}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-ink-500">Nombre del contrato</label>
                <input
                  name="nombre"
                  required
                  value={contratoForm.nombre}
                  onChange={handleContratoChange}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-ink-500">Categoría</label>
                  <select
                    name="categoria"
                    value={contratoForm.categoria}
                    onChange={handleContratoChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                  >
                    {contratoCategorias.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-ink-500">Proceso</label>
                  <select
                    name="proceso"
                    value={contratoForm.proceso}
                    onChange={handleContratoChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                  >
                    {procesosNegocio.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-ink-500">Tipo de empresa</label>
                <select
                  name="tipo_empresa"
                  value={contratoForm.tipo_empresa}
                  onChange={handleContratoChange}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                >
                  {tiposEmpresa.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-ink-500">
                  Proveedor vinculado {selectedTemplate?.requiere_proveedor ? "(requerido)" : "(opcional)"}
                </label>
                <select
                  name="proveedor"
                  value={contratoForm.proveedor}
                  onChange={handleContratoChange}
                  required={selectedTemplate?.campos_configurables.includes("proveedor")}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                >
                  <option value="">Sin proveedor</option>
                  {proveedores.map((prov) => (
                    <option key={prov.id} value={prov.id}>
                      {prov.razon_social}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="text-sm font-medium text-ink-500">Fecha de firma</label>
                  <input
                    type="date"
                    name="fecha_firma"
                    value={contratoForm.fecha_firma}
                    onChange={handleContratoChange}
                    required={selectedTemplate?.campos_configurables.includes("fecha_firma")}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-ink-500">Vigencia inicial</label>
                  <input
                    type="date"
                    name="vigencia_inicio"
                    value={contratoForm.vigencia_inicio}
                    onChange={handleContratoChange}
                    required={selectedTemplate?.campos_configurables.includes("vigencia_inicio")}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-ink-500">Vigencia final</label>
                  <input
                    type="date"
                    name="vigencia_fin"
                    value={contratoForm.vigencia_fin}
                    onChange={handleContratoChange}
                    required={selectedTemplate?.campos_configurables.includes("vigencia_fin")}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-ink-500">Soporte documental interno</label>
                <input
                  name="soporte_documental"
                  value={contratoForm.soporte_documental}
                  onChange={handleContratoChange}
                  required={selectedTemplate?.campos_configurables.includes("soporte_documental")}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                  placeholder="Ruta de carpeta, folio o referencia interna"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-ink-500">Expediente externo / URL</label>
                <input
                  type="url"
                  name="expediente_externo"
                  value={contratoForm.expediente_externo}
                  onChange={handleContratoChange}
                  required={selectedTemplate?.campos_configurables.includes("expediente_externo")}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                  placeholder="https://drive..."
                />
              </div>
              <div>
                <label className="text-sm font-medium text-ink-500">Notas internas</label>
                <textarea
                  name="descripcion"
                  rows={3}
                  value={contratoForm.descripcion}
                  onChange={handleContratoChange}
                  required={selectedTemplate?.campos_configurables.includes("descripcion")}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-ink-500">Razón de negocio (Art. 5-A CFF)</label>
                <textarea
                  name="razon_negocio"
                  rows={3}
                  value={contratoForm.razon_negocio}
                  onChange={handleContratoChange}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                  placeholder="¿Qué necesidad cubre y qué beneficio económico real se espera?"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-ink-500">Beneficio económico esperado</label>
                  <input
                    type="number"
                    name="beneficio_economico_esperado"
                    value={contratoForm.beneficio_economico_esperado}
                    onChange={handleContratoChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                    placeholder="Monto estimado no fiscal"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-ink-500">Beneficio fiscal estimado (opcional)</label>
                  <input
                    type="number"
                    name="beneficio_fiscal_estimado"
                    value={contratoForm.beneficio_fiscal_estimado}
                    onChange={handleContratoChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                    placeholder="Comparativo del efecto fiscal"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>
            </div>
            {selectedTemplate && contratoMissingFields.length > 0 && (
              <p className="text-xs text-flame-600">
                Completa: {contratoMissingFields.map((field) => formatTemplateFieldLabel(field)).join(", ")}
              </p>
            )}
            <button
              type="submit"
              disabled={
                saving.section === "contrato" || (selectedTemplate ? contratoMissingFields.length > 0 : false)
              }
              className="w-full rounded-lg bg-jade-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-jade-600 disabled:opacity-70"
            >
              {saving.section === "contrato"
                ? "Guardando..."
                : selectedTemplate
                  ? "Completar plantilla"
                  : "Registrar contrato"}
            </button>
          </form>

          <form
            onSubmit={submitOperacion}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div>
              <p className="text-sm text-slate-500">Paso 3</p>
              <h2 className="text-xl font-semibold text-ink-500">Operaciones trazables</h2>
              <p className="text-sm text-slate-500">
                Registra cada CFDI y liga proveedor, contrato y evidencia para cerrar el ciclo de materialidad.
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-ink-500">Proveedor</label>
                <select
                  name="proveedor"
                  required
                  value={operacionForm.proveedor}
                  onChange={handleOperacionChange}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                >
                  <option value="" disabled>
                    Selecciona un proveedor
                  </option>
                  {proveedores.map((prov) => (
                    <option key={prov.id} value={prov.id}>
                      {prov.razon_social}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-ink-500">Contrato (opcional)</label>
                <select
                  name="contrato"
                  value={operacionForm.contrato}
                  onChange={handleOperacionChange}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                >
                  <option value="">Sin contrato</option>
                  {contratos.map((contrato) => (
                    <option key={contrato.id} value={contrato.id}>
                      {contrato.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-ink-500">Monto</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="monto"
                    required
                    value={operacionForm.monto}
                    onChange={handleOperacionChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-ink-500">Moneda</label>
                  <select
                    name="moneda"
                    value={operacionForm.moneda}
                    onChange={handleOperacionChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                  >
                    {monedas.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-ink-500">Fecha de operación</label>
                  <input
                    type="date"
                    name="fecha_operacion"
                    required
                    value={operacionForm.fecha_operacion}
                    onChange={handleOperacionChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-ink-500">Tipo</label>
                  <select
                    name="tipo_operacion"
                    value={operacionForm.tipo_operacion}
                    onChange={handleOperacionChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                  >
                    {tiposOperacion.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-ink-500">Concepto / CFDI</label>
                <textarea
                  name="concepto"
                  rows={3}
                  value={operacionForm.concepto}
                  onChange={handleOperacionChange}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-ink-500">NIF aplicable</label>
                <input
                  name="nif_aplicable"
                  value={operacionForm.nif_aplicable}
                  onChange={handleOperacionChange}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                  placeholder="Ej. NIF D-1 ingresos, C-6 propiedades"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-ink-500">Póliza contable</label>
                  <input
                    key={operacionFileReset}
                    type="file"
                    name="poliza_contable"
                    onChange={handleOperacionFileChange}
                    accept=".pdf,image/*"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-slate-500">Adjunta la póliza que acredita la sustancia económica.</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-ink-500">Notas contables</label>
                  <textarea
                    name="observacion_contable"
                    rows={3}
                    value={operacionForm.observacion_contable}
                    onChange={handleOperacionChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-jade-500 focus:outline-none"
                    placeholder="Sustancia económica vs forma jurídica (NIF A-2)"
                  />
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={saving.section === "operacion"}
              className="w-full rounded-lg bg-jade-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-jade-600 disabled:opacity-70"
            >
              {saving.section === "operacion" ? "Guardando..." : "Registrar operación"}
            </button>
          </form>
        </section>

        <section className="space-y-8">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <p className="text-sm text-slate-500">Seguimiento</p>
                <h3 className="text-lg font-semibold text-ink-500">Proveedores</h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Razón social</th>
                    <th className="px-4 py-3">RFC</th>
                    <th className="px-4 py-3">Ubicación</th>
                    <th className="px-4 py-3">Estatus SAT</th>
                    <th className="px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {proveedores.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>
                        Aún no registras proveedores para esta empresa
                      </td>
                    </tr>
                  )}
                  {proveedores.map((prov) => (
                    <tr key={prov.id}>
                      <td className="px-4 py-3 font-medium text-ink-500">{prov.razon_social}</td>
                      <td className="px-4 py-3 text-slate-600">{prov.rfc}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {prov.ciudad}, {prov.estado}, {prov.pais}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${prov.estatus_sat ? "bg-jade-500/10 text-jade-600" : "bg-slate-200 text-slate-600"}`}>
                          {prov.estatus_sat || "Pendiente"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            void handleValidarProveedor(prov);
                          }}
                          className="rounded-lg border border-jade-200 px-3 py-1 text-xs font-medium text-jade-600 hover:bg-jade-50"
                        >
                          Validar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <p className="text-sm text-slate-500">Contratos vigentes</p>
                <h3 className="text-lg font-semibold text-ink-500">Documentos y categorías</h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Contrato / plantilla</th>
                    <th className="px-4 py-3">Categoría</th>
                    <th className="px-4 py-3">Proceso</th>
                    <th className="px-4 py-3">Proveedor</th>
                    <th className="px-4 py-3">Vigencia</th>
                    <th className="px-4 py-3">Configuración</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {contratos.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>
                        Registra al menos un contrato para cumplir con materialidad jurídica
                      </td>
                    </tr>
                  )}
                  {contratos.map((contrato) => (
                    <tr key={contrato.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink-500">
                          {contrato.template_nombre ?? contrato.nombre}
                        </p>
                        <p className="text-xs text-slate-500">
                          {contrato.template_nombre
                            ? contrato.nombre
                            : (contrato.template_clave ?? "Sin plantilla")}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className={`rounded-full px-2 py-0.5 ${contrato.activo ? "bg-jade-500/10 text-jade-600" : "bg-slate-200 text-slate-600"}`}>
                            {contrato.activo ? "Activo" : "Inactivo"}
                          </span>
                          {contrato.es_marco && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                              Contrato marco
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{contrato.categoria}</td>
                      <td className="px-4 py-3 text-slate-600">{contrato.proceso}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {contrato.proveedor_nombre || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {contrato.vigencia_inicio || "-"} → {contrato.vigencia_fin || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${contrato.estado_configuracion === "COMPLETO" ? "bg-jade-500/10 text-jade-600" : "bg-flame-100 text-flame-600"}`}
                        >
                          {contrato.estado_configuracion}
                        </span>
                        {contrato.campos_faltantes.length > 0 && (
                          <p className="mt-1 text-xs text-slate-500">
                            Faltan: {contrato.campos_faltantes.map((field) => formatTemplateFieldLabel(field)).join(", ")}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <p className="text-sm text-slate-500">Operaciones monitoreadas</p>
                <h3 className="text-lg font-semibold text-ink-500">Evidencia transaccional</h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Proveedor</th>
                    <th className="px-4 py-3">Contrato</th>
                    <th className="px-4 py-3">Monto</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">NIF y póliza</th>
                    <th className="px-4 py-3">Validación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {operaciones.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-500" colSpan={7}>
                        Registra operaciones para disparar procesos de materialidad
                      </td>
                    </tr>
                  )}
                  {operaciones.map((operacion) => (
                    <tr key={operacion.id}>
                      <td className="px-4 py-3 font-medium text-ink-500">{operacion.proveedor_nombre}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {operacion.contrato_nombre || "Sin contrato"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {Number(operacion.monto).toLocaleString("es-MX", {
                          style: "currency",
                          currency: operacion.moneda,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{operacion.fecha_operacion}</td>
                      <td className="px-4 py-3 text-slate-600">{operacion.tipo_operacion}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <p className="font-medium text-ink-500">{operacion.nif_aplicable || "Sin NIF"}</p>
                        {operacion.poliza_contable && (
                          <a
                            href={operacion.poliza_contable}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-xs text-jade-700 hover:text-jade-800"
                          >
                            Póliza contable
                          </a>
                        )}
                        {operacion.observacion_contable && (
                          <p className="mt-1 text-xs text-slate-500">{operacion.observacion_contable}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${operacion.estatus_validacion === "VALIDADO" ? "bg-jade-500/10 text-jade-600" : operacion.estatus_validacion === "RECHAZADO" ? "bg-flame-100 text-flame-600" : "bg-slate-200 text-slate-600"}`}>
                          {operacion.estatus_validacion}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        {isLoading && (
          <p className="text-center text-sm text-slate-500">Actualizando indicadores...</p>
        )}
      </div>
    </DashboardShell>
  );
}