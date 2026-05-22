# Generar Función de Cotización en el POS

## Objetivo
Implementar la opción de cotizaciones en el punto de venta que permita imprimir un ticket no válido como compra sin afectar el stock de productos ni la caja de la sesión actual.

## Tareas
- [ ] Tarea 1: Agregar estilos para el botón "Cotizar" en `frontend/src/components/sales/Sales.css` → Verificar: Estilo `.ct-btn-cotizar` definido con soporte para temas claro y oscuro.
- [ ] Tarea 2: Agregar botón "Cotizar" en `frontend/src/components/sales/CartSidebar.jsx` → Verificar: El botón aparece junto a "Pagar" en el panel lateral si hay productos en el carrito.
- [ ] Tarea 3: Crear función `generarCotizacion` en `frontend/src/components/sales/Sales.jsx` y pasarla a `CartSidebar` → Verificar: Al hacer clic en "Cotizar", se limpia el carrito y se abre el modal de éxito con el ticket de cotización.
- [ ] Tarea 4: Adaptar el componente `frontend/src/components/sales/TicketVenta.jsx` para detectar cotizaciones → Verificar: Si `venta.isCotizacion` es true, el encabezado dice "COTIZACIÓN", se eliminan el QR/PIN de facturación y los datos de pago, y se muestra el mensaje de vigencia de 15 días en el pie.
- [ ] Tarea 5: Verificar que la cotización no afecte el stock ni la caja de Supabase → Verificar: Tras cotizar, los niveles de stock en la tabla `products` y el acumulado en `cash_cuts` de la sesión activa permanecen idénticos.

## Listo Cuando
- [ ] Se puede cotizar un grupo de productos y obtener una impresión en formato ticket marcada claramente como "COTIZACIÓN".
- [ ] La cotización no realiza ninguna petición de inserción en `sales` o actualización de stock en la base de datos.
- [ ] El carrito se vacía correctamente al terminar de cotizar para dejar el POS listo para una nueva operación.

## Notas
- El folio de la cotización se generará de manera local utilizando un prefijo único `COT-` seguido por marcas de tiempo o números aleatorios para evitar conflictos de folios de ventas reales.
- El botón de cotizaciones hereda el estado deshabilitado del carrito vacío.
