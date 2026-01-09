"use client";

import { useState } from "react";

import { DashboardShell } from "../../../components/DashboardShell";
import { alertError, alertSuccess } from "../../../lib/alerts";
import {
  actualizarFirmaLogistica,
  ContratoLogistica,
  EstadoLogistica,
  FirmaModalidad,
} from "../../../lib/firma";

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
    emerald: "border-emerald-300/60 bg-emerald-500/10 text-emerald-100",
    sky: "border-sky-300/60 bg-sky-500/10 text-sky-100",
    amber: "border-amber-300/60 bg-amber-500/10 text-amber-900",
  };
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${palette[tone]}`}>{label}</span>
  );
}

export default function FirmaLogisticaPage() {
  const [contratoId, setContratoId] = useState<string>("");
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
      <div className="space-y-6 text-white">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/40 to-emerald-900/30 p-6 shadow-2xl shadow-emerald-500/20">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Fecha cierta</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Firma y logística</h1>
          <p className="mt-2 text-sm text-slate-200">
            Programa la firma, registra fedatario e instrumentación para acreditar fecha cierta.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs text-slate-300">ID de contrato</p>
                <input
                  className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-950/60 px-3 py-2 text-white"
                  placeholder="Ej. 42"
                  value={contratoId}
                  onChange={(e) => setContratoId(e.target.value)}
                />
              </div>
              <div>
                <p className="text-xs text-slate-300">Modalidad de firma</p>
                <select
                  className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-900/60 px-3 py-2 text-white"
                  value={firmaModalidad}
                  onChange={(e) => setFirmaModalidad(e.target.value as FirmaModalidad)}
                >
                  {MODALIDADES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-400">{MODALIDADES.find((m) => m.value === firmaModalidad)?.hint}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs text-slate-300">Estado logístico</p>
                <select
                  className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-900/60 px-3 py-2 text-white"
                  value={logisticaEstado}
                  onChange={(e) => setLogisticaEstado(e.target.value as EstadoLogistica)}
                >
                  {ESTADOS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs text-slate-300">Cita para firma</p>
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-900/60 px-3 py-2 text-white"
                  value={fechaCita}
                  onChange={(e) => setFechaCita(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs text-slate-300">Lugar de firma / notaría</p>
                <input
                  className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-900/60 px-3 py-2 text-white"
                  placeholder="Notaría, domicilio o sala"
                  value={lugarCita}
                  onChange={(e) => setLugarCita(e.target.value)}
                />
              </div>
              <div>
                <p className="text-xs text-slate-300">Responsable logística</p>
                <input
                  className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-900/60 px-3 py-2 text-white"
                  placeholder="Nombre y rol"
                  value={responsable}
                  onChange={(e) => setResponsable(e.target.value)}
                />
                <input
                  className="mt-2 w-full rounded-2xl border border-white/20 bg-slate-900/60 px-3 py-2 text-white"
                  placeholder="Contacto (teléfono o email)"
                  value={contacto}
                  onChange={(e) => setContacto(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Fecha cierta</p>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-200">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={fechaCiertaRequerida}
                    onChange={(e) => setFechaCiertaRequerida(e.target.checked)}
                    className="h-4 w-4 rounded border-white/40 bg-slate-900 text-emerald-500"
                  />
                  Requiere fecha cierta
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={fechaCiertaObtenida}
                    onChange={(e) => setFechaCiertaObtenida(e.target.checked)}
                    className="h-4 w-4 rounded border-white/40 bg-slate-900 text-emerald-500"
                  />
                  Fecha cierta obtenida
                </label>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-300">Fedatario</p>
                  <input
                    className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-900/60 px-3 py-2 text-white"
                    placeholder="Nombre del fedatario"
                    value={fedatario}
                    onChange={(e) => setFedatario(e.target.value)}
                  />
                </div>
                <div>
                  <p className="text-xs text-slate-300">No. de instrumento</p>
                  <input
                    className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-900/60 px-3 py-2 text-white"
                    placeholder="Ej. 15,234"
                    value={numeroInstrumento}
                    onChange={(e) => setNumeroInstrumento(e.target.value)}
                  />
                </div>
                <div>
                  <p className="text-xs text-slate-300">Fecha de protocolización</p>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-900/60 px-3 py-2 text-white"
                    value={fechaRatificacion}
                    onChange={(e) => setFechaRatificacion(e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-3">
                <p className="text-xs text-slate-300">URL de testimonio / archivo notariado</p>
                <input
                  className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-900/60 px-3 py-2 text-white"
                  placeholder="Link seguro al testimonio"
                  value={archivoNotariadoUrl}
                  onChange={(e) => setArchivoNotariadoUrl(e.target.value)}
                />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-300">Sello de tiempo (proveedor)</p>
                  <input
                    className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-900/60 px-3 py-2 text-white"
                    placeholder="Ej. TimeStamp Authority"
                    value={selloTiempoProveedor}
                    onChange={(e) => setSelloTiempoProveedor(e.target.value)}
                  />
                  <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto] items-center">
                    <input
                      type="datetime-local"
                      className="w-full rounded-2xl border border-white/20 bg-slate-900/60 px-3 py-2 text-white"
                      value={selloTiempoFecha}
                      onChange={(e) => setSelloTiempoFecha(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setSelloTiempoFecha(new Date().toISOString().slice(0, 16))}
                      className="rounded-xl border border-emerald-300/50 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-300/10"
                    >
                      Marcar ahora
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-300">Acuse / hash del sello</p>
                  <input
                    className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-900/60 px-3 py-2 text-white"
                    placeholder="URL o hash del acuse"
                    value={selloTiempoAcuse}
                    onChange={(e) => setSelloTiempoAcuse(e.target.value)}
                  />
                  <p className="mt-2 text-xs text-slate-300">Registro público (opcional)</p>
                  <input
                    className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-900/60 px-3 py-2 text-white"
                    placeholder="Folio de inscripción"
                    value={registroFolio}
                    onChange={(e) => setRegistroFolio(e.target.value)}
                  />
                  <input
                    className="mt-2 w-full rounded-2xl border border-white/20 bg-slate-900/60 px-3 py-2 text-white"
                    placeholder="URL a constancia de registro"
                    value={registroUrl}
                    onChange={(e) => setRegistroUrl(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-300">Notas de logística / instrucciones</p>
              <textarea
                rows={4}
                className="mt-1 w-full rounded-2xl border border-white/20 bg-slate-900/60 px-3 py-2 text-white"
                placeholder="Mensajería, entregables que deben acompañar la firma, SLA, etc."
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
              />
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={() => void handleSubmit()}
              className="w-full rounded-2xl border border-emerald-400/60 bg-emerald-500/15 px-4 py-3 text-base font-semibold text-emerald-200 hover:border-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Guardando…" : "Guardar logística"}
            </button>
          </div>

          <div className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/50 p-6 text-sm">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-300">Estatus</p>
            {!resultado && <p className="text-slate-300">Actualiza un contrato para ver el resumen de logística.</p>}
            {resultado && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill label={`Contrato #${resultado.id}`} />
                  <Pill label={resultado.logistica_estado} tone={resultado.logistica_estado === "COMPLETADA" ? "emerald" : "sky"} />
                  {resultado.fecha_cierta_obtenida && <Pill label="Fecha cierta acreditada" tone="amber" />}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-slate-400">Modalidad</p>
                  <p className="text-base font-semibold text-white">{resultado.firma_modalidad}</p>
                  {resultado.fecha_cita_firma && <p className="text-sm text-slate-200">Cita: {new Date(resultado.fecha_cita_firma).toLocaleString()}</p>}
                  {resultado.lugar_cita && <p className="text-sm text-slate-200">Lugar: {resultado.lugar_cita}</p>}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-1">
                  <p className="text-xs text-slate-400">Fedatario</p>
                  <p className="text-sm text-white">{resultado.fedatario_nombre || "Sin capturar"}</p>
                  <p className="text-sm text-slate-200">Instrumento: {resultado.numero_instrumento || "N/D"}</p>
                  <p className="text-sm text-slate-200">Fecha: {resultado.fecha_ratificacion || "N/D"}</p>
                  {resultado.archivo_notariado_url && (
                    <a
                      className="text-xs text-emerald-300 underline"
                      href={resultado.archivo_notariado_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver testimonio
                    </a>
                  )}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-slate-400">Responsable</p>
                  <p className="text-sm text-white">{resultado.responsable_logistica || "N/D"}</p>
                  <p className="text-sm text-slate-200">{resultado.contacto_responsable || "Sin contacto"}</p>
                </div>
                {resultado.notas_logistica && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs text-slate-400">Notas</p>
                    <p className="text-sm text-slate-200 whitespace-pre-line">{resultado.notas_logistica}</p>
                  </div>
                )}
                <p className="text-[11px] text-slate-400">Actualizado: {new Date(resultado.updated_at).toLocaleString()}</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
