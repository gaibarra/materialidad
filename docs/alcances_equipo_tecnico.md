# Alcances Técnicos para el Equipo de Desarrollo

## 1. Contexto y objetivos
El producto de materialidad busca automatizar la elaboración de contratos y soportes fiscales sin perder el control normativo. Desde tecnología debemos garantizar que cada capacidad de IA se ejecute con trazabilidad, pruebas y límites de costo claramente definidos. El dominio oficial para ambientes productivos será **materialidad.online**, por lo que toda integración (frontend, Nginx, certificados) debe apuntar a ese FQDN.

## 2. Arquitectura general
- **Backend Django como orquestador**: todas las llamadas a GPT-5 mini se concentran en el backend para aplicar logging, control de costos y rate limiting antes de exponer APIs hacia Next.js.
- **Módulo `ai_providers`**: encapsularemos la integración (ej. `ai_providers/openai.py`) para leer `OPENAI_API_KEY`, permitir interchange de modelos y añadir métricas sin tocar cada feature.
- **Dominios funcionales en `materialidad.ai`**: generador de contratos, citas legales, cláusulas/redlines, resúmenes, etc., cada uno dentro de un submódulo con sus prompts documentados y pruebas unitarias basadas en fixtures simuladas.
- **Frontend Next.js**: consume únicamente los endpoints del backend, respetando headers de autenticación (`Authorization`, `X-Tenant`). El UI renderiza estados de carga, errores y resultados enriquecidos (tips, panel de redlines, etc.).

## 3. Capacidades ya implementadas
1. **Generador de contratos** (`POST /api/materialidad/contratos/generar/`).
2. **Citado legal/fiscal automático** con caché de referencias y exportación a DOCX.
3. **Biblioteca de cláusulas sugeridas y redlines inteligentes** (`GET /contratos/clausulas-sugeridas/`, `POST /contratos/redlines/`).
4. **Panel UI** en Next.js que consume los endpoints anteriores, muestra tarjetas de cláusulas y un workspace de redlines.

## 4. Pendientes inmediatos
1. **Resúmenes y highlights de contratos**.
2. **Comparador de versiones / control de cambios avanzado** (más allá del diff actual).
3. **Asistente de onboarding** para captura guiada.
4. **Validación inteligente de datos fiscales**.
5. **Chatbot contextual dentro del dashboard**.
6. **Extracción estructurada desde PDF/XML**.
7. **Scoring de riesgo fiscal**.
8. **Traducción jurídica EN↔ES**.
9. **Mesa de ayuda automática y monitoreo normativo (DOF)**.

Cada entrega debe incluir:
- Endpoint y contrato de API documentado.
- Flujo UI (si aplica) con estados de carga/errores.
- Prompt o reglas IA guardadas en el repositorio.
- Manejo de errores traducidos al usuario.
- Pruebas unitarias con respuestas mockeadas.

## 5. Orden recomendado de implementación
1. Generador de contratos (completo).
2. Citado legal/fiscal automático (listo, seguir enriqueciendo fuentes).
3. Biblioteca de cláusulas sugeridas / redlines inteligentes (ya desplegado, requiere pruebas end-to-end).
4. Resúmenes y highlights (pendiente, priorizar tras validar flujo actual).
5. Comparador, onboarding, validaciones fiscales, chatbot, extracción documental, scoring, traducción, mesa de ayuda (en ese orden aproximado, ajustable según feedback).

## 6. Pruebas pendientes
- **Probar UI de cláusulas y redlines** usando un tenant real (`X-Tenant: proyectog40`) con JWT vigente para confirmar cabeceras.
- Verificar que el frontend envía `Authorization` y `X-Tenant` en ambos endpoints nuevos y que los rate limits se registran en el backend.

## 7. Ingesta de fuentes legales
Para mantener actualizada la base de citas, ejecutar:
```bash
cd /home/gaibarra/materialidad/backend \
  && source .venv/bin/activate \
  && python manage.py ingest_legal_sources \
       --path docs/fuentes/ley_isr \
       --ley "Ley del ISR" \
       --tipo-fuente LEY \
       --vigencia "DOF 12/07/2024" \
       --fuente-url https://www.diputados.gob.mx/LeyesBiblio/pdf/LISR.pdf
```
Documentar cada ingesta (fuente, fecha) en la wiki interna para facilitar auditorías.
