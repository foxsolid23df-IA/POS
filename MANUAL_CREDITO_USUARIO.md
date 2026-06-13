# Manual de Usuario - Sistema de Credito

Este manual explica como usar el modulo de credito en la operacion diaria del negocio.

---

## 1. Para Que Sirve El Credito

El credito sirve para venderle a un cliente aunque no pague todo en ese momento.

El sistema guarda:

- Cuanto compro el cliente.
- Cuanto pago al momento.
- Cuanto quedo pendiente.
- Los abonos que va haciendo.
- El saldo actual que todavia debe.

---

## 2. Antes De Vender A Credito

Antes de hacer una venta a credito, revise que el cliente exista en el sistema.

Si el cliente no existe, agreguelo desde la busqueda de clientes al momento de cobrar.

Para trabajar mejor, es recomendable que cada cliente tenga:

- Nombre.
- Telefono.
- Limite de credito, si aplica.
- Notas, si desea recordar algo importante.

---

## 3. Como Hacer Una Venta A Credito

1. Entre al modulo de ventas.
2. Agregue los productos al carrito como en una venta normal.
3. Presione cobrar o abra la ventana de pago.
4. Elija la opcion **Credito**.
5. Seleccione el cliente.
6. Si el cliente da un abono inicial, capture el monto y agreguelo al pago.
7. Si no da abono, deje el pago sin cubrir.
8. Presione **Completar Venta a Credito**.

Al terminar, el sistema guarda la venta y aumenta el saldo pendiente del cliente.

---

## 4. Venta A Credito Con Abono Inicial

Use esta opcion cuando el cliente paga una parte y deja el resto pendiente.

Ejemplo:

- Total de la venta: $1,000.00
- El cliente paga: $300.00
- Queda pendiente: $700.00

En la ventana de pago:

1. Seleccione **Credito**.
2. Seleccione el cliente.
3. Capture el abono inicial.
4. Agregue el pago.
5. Complete la venta a credito.

El ticket mostrara el total de la venta y el sistema guardara el saldo pendiente del cliente.

---

## 5. Venta A Credito Sin Abono

Use esta opcion cuando el cliente no paga nada al momento.

1. Agregue los productos al carrito.
2. Abra la ventana de pago.
3. Seleccione **Credito**.
4. Seleccione el cliente.
5. No capture ningun pago.
6. Presione **Completar Venta a Credito**.

El total completo queda como saldo pendiente del cliente.

---

## 6. Como Consultar Los Creditos

1. Entre al menu **Creditos y Cuentas por Cobrar**.
2. Vera un resumen con:
   - Total pendiente.
   - Total vencido.
   - Clientes con credito.
   - Clientes vencidos.
3. Use el buscador para encontrar un cliente.

En la lista de clientes puede ver:

- Nombre del cliente.
- Telefono.
- Limite de credito.
- Saldo actual.
- Disponible.
- Estado del cliente.

---

## 7. Estados Del Cliente

El sistema puede mostrar diferentes estados:

**AL CORRIENTE**  
El cliente tiene credito activo y no aparece como vencido.

**ALTO**  
El cliente ya uso gran parte de su limite.

**VENCIDO**  
El cliente tiene saldo pendiente atrasado.

**BLOQUEADO**  
El cliente no debe recibir mas credito hasta que se desbloquee.

---

## 8. Como Ver El Detalle De Un Cliente

1. Entre a **Creditos y Cuentas por Cobrar**.
2. Busque el cliente.
3. Presione el boton de ver detalle.

En el detalle vera:

- Limite de credito.
- Saldo actual.
- Disponible.
- Porcentaje usado.
- Ventas a credito.
- Abonos registrados.
- Notas del cliente.

---

## 9. Como Registrar Un Abono

1. Entre a **Creditos y Cuentas por Cobrar**.
2. Busque el cliente.
3. Presione **Registrar Abono**.
4. Escriba el monto que el cliente va a pagar.
5. Elija el metodo de pago:
   - Efectivo.
   - Tarjeta.
   - Transferencia.
6. Si desea, agregue una referencia.
7. Si desea, agregue una nota.
8. Presione **Registrar Abono**.

El sistema resta el abono al saldo del cliente.

---

## 10. Vincular Abono A Una Venta

Cuando el cliente tiene varias ventas pendientes, el sistema puede mostrar una lista de ventas.

Puede elegir una venta especifica para aplicar el abono.

Si no esta seguro, puede dejarlo como **Sin vincular**.

Recomendacion:

- Si el cliente esta pagando una venta exacta, vincule el abono a esa venta.
- Si el cliente solo esta dando dinero a cuenta general, dejelo sin vincular.

---

## 11. Que Revisar Antes De Dar Mas Credito

Antes de vender de nuevo a credito, revise:

- Saldo actual del cliente.
- Disponible.
- Si aparece vencido.
- Si esta bloqueado.
- Si tiene notas importantes.

Si el cliente ya debe mucho, pida autorizacion antes de darle mas credito.

---

## 12. Recomendaciones Para El Cajero

- Siempre seleccione el cliente correcto antes de completar la venta.
- No use "Publico General" para ventas a credito.
- Si el cliente da dinero, registre el abono en el momento.
- Si el cliente paga por transferencia, escriba la referencia.
- Si hay una aclaracion, escribala en notas.
- Revise el saldo antes de prometer credito nuevo.

---

## 13. Recomendaciones Para Cobranza

- Revise todos los dias el total pendiente.
- Atienda primero los clientes vencidos.
- Use el historial de abonos para confirmar pagos anteriores.
- Compare el saldo del cliente antes y despues de registrar un abono.
- Si un cliente no debe recibir mas credito, mantengalo bloqueado.

---

## 14. Errores Comunes

### No aparece el cliente

Revise que el cliente este registrado. Si no existe, agreguelo.

### El sistema no deja completar la venta a credito

Revise que haya seleccionado un cliente.

### El abono no se puede registrar

Revise que el monto sea mayor a cero y que no sea mayor al saldo pendiente.

### El saldo no coincide con lo esperado

Revise el detalle del cliente y confirme:

- Ventas a credito.
- Abonos registrados.
- Venta pagada parcialmente.
- Venta pendiente.

---

## 15. Flujo Recomendado Diario

Al iniciar el dia:

1. Revise clientes vencidos.
2. Revise saldos altos.
3. Informe al encargado si algun cliente esta cerca de su limite.

Durante el dia:

1. Seleccione bien el cliente en cada venta a credito.
2. Registre abonos en el momento.
3. Anote referencias de transferencias.

Al cerrar el dia:

1. Revise los abonos registrados.
2. Compare pagos recibidos con efectivo, tarjetas o transferencias.
3. Revise si quedaron clientes nuevos con saldo pendiente.

---

## 16. Resumen Rapido

Para vender a credito:

1. Agregue productos.
2. Abra cobro.
3. Elija **Credito**.
4. Seleccione cliente.
5. Capture abono si hay.
6. Complete venta.

Para cobrar un abono:

1. Entre a **Creditos y Cuentas por Cobrar**.
2. Busque cliente.
3. Presione **Registrar Abono**.
4. Capture monto.
5. Guarde.

Para revisar deuda:

1. Entre al detalle del cliente.
2. Revise ventas a credito.
3. Revise abonos.
4. Revise saldo actual.
