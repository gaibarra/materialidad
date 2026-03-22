# Dashboard para Superusuarios

## Objetivo
Proveer a superusuarios una vista consolidada y herramientas para operar múltiples despachos (corporativos): creación/edición de despachos, provisión de clientes asignando despacho, monitoreo de logs y salud operativa.

## Principios
- **Contexto cruzado**: selector de despacho para operar en contexto o ver agregados globales.
- **Seguridad por contexto**: acciones sensibles (provisión, gestión de usuarios globales) solo visibles para superusuarios.
- **Trazabilidad**: cada provisión registra despacho, usuario y resultado.
- **Tiempo real**: métricas leídas del backend sin caché manual.

## Estructura
- **Header**: nombre de usuario, rol "Superusuario" y selector de despacho ("Todos" + lista activa).
- **Sidebar**: mismas secciones base, más módulos exclusivos detallados abajo.
- **Contenido**: tarjetas y tablas filtrables por despacho o global.

## Módulos exclusivos
1) **Despachos**
   - Crear/editar/desactivar despachos.
   - Ver conteo de clientes y usuarios por despacho.
2) **Provisión de clientes**
   - Crear cliente eligiendo despacho destino (requerido).
   - Ver histórico de provisiones con estado, timestamps y usuario.
3) **Usuarios globales**
   - Alta/baja/roles de superusuarios y staff cross-despacho.
4) **Salud operativa**
   - Últimas provisiones (éxito/error) por despacho.
   - Alertas de conectividad a bases de datos de tenants.
5) **Auditoría**
   - Log de acciones administrativas (quién, qué, cuándo, despacho asociado).

## Métricas clave para superusuarios
- Provisiones en las últimas 24h por despacho (éxito/error).
- Clientes activos por despacho.
- Usuarios activos por despacho y rol.
- Tiempo promedio de provisión.
- Fallos recientes de conectividad a clientes.

## Flujos recomendados
1. Crear despacho y asignar staff inicial.
2. Provisionar clientes seleccionando el despacho correspondiente.
3. Revisar provisiones recientes y resolver fallos.
4. Gestionar roles de usuarios globales.
5. Auditar acciones administrativas de alto impacto.

## Estado actual
- Selector de despacho funcional para provisión y navegación.
- Provisión multi-despacho activa (backend + frontend).
- Auditoría y salud operativa base cubiertas con logs de provisión; monitoreo avanzado pendiente de futuras iteraciones.
