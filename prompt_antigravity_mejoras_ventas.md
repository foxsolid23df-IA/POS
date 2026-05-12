# Prompt para Google Antigravity - Mejoras Frontend en Ventas

## Contexto del Proyecto
Estás trabajando en un sistema POS (Punto de Venta) React con la siguiente estructura:
- **CartSidebar.jsx**: Componente del resumen de venta (sidebar derecho)
- **Sales.jsx**: Componente principal de ventas (~2710 líneas)
- **ProductGrid.jsx**: Grid de productos con tarjetas
- **useCart.js**: Hook personalizado para manejar el carrito
- **Stats.jsx**: Dashboard de estadísticas de ventas
- **Modal.jsx**: Componente genérico de modales

## Tarea
Implementa las siguientes mejoras UX/UI y funcionalidades avanzadas en el módulo de ventas:

---

## 1. MEJORAS EN CARTSIDEBAR.JSX (Resumen de Venta)

### A. Animaciones Suaves al Agregar/Eliminar Productos
```javascript
// Implementar transiciones CSS y FLIP animations
- Agregar clase CSS 'cart-item-enter' y 'cart-item-exit' con transiciones
- Usar CSS keyframes para animación de entrada (fade-in + slide-from-right)
- Usar CSS keyframes para animación de salida (fade-out + slide-to-left)
- Duración: 300ms con easing 'cubic-bezier(0.4, 0, 0.2, 1)'
- Agregar efecto de escala temporal (scale 0.95 a 1) al agregar
```

### B. Notificación Toast por Stock Bajo
```javascript
// Crear componente ToastNotification.jsx en components/common/
- Mostrar toast cuando producto tiene stock <= 5 unidades al agregarlo
- Posición: top-right de la pantalla
- Duración: 4 segundos con auto-dismiss
- Tipos: 'warning' (ámbar) para stock bajo, 'error' (rojo) para sin stock
- Incluir ícono de material symbols y mensaje claro
- Permitir múltiples toasts apilados verticalmente
- Animación de entrada: slide-from-top con fade
- Integrar en useCart.js después de validar stock en agregarProducto()
```

### C. Mini Gráfico de Tendencia de Ventas del Operador
```javascript
// En CartSidebar.jsx, debajo del estado del operador
- Crear mini sparkline chart usando SVG inline
- Mostrar ventas de las últimas 6 horas de la sesión actual
- Datos: array de montos por hora [1200, 1500, 800, 2100, 1700, 900]
- Línea de tendencia con gradiente azul-verde
- Tooltip al hover mostrando monto de esa hora
- Altura: 60px, ancho: 100% del sidebar
- Si no hay datos, mostrar mensaje "Sin ventas aún"
```

### D. Información Adicional en Header
```javascript
// Mejorar cart-sidebar-header
- Mostrar número de items únicos vs total de piezas: "5 productos, 12 piezas"
- Agregar badge de método de pago seleccionado (después de abrir modal de pago)
- Indicador visual de sesión activa: círculo verde parpadeante junto al nombre
```

---

## 2. MEJORAS EN TABLA DE PRODUCTOS DEL CARRITO (En Sales.jsx)

### A. Vista de Columnas Personalizable
```javascript
// Crear componente ColumnPicker.jsx
- Botón "Columnas" con ícono de view_column en header de tabla
- Modal dropdown con checkboxes para cada columna disponible:
  * Producto (siempre visible)
  * Precio Unitario
  * Cantidad
  * Subtotal
  * Descuento
  * Stock Disponible
  * Impuestos
- Guardar preferencia en localStorage como 'cart-column-visibility'
- Aplicar clases CSS condicionales para mostrar/ocultar columnas
- Animación suave al cambiar visibilidad (width transition)
```

### B. Redimensionamiento de Columnas Arrastrando Bordes
```javascript
// Implementar resizable columns
- Agregar handle de 4px de ancho en borde derecho de cada th
- Cursor 'col-resize' al hover sobre handle
- Usar mouse events (mousedown, mousemove, mouseup) para drag
- Guardar anchos en localStorage como 'cart-column-widths'
- Ancho mínimo por columna: 80px, máximo: 400px
- Actualizar en tiempo real mientras se arrastra
- Usar CSS variable --column-width para cada columna
```

### C. Búsqueda/Filtrado Dentro de la Tabla del Carrito
```javascript
// Agregar input de búsqueda encima de la tabla del carrito
- Placeholder: "Filtrar productos en carrito..."
- Filtrar en tiempo real por nombre, código de barras, categoría
- Ícono de search dentro del input
- Botón X para limpiar filtro rápidamente
- Contador de resultados: "3 de 15 productos"
- Resaltar texto coincidente con <mark> tag
- Si no hay resultados, mostrar mensaje amigable con ícono
```

### D. Edición Rápida Inline de Cantidad y Precio
```javascript
// Reemplazar botones +/- con inputs editables inline
- Al hacer click en cantidad o precio, convertir a input numérico
- Auto-focus y select-all del texto al activar edición
- Guardar al presionar Enter o perder foco (onBlur)
- Cancelar con Escape (revertir al valor original)
- Validación en tiempo real: solo números positivos
- Indicador visual de celda editable: border-bottom punteado
- Hover effect: background ligeramente más oscuro
- Agregar botón pequeño de "edit" al lado del valor
```

### E. Drag & Drop para Reordenar Productos
```javascript
// Implementar react-beautiful-dnd o dnd-kit
- Handle de arrastre (ícono drag_handle) al inicio de cada fila
- Cursor 'grabbing' durante el arrastre
- Placeholder visual donde se soltará el item
- Animación suave de reordenamiento
- Actualizar orden del array carrito onDrop
- Guardar orden preferido temporalmente (no persistir)
- Deshabilitar durante edición inline
```

### F. Agrupación Visual de Productos Empaquetados vs Individuales
```javascript
// Diferenciación visual en tabla
- Badge "[CAJA]" o "[PZA]" prominente junto al nombre
- Color de fondo diferente para filas empaquetadas (azul muy claro)
- Ícono de package_2 para cajas, inventory_2 para piezas
- Border izquierdo de 4px: azul para cajas, verde para piezas
- Tooltip explicando diferencia al hover sobre badge
- Opción de colapsar/expandir grupos si hay múltiples del mismo tipo
```

### G. Calculadora Rápida Integrada
```javascript
// Mini calculadora en celdas de cantidad/precio
- Al hacer doble click en celda, mostrar popup de calculadora
- Operaciones básicas: +, -, *, /
- Soporte para expresiones: "10*5", "100/2", "50+25"
- Evaluar expresión y reemplazar valor
- Cerrar con Enter o click fuera
- Historial de últimas 3 operaciones en tooltip
- Atajo de teclado: Ctrl+Shift+C para abrir calculadora
```

---

## 3. MEJORAS TÉCNICAS ESPECÍFICAS

### En useCart.js:
```javascript
// Agregar historial de acciones para deshacer
const [cartHistory, setCartHistory] = useState([]);
const [historyIndex, setHistoryIndex] = useState(-1);

// Guardar snapshot antes de cada cambio
const saveToHistory = (newCart) => {
  const newHistory = cartHistory.slice(0, historyIndex + 1);
  newHistory.push(JSON.parse(JSON.stringify(newCart)));
  if (newHistory.length > 20) newHistory.shift(); // Máximo 20 estados
  setCartHistory(newHistory);
  setHistoryIndex(newHistory.length - 1);
};

// Función deshacer
const undoLastAction = () => {
  if (historyIndex > 0) {
    setCarrito(cartHistory[historyIndex - 1]);
    setHistoryIndex(historyIndex - 1);
  }
};

// Exportar undoLastAction en el return
```

### En Sales.jsx:
```javascript
// Agregar listener para Ctrl+Z
useEffect(() => {
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      undoLastAction();
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [undoLastAction]);

// Auto-guardado del carrito cada 30 segundos
useEffect(() => {
  const interval = setInterval(() => {
    if (carrito.length > 0) {
      localStorage.setItem('cart-autosave', JSON.stringify({
        carrito,
        timestamp: Date.now()
      }));
    }
  }, 30000);
  return () => clearInterval(interval);
}, [carrito]);

// Recuperar carrito al montar componente
useEffect(() => {
  const saved = localStorage.getItem('cart-autosave');
  if (saved) {
    const { carrito: savedCart, timestamp } = JSON.parse(saved);
    if (Date.now() - timestamp < 3600000) { // 1 hora máximo
      // Ofrecer recuperar con modal de confirmación
    }
  }
}, []);
```

### Nuevos Componentes a Crear:

1. **ToastNotification.jsx** en components/common/
```jsx
- Props: message, type ('success'|'warning'|'error'|'info'), duration, onClose
- Usar createRoot o portal para renderizar fuera del DOM normal
- Animaciones de entrada/salida
- Múltiples instancias apilables
```

2. **ColumnPicker.jsx** en components/sales/
```jsx
- Dropdown con checkboxes
- Guardar en localStorage
- Emitir evento de cambio de columnas visibles
```

3. **SparklineChart.jsx** en components/common/
```jsx
- SVG inline para mini gráfico
- Props: data (array), color, height, width
- Tooltip con valores
```

4. **InlineCalculator.jsx** en components/common/
```jsx
- Popup modal pequeño
- Input para expresiones matemáticas
- Botones de operaciones rápidas
```

---

## 4. ESTILOS CSS A AGREGAR (en Sales.css)

```css
/* Animaciones de carrito */
.cart-item-enter {
  animation: slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.cart-item-exit {
  animation: slideOutLeft 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideInRight {
  from { opacity: 0; transform: translateX(30px) scale(0.95); }
  to { opacity: 1; transform: translateX(0) scale(1); }
}

@keyframes slideOutLeft {
  from { opacity: 1; transform: translateX(0); }
  to { opacity: 0; transform: translateX(-30px) scale(0.95); }
}

/* Toast Notifications */
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.toast {
  min-width: 300px;
  padding: 16px 20px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  display: flex;
  align-items: center;
  gap: 12px;
  animation: slideInTop 0.3s ease-out;
  backdrop-filter: blur(8px);
}

.toast.warning { background: rgba(251, 191, 36, 0.95); color: #1f2937; }
.toast.error { background: rgba(239, 68, 68, 0.95); color: white; }
.toast.success { background: rgba(34, 197, 94, 0.95); color: white; }

@keyframes slideInTop {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Columnas redimensionables */
.resizable-column {
  position: relative;
}

.resizable-handle {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  cursor: col-resize;
  background: transparent;
  transition: background 0.2s;
}

.resizable-handle:hover {
  background: #3b82f6;
}

/* Edición inline */
.inline-editable {
  border-bottom: 1px dashed #cbd5e1;
  cursor: pointer;
  transition: background 0.2s;
}

.inline-editable:hover {
  background: #f1f5f9;
}

.inline-edit-input {
  width: 100%;
  border: 2px solid #3b82f6;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: inherit;
}

/* Drag and drop */
.draggable-row {
  cursor: grab;
}

.draggable-row:active {
  cursor: grabbing;
}

.drag-placeholder {
  background: #e0f2fe;
  border: 2px dashed #3b82f6;
  border-radius: 8px;
}

/* Sparkline chart */
.sparkline-container {
  margin-top: 12px;
  padding: 8px;
  background: #f8fafc;
  border-radius: 6px;
}

.sparkline-svg {
  width: 100%;
  height: 60px;
}

.sparkline-path {
  fill: none;
  stroke: #10b981;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.sparkline-gradient {
  stop-color: #10b981;
  stop-opacity: 0.2;
}

/* Badges de unidad */
.unit-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.unit-badge.caja {
  background: #dbeafe;
  color: #1e40af;
}

.unit-badge.pza {
  background: #dcfce7;
  color: #166534;
}

/* Calculadora inline */
.inline-calculator {
  position: absolute;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.15);
  padding: 12px;
  z-index: 1000;
}

.calc-display {
  width: 100%;
  padding: 8px;
  font-size: 1.25rem;
  text-align: right;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  margin-bottom: 8px;
}

.calc-buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}

.calc-btn {
  padding: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  background: #f8fafc;
  cursor: pointer;
  transition: background 0.2s;
}

.calc-btn:hover {
  background: #e0f2fe;
}

.calc-btn.operator {
  background: #eff6ff;
  color: #2563eb;
  font-weight: 600;
}

.calc-btn.equal {
  background: #2563eb;
  color: white;
  grid-column: span 2;
}
```

---

## 5. CRITERIOS DE ACEPTACIÓN

### Funcionales:
- [ ] Las animaciones de agregar/eliminar son suaves (60 FPS)
- [ ] Toast notifica correctamente cuando stock <= 5
- [ ] Mini gráfico muestra datos reales de ventas por hora
- [ ] Se pueden mostrar/ocultar columnas individualmente
- [ ] Las columnas se redimensionan arrastrando bordes
- [ ] El filtro de tabla funciona en tiempo real
- [ ] La edición inline guarda cambios correctamente
- [ ] Drag & drop reordena productos sin errores
- [ ] Los badges de unidad son claramente visibles
- [ ] La calculadora evalúa expresiones correctamente
- [ ] Ctrl+Z deshace la última acción del carrito
- [ ] Auto-guardado funciona cada 30 segundos

### No Funcionales:
- [ ] Todo el código sigue estándares ESLint del proyecto
- [ ] No hay console.log en producción
- [ ] Las preferencias se guardan en localStorage
- [ ] Responsive design se mantiene en tablets
- [ ] Accesibilidad: labels ARIA donde corresponde
- [ ] Performance: sin memory leaks, cleanup en useEffect

### UI/UX:
- [ ] Coherencia con diseño existente (colores, tipografía)
- [ ] Transiciones suaves en todos los elementos interactivos
- [ ] Feedback visual claro para cada acción
- [ ] Tooltips explicativos en elementos nuevos
- [ ] Iconografía consistente con Material Symbols

---

## 6. ARCHIVOS A MODIFICAR

1. `/workspace/frontend/src/components/sales/CartSidebar.jsx` - Mejorar UI y agregar gráfico
2. `/workspace/frontend/src/components/sales/Sales.jsx` - Tabla del carrito con todas las mejoras
3. `/workspace/frontend/src/hooks/useCart.js` - Agregar historial para deshacer
4. `/workspace/frontend/src/components/sales/Sales.css` - Nuevos estilos
5. **NUEVOS**: 
   - `/workspace/frontend/src/components/common/ToastNotification.jsx`
   - `/workspace/frontend/src/components/sales/ColumnPicker.jsx`
   - `/workspace/frontend/src/components/common/SparklineChart.jsx`
   - `/workspace/frontend/src/components/common/InlineCalculator.jsx`

---

## 7. NOTAS ADICIONALES

- Mantener compatibilidad con modo oscuro existente
- Usar las funciones utilitarias existentes (formatearDinero, etc.)
- Integrar con el sistema de autenticación actual (user context)
- Considerar performance con carritos grandes (>50 items)
- Probar en Chrome, Firefox, Safari y Edge
- Verificar funcionamiento en dispositivos táctiles

## Instrucciones de Implementación

1. **Primero**: Crear componentes nuevos (Toast, Sparkline, ColumnPicker, Calculator)
2. **Segundo**: Modificar useCart.js para agregar historial y validación de stock mejorada
3. **Tercero**: Actualizar CartSidebar.jsx con animaciones y gráfico
4. **Cuarto**: Implementar mejoras de tabla en Sales.jsx
5. **Quinto**: Agregar todos los estilos CSS
6. **Sexto**: Pruebas integrales de cada funcionalidad
7. **Séptimo**: Limpieza de código y optimización

---

**Importante**: Generar todo el código completo y funcional, listo para producción. No dejar placeholders ni comentarios TODO. Incluir manejo de errores apropiado y validaciones.
