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

export async function compararPrecios(payload: { concepto: string; items: Cotizacion[] }): Promise<ComparativoResponse> {
  return apiFetch<ComparativoResponse>("/api/materialidad/comparar-precios/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
