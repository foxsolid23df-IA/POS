# Manual: Copiar Ticket a Venta Actual y Reemplazar Original

Este manual explica como usar la funcion **Copiar a venta actual** cuando un cliente ya tiene un ticket con muchos productos, pero necesita quitar o cambiar algunos articulos antes de terminar correctamente la venta.

## Para Que Sirve

La funcion permite tomar un ticket ya creado y pasarlo al carrito de Ventas para editarlo rapidamente, sin capturar producto por producto otra vez.

Es util cuando:

- El cliente llevo muchos productos y despues decide quitar algunos.
- Algunos productos no tienen existencia.
- El cliente pide corregir el ticket sin volver a escanear todo.
- Hay una fila de clientes y se necesita avanzar mas rapido.

Al cobrar la nueva venta, el sistema cancela el ticket original y crea un ticket nuevo corregido.

## Regla Importante

El ticket original no se cancela al copiarlo.

El ticket original se cancela solamente cuando se cobra correctamente la nueva venta.

Esto significa que si el cajero abandona el proceso o cierra la pantalla, el ticket original queda intacto.

## Donde Se Usa

La funcion se usa desde:

1. Modulo **Ordenes**.
2. Detalle de un ticket.
3. Boton **Copiar a venta actual**.
4. Pantalla **Ventas**.

## Pasos Para Copiar Un Ticket

1. Entrar al modulo **Ordenes**.
2. Buscar el ticket que se desea corregir.
3. Abrir el detalle del ticket.
4. Presionar **Copiar a venta actual**.
5. El sistema llevara al cajero a la pantalla **Ventas**.
6. Si el carrito actual ya tiene productos, el sistema preguntara si desea reemplazarlo.
7. Confirmar solo si se quiere borrar el carrito actual y cargar el ticket copiado.
8. Revisar la banda que indica **Reemplazando ticket #...**.
9. Quitar, agregar o modificar productos segun necesite el cliente.
10. Cobrar la nueva venta normalmente.

## Que Pasa Al Cobrar

Cuando se cobra la venta nueva:

- El sistema cancela el ticket original.
- Restaura el inventario que habia descontado el ticket original.
- Crea el nuevo ticket corregido.
- Descuenta el inventario de la nueva venta.
- Imprime el nuevo ticket normalmente.

Todo esto se hace en una sola operacion para evitar diferencias de inventario.

## Si El Carrito Ya Tiene Productos

Si el cajero ya tenia productos en la venta actual, el sistema no mezcla los productos automaticamente.

Primero pregunta si se desea reemplazar el carrito.

Opciones:

- **Aceptar / Reemplazar**: se borra el carrito actual y se carga el ticket copiado.
- **Cancelar**: no se copia el ticket y el carrito actual se conserva.

## Productos Que Ya No Existen

Si el ticket original tiene un producto que ya no existe en inventario, el sistema puede cargarlo como producto manual.

En ese caso el cajero debe revisar ese producto antes de cobrar.

Recomendacion:

- Confirmar nombre.
- Confirmar cantidad.
- Confirmar precio.
- Si el producto ya no se debe vender, quitarlo del carrito.

## Tickets Permitidos

Se puede copiar un ticket cuando:

- No esta cancelado.
- No esta devuelto.
- Es una venta normal.

## Limitaciones Actuales

En esta version, el reemplazo de ticket no aplica para venta a credito.

Si se intenta reemplazar un ticket y cobrarlo a credito, el sistema mostrara un mensaje indicando que esa operacion no esta disponible en esta version.

## Ejemplo De Uso

Un cliente compro 50 productos y se genero el ticket.

Despues el cliente dice que ya no llevara 5 productos porque no hay existencia o porque cambio de opinion.

El cajero puede hacer esto:

1. Ir a **Ordenes**.
2. Abrir el ticket original.
3. Presionar **Copiar a venta actual**.
4. Confirmar reemplazo del carrito si es necesario.
5. Quitar los 5 productos.
6. Cobrar la venta nueva.

Resultado:

- El ticket original queda cancelado.
- Se genera un ticket nuevo con los productos correctos.
- El inventario queda ajustado correctamente.

## Recomendaciones Para Cajeros

- Antes de cobrar, revisar que la banda diga **Reemplazando ticket #...**.
- Confirmar que el total final sea correcto.
- Si se cargo un producto manual, revisar precio y cantidad.
- No cancelar manualmente el ticket original antes de cobrar la nueva venta.
- Si el cliente ya no quiere hacer el cambio, salir del flujo sin cobrar; el ticket original seguira igual.

## Preguntas Frecuentes

### Se cancela el ticket original al presionar Copiar a venta actual?

No. Solo se copia al carrito. El original se cancela hasta que se cobra el nuevo ticket.

### Puedo mezclar el ticket copiado con productos que ya tenia en el carrito?

No automaticamente. Si el carrito tiene productos, el sistema pide confirmacion para reemplazarlo.

### Que pasa si cierro la pantalla antes de cobrar?

No pasa nada con el ticket original. Sigue valido porque la cancelacion ocurre al cobrar la nueva venta.

### El nuevo ticket imprime normal?

Si. El nuevo ticket se imprime con el mismo flujo de venta normal.

### Esto arregla tambien el inventario?

Si. Al cobrar la nueva venta, el sistema restaura el inventario del ticket original y descuenta el inventario del nuevo ticket.

