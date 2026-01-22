# 🔐 Sistema de Códigos de Invitación - Control de Registro

## 📋 Descripción

Sistema que controla el registro de nuevos negocios mediante códigos de invitación de **un solo uso**. Una vez que un código es usado para registrar una tienda, no puede volver a usarse.

---

## ✅ Características Implementadas

### 1. **Códigos de Un Solo Uso**
   - Cada código solo puede usarse **una vez**
   - Una vez usado, se marca automáticamente como `used = true`
   - Se registra quién usó el código y cuándo

### 2. **Validación Contra Base de Datos**
   - Los códigos se validan en tiempo real contra Supabase
   - Verifica que el código exista
   - Verifica que no haya sido usado
   - Verifica fecha de expiración (si tiene)

### 3. **Control Automático**
   - El código se marca como usado automáticamente después del registro exitoso
   - Se registra el usuario que usó el código
   - Se guarda la fecha y hora de uso

---

## 🗄️ Configuración de Base de Datos

### Paso 1: Ejecutar el Script SQL

1. **Abre Supabase Dashboard:**
   - Ve a: https://supabase.com/dashboard
   - Selecciona tu proyecto

2. **Ve al SQL Editor:**
   - Clic en "SQL Editor" en el menú lateral

3. **Ejecuta el script:**
   - Copia el contenido de `invitation_codes_setup.sql`
   - Pégalo en el editor SQL
   - Haz clic en "Run" o presiona Ctrl+Enter

### Paso 2: Verificar la Tabla

Después de ejecutar el script, deberías ver:
- ✅ Tabla `invitation_codes` creada
- ✅ Políticas RLS configuradas
- ✅ Algunos códigos de ejemplo insertados

---

## 📝 Crear Nuevos Códigos de Invitación

### Opción 1: Desde Supabase SQL Editor (Recomendado)

```sql
-- Crear un nuevo código de invitación sin fecha de expiración
INSERT INTO public.invitation_codes (code, created_by, notes) 
VALUES (
  'DEMO-2026',                         -- Código único
  'Admin Sistema',                     -- Quién lo crea
  'Código de invitación sin expiración'  -- Notas
);
```

### Opción 2: Desde Supabase Table Editor

1. Ve a **Table Editor** en Supabase
2. Selecciona la tabla `invitation_codes`
3. Haz clic en **"Insert row"**
4. Completa los campos:
   - `code`: El código único (ej: `NUEVO-2024`)
   - `created_by`: Tu nombre o "Administración"
   - `notes`: Notas opcionales
   - `expires_at`: Fecha de expiración (opcional, dejar null para sin expiración)
5. Haz clic en **"Save"**

### Opción 3: Desde el Código (Futuro)

En el futuro podrías crear un panel de administración para generar códigos automáticamente.

---

## 🔍 Consultas Útiles

### Ver todos los códigos y su estado:

```sql
SELECT 
  id, 
  code, 
  used, 
  used_by, 
  used_at, 
  created_at, 
  expires_at, 
  notes 
FROM public.invitation_codes 
ORDER BY created_at DESC;
```

### Ver solo códigos disponibles (no usados):

```sql
SELECT 
  code, 
  created_at, 
  expires_at, 
  notes 
FROM public.invitation_codes 
WHERE used = false 
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY created_at DESC;
```

### Ver códigos usados con información del negocio:

```sql
SELECT 
  ic.code, 
  ic.used_at, 
  p.store_name, 
  p.full_name,
  p.id as user_id
FROM public.invitation_codes ic
LEFT JOIN public.profiles p ON ic.used_by = p.id
WHERE ic.used = true
ORDER BY ic.used_at DESC;
```

---

## 🚀 Uso del Sistema

### Para Registrar un Nuevo Negocio:

1. **Crear un código de invitación** (desde Supabase)
2. **Compartir la URL con el código:**
   ```
   https://sistema-ventas-topaz.vercel.app/#/register/MI-CODIGO-2024
   ```
3. **El código se valida automáticamente** al intentar registrarse
4. **Después del registro exitoso**, el código se marca como usado
5. **El código no puede volver a usarse**

### Validación Automática:

- ✅ Verifica que el código exista
- ✅ Verifica que no haya sido usado
- ✅ Verifica fecha de expiración (si tiene)
- ✅ Marca el código como usado después del registro
- ✅ Registra quién usó el código y cuándo

---

## ⚙️ Configuración Actual

### Códigos Iniciales (después de ejecutar el script):

- `ADMIN2024` - Código principal
- `POS-REG-2024` - Código para registro
- `BIZ-PRO-2024` - Código profesional

**Nota:** Estos códigos son solo de ejemplo. Deberías crear tus propios códigos únicos.

---

## 🔒 Seguridad

### Características de Seguridad:

1. **RLS (Row Level Security) habilitado**
   - Solo campos necesarios son visibles públicamente
   - Solo usuarios autenticados pueden marcar códigos como usados

2. **Validación en tiempo real**
   - Cada intento de registro valida el código contra la base de datos
   - No hay códigos hardcodeados en el frontend

3. **Control de uso único**
   - Una vez usado, el código no puede reutilizarse
   - Se registra quién y cuándo usó cada código

---

## 📊 Estructura de la Tabla

```sql
invitation_codes
├── id (bigint, PK) - ID único
├── code (text, UNIQUE) - Código de invitación
├── used (boolean) - Si ya fue usado
├── used_by (uuid, FK -> auth.users) - Usuario que lo usó
├── used_at (timestamp) - Fecha/hora de uso
├── created_by (text) - Quién lo creó
├── created_at (timestamp) - Fecha de creación
├── expires_at (timestamp, NULLABLE) - Fecha de expiración
└── notes (text, NULLABLE) - Notas adicionales
```

---

## ✅ Checklist de Implementación

- [ ] Ejecutar script SQL `invitation_codes_setup.sql` en Supabase
- [ ] Verificar que la tabla `invitation_codes` existe
- [ ] Crear códigos de invitación para uso real
- [ ] Probar registro con un código válido
- [ ] Verificar que el código se marca como usado
- [ ] Probar que el código usado no puede reutilizarse

---

## 🎯 Próximos Pasos Recomendados (Opcional)

1. **Panel de Administración:**
   - Interfaz para crear códigos desde la aplicación
   - Vista de códigos usados/disponibles
   - Generación automática de códigos

2. **Límites Adicionales:**
   - Límite de intentos por código
   - Notificaciones cuando se usa un código
   - Estadísticas de uso de códigos

3. **Expiración Automática:**
   - Limpieza automática de códigos expirados
   - Notificaciones antes de expirar

---

## 📞 Soporte

Si tienes problemas:
1. Verifica que la tabla existe en Supabase
2. Verifica que las políticas RLS están activas
3. Revisa los logs de la consola del navegador
4. Verifica que los códigos están insertados correctamente

**¡El sistema está listo para controlar el registro de nuevos negocios! 🎉**
