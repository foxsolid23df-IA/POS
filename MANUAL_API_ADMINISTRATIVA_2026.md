# 📔 Manual de la API Administrativa y Soporte Forense 🛡️

Este manual explica cómo utilizar la nueva infraestructura de administración y monitoreo del Sistema de Ventas Multi-Caja. Esta herramienta está diseñada tanto para el personal técnico que opera el backend como para el personal administrativo que supervisa la salud del negocio.

---

## 1. Conceptos Básicos (Para todo el equipo)

### ¿Qué es la API Administrativa?

Es un "cerebro" de seguridad que vive en el servidor (backend). Su función es realizar tareas de mantenimiento crítico (como borrar ventas viejas o liberar licencias) de forma segura, rápida y, sobre todo, **registrada**.

### La Regla de Oro: Auditoría Forense

Cada vez que se toca un botón en esta herramienta o se hace una petición a la API, el sistema guarda una "huella digital" (Log) que incluye:

- **Qué** se hizo (Reset de ventas, limpieza de terminales, etc.).
- **Cuándo** se hizo (Fecha y hora exacta).
- **Desde dónde** (Dirección IP y tipo de dispositivo).

---

## 2. Acceso y Seguridad 🔑

El acceso está restringido por un **PIN Maestro**. Sin este código, la API rechazará cualquier intento de conexión.

- **PIN Maestro por defecto:** `2026SOP`
- **URL Base Local:** `http://localhost:3001/api/admin`

### Cómo acceder desde el Sistema (No técnico)

1. Inicie sesión como Administrador en el POS.
2. Navegue a la URL especial: `#/soporte-tecnico-especializado-foxsolid`.
3. Ingrese el PIN Maestro cuando se le solicite.
4. Verá el **Monitor de Salud** y la **Tabla de Auditoría**.

---

## 3. Guía de Funciones (Qué hace cada cosa) 🛠️

### A. Monitor de Salud (Health Check)

Verifica si el sistema está "vivo".

- **API Local:** Indica si el servidor de soporte está respondiendo.
- **Base de Datos:** Indica si el sistema puede leer y escribir datos.
- **Uso Técnico:** `GET /api/admin/health`

### B. Registro de Auditoría (Logs)

Muestra la lista de acciones críticas realizadas recientemente.

- **Uso:** Sirve para deslindar responsabilidades si algo falla.
- **Uso Técnico:** `GET /api/admin/logs`

### C. Resetear Dispositivos

Libera las terminales (computadoras/tablets) registradas.

- **Cuándo usar:** Si un cliente cambió de computadora y el sistema dice "Límite de dispositivos alcanzado".
- **Uso Técnico:** `POST /api/admin/reset/devices`

### D. Limpiar Transacciones

Borra el historial de ventas y cortes de caja, pero **mantiene todos los productos e inventario intactos**.

- **Cuándo usar:** Limpieza de fin de año o inicio de operaciones.
- **Uso Técnico:** `POST /api/admin/reset/sales`

### E. Reset de Fábrica (Nuclear)

Borra **TODO**: productos, ventas, usuarios y terminales. El sistema queda como nuevo.

- **Cuándo usar:** Baja de cliente o desinstalación completa.
- **Uso Técnico:** `POST /api/admin/reset/factory`

---

## 4. Guía para Desarrolladores / Técnicos (Postman/Curl) 🚀

Para realizar peticiones manuales a la API, debe incluir el PIN de seguridad.

### Ejemplo de Petición (GET)

Puede enviarlo por la URL:
`http://localhost:3001/api/admin/health?masterPin=2026SOP`

### Ejemplo de Petición (POST)

En el cuerpo (BODY) de la petición JSON:

```json
{
  "masterPin": "2026SOP"
}
```

O mediante el Header personalizado:
`x-master-pin: 2026SOP`

### Respuesta Exitosa (200 OK)

```json
{
  "success": true,
  "status": "Operational",
  "database": "Connected",
  "version": "1.0.0-admin-alpha"
}
```

---

## 5. Solución de Problemas (Troubleshooting) ❓

**1. El navegador dice "ERR_CONNECTION_REFUSED"**

- **Causa:** El servidor backend está apagado.
- **Solución:** Ve a la carpeta `backend` y ejecuta `npm run dev`.

**2. Error "Acceso Denegado" (403 Forbidden)**

- **Causa:** El PIN Maestro es incorrecto o no se envió.
- **Solución:** Verifique que está escribiendo `2026SOP` en mayúsculas.

**3. El sistema no guarda los cambios (Logs)**

- **Causa:** La base de datos SQLite puede estar bloqueada o el archivo carece de permisos de escritura.
- **Solución:** Reinicie el backend o verifique los permisos de la carpeta `data`.

---

_Manual generado el 23 de Enero, 2026 - Auditoría y Soporte FoxSolid_
