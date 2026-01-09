import { apiFetch } from "./api";

export type CuentaBancaria = {
  id: number;
  empresa: number;
  alias: string;
  banco: string;
  numero_cuenta: string;
  clabe: string;
  moneda: "MXN" | "USD" | "EUR";
  titular: string;
  es_principal: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type EstadoCuenta = {
  id: number;
  cuenta: number;
  periodo_inicio: string;
  periodo_fin: string;
  archivo_url: string;
  hash_archivo: string;
  saldo_inicial: string | null;
  saldo_final: string | null;
  total_abonos: string | null;
  total_cargos: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type MovimientoBancario = {
  id: number;
  estado_cuenta: number;
  cuenta: number;
  fecha: string;
  monto: string;
  tipo: "ABONO" | "CARGO";
  referencia: string;
  descripcion: string;
  cuenta_contraparte: string;
  banco_contraparte: string;
  nombre_contraparte: string;
  spei_referencia: string;
  categoria: string;
  es_circular: boolean;
  alerta_capacidad: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type OperacionConciliacion = {
  id: number;
  operacion: number;
  movimiento: number;
  estado: "PENDIENTE" | "AUTO" | "MANUAL" | "RECHAZADA";
  confianza: string | null;
  comentario: string;
  operacion_monto: string;
  movimiento_monto: string;
  created_at: string;
  updated_at: string;
};

export async function fetchCuentas(): Promise<CuentaBancaria[]> {
  const payload = await apiFetch<any>("/api/materialidad/cuentas-bancarias/?ordering=alias");
  return payload?.results ?? payload ?? [];
}

export async function createCuenta(data: Partial<CuentaBancaria>): Promise<CuentaBancaria> {
  return apiFetch<CuentaBancaria>("/api/materialidad/cuentas-bancarias/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function fetchEstados(cuentaId: number): Promise<EstadoCuenta[]> {
  const payload = await apiFetch<any>(`/api/materialidad/estados-cuenta/?cuenta=${cuentaId}&ordering=-periodo_fin`);
  return payload?.results ?? payload ?? [];
}

export async function createEstado(data: Partial<EstadoCuenta>): Promise<EstadoCuenta> {
  return apiFetch<EstadoCuenta>("/api/materialidad/estados-cuenta/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export type MovimientoFilters = {
  cuenta?: number;
  estado_cuenta?: number;
  tipo?: "ABONO" | "CARGO";
  min_fecha?: string;
  max_fecha?: string;
  min_monto?: string;
  max_monto?: string;
  spei_referencia?: string;
};

function buildQuery(params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    q.set(key, String(value));
  });
  return q.toString();
}

export async function fetchMovimientos(filters: MovimientoFilters = {}): Promise<MovimientoBancario[]> {
  const query = buildQuery(filters as Record<string, string | number>);
  const url = `/api/materialidad/movimientos-bancarios/${query ? `?${query}` : ""}`;
  const payload = await apiFetch<any>(url);
  return payload?.results ?? payload ?? [];
}

export async function createMovimiento(data: Partial<MovimientoBancario>): Promise<MovimientoBancario> {
  return apiFetch<MovimientoBancario>("/api/materialidad/movimientos-bancarios/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function fetchConciliaciones(): Promise<OperacionConciliacion[]> {
  const payload = await apiFetch<any>("/api/materialidad/conciliaciones/?ordering=-created_at");
  return payload?.results ?? payload ?? [];
}

export async function updateConciliacion(
  id: number,
  data: Partial<OperacionConciliacion>
): Promise<OperacionConciliacion> {
  return apiFetch<OperacionConciliacion>(`/api/materialidad/conciliaciones/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
