# Evidencia ETAPA 1 — Usabilidad crítica en Clientes/Proveedores

**Fecha:** 2026-03-04  
**Rama:** `feat/materialidad-validacion-expediente`  
**Commit:** `0c1614a`  
**Objetivo:** Reducir fricción operativa y errores de captura en alta/edición de Clientes y Proveedores.

## 1) Alcance implementado

Se implementaron mejoras UX y de consistencia API para que el flujo de captura sea claro, seguro y entendible para usuarios contables:

- Guardado explícito por contexto:
  - `Guardar cliente`
  - `Guardar proveedor`
- Prevención de pérdida de información:
  - Estado de cambios sin guardar (`isDirty`)
  - Confirmación al salir/cancelar con cambios
  - Guardia de cierre/recarga (`beforeunload`)
- Validación en frontend antes de enviar:
  - Campos obligatorios por tipo de persona (PM/PF)
  - Formato RFC
  - Formato email (cuando aplica)
- Errores claros y accionables:
  - Mensaje general (`detail`)
  - Errores por campo (`field_errors`)
- Consistencia backend para errores:
  - Contrato uniforme `{ detail, field_errors, code }`

## 2) Archivos modificados

### Frontend
- `frontend/src/app/dashboard/empresas/page.tsx`
- `frontend/src/app/dashboard/proveedores/page.tsx`

### Backend
- `backend/materialidad/serializers.py`
- `backend/materialidad_backend/settings.py`
- `backend/materialidad_backend/exceptions.py` (nuevo)

## 3) Cambios técnicos relevantes

### Frontend
- Gestión de estado sucio (`isDirty`) comparando snapshot inicial vs estado actual.
- Reglas de validación cliente-side para obligatorios y formatos (RFC/email).
- Bloqueo de acción de guardado cuando no hay cambios o durante submit.
- Parseo robusto de errores API para mapear mensajes generales y por campo.

### Backend
- Validaciones de negocio en serializers:
  - `EmpresaSerializer.validate(...)`
  - `ProveedorSerializer.validate(...)`
- Reglas de RFC y obligatoriedad por tipo de persona (PM/PF).
- Exception handler DRF global para normalizar respuestas de error:
  - Archivo: `materialidad_backend/exceptions.py`
  - Configuración: `REST_FRAMEWORK["EXCEPTION_HANDLER"]`

## 4) Validación ejecutada

- Frontend lint:
  - Resultado: **OK** (sin warnings/errores)
- Regresión backend consolidada:
  - Resultado: **36 tests OK**

## 5) Checklist QA de salida (ETAPA 1)

- [x] Botón de guardado explícito y contextual en ambas pantallas.
- [x] Confirmación al abandonar formulario con cambios sin guardar.
- [x] Mensaje de estado de cambios pendientes visible para el usuario.
- [x] Validación de campos obligatorios antes de enviar.
- [x] Validación de RFC y email con mensajes claros.
- [x] Errores por campo renderizados de forma consistente.
- [x] Contrato de error backend estandarizado para frontend.
- [x] Lint frontend en verde.
- [x] Regresión backend en verde.

## 6) Resultado operativo

ETAPA 1 queda **implementada, validada y versionada**. El flujo Cliente → Proveedor ahora minimiza pérdidas por salida accidental, reduce intentos fallidos de guardado y entrega retroalimentación clara para corrección inmediata.

## 7) Siguiente paso sugerido

Ejecutar una mini UAT guiada (30–45 min) con 2 perfiles de usuario (despacho + contador operativo) enfocada en:

1. Alta completa de Cliente PM y PF.
2. Alta de Proveedor PM y PF.
3. Casos con errores intencionales (RFC/email/campos faltantes).
4. Validación de mensajes y tiempos de corrección.
