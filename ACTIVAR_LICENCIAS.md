# 🛡️ Manual para Activar / Renovar Licencias Vencidas

Cuando a un cliente (cuenta administradora) se le ha vencido el tiempo de vigencia de su licencia, el sistema Punto de Venta bloqueará el acceso mostrando la pantalla de **Licencia Expirada**.

Para rehabilitar el acceso y renovar el tiempo de uso, debes actualizar la fecha de vencimiento directamente desde la base de datos de **Supabase**. Sigue los pasos indicados a continuación.

---

## Procedimiento Paso a Paso

1. Inicia sesión en tu panel de control de **[Supabase](https://supabase.com/)**.
2. Selecciona tu proyecto actual.
3. Dirígete a la sección de **SQL Editor** en la barra lateral izquierda.
4. Necesitarás el **Email** del cliente o el **ID** de su usuario para identificar su registro correctamente de las siguientes formas:

### Opción A: Renovar a todos los usuarios expirados al mismo tiempo

Si deseas darles, por ejemplo, 30 días adicionales a todos aquellos cuya cuenta ya se había vencido:

```sql
UPDATE public.invitation_codes
SET expires_at = now() + interval '30 days'
WHERE expires_at < now();
```

### Opción B: Renovar buscando el correo electrónico del cliente (MÉTODO RECOMENDADO)

Normalmente, el cliente te dará el correo electrónico con el que se registró. Puedes buscar con qué cuenta (ID) está relacionado el código vinculando las tablas `invitation_codes` y `auth.users`:

```sql
UPDATE public.invitation_codes
SET expires_at = now() + interval '30 days' -- o '1 year', '3 months', etc.
WHERE used_by = (
    SELECT id
    FROM auth.users
    WHERE email = 'correo_del_cliente@ejemplo.com'
);
```

### Opción C: Renovar a un usuario cuando ya conoces su ID de Usuario (UUID)

Si conoces directamente el identificador UUID del usuario registrado:

```sql
UPDATE public.invitation_codes
SET expires_at = now() + interval '1 year'
WHERE used_by = 'UUID-DEL-CLIENTE';
```

---

## 📅 Opciones de Tiempo `interval`

Puedes ajustar el valor `interval` según el período contratado por el cliente:

- `interval '15 days'` (15 días)
- `interval '1 month'` (1 mes)
- `interval '6 months'` (Medio año)
- `interval '1 year'` (1 año)

---

## Verificación

Para confirmar que la asignación de la nueva vigencia fue exitosa, puedes listar sus datos usando el siguiente script en el **SQL Editor**:

```sql
SELECT
    ic.code AS codigo_invitacion,
    u.email AS correo,
    ic.expires_at AS fecha_vencimiento
FROM public.invitation_codes ic
JOIN auth.users u ON ic.used_by = u.id
WHERE u.email = 'correo_del_cliente@ejemplo.com';
```

Al verificar que la fecha de `fecha_vencimiento` sea una fecha futura, infórmale al cliente que **solo debe recargar (o reiniciar) la aplicación** para acceder nuevamente con normalidad. No es necesario que cambien su contraseña ni vuelvan a instalar nada.
