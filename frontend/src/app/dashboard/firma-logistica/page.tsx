"use client";

import { useCallback, useEffect, useState } from "react";

import { DashboardShell } from "../../../components/DashboardShell";
import { alertError, alertSuccess } from "../../../lib/alerts";
import { apiFetch } from "../../../lib/api";
import {
  actualizarFirmaLogistica,
  obtenerFirmaLogistica,
  ContratoLogistica,
  EstadoLogistica,
  FirmaModalidad,
} from "../../../lib/firma";

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type ContratoLite = {
  id: number;
  nombre: string;
  proveedor_nombre?: string | null;
};

const MODALIDADES: Array<{ value: FirmaModalidad; label: string; hint: string }> = [
  { value: "NOTARIAL", label: "Notarial (fecha cierta)", hint: "Protocolización con fedatario" },
  { value: "ELECTRONICA", label: "Firma electrónica avanzada", hint: "FEA / plataformas de e-sign" },
  { value: "MANUSCRITA", label: "Manuscrita / física", hint: "Firma autógrafa con testigos" },
];

const ESTADOS: Array<{ value: EstadoLogistica; label: string }> = [
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "AGENDADA", label: "Agendada" },
  { value: "EN_PROCESO", label: "En proceso" },
  { value: "COMPLETADA", label: "Completada" },
  { value: "CANCELADA", label: "Cancelada" },
];

function Pill({ label, tone = "emerald" }: { label: string; tone?: "emerald" | "sky" | "amber" }) {
  const palette = {
    emerald: "border-emerald-300 bg-emerald-50 text-emerald-700",
    sky: "border-sky-300 bg-sky-50 text-sky-700",
    amber: "border-amber-300 bg-amber-50 text-amber-700",
  };
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${palette[tone]}`}>{label}</span>
  );
}

export default function FirmaLogisticaPage() {
  const [contratoId, setContratoId] = useState<string>("");
  const [contratos, setContratos] = useState<ContratoLite[]>([]);
  const [loadingContratos, setLoadingContratos] = useState(false);
  const [firmaModalidad, setFirmaModalidad] = useState<FirmaModalidad>("NOTARIAL");
  const [logisticaEstado, setLogisticaEstado] = useState<EstadoLogistica>("PENDIENTE");
  const [fechaCita, setFechaCita] = useState<string>("");
  const [lugarCita, setLugarCita] = useState<string>("");
  const [responsable, setResponsable] = useState<string>("");
  const [contacto, setContacto] = useState<string>("");
  const [fechaCiertaRequerida, setFechaCiertaRequerida] = useState<boolean>(true);
  const [fechaCiertaObtenida, setFechaCiertaObtenida] = useState<boolean>(false);
  const [fechaRatificacion, setFechaRatificacion] = useState<string>("");
  const [fedatario, setFedatario] = useState<string>("");
  const [numeroInstrumento, setNumeroInstrumento] = useState<string>("");
  const [archivoNotariadoUrl, setArchivoNotariadoUrl] = useState<string>("");
  const [selloTiempoFecha, setSelloTiempoFecha] = useState<string>("");
  const [selloTiempoProveedor, setSelloTiempoProveedor] = useState<string>("");
  const [selloTiempoAcuse, setSelloTiempoAcuse] = useState<string>("");
  const [registroFolio, setRegistroFolio] = useState<string>("");
  const [registroUrl, setRegistroUrl] = useState<string>("");
  const [notas, setNotas] = useState<string>("");
  const [resultado, setResultado] = useState<ContratoLogistica | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadContratos = async () => {
      setLoadingContratos(true);
      try {
        const payload = await apiFetch<PaginatedResponse<ContratoLite> | ContratoLite[]>(
          "/api/materialidad/contratos/?ordering=-created_at"
        );
        const list = Array.isArray(payload) ? payload : payload.results ?? [];
        if (mounted) {
          setContratos(list);
        }
      } catch (err) {
        if (mounted) {
          await alertError("No pudimos cargar contratos", (err as Error).message);
        }
      } finally {
        if (mounted) {
          setLoadingContratos(false);
        }
      }
    };

    void loadContratos();
    return () => {
      mounted = false;
    };
  }, []);

  /* ── Auto-load contract data when a contract is selected ── */
  const handleContratoChange = useCallback(async (id: string) => {
    setContratoId(id);
    setResultado(null);
    if (!id) return;

    try {
      const data = await obtenerFirmaLogistica(Number(id));
      if (data) {
        setFirmaModalidad(data.firma_modalidad || "NOTARIAL");
        setLogisticaEstado(data.logistica_estado || "PENDIENTE");
        setFechaCita(data.fecha_cita_firma ? data.fecha_cita_firma.slice(0, 16) : "");
        setLugarCita(data.lugar_cita || "");
        setResponsable(data.responsable_logistica || "");
        setContacto(data.contacto_responsable || "");
        setFechaCiertaRequerida(data.fecha_cierta_requerida ?? true);
        setFechaCiertaObtenida(data.fecha_cierta_obtenida ?? false);
        setFedatario(data.fedatario_nombre || "");
        setNumeroInstrumento(data.numero_instrumento || "");
        setFechaRatificacion(data.fecha_ratificacion || "");
        setArchivoNotariadoUrl(data.archivo_notariado_url || "");
        setSelloTiempoFecha(data.sello_tiempo_aplicado ? data.sello_tiempo_aplicado.slice(0, 16) : "");
        setSelloTiempoProveedor(data.sello_tiempo_proveedor || "");
        setSelloTiempoAcuse(data.sello_tiempo_acuse_url || "");
        setRegistroFolio(data.registro_publico_folio || "");
        setRegistroUrl(data.registro_publico_url || "");
        setNotas(data.notas_logistica || "");
        setResultado(data);
      }
    } catch {
      /* contract may not have logistics yet – that's ok */
    }
  }, []);

  const handleSubmit = async () => {
    const idNumber = Number(contratoId);
    if (!idNumber) {
      await alertError("Falta contrato", "Indica el ID del contrato a actualizar");
      return;
    }

    if (fechaCiertaObtenida && (!fedatario.trim() || !numeroInstrumento.trim())) {
      await alertError("Datos faltantes", "Captura fedatario y número de instrumento para fecha cierta");
      return;
    }
    if (fechaCiertaObtenida && !archivoNotariadoUrl.trim() && !selloTiempoAcuse.trim()) {
      await alertError("Acuse requerido", "Agrega el acuse del sello de tiempo o el link al testimonio notariado");
      return;
    }

    const payload: any = {
      firma_modalidad: firmaModalidad,
      logistica_estado: logisticaEstado,
      fecha_cierta_requerida: fechaCiertaRequerida,
      fecha_cierta_obtenida: fechaCiertaObtenida,
      lugar_cita: lugarCita || undefined,
      responsable_logistica: responsable || undefined,
      contacto_responsable: contacto || undefined,
      fedatario_nombre: fedatario || undefined,
      numero_instrumento: numeroInstrumento || undefined,
      archivo_notariado_url: archivoNotariadoUrl || undefined,
      sello_tiempo_aplicado: selloTiempoFecha ? new Date(selloTiempoFecha).toISOString() : undefined,
      sello_tiempo_proveedor: selloTiempoProveedor || undefined,
      sello_tiempo_acuse_url: selloTiempoAcuse || undefined,
      registro_publico_folio: registroFolio || undefined,
      registro_publico_url: registroUrl || undefined,
      notas_logistica: notas || undefined,
    };

    if (fechaCita) {
      const iso = new Date(fechaCita).toISOString();
      payload.fecha_cita_firma = iso;
    }
    if (fechaRatificacion) {
      payload.fecha_ratificacion = fechaRatificacion;
    }

    setLoading(true);
    try {
      const res = await actualizarFirmaLogistica(idNumber, payload);
      setResultado(res);
      await alertSuccess("Guardado", "Logística de firma actualizada");
    } catch (e) {
      await alertError("No pudimos guardar", (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-10 text-slate-900">
        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          {/* ── LEFT COLUMN: Form ── */}
          <section className="space-y-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Fecha cierta</p>
                <h2 className="text-2xl font-semibold text-slate-900">Firma y logística</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Programa la firma, registra fedatario e instrumentación para acreditar fecha cierta.
                </p>
              </div>
            </div>

            {/* ── Contrato + Modalidad ── */}
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-500">Contrato</label>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  value={contratoId}
                  onChange={(e) => void handleContratoChange(e.target.value)}
                >
                  <option value="">Selecciona un contrato</option>
                  {loadingContratos && <option value="">Cargando contratos…</option>}
                  {!loadingContratos && contratos.length === 0 && (
                    <option value="">Sin contratos disponibles</option>
                  )}
                  {contratos.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      #{c.id} · {c.nombre}
                      {c.proveedor_nombre ? ` — ${c.proveedor_nombre}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Modalidad de firma</label>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  value={firmaModalidad}
                  onChange={(e) => setFirmaModalidad(e.target.value as FirmaModalidad)}
                >
                  {MODALIDADES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  {MODALIDADES.find((m) => m.value === firmaModalidad)?.hint}
                </p>
              </div>
            </div>

            {/* ── Estado + Cita ── */}
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-500">Estado logístico</label>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  value={logisticaEstado}
                  onChange={(e) => setLogisticaEstado(e.target.value as EstadoLogistica)}
                >
                  {ESTADOS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Cita para firma</label>
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  value={fechaCita}
                  onChange={(e) => setFechaCita(e.target.value)}
                />
              </div>
            </div>

            {/* ── Lugar + Responsable ── */}
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-500">Lugar de firma / notaría</label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  placeholder="Notaría, domicilio o sala"
                  value={lugarCita}
                  onChange={(e) => setLugarCita(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Responsable logística</label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  placeholder="Nombre y rol"
                  value={responsable}
                  onChange={(e) => setResponsable(e.target.value)}
                />
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  placeholder="Contacto (teléfono o email)"
                  value={contacto}
                  onChange={(e) => setContacto(e.target.value)}
                />
              </div>
            </div>

            {/* ── FECHA CIERTA CARD ── */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">Fecha cierta</p>
              <div className="mt-3 flex flex-wrap items-center gap-5 text-sm text-slate-700">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={fechaCiertaRequerida}
                    onChange={(e) => setFechaCiertaRequerida(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Requiere fecha cierta
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={fechaCiertaObtenida}
                    onChange={(e) => setFechaCiertaObtenida(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Fecha cierta obtenida
                </label>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-xs font-medium text-slate-500">Fedatario</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    placeholder="Nombre del fedatario"
                    value={fedatario}
                    onChange={(e) => setFedatario(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">No. de instrumento</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    placeholder="Ej. 15,234"
                    value={numeroInstrumento}
                    onChange={(e) => setNumeroInstrumento(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Fecha de protocolización</label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    value={fechaRatificacion}
                    onChange={(e) => setFechaRatificacion(e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="text-xs font-medium text-slate-500">URL de testimonio / archivo notariado</label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  placeholder="Link seguro al testimonio"
                  value={archivoNotariadoUrl}
                  onChange={(e) => setArchivoNotariadoUrl(e.target.value)}
                />
              </div>

              {/* ── Sello de tiempo + Registro público ── */}
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-slate-500">Sello de tiempo (proveedor)</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    placeholder="Ej. TimeStamp Authority"
                    value={selloTiempoProveedor}
                    onChange={(e) => setSelloTiempoProveedor(e.target.value)}
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="datetime-local"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      value={selloTiempoFecha}
                      onChange={(e) => setSelloTiempoFecha(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setSelloTiempoFecha(new Date().toISOString().slice(0, 16))}
                      className="whitespace-nowrap rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
                    >
                      Marcar ahora
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Acuse / hash del sello</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    placeholder="URL o hash del acuse"
                    value={selloTiempoAcuse}
                    onChange={(e) => setSelloTiempoAcuse(e.target.value)}
                  />
                  <label className="mt-2 block text-xs font-medium text-slate-500">Registro público (opcional)</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    placeholder="Folio de inscripción"
                    value={registroFolio}
                    onChange={(e) => setRegistroFolio(e.target.value)}
                  />
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    placeholder="URL a constancia de registro"
                    value={registroUrl}
                    onChange={(e) => setRegistroUrl(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* ── Notas ── */}
            <div>
              <label className="text-xs font-medium text-slate-500">Notas de logística / instrucciones</label>
              <textarea
                rows={4}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                placeholder="Mensajería, entregables que deben acompañar la firma, SLA, etc."
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
              />
            </div>

            {/* ── Submit ── */}
            <button
              type="button"
              disabled={loading || !contratoId}
              onClick={() => void handleSubmit()}
              className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white shadow-md hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 transition"
            >
              {loading ? "Guardando…" : "Guardar logística"}
            </button>
          </section>

          {/* ── RIGHT COLUMN: Status ── */}
          <aside className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Estatus</p>
            {!resultado && (
              <p className="text-sm text-slate-400">
                Selecciona un contrato para ver su logística de firma, o completa el formulario y guárdalo.
              </p>
            )}
            {resultado && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill label={`Contrato #${resultado.id}`} />
                  <Pill label={resultado.logistica_estado} tone={resultado.logistica_estado === "COMPLETADA" ? "emerald" : "sky"} />
                  {resultado.fecha_cierta_obtenida && <Pill label="Fecha cierta ✓" tone="amber" />}
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-400">Modalidad</p>
                  <p className="text-base font-semibold text-slate-900">{resultado.firma_modalidad}</p>
                  {resultado.fecha_cita_firma && <p className="text-sm text-slate-600">Cita: {new Date(resultado.fecha_cita_firma).toLocaleString()}</p>}
                  {resultado.lugar_cita && <p className="text-sm text-slate-600">Lugar: {resultado.lugar_cita}</p>}
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 space-y-1">
                  <p className="text-xs font-medium text-slate-400">Fedatario</p>
                  <p className="text-sm text-slate-900">{resultado.fedatario_nombre || "Sin capturar"}</p>
                  <p className="text-sm text-slate-600">Instrumento: {resultado.numero_instrumento || "N/D"}</p>
                  <p className="text-sm text-slate-600">Fecha: {resultado.fecha_ratificacion || "N/D"}</p>
                  {resultado.archivo_notariado_url && (
                    <a
                      className="text-xs font-medium text-emerald-600 underline hover:text-emerald-700"
                      href={resultado.archivo_notariado_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver testimonio ↗
                    </a>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-400">Responsable</p>
                  <p className="text-sm text-slate-900">{resultado.responsable_logistica || "N/D"}</p>
                  <p className="text-sm text-slate-600">{resultado.contacto_responsable || "Sin contacto"}</p>
                </div>
                {resultado.notas_logistica && (
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-400">Notas</p>
                    <p className="text-sm text-slate-600 whitespace-pre-line">{resultado.notas_logistica}</p>
                  </div>
                )}
                <p className="text-[11px] text-slate-400">Actualizado: {new Date(resultado.updated_at).toLocaleString()}</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </DashboardShell>
  );
}
