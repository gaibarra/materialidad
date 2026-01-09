import { apiFetch } from "./api";

export type ValidacionCFDISPEI = {
  uuid_cfdi?: string | null;
  referencia_spei?: string | null;
  monto?: string | null;
  cfdi_estatus: "PENDIENTE" | "VALIDO" | "INVALIDO";
  spei_estatus: "PENDIENTE" | "VALIDADO" | "NO_ENCONTRADO";
  operacion_id?: number;
};

export async function validarCfdiSpei(payload: {
  uuid_cfdi?: string;
  referencia_spei?: string;
  monto?: string;
  operacion?: number | null;
}): Promise<ValidacionCFDISPEI> {
  return apiFetch<ValidacionCFDISPEI>("/api/materialidad/validar-cfdi-spei/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
