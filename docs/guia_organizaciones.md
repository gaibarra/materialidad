# Guía Rápida: Administración de Organizaciones

## 🎯 Objetivo

Como **superusuario**, ahora puedes administrar de forma integral la creación y gestión de **Despachos Contables** y **Grupos Corporativos**, cada uno con sus respectivos tenants (clientes o empresas).

---

## 📍 Acceso

**URL:** `/dashboard/admin/organizaciones`

**Requisito:** Debes ser superusuario (el link solo aparece en el sidebar si tienes este permiso)

---

## 🏢 Tipos de Organización

### 1. **Despacho Contable**
- Los **tenants son los clientes** del despacho
- Cada cliente tiene su base de datos aislada
- Enfoque en servicios contables independientes
- No requiere gestión de transacciones intercompañía

**Ejemplo:** Un despacho que atiende a 20 PyMEs diferentes

### 2. **Grupo Corporativo**
- Los **tenants son las empresas** que conforman el grupo
- Gestión de múltiples empresas bajo el mismo paraguas corporativo
- **Monitoreo de transacciones intercompañía** (préstamos, servicios, etc.)
- Documentación rigurosa para cumplir con SAT 2026

**Ejemplo:** Un corporativo con 5 empresas (matriz, subsidiarias) que se hacen préstamos entre sí

---

## 🚀 Flujo de Uso

### Paso 1: Crear una Organización

1. Accede a **"Organizaciones"** en el sidebar
2. Haz clic en **"+ Nueva Organización"**
3. Completa el formulario:
   - **Nombre:** Identificador de la organización
   - **Tipo:** Despacho o Corporativo
   - **Email de Contacto:** Email principal
   - **Teléfono:** Opcional
   - **Notas:** Información adicional
4. Haz clic en **"Crear"**

### Paso 2: Ver Detalles y Tenants

1. En la lista, haz clic en el ícono de **ojo (👁️)** o en el nombre
2. Verás:
   - **Cards de información:** Total tenants, contacto, fecha de creación
   - **Tab "Tenants":** Lista de todos los tenants asociados
   - **Tab "Transacciones Intercompañía":** (Solo para corporativos)

### Paso 3: Agregar Tenants

1. Desde la página de detalle, tab "Tenants"
2. Haz clic en **"+ Nuevo Tenant"**
3. Se redirige al flujo de creación de tenant asociado a esa organización

### Paso 4: Monitorear Transacciones Intercompañía (Solo Corporativos)

1. Desde la página de detalle, tab "Transacciones Intercompañía"
2. Verás un alert informativo sobre requisitos fiscales 2026
3. Haz clic en **"+ Nueva Transacción"** para registrar:
   - Préstamos entre empresas del grupo
   - Prestación de servicios
   - Ventas de bienes
   - Regalías
   - Arrendamientos

---

## ⚠️ Diferencias Críticas: Despacho vs Corporativo

| Característica | Despacho | Corporativo |
|----------------|----------|-------------|
| **Tenants** | Clientes externos | Empresas del grupo |
| **Relación** | Servicios contables | Estructura corporativa |
| **Transacciones Intercompañía** | ❌ No aplica | ✅ Crítico |
| **Transfer Pricing** | ❌ No requiere | ✅ Obligatorio |
| **Razón de Negocio** | Normal | **Reforzada** |
| **Documentación** | Estándar | **Rigurosa** |

---

## 🔴 Importante: Transacciones Intercompañía 2026

Los **préstamos y transacciones entre empresas del mismo grupo** son áreas de alto escrutinio del SAT en 2026. Debes documentar:

### ✅ Requisitos Obligatorios:

1. **Contrato con fecha cierta**
   - Protocolizado ante notario o inscrito en registro público
   - Fecha anterior a la transacción

2. **Razón de Negocios Clara (Art. 5-A CFF)**
   - Beneficio económico \> beneficio fiscal
   - Justificación del beneficio al grupo corporativo
   - No operaciones circulares sin sustancia

3. **Tasas y Condiciones de Mercado**
   - Intereses a valor "arm's length"
   - Comparables con terceros independientes
   - Estudio de precios de transferencia cuando aplique

4. **Documentación Completa**
   - Expediente de la transacción
   - Estados de cuenta de ambas empresas
   - Comprobantes de pago (SPEI)
   - Minutas o actas que justifiquen la necesidad

5. **Alertas de Riesgo**
   - Préstamos vencidos sin plan de pago
   - Tasas de interés 0% o fuera de mercado
   - Operaciones sin beneficio claro al grupo
   - Falta de estudio de precios de transferencia

---

## 🎨 Componentes de la UI

### Dashboard Principal
- **Cards de métricas:** Total Despachos, Corporativos, Tenants
- **Búsqueda:** Filtrado en tiempo real
- **Filtros:** Por tipo de organización
- **Tabla:** Lista completa con acciones

### Página de Detalle
- **Header:** Nombre, tipo, botón de edición
- **Info Cards:** Métricas clave
- **Tabs:**
  - Tenants asociados
  - Transacciones intercompañía (corporativos)

### Modal de Creación/Edición
- Formulario completo
- Validación en tiempo real
- Ayuda contextual según tipo seleccionado

---

## 🔧 Funcionalidades Disponibles

### Operaciones CRUD
- ✅ **Crear** nueva organización
- ✅ **Leer** lista y detalle
- ✅ **Actualizar** información
- ✅ **Eliminar** organización (con confirmación)

### Vistas Especiales
- ✅ **Estadísticas** por organización
- ✅ **Lista de tenants** asociados
- ✅ **Monitor de transacciones** (corporativos)

### Filtros y Búsqueda
- ✅ Búsqueda por nombre o email
- ✅ Filtro por tipo
- ✅ Ordenamiento por fecha de creación

---

## 📊 Próximas Funcionalidades (En Desarrollo)

1. **Panel Completo de Transacciones Intercompañía**
   - CRUD de transacciones
   - Timeline de pagos
   - Alertas automáticas de vencimiento
   - Cálculo de intereses

2. **Dashboard de Riesgos Fiscales**
   - Transacciones sin documentación
   - Préstamos vencidos
   - Tasas fuera de mercado
   - Falta de estudios transfer pricing

3. **Generación Automática de Contratos**
   - Templates para préstamos intercompañía
   - Inclusión automática de razón de negocio
   - Checklist de fecha cierta

4. **Reportes Consolidados**
   - Por corporativo
   - Flujos entre empresas
   - Saldos pendientes
   - Alertas agregadas

---

## 🛠️ Comandos Útiles

### Backend - Crear Migraciones
```bash
cd backend
source .venv/bin/activate
python3 manage.py makemigrations
python3 manage.py migrate
```

### Frontend - Instalar Dependencias
```bash
cd frontend
npm install
```

### Frontend - Ejecutar en Desarrollo
```bash
cd frontend
npm run dev
```

---

## 💡 Tips y Mejores Prácticas

### Al Crear Despachos:
- Usa nombres descriptivos (ej: "Despacho ABC Contadores")
- Agrega email y teléfono de contacto para referencia
- En notas, menciona el número de clientes esperado

### Al Crear Corporativos:
- Nombra según el grupo (ej: "Grupo XYZ Holdings")
- Documenta la estructura del grupo en notas
- Lista las empresas principales que lo conforman

### Al Registrar Transacciones Intercompañía:
- Registra ANTES de ejecutar la transacción
- Asegura tener contrato firmado con fecha cierta
- Verifica que la tasa de interés sea de mercado
- Documenta claramente la razón de negocio
- Adjunta estudio de precios de transferencia si aplica

---

## 🆘 Soporte y Ayuda

### En caso de dudas:
1. Revisa el archivo `/docs/implementacion_organizaciones.md`
2. Consulta la documentación general en `/README.md`
3. Contacta al equipo de desarrollo

### Errores comunes:
- **"Ya existe un despacho con este nombre":** Usa un nombre único
- **"Error al cargar organizaciones":** Verifica que seas superusuario
- **"No se encontraron organizaciones":** Crea la primera con el botón "+"

---

¡Listo! Ahora tienes control total sobre la creación y administración de **Despachos y Corporativos** desde una interfaz moderna y profesional. 🚀
