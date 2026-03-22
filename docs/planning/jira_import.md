# Importación Jira del backlog P0 (8 semanas)

Archivo base: `docs/planning/jira_p0_backlog.csv`

## 1) Mapeo sugerido de columnas en Jira CSV Import

- `External ID` -> **External Issue ID** (o campo texto; útil para trazabilidad)
- `Issue Type` -> **Issue Type**
- `Summary` -> **Summary**
- `Epic Name` -> **Epic Name** (solo para filas tipo Epic)
- `Epic Link` -> **Epic Link** (historias que cuelgan de la épica)
- `Story Points` -> **Story Points**
- `Sprint` -> **Sprint**
- `Labels` -> **Labels**
- `Description` -> **Description**
- `Depends On` -> campo custom (si existe) o mapear temporalmente a **Description**

## 2) Orden recomendado

1. Importar primero las filas `Issue Type = Epic`.
2. Verificar que las épicas queden con el mismo nombre del CSV.
3. Importar después las filas `Issue Type = Story`.
4. Revisar campo `Epic Link` (debe enlazar historias con `E1`, `E2`, `E3`, `E4` por nombre de épica).

## 3) Sprints objetivo

- `P0-Sprint-1`: Semanas 1-2
- `P0-Sprint-2`: Semanas 3-4
- `P0-Sprint-3`: Semanas 5-6
- `P0-Sprint-4`: Semanas 7-8

## 4) Notas prácticas

- Si tu Jira no reconoce `Story Points`, usa el campo de estimación del proyecto (team-managed/company-managed cambia).
- Si tu Jira no reconoce `Epic Link`, verifica que el proyecto tenga habilitado roadmap/epics.
- `Depends On` es informativo para ruta crítica; si no existe campo nativo, conviértelo en issue links post-import.

## 5) QA post-import (5 min)

- Confirmar 4 épicas y 19 historias.
- Confirmar capacidad por sprint (~32 puntos).
- Confirmar que no haya historias huérfanas sin `Epic Link`.
- Confirmar labels `p0` y `materialidad` para filtros rápidos.
