# Plan de Mejora: Flujo de Venta de Cajas y Piezas

## 1. Estructura Actual del Flujo

### 1.1 Arquitectura de Datos

| Componente     | Campo               | Propósito                                      |
| -------------- | ------------------- | ---------------------------------------------- |
| **Products**   | `box_units`         | Piezas por caja (ej. 12, 24)                   |
|                | `box_price`         | Precio de caja completa                        |
|                | `box_barcode`       | Código alternativo para buscar caja            |
| **Sale Items** | `unit_sold`         | 'PZA' o 'CAJA'                                 |
|                | `conversion_factor` | Multiplicador (piezas por unidad)              |
|                | `base_quantity`     | Total en piezas (quantity × conversion_factor) |

### 1.2 Flujo Actual (Diagrama Conceptual)

```
Escaneo → Buscar Producto → Agregar al Carrito → Seleccionar Unidad (PZA/CAJA)
    → Verificar Stock (base_quantity) → Procesar Venta (RPC)
    → Descontar Inventario (base_quantity)
```

### 1.3 Archivos Clave a Modificar

| Archivo                                          | Responsabilidad                 |
| ------------------------------------------------ | ------------------------------- |
| `frontend/src/hooks/useCart.js`                  | Lógica del carrito y conversión |
| `frontend/src/components/sales/Sales.jsx`        | UI del punto de venta           |
| `frontend/src/services/salesService.js`          | Comunicación con API            |
| `supabase/migrations/...sian_caja_box_sales.sql` | Schema y RPC                    |
| `backend/services/saleService.js`                | Lógica de ventas (SQLite local) |

---

## 2. Problemas Identificados

### Fase 2.1: Lógica de Negocio

| #     | Problema                                                                                                                                                                                                | Impacto                              |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 2.1.1 | **Conversión inflexible**: Solo permite cambiar entre PZA/CAJA si el producto tiene configuración de caja predefinida. Si un producto no tiene `box_units` configurado, no puede venderse como paquete. | Limitación de flexibilidad comercial |
| 2.1.2 | **Falta de conversión en masa**: No existe funcionalidad para convertir múltiples productos diferentes en una sola venta a formato paquete/box.                                                         | Proceso manual lento                 |
| 2.1.3 | **Mezcla de inventario visually unclear**: El usuario no puede ver de forma clara cuántas piezas individuales conforman su carrito vs cuántas cajas.                                                    | Errores de selección                 |
| 2.1.4 | **Sin precio unitario para cajas parciales**: No existe forma de vender "media caja" o cantidad decimal de cajas.                                                                                       | Pérdida de ventas                    |
| 2.1.5 | **Lógica de validación dispersa**: La validación de stock existe en múltiples lugares (frontend useCart, backend, RPC) inconsistente.                                                                   | Bugs potenciales                     |

### Fase 2.2: Experiencia de Usuario

| #     | Problema                                                                                                                         | Impacto                          |
| ----- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 2.2.1 | **Toggle confuso**: El cambio de PZA a CAJA es un toggle que no muestra claramente cuál es el precio/pieza resultanted.          | Confusión en cajas registradoras |
| 2.2.2 | **Sin atajos de teclado para conversión**: No existen atajos rápidos (F2, F3, etc.) para cambiar entre piezas y cajas.           | Velocidad reducida               |
| 2.2.3 | **Información de stock poco clara**: El usuario ve el stock total pero no cuántas piezas o cajas disponibles independientemente. | No sabe cuánto puede vender      |
| 2.2.4 | **Modal de empaque al vuelo poco visible**: La funcionalidad de crear paquetes custom está oculta en un submenú.                 | Desconocimiento de la función    |

### Fase 2.3: Reportes y Análisis

| #     | Problema                                                                                                    | Impacto                         |
| ----- | ----------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 2.3.1 | **Sin reportes de ventas por unidad**: No existen reportes que discriminen ventas PZA vs CAJA.              | No se pueden analizar ventas    |
| 2.3.2 | **Sin historial de conversiones**: No se registra cuando se hizo una conversión manual.                     | Trazabilidad limitada           |
| 2.3.3 | **KPI de conversión no disponible**: No hay forma de medir cuántos productos se vendieron en caja vs pieza. | Decisiones de negocio limitadas |

---

## 3. Plan de Mejora Propuesto

### Fase 1: Foundation - Mejoras de Lógica Core

**Objetivo**: Establecer la base para conversiones flexibles y robustas.

#### 1.1 Refactorizar normalizeCartItem y lógica de conversión

**Ubicación**: `frontend/src/hooks/useCart.js`

| Cambio                                                | Descripción                                                                        |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Extraer función `getConversionInfo(producto, unidad)` | Centralizar calculo de conversion_factor, price, display string                    |
| Agregar soporte para conversión dinámica              | Si `box_units` no existe, permitir especificar piezas por caja en momento de venta |
| Validación única de stock                             | Crear función `validateStock(item, qty, allowNegative)` usada en un solo lugar     |

```javascript
// Pseudocódigo - Estructura objetivo
const getConversionInfo = (producto, unidad, customPiezas = null) => {
  const configurado = producto.box_units > 0;
  const piezas = customPiezas || producto.box_units || 1;
  const unitSold =
    (configurado || customPiezas) && unidad === "CAJA" ? "CAJA" : "PZA";
  const price = unitSold === "CAJA" ? producto.box_price : producto.price;
  const multiplier = unitSold === "CAJA" ? piezas : 1;

  return { unitSold, piecesPerUnit: piezas, price, multiplier };
};
```

#### 1.2 Modificar función cambiarUnidadVenta

**Cambios requeridos**:

- Permitir cambio a CAJA aunque no tenga `box_units` configurado (usando valor predeterminado del usuario o 1)
- Agregar parámetro opcional `customPiezas` para crear caja custom
- Integrar con la función de validación de stock única

#### 1.3 Agregar endpoint RPC para validar stock pré-transacción

**Nueva función en migrations**:

```sql
create or replace function public.validate_sale_stock(
    p_items jsonb
)
returns jsonb
language plpgsql
as $$
-- Validar stock disponible para todos los items antes de procesar
-- Return: { valid: boolean, items: [{product_id, available, requested}] }
```

---

### Fase 2: UX Improvements - Interfaz y Flujo Visual

**Objetivo**: Mejorar la claridad y velocidad de la interfaz.

#### 2.1 Enhanced Cart Item Display

**Ubicación**: `frontend/src/components/sales/Sales.jsx` (Cart render section)

| Elemento              | Descripción                                                                   |
| --------------------- | ----------------------------------------------------------------------------- |
| Badge de unidad       | Mostrar "PZA" o "CAJA" con color distintivo (azul para PZA, morado para CAJA) |
| Breakdown de piezas   | En formato "2 cajas × 12 pzs = 24 piezas"                                     |
| Stock info optimizada | "Stock: 48 pzs (4 cajas)" o "Stock: 5 pzs"                                    |
| Quick toggle          | Botones [-] [PZA] [CAJA] [+] en cada línea                                    |

#### 2.2 Shortcuts de Teclado

| Atajo | Acción                                      |
| ----- | ------------------------------------------- |
| F2    | Cambiar unidad del item activa (PZA ↔ CAJA) |
| F3    | Abrir modal de empaque al vuelo             |
| F4    | Convertir todo el carrito a pacote          |

#### 2.3 Stock Display Mode Toggle

Agregar preferencia de usuario para mostrar stock en:

- Modo piezas (default actual)
- Modo mixto: "48 pzs (4 cajas)"
- Modo cajas: solo mostrar cajas disponibles

#### 2.4 Enhanced Empaque Modal

**Mejoras al modal actual** (líneas 2621-2690 en Sales.jsx):

- Seleccionar preset de piezas (6, 12, 24, CUSTOM)
- Calcular automáticamente precio sugerido (box_price / box_units × piezas)
- Guardar como preset para futuras ventas

---

### Fase 3: Workflow Enhancement - Procesos de Negocio

#### 3.1 Conversión en Masa (Bulk Pack)

**Nueva funcionalidad**: Convertir todos los items del carrito en un solo "Paquete Custom".

**Caso de uso**: Cliente compra 10 items diferentes, quiere una caja promocional.

**Flujo propuesto**:

1. Usuario presiona F4 o botón "Empacar Todo"
2. Modal pregunta: nombre del paquete (default: "PAQUETE + fecha")
3. Mostrar lista de items incluidos con cantidades
4. Opción de aplicar descuento % al total
5. Generar item único en carrito con `is_package: true`

**Archivos a modificar**:

- `frontend/src/hooks/useCart.js` → `convertirCarritoAPaquete()`
- `frontend/src/components/sales/Sales.jsx` → enhanced modal

#### 3.2 Venta de Cajas Parciales (Fraccional)

**Nueva funcionalidad**: Permitir cantidad decimal de cajas (ej. 2.5 cajas = 30 piezas).

**Cambios requeridos**:

- Modificar validación en `useCart.js` para permitir quantities decimales cuando `unit_sold === 'CAJA'`
- Actualizar display: "2.5 cajas (30 pzs)"
- Ajustar lógica de inventario (base_quantity puede ser decimal)

#### 3.3 Pre-configuración de Empaques Frecuentes

**Nueva funcionalidad**: Guardar empaques custom como presets.

**Schema requerido**:

```sql
create table product_pack_presets (
    id bigint generated by default as identity primary key,
    user_id uuid references auth.users,
    name text not null,
    product_id bigint references products,
    piezas integer not null,
    price numeric,
    created_at timestamptz default now()
);
```

**UI**: En inventario, opción "Crear Preset" al configurar box_units.

---

### Fase 4: Reporting - Análisis y Métricas

#### 4.1 Dashboard de Conversión

**Nueva vista en dashboard**: Gráfico de tendencia PZA vs CAJA.

| Métrica              | Descripción                                 |
| -------------------- | ------------------------------------------- |
| % Ventas en Caja     | Porcentaje de ventas que incluyen CAJA      |
| Revenue Mix          | Ingreso por PZA vs CAJA                     |
| Top Products en Caja | Productos que más se venden en formato caja |

#### 4.2 Reporte Detallado de Ventas

**Modificar reporte existente** (`frontend/src/components/reports/SalesReport.jsx`):

| Columna nueva     | Descripción         |
| ----------------- | ------------------- |
| Unidad            | PZA/CAJA/Paquete    |
| Conversion Factor | Piezas por unidad   |
| Piezas Vendidas   | base_quantity total |
| Revenue Unitario  | price por pieza     |

#### 4.3 Bitácora de Conversiones

**Nueva tabla para auditoría**:

```sql
create table sale_conversions (
    id bigint generated by default as identity primary key,
    sale_id bigint references sales,
    product_id bigint,
    from_unit text, -- 'PZA' o 'CAJA'
    to_unit text,
    conversion_factor integer,
    created_at timestamptz default now()
);
```

---

## 4. Roadmap de Implementación

```
Fase 1 (Foundation):          Semana 1-2
├── 1.1 Refactor useCart
├── 1.2 RPC validation stock
└── 1.3 Tests unitarios

Fase 2 (UX):                Semana 3-4
├── 2.1 Enhanced cart display
├── 2.2 Keyboard shortcuts
└── 2.3 Stock mode toggle

Fase 3 (Workflow):          Semana 5-6
├── 3.1 Bulk pack conversion
├── 3.2 Fraccional sales
└── 3.3 Pack presets

Fase 4 (Reporting):         Semana 7
├── 4.1 Conversion dashboard
├── 4.2 Enhanced reports
└── 4.3 Audit logs
```

---

## 5. Archivos a Modificar Resumidos

| Prioridad | Archivo                                   | Cambios Principales                                 |
| --------- | ----------------------------------------- | --------------------------------------------------- |
| **P1**    | `frontend/src/hooks/useCart.js`           | Refactor normalizeCartItem, validación centralizada |
| **P1**    | `supabase/migrations/...sql`              | Agregar RPC validate_stock                          |
| **P2**    | `frontend/src/components/sales/Sales.jsx` | Enhanced UI, shortcuts, modals better               |
| **P2**    | `frontend/src/services/salesService.js`   | Agregar llamada a validate_stock préventa           |
| **P3**    | Nueva tabla                               | `product_pack_presets` + CRUD                       |
| **P3**    | `frontend/src/components/reports/*.jsx`   | Nuevos reportes                                     |
| **P4**    | Nueva tabla                               | `sale_conversions` audit log                        |

---

## 6. Preguntas para el Usuario

1. **¿Prioridad de cambios?** ¿Comenzamos por la Fase 1 (Foundation) para tener una base más sólida, o prefieres atacar primero las mejoras visuales de la Fase 2? R= inicia con Fase 1

2. **¿Venta fraccional es necesaria?** El soporte para "2.5 cajas" (cantidad decimal) requiere cambios significativos en validaciones. ¿Es feature necesario para tu operación? R= No es necesaria la venta fraccional

3. **¿Reportes específicos?** ¿Hay algún reporte o métrica en particular que falte y sea crítico para tu negocio? R= reportes de caja

4. **¿Atajos de teclado?** ¿Quieres que agreguemos los atajos F2/F3/F4 propuestos, o prefieres otras teclas? R= que funcionen los atajos y que sean los correctos para ventas rápidas

---

## 7. Notas de la Revisión

- Este plan fue generado el 7 de mayo de 2026.
- El código base actual permite venta por piezas (PZA) y cajas (CAJA) con conversión de inventario basada en `base_quantity`.
- La funcionalidad de "empaque al vuelo" ya existe pero está oculta y poco visible.
- El sistema soporta tanto Supabase (cloud) como SQLite (local).
