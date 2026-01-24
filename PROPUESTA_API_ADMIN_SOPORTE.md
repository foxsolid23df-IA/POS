# 🛡️ Propuesta: API de Gestión Administrativa y Soporte Maestro

**Estado:** Propuesta Técnica  
**Fecha:** 24 de Enero, 2026  
**Objetivo:** Centralizar y asegurar las funciones críticas de soporte y mantenimiento en una API dedicada.

---

## 1. Análisis de Situación Actual

Actualmente, el sistema cuenta con herramientas de soporte poderosas (como se detalla en el `MANUAL_SOPORTE_MAESTRO.md`), pero muchas de estas operaciones dependen de la lógica del frontend o scripts manuales (`RESET_MANUAL_SUPABASE.md`).

**Riesgos actuales:**

- **Seguridad:** La lógica de limpieza y reseteo, si reside en el frontend, es más vulnerable a manipulaciones o ejecución accidental si se compromete el cliente.
- **Integridad de Datos:** Si el navegador se cierra durante un proceso de limpieza masiva ("Reset de Fábrica"), la base de datos podría quedar en un estado inconsistente.
- **Auditoría Limitada:** No existe un registro centralizado y persistente de _quién_ ejecutó una acción de soporte crítica y _cuándo_.

---

## 2. Solución Propuesta: API Administrativa Centralizada

Se propone la creación de un nuevo módulo en el backend existente (`Node.js + Express`) dedicado exclusivamente a tareas de alto nivel.

**Nueva Ruta Base:** `/api/admin`

### 2.1 Arquitectura sugerida

Integrar los siguientes archivos en la estructura actual:

- `backend/routes/adminRoutes.js`: Definición de endpoints.
- `backend/controllers/adminController.js`: Lógica de negocio (limpiezas, bloqueos).
- `backend/middleware/authAdmin.js`: Middleware reforzado que exige el **PIN Maestro** (`2026SOP`) o un Token de Super-Admin en cada petición.

---

## 3. Funciones Clave (Paridad con Soporte Maestro + Mejoras)

Esta API replicará las funciones del manual actual, pero ejecutadas desde el servidor para mayor seguridad.

### 🛠️ Funciones de Mantenimiento (Existentes pero migradas)

| Método | Endpoint                           | Descripción                         | Ventaja Backend                                                 |
| :----- | :--------------------------------- | :---------------------------------- | :-------------------------------------------------------------- |
| `POST` | `/api/admin/reset/devices`         | Libera licencias de computadoras.   | Garantiza que no queden "dispositivos fantasma".                |
| `POST` | `/api/admin/reset/sales`           | Borra historial de ventas y cortes. | Uso de **Transacciones SQL** (Todo o nada) para evitar errores. |
| `POST` | `/api/admin/reset/factory`         | Reseteo total del sistema.          | Mayor rapidez y seguridad al ejecutar comandos directos en DB.  |
| `POST` | `/api/admin/users/reset-secondary` | Elimina cajeros, deja solo Admin.   | Validación inmediata de que no se borre al dueño.               |

### 🚀 Nuevas Funciones Recomendadas (Mejoras)

#### A. Sistema de "Health Check" (Salud del Sistema)

**Endpoint:** `GET /api/admin/system/health`

- **Función:** Devuelve el estado real de la conexión a la base de datos, latencia y uso de memoria del servidor.
- **Uso:** El panel de soporte puede mostrar un "semáforo" (Verde/Rojo) indicando si el servidor está saludable antes de intentar operar.

#### B. Kill Switch de Sesiones (Cierre Remoto Real)

**Endpoint:** `POST /api/admin/sessions/kill-all`

- **Mejora:** No solo actualiza la base de datos, sino que puede invalidar tokens JWT activos o desconectar Sockets en tiempo real, sacando a los usuarios inmediatamente, no solo "al intentar cerrar caja".

#### C. Modo "Ghost" (Suplantación para Soporte)

**Endpoint:** `POST /api/admin/auth/masquerade`

- **Función:** Permite al soporte técnico iniciar sesión temporalmente como un usuario cajero específico para ver _exactamente_ lo que ellos ven, sin necesitar su contraseña real, útil para depurar errores de permisos.

#### D. Auditoría Forense (Log de Acciones)

**Endpoint:** `GET /api/admin/audit-logs`

- **Función:** Cada vez que alguien use el PIN Maestro, se guarda un registro inmutable en una tabla `system_logs`.
- **Dato guardado:** `IP`, `Fecha`, `Acción Realizada`, `Usuario Admin`.

#### E. Respaldo de Seguridad Automático (Snapshot)

**Endpoint:** `POST /api/admin/backup/trigger`

- **Función:** Antes de permitir un `reset/factory`, el sistema puede generar un archivo JSON con los datos actuales y guardarlo en una carpeta segura o Bucket de Supabase. "Deshacer" se vuelve posible.

---

## 4. Ejemplo Técnico (Implementation Preview)

```javascript
// backend/controllers/adminController.js

exports.factoryReset = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // 1. Verificar PIN Maestro (Doble factor de seguridad)
    if (req.body.masterPin !== process.env.SUPPORT_PIN) {
      throw new Error("Acceso Denegado");
    }

    // 2. Crear Log de Auditoría
    await SystemLog.create(
      { action: "FACTORY_RESET", user: req.user.id },
      { transaction: t },
    );

    // 3. Ejecutar Limpieza Masiva
    await Sale.destroy({ where: {}, truncate: true, transaction: t });
    await Product.destroy({ where: {}, truncate: true, transaction: t });
    // ... más limpiezas

    await t.commit();
    res.json({
      success: true,
      message: "Sistema reseteado a fábrica correctamente.",
    });
  } catch (error) {
    await t.rollback();
    res
      .status(500)
      .json({ error: "Error crítico, nada fue borrado: " + error.message });
  }
};
```

## 5. Conclusión

Migrar estas herramientas a una **API Administrativa** transforma el "Soporte Maestro" de una utilidad de ayuda a una **plataforma de gestión empresarial robusta**, aumentando la confianza del cliente final y facilitando el trabajo del equipo de soporte técnico.
