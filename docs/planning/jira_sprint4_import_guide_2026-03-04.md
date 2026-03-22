# Guía de Importación Jira — Sprint 4 (Detallado)

**Archivo principal:** `docs/planning/jira_sprint4_backlog_detailed.csv`

## Objetivo
Importar en Jira una estructura jerárquica completa de Sprint 4 con:
- 1 épica (`E4`)
- 6 historias (`E4-H1-R1` ... `E4-QA-R1`)
- 12 subtareas asociadas mediante `Parent Id`

## Mapeo recomendado de columnas
Mapear durante el import CSV de Jira:

- `Issue Id` → `Issue Id`
- `Parent Id` → `Parent Id`
- `External ID` → `External ID` (o campo personalizado equivalente)
- `Issue Type` → `Issue Type`
- `Summary` → `Summary`
- `Epic Name` → `Epic Name`
- `Epic Link` → `Epic Link`
- `Story Points` → `Story Points`
- `Sprint` → `Sprint`
- `Labels` → `Labels`
- `Depends On` → `Issue Links` (tipo `is blocked by`) o campo temporal de dependencia
- `Description` → `Description`
- `Acceptance Criteria` → `Acceptance Criteria` (o incluir en `Description` si no existe el campo)

## Orden de importación sugerido
1. Importar el CSV completo en una corrida.
2. Si la instancia no soporta `Parent Id` en la misma corrida, usar fallback:
   - Primera corrida: épica + historias (filtrar `Issue Type != Sub-task`).
   - Segunda corrida: subtareas (`Issue Type = Sub-task`) conservando `Issue Id/Parent Id`.

## Validaciones post-import
- Verificar que la épica `E4` contiene 6 historias.
- Verificar que cada historia contiene 2 subtareas.
- Validar que `Sprint = P0-Sprint-4` y labels se aplicaron.
- Confirmar que los criterios de aceptación están visibles por issue.

## Observaciones
- `Depends On` puede requerir mapeo según la configuración de Issue Links de cada proyecto Jira.
- Si el proyecto no usa campo `Acceptance Criteria`, mapearlo a `Description` concatenado.
