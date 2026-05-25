# Refinamiento Estético y de Medidas de Punto de Venta (POS)

## Goal
Ajustar visualmente los contenedores "padres" e "hijos" del POS (sidebar, cabecera, buscador, botones de acción rápida, listado y panel de resumen) para lograr una consistencia perfecta en tamaños, espaciados y contraste tanto en modo claro como oscuro, basándose exactamente en el diseño de la imagen de referencia.

## Tasks
- [ ] Tarea 1: Corregir el fondo del Sidebar y cabecera en modo oscuro en [Sidebar.jsx](file:///c:/POS/frontend/src/components/sidebar/Sidebar.jsx) eliminando los estilos en línea `style={{ backgroundColor: '#ffffff' }}` que sobrescriben la clase `dark:bg-slate-900`. → Verificar: Cambiar a modo oscuro en la aplicación y ver que el fondo del sidebar sea oscuro en lugar de blanco.
- [ ] Tarea 2: Rediseñar el switch de "Modo Oscuro" en el sidebar en [Sidebar.jsx](file:///c:/POS/frontend/src/components/sidebar/Sidebar.jsx) para cambiar de color al estar activo y ajustar sus dimensiones. → Verificar: El switch debe verse azul brillante en modo oscuro y gris en modo claro, con el círculo trasladado a la derecha.
- [ ] Tarea 3: Modificar [QuickActions.jsx](file:///c:/POS/frontend/src/components/sales/QuickActions.jsx) para estandarizar los botones "Cámara" y "Escáner BT", reemplazando los emojis por iconos de Material Symbols y aplicando clases CSS uniformes. → Verificar: Los 5 botones de acción rápida deben tener la misma altura, bordes redondeados y estilo visual.
- [ ] Tarea 4: Corregir el ancho de la barra de búsqueda en [Sales.css](file:///c:/POS/frontend/src/components/sales/Sales.css) (cambiar `width: 50%` a `width: 100%` en `.search-input-full`) e integrar iconos correctos y textos en mayúsculas en [SearchSection.jsx](file:///c:/POS/frontend/src/components/sales/SearchSection.jsx). → Verificar: El buscador debe expandirse a lo largo del panel central, con un icono de lupa Material y un botón de calculadora a la derecha, y las etiquetas de atajo deben decir `F2 VARIOS`, `F4 EMPACAR` y `F12 COBRAR`.
- [ ] Tarea 5: Agregar en [CartSidebar.jsx](file:///c:/POS/frontend/src/components/sales/CartSidebar.jsx) la rejilla de 4 tarjetas de datos (Cliente, Vendedor, Piezas, Método) justo debajo de la tarjeta del operador. → Verificar: Cuando el carrito tenga productos, se debe mostrar la cuadrícula con las 4 tarjetas (Cliente: Público General, Vendedor, Piezas, Método) con sus iconos respectivos.
- [ ] Tarea 6: Añadir clases CSS responsivas y estilos adaptables para modo claro y oscuro a la nueva rejilla de tarjetas en [Sales.css](file:///c:/POS/frontend/src/components/sales/Sales.css). → Verificar: Las tarjetas deben tener un fondo y bordes oscuros en modo oscuro (`bg-slate-800`, `border-slate-700`) y claros en modo claro (`bg-slate-50`, `border-slate-200`).

## Done When
- [ ] El sidebar y el encabezado cambian a fondo oscuro en modo oscuro de manera fluida.
- [ ] Los botones de acción rápida, el buscador y las etiquetas de atajos son uniformes en tamaño y estilo, alineados horizontalmente.
- [ ] El panel derecho del carrito (CartSidebar) muestra las 4 tarjetas de resumen y la tarjeta del operador con bordes redondeados e iconos consistentes.
- [ ] Todo el diseño se adapta de forma idéntica al flujo claro y oscuro, sin perder ninguna funcionalidad de ventas ni control de stock.

## Notes
- No se modificará ninguna función de negocio ni lógica de base de datos de Supabase.
- Se mantendrá la compatibilidad responsiva con dispositivos móviles y tabletas descrita en `tablet-responsive.css` y `android-core.css`.
