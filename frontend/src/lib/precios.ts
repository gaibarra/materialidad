import { apiFetch } from "./api";

export type Cotizacion = {
  descripcion: string;
  proveedor: string;
  precio: number;
  moneda: "MXN" | "USD" | "EUR";
};

export type ComparativoResponse = {
  concepto: string;
  mejor_opcion: Cotizacion;
  peor_opcion: Cotizacion;
  diferencia_porcentual: number;
  ahorro_vs_promedio: number;
  items_ordenados: Cotizacion[];
};

export type CotizacionConcepto = {
  id: number;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  importe: number;
  moneda: string;
  unidad: string;
  orden: number;
};

export type CotizacionPDF = {
  id: number;
  empresa: number;
  proveedor_nombre: string;
  archivo: string;
  archivo_nombre: string;
  estatus: "PENDIENTE" | "PROCESADO" | "ERROR";
  error_detalle: string;
  metadata: Record<string, unknown>;
  created_at: string;
  conceptos: CotizacionConcepto[];
  conceptos_count: number;
};

export type ComparativoPDFResponse = {
  summary: {
    proveedores: Array<{ id: number; nombre: string }>;
    totales: Record<string, number>;
    mejor_total: { cotizacion_id: number; proveedor: string; total: number } | null;
    monedas: string[];
    conceptos: number;
  };
  concepts: Array<{
    descripcion: string;
    valores: Record<string, number>;
    min: number;
    max: number;
    avg: number;
  }>;
};

export async function compararPrecios(payload: { concepto: string; items: Cotizacion[] }): Promise<ComparativoResponse> {
  return apiFetch<ComparativoResponse>("/api/materialidad/comparar-precios/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function fetchCotizacionesPDF(empresaId: number): Promise<CotizacionPDF[]> {
  const res = await apiFetch<{ results: CotizacionPDF[] }>(`/api/materialidad/cotizaciones-pdf/?empresa=${empresaId}`);
  return res.results ?? [];
}

export async function uploadCotizacionPDF(params: {
  empresa: number;
  archivo: File;
  proveedor_nombre?: string;
}): Promise<CotizacionPDF> {
  const form = new FormData();
  form.append("empresa", String(params.empresa));
  form.append("archivo", params.archivo);
  if (params.proveedor_nombre) {
    form.append("proveedor_nombre", params.proveedor_nombre);
  }

  const response = await apiFetch<
    CotizacionPDF
  >("/api/materialidad/cotizaciones-pdf/", {
    method: "POST",
    body: form,
  });
  return response;
}

export async function compararCotizacionesPDF(cotizacionIds: number[]): Promise<ComparativoPDFResponse> {
  return apiFetch<ComparativoPDFResponse>("/api/materialidad/cotizaciones-pdf/comparar/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cotizacion_ids: cotizacionIds }),
  });
}
