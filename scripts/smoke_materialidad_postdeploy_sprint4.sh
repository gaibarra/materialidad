#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/home/gaibarra/materialidad"
BACKEND_DIR="${ROOT_DIR}/backend"
PYTHON_BIN="${ROOT_DIR}/.venv/bin/python"

if [[ ! -x "${PYTHON_BIN}" ]]; then
  echo "[ERROR] Python env no encontrado en ${PYTHON_BIN}" >&2
  exit 2
fi

cd "${BACKEND_DIR}"

echo "[INFO] Smoke Sprint 4 - materialidad"
echo "[INFO] Ejecutando suite crítica post-deploy..."

"${PYTHON_BIN}" manage.py test \
  materialidad.tests.test_operacion_export_pdf.OperacionExportPdfTests.test_exportar_pdf_defensa_descarga_pdf_valido \
  materialidad.tests.test_operacion_export_dossier.OperacionExportDossierTests.test_exportar_dossier_incluye_manifiesto_integridad \
  materialidad.tests.test_operacion_matriz_materialidad.OperacionMatrizMaterialidadTests.test_matriz_devuelve_cadena_documental_y_estado_completitud \
  materialidad.tests.test_dashboard_cobertura_p0.DashboardCoberturaP0Tests.test_dashboard_cobertura_p0_devuelve_contrato_esperado \
  materialidad.tests.test_operacion_cambiar_estatus.OperacionCambioEstatusTests.test_bloquea_validado_si_expediente_incompleto \
  materialidad.tests.test_operacion_bandeja_revision.OperacionBandejaRevisionTests.test_bandeja_devuelve_operacion_riesgo_faltantes_y_alertas \
  -v 2

echo "[OK] Smoke Sprint 4 finalizado sin errores"
