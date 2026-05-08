# Manual de Usuario - Módulo de Ventas (POS)

Bienvenido al manual de uso del **Módulo de Ventas**. Este documento describe todas las funcionalidades, flujos de trabajo y atajos de teclado para operar el punto de venta de manera eficiente.

---

## 1. Funciones Principales

### 🛒 Gestión del Carrito
*   **Búsqueda de Productos**: Puede buscar productos escaneando el código de barras o escribiendo manualmente en el campo superior.
*   **Sugerencias Inteligentes**: Al escribir 2 o más caracteres, aparecerá una lista de productos que coinciden con el nombre o SKU. Use las flechas ↑↓ y `Enter` para seleccionar.
*   **Ajuste de Cantidades**: Puede modificar la cantidad de un producto directamente en la lista del carrito.
*   **Eliminación de Productos**: Quite elementos individuales o vacíe el carrito por completo si es necesario.

### 📦 Unidades de Venta (Pieza / Caja)
*   Si un producto tiene configurada la venta por caja, puede alternar entre **PZA** (Pieza) y **CAJA** presionando un botón o usando el atajo de teclado. El sistema ajustará automáticamente el precio y descontará el stock base correspondiente.

### 🛠️ Empaque Especial
*   **Empaque al Vuelo (F3)**: Permite convertir un producto en un paquete de "N" piezas con un precio especial en ese momento. Ideal para promociones rápidas o ventas a granel.
*   **Empacar Todo (F4)**: Agrupa todos los productos del carrito en un solo "Paquete Personalizado" con un nombre y precio total único.

### 💰 Operaciones de Caja
*   **Producto Común**: Agregue artículos que no están en el inventario especificando una descripción y precio manual.
*   **Entrada de Efectivo**: Registre ingresos de dinero a caja ajenos a las ventas (ej. cambio inicial adicional).
*   **Salida de Efectivo (Gastos)**: Registre retiros de dinero para pagos a proveedores o gastos menores.
*   **Reporte de Sesión (F7)**: Consulte un resumen rápido de las ventas y movimientos de la sesión actual.

### 💳 Proceso de Pago
*   **Pagos Mixtos**: El sistema permite recibir pagos combinados (ej. una parte en efectivo y el resto con tarjeta).
*   **Múltiples Monedas**: Soporte para cobro en Dólares (USD) con cálculo automático según el tipo de cambio configurado.
*   **Facturación**: Opción para emitir factura electrónica (CFDI) al momento de la venta si el cliente lo requiere.
*   **Cálculo de Cambio**: Visualización clara del cambio a entregar al cliente en tiempo real.

---

## 2. Atajos de Teclado (Power User)

Aumente su velocidad de atención utilizando estos atajos desde cualquier parte del módulo (siempre que no esté escribiendo en un cuadro de texto).

### Atajos Globales
| Tecla | Acción |
| :--- | :--- |
| **Enter** | Abrir ventana de pago (si el buscador está vacío) |
| **F2** | Alternar entre Pieza y Caja (último producto añadido) |
| **F3** o **Alt + C** | Abrir modal de "Empaque al Vuelo" |
| **F4** o **+** o **\*** | Abrir modal de "Empacar Todo" (Bulk Pack) |
| **F7** | Ver reporte de la sesión actual |
| **F10** | Recargar la aplicación |
| **F12** o **f** | Abrir ventana de pago |
| **x** | Vaciar el carrito por completo |
| **-** o **Delete** | Quitar el producto seleccionado del carrito |
| **↑ / ↓** | Navegar entre los productos del carrito |
| **→** | Alternar unidad (PZA/CAJA) del producto seleccionado |

### Atajos en Buscador de Productos
| Tecla | Acción |
| :--- | :--- |
| **Enter** | Buscar código / Seleccionar sugerencia marcada |
| **↑ / ↓** | Navegar por la lista de sugerencias de búsqueda |

### Atajos en Ventana de Pago
| Tecla | Acción |
| :--- | :--- |
| **F1** | Seleccionar método: **Efectivo** |
| **F2** | Seleccionar método: **Tarjeta** |
| **F3** | Seleccionar método: **Transferencia** |
| **F4** | Seleccionar método: **Dólares** |
| **Enter** o **+** | Confirmar pago / Finalizar venta |
| **Escape** | Cerrar ventana de pago y volver al carrito |

---

## 3. Consejos para el Cajero

1.  **Foco Automático**: El sistema está diseñado para que siempre pueda escanear. Si pierde el foco, haga clic en cualquier parte del fondo y el cursor regresará al buscador.
2.  **Stock Visual**: Puede cambiar el modo de visualización del stock (Solo piezas, Solo cajas o Mixto) haciendo clic en el indicador de inventario.
3.  **Tickets**: Puede imprimir un comprobante antes de finalizar la venta desde la ventana de pago para que el cliente verifique sus artículos.
4.  **Cierre de Caja**: Al terminar el turno, use el Reporte de Sesión para validar que el efectivo físico coincida con el sistema antes de realizar el corte final.
