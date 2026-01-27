# Materialidad para el Contador Público

## Qué busca el contador
- Que cada operación tenga soporte válido ante el SAT: contrato + entregables + CFDI + pago + razón de negocio.
- Saber rápido qué falta para cerrar mes/año y evitar ajustes en auditoría o dictamen.
- Tener un expediente listo para defensa (art. 5-A CFF) sin perseguir evidencias en múltiples sistemas.

## Flujo de información (de origen a defensa)
1. **Alta de operación**: compras/solicitante registra empresa, proveedor, monto, fecha, tipo y vincula contrato vigente.
2. **Contrato y fecha cierta**: se genera o carga contrato; se puede añadir testimonio/notaría o registro público si aplica.
3. **Entregables y checklist por pilar SAT**: se crean entregables con fechas compromiso y se adjuntan evidencias “antes-durante-después”; alertas por vencimiento.
4. **Evidencias y logística**: actas de recepción, correos, minutas, fotos, órdenes de compra y acuses se cargan y se sellan con fecha/usuario.
5. **Validación fiscal**: CFDI y SPEI se validan (UUID, monto, referencia); se guarda resultado y conciliación básica factura–pago.
6. **Bitácora de auditoría**: registra quién creó/modificó entregables, evidencias y operaciones (usuario, timestamp, IP).
7. **Dossier de defensa (1 clic)**: genera ZIP con índice cronológico por pilar SAT: contrato, evidencias, acuses, CFDI/SPEI y bitácora clave.

### Diagrama de flujo (resumen)
```
Alta operación -> Contrato/fecha cierta -> Entregables con fechas -> Evidencias cargadas
	|                  |                     |                          |
	+--> Validación CFDI/SPEI + conciliación -> Bitácora (quién/cuándo) -> Dossier ZIP (defensa)
```

## Qué revisa el SAT y cómo lo cubrimos
- **Existencia**: contrato + órdenes/recepciones + evidencia fotográfica o documental.
- **Capacidad**: datos del proveedor, REPS/IMSS, activos, personal clave, riesgo 69-B, sitio web/fotos.
- **Ejecución**: entregables, minutas, correos, guías/logística, actas de recepción con fecha cierta.
- **Contraprestación**: CFDI válido y SPEI conciliado con monto/fecha; estados de cuenta opcionales.
- **Razón de negocio (5-A CFF)**: narrativa, beneficio esperado y aprobaciones internas.

## Señales de control para contabilidad
- Alertas de entregables vencidos y evidencias faltantes.
- Contratos sin fecha cierta o sin soporte notarial cuando es requerido.
- CFDI con conceptos genéricos o sin vínculo a entregable.
- Operaciones con proveedores de riesgo o sin capacidad documentada.
- Bitácora para reconstruir quién cambió qué y cuándo (útil en revisiones).

## Rol del contador
- Monitorea el tablero: faltantes por operación, vencimientos y estatus de validación fiscal.
- Revisa y aprueba cierres mensuales con checklist de pilares SAT completo.
- Prepara respuestas a auditoría usando el dossier automático; ajusta glosas si falta evidencia.

## Checklist corto para cierre mensual
- Operaciones con CFDI/SPEI validados y conciliados (monto/fecha/referencia).
- Contratos vinculados y, cuando aplique, con fecha cierta/documento notarial.
- Entregables cerrados o con plan de acción si vencidos; evidencias “antes-durante-después” cargadas.
- Proveedores revisados (riesgo 69-B/REPS/IMSS) y capacidades documentadas.
- Dossier generado para operaciones críticas o de auditoría en curso.

## Entregable clave: Dossier de defensa
- **Contenido**: índice cronológico (JSON/README) + archivos: contrato/testimonio, órdenes, recepciones, fotos, CFDI, SPEI, actas, bitácora relevante.
- **Formato**: ZIP descargable desde la operación.
- **Uso**: se envía a fiscalización o se adjunta a dictamen; reduce tiempo de respuesta y riesgo de rechazo.

---

**C.P. Gonzalo Arturo Ibarra Mendoza**  
ProyectoG40
