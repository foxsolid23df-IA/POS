# 🛠️ Guía de Mantenimiento: Reset de Terminales y Datos

Esta guía explica cómo utilizar la nueva herramienta de **Mantenimiento** diseñada para gestionar licencias de dispositivos y limpiar datos transaccionales, siempre **protegiendo tu inventario**.

---

## 🔒 Requisitos Previos

- Debes haber iniciado sesión con una cuenta de **Administrador**.
- Asegúrate de que los cajeros hayan cerrado sus turnos antes de realizar un reset general de transacciones.

---

## 🚀 Pasos para Realizar un Reset

### 1. Acceder a Mantenimiento

En el menú lateral izquierdo (Sidebar), verás una opción llamada **"Mantenimiento"** (con un icono de engranajes). Haz clic para entrar.

### 2. Seleccionar qué deseas limpiar

Verás tres opciones principales. Puedes marcar una o varias según tu necesidad:

- **Resetear Dispositivos**:
  - **¿Cuándo usarlo?** Cuando quieras liberar licencias de máquinas antiguas para registrar computadoras nuevas.
  - **Efecto**: Elimina el registro de la terminal actual y de todas las demás. Al terminar, el sistema pedirá configurar la terminal nuevamente.
- **Limpiar Transacciones**:
  - **¿Cuándo usarlo?** Al iniciar un nuevo mes, año, o después de un periodo de pruebas.
  - **Efecto**: Borra historial de ventas, depósitos y cortes. **NO borra productos ni stock**.
- **Resetear Usuarios Secundarios**:
  - **¿Cuándo usarlo?** Si deseas limpiar la lista de cajeros y personal para reconfigurar el equipo.
  - **Efecto**: Elimina perfiles que no sean administradores.

### 3. Confirmación de Seguridad (Paso Crítico)

Para evitar errores accidentales, el botón de limpieza está bloqueado por defecto.

1.  Busca el cuadro de texto que dice: **"Escriba RESET para habilitar el botón"**.
2.  Escribe la palabra **RESET** (en mayúsculas).
3.  El botón cambiará a color rojo y dirá **"Ejecutar Limpieza"**.

### 4. Ejecución

1.  Haz clic en **Ejecutar Limpieza**.
2.  Aparecerá una ventana del navegador preguntando si estás seguro. Confirma haciendo clic en **Aceptar**.
3.  **¡Listo!** El sistema procesará la solicitud. Si seleccionaste "Resetear Dispositivos", la página se recargará automáticamente después de 2 segundos para que puedas configurar la nueva terminal.

---

## 💡 Preguntas Frecuentes

**¿Se borrarán mis productos o precios?**

> [!IMPORTANT]
> **NO.** La herramienta ha sido programada para ignorar la tabla de productos. Tu inventario, costos y precios están 100% seguros.

**¿Qué pasa si borro las terminales por error?**

> No pasa nada grave. Simplemente aparecerá la pantalla de "Configuración de Terminal" la próxima vez que intentes entrar a las ventas. Solo dale un nombre a la máquina y todo seguirá funcionando normal.

**¿Puedo recuperar los datos después de borrarlos?**

> [!CAUTION]
> **NO.** Una vez que se ejecuta la limpieza, los datos (ventas o terminales) se eliminan permanentemente de la base de datos.

---

_Guía generada para la administración del Sistema de Ventas Multicajas._
