# Historial de Cambios Recientes

Este documento resume las mejoras y correcciones implementadas recientemente en el sistema PosMulticajas.

## Módulo de Proveedores

- **Optimización de Interfaz**: Se ajustó el layout para ser completamente funcional a un zoom del 100%.
- **Scroll Interno**: Se implementó scroll independiente para la tabla de datos, manteniendo visibles los KPIs y filtros.
- **Estética**: Reducción de `line-height` global para mejorar la densidad de información.

## Módulo de Auditoría (Historial)

- **Carga de Datos**: Se refactorizó la carga de transacciones usando `Promise.all` para mayor velocidad.
- **Manejo de Estados**: Se corrigió el problema de carga infinita agregando timeouts y mejor manejo de errores.

## Módulo de Ventas (POS)

- **Persistencia de Productos**: Se solucionó el error donde los productos desaparecían al navegar entre módulos.
- **Sincronización**: Mejora en la reactividad al regresar al módulo de ventas desde otros apartados.
- **Cálculo de Cambio**: Mejora en la visualización del cambio en pagos con efectivo y dólares.

## Pantalla del Cliente (Customer Display)

- **Sincronización en Tiempo Real**: Se corrigió la actualización automática del carrito.
- **Estado Inicial**: Se eliminó el "producto fantasma" que aparecía al iniciar la pantalla por primera vez.

## Gestión de Cajas y Turnos

- **Multicajas Cloud**: Implementación de `terminal_id` para permitir múltiples cajas funcionando de forma independiente en la nube.
- **Cierre de Caja**: Rediseño visual de las ventanas de "Corte de Turno" y "Corte del Día".
- **Resumen de Turno**: Corrección de errores al cargar el resumen de ventas por terminal.

## Inventario

- **Carga Masiva**: Implementación de importación de productos mediante plantillas de Excel.
- **Nuevos Campos**: Se añadieron campos de `precio_costo`, `precio_mayoreo` y `stock_minimo`.
