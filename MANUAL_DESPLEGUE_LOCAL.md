# 🖥️ Manual de Despliegue Local - Sistema de Ventas

Este manual explica cómo configurar y ejecutar el sistema localmente para verificar cambios antes de subirlos a producción.

---

## 📋 Tabla de Contenidos

1. [Prerrequisitos](#prerrequisitos)
2. [Configuración Inicial](#configuración-inicial)
3. [Variables de Entorno](#variables-de-entorno)
4. [Instalación de Dependencias](#instalación-de-dependencias)
5. [Configuración de Supabase](#configuración-de-supabase)
6. [Ejecución Local](#ejecución-local)
7. [Verificación de Cambios](#verificación-de-cambios)
8. [Testing de Funcionalidades](#testing-de-funcionalidades)
9. [Flujo de Trabajo Recomendado](#flujo-de-trabajo-recomendado)
10. [Solución de Problemas](#solución-de-problemas)

---

## ✅ Prerrequisitos

### Software Requerido

Antes de comenzar, asegúrate de tener instalado:

1. **Node.js** (versión 18 o superior)
   - Descargar: https://nodejs.org/
   - Verificar instalación:
     ```bash
     node --version
     npm --version
     ```

2. **Git** (para control de versiones)
   - Descargar: https://git-scm.com/
   - Verificar instalación:
     ```bash
     git --version
     ```

3. **Editor de Código** (opcional pero recomendado)
   - Visual Studio Code: https://code.visualstudio.com/
   - O cualquier editor de tu preferencia

4. **Cuenta de Supabase** (para base de datos)
   - Crear cuenta: https://supabase.com/
   - O usar proyecto existente

---

## ⚙️ Configuración Inicial

### Paso 1: Clonar o Actualizar el Repositorio

Si ya tienes el proyecto clonado:

```bash
# Actualizar a la última versión
cd "Sistema ventas"
git pull origin main
```

Si es la primera vez:

```bash
# Clonar el repositorio
git clone https://github.com/foxsolid23df-IA/sistema-ventas.git
cd sistema-ventas
```

---

## 🔐 Variables de Entorno

### Paso 1: Crear Archivo .env

El proyecto necesita variables de entorno para conectarse a Supabase. Crea el archivo `.env` en el directorio `frontend/`:

```bash
# Navegar al directorio frontend
cd frontend

# Crear archivo .env (Windows - PowerShell)
New-Item -ItemType File -Name .env

# O desde Git Bash / Terminal
touch .env
```

### Paso 2: Configurar Variables de Entorno

Abre el archivo `frontend/.env` con tu editor y agrega:

```env
# URL de tu proyecto Supabase
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co

# Clave anónima de Supabase
VITE_SUPABASE_ANON_KEY=tu-clave-anonima-aqui
```

### Paso 3: Obtener Credenciales de Supabase

1. **Ir a Supabase Dashboard:**
   - Ve a: https://supabase.com/dashboard
   - Selecciona tu proyecto

2. **Obtener URL:**
   - Ve a **Settings** → **API**
   - Copia **Project URL** (ejemplo: `https://abcdefgh.supabase.co`)

3. **Obtener Anon Key:**
   - En la misma página **Settings** → **API**
   - Copia **anon public** key (comienza con `eyJhbG...`)

4. **Pegar en `.env`:**
   ```env
   VITE_SUPABASE_URL=https://abcdefgh.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### ⚠️ Importante

- **NO subir el archivo `.env` a Git** (ya está en `.gitignore`)
- **NO compartir tus credenciales** públicamente
- **Usa credenciales de desarrollo** para pruebas locales

---

## 📦 Instalación de Dependencias

### Paso 1: Instalar Dependencias del Frontend

```bash
# Asegúrate de estar en el directorio frontend
cd frontend

# Instalar todas las dependencias
npm install
```

**Tiempo estimado:** 1-3 minutos

**Salida esperada:**
```
added 450 packages, and audited 451 packages in 2m
```

### Paso 2: Verificar Instalación

```bash
# Verificar que las dependencias se instalaron
ls node_modules

# Verificar versión de Node
node --version  # Debe ser 18 o superior
```

---

## 🗄️ Configuración de Supabase

### Paso 1: Verificar Esquema de Base de Datos

Asegúrate de que todas las tablas necesarias estén creadas en Supabase:

1. **Ir a SQL Editor** en Supabase
2. **Ejecutar el esquema principal:**
   - Copia el contenido de `supabase_schema.sql`
   - Pégalo en el editor SQL
   - Haz clic en **"Run"**

3. **Ejecutar el esquema de códigos de invitación** (si usas sistema de invitaciones):
   - Copia el contenido de `invitation_codes_setup.sql`
   - Pégalo en el editor SQL
   - Haz clic en **"Run"**

### Paso 2: Verificar Tablas Creadas

En Supabase Dashboard → **Table Editor**, deberías ver:
- ✅ `profiles`
- ✅ `products`
- ✅ `sales`
- ✅ `sale_items`
- ✅ `staff`
- ✅ `cash_cuts`
- ✅ `invitation_codes` (si aplica)

### Paso 3: Configurar Autenticación (Opcional para Desarrollo)

Para desarrollo local, puedes desactivar la confirmación de email:

1. **Ir a:** Authentication → Settings
2. **Desactivar:** "Enable email confirmations" (temporal para desarrollo)
3. **Guardar cambios**

**Nota:** Para producción, mantén la confirmación de email activada.

---

## 🚀 Ejecución Local

### Método 1: Ejecución Simple (Recomendado)

```bash
# Desde el directorio frontend
cd frontend

# Iniciar servidor de desarrollo
npm run dev
```

**Salida esperada:**
```
  VITE v7.1.1  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

**La aplicación estará disponible en:** http://localhost:5173

### Método 2: Ejecución con Hot Reload

El servidor de desarrollo de Vite incluye **Hot Module Replacement (HMR)** automático:
- Los cambios en el código se reflejan **instantáneamente** en el navegador
- No necesitas recargar manualmente la página

---

## ✅ Verificación de Cambios

### Paso 1: Abrir la Aplicación Local

1. **Abrir navegador:**
   - Ve a: http://localhost:5173
   - Se abrirá la pantalla de login

2. **Iniciar sesión:**
   - Usa tus credenciales de Supabase
   - O crea una cuenta de prueba con un código de invitación válido

### Paso 2: Probar Funcionalidades Específicas

#### Verificar Scanner de Cámara:

1. **Ir a:** Sección de Ventas (`/`)
2. **Verificar que aparece:** Botón "Cámara" junto al input de búsqueda
3. **Hacer clic** en el botón "Cámara"
4. **Verificar que se abre** el modal del scanner
5. **Probar escaneo** con cámara web o móvil

#### Verificar Registro con Código de Invitación:

1. **Ir a:** http://localhost:5173/#/login
2. **Verificar que NO aparece** el botón "Regístrate" público
3. **Ir a:** http://localhost:5173/#/register/ADMIN2024 (con código válido)
4. **Verificar que aparece** el formulario de registro
5. **Verificar que el código** se pre-llena automáticamente

#### Verificar Inventario:

1. **Ir a:** Sección de Inventario (`/inventario`)
2. **Crear nuevo producto:**
   - Clic en "Nuevo Producto"
   - **Verificar que aparece** el botón "Cámara" en el campo de código de barras
   - Probar el scanner de cámara
   - Guardar producto

### Paso 3: Verificar en Consola del Navegador

1. **Abrir DevTools:**
   - Presiona `F12` o `Ctrl+Shift+I`
   - Ve a la pestaña **"Console"**

2. **Buscar errores:**
   - No deberían aparecer errores en rojo
   - Si hay warnings, revisarlos pero pueden ser normales

3. **Buscar mensajes específicos:**
   - Verificar que las llamadas a Supabase se realizan correctamente
   - Verificar que no hay errores de autenticación

---

## 🧪 Testing de Funcionalidades

### Checklist de Verificación

Antes de hacer commit y push, verifica:

#### Autenticación
- [ ] Login funciona correctamente
- [ ] Registro requiere código de invitación válido
- [ ] Códigos usados no pueden reutilizarse
- [ ] Logout funciona correctamente

#### Ventas
- [ ] Scanner de cámara se abre y funciona
- [ ] Búsqueda por nombre funciona
- [ ] Agregar productos al carrito funciona
- [ ] Finalizar venta funciona
- [ ] Impresión de ticket funciona

#### Inventario
- [ ] Scanner de cámara en formulario de productos
- [ ] Crear producto funciona
- [ ] Editar producto funciona
- [ ] Eliminar producto funciona
- [ ] Búsqueda de productos funciona

#### Códigos de Invitación
- [ ] Validación de códigos funciona
- [ ] Códigos usados se marcan correctamente
- [ ] Mensajes de error son claros

---

## 🔄 Flujo de Trabajo Recomendado

### Flujo Completo de Desarrollo Local

```
1. Hacer cambios en el código
   ↓
2. Guardar archivos (Vite recarga automáticamente)
   ↓
3. Probar cambios en http://localhost:5173
   ↓
4. Verificar que no hay errores en consola
   ↓
5. Probar todas las funcionalidades afectadas
   ↓
6. Verificar que todo funciona correctamente
   ↓
7. Hacer commit y push (solo si todo está bien)
```

### Antes de Cada Commit

✅ **Siempre verifica:**
- La aplicación funciona en `localhost:5173`
- No hay errores en la consola del navegador
- Las funcionalidades modificadas funcionan correctamente
- Los cambios no rompen otras funcionalidades existentes

### Comandos Útiles Durante Desarrollo

```bash
# Detener el servidor de desarrollo
# Presiona Ctrl+C en la terminal

# Reiniciar el servidor
npm run dev

# Limpiar caché de Vite (si hay problemas)
# Eliminar carpeta node_modules/.vite
rm -rf node_modules/.vite  # Linux/Mac
rmdir /s node_modules\.vite  # Windows

# Ver logs detallados
npm run dev -- --debug
```

---

## 🐛 Solución de Problemas

### Problema 1: Puerto 5173 ya está en uso

**Error:**
```
Port 5173 is in use, trying another one...
```

**Solución:**
```bash
# Opción 1: Usar otro puerto
npm run dev -- --port 5174

# Opción 2: Cerrar el proceso que usa el puerto (Windows)
netstat -ano | findstr :5173
taskkill /PID <PID_NUMBER> /F

# Opción 3: Reiniciar la terminal
```

### Problema 2: Variables de entorno no se cargan

**Error:**
```
Supabase URL and Key are required
```

**Solución:**
1. Verificar que el archivo `.env` existe en `frontend/`
2. Verificar que las variables empiezan con `VITE_`
3. Reiniciar el servidor de desarrollo (`Ctrl+C` y luego `npm run dev`)
4. Verificar que no hay espacios alrededor del `=` en `.env`

### Problema 3: Errores de módulos no encontrados

**Error:**
```
Cannot find module 'xxx'
```

**Solución:**
```bash
# Reinstalar dependencias
cd frontend
rm -rf node_modules package-lock.json  # Linux/Mac
rmdir /s node_modules package-lock.json  # Windows
npm install
```

### Problema 4: La cámara no se activa localmente

**Problema:**
- El scanner de cámara no funciona en `localhost`

**Solución:**
1. **Vite debe usar HTTPS localmente:**
   ```bash
   # Modificar vite.config.js para usar HTTPS
   npm run dev -- --https
   ```
   
   O usar un túnel como `ngrok` para HTTPS:
   ```bash
   ngrok http 5173
   ```

2. **Permisos de cámara:**
   - El navegador debe solicitar permisos de cámara
   - Permite el acceso cuando se solicite

### Problema 5: Cambios no se reflejan

**Problema:**
- Los cambios no aparecen en el navegador

**Solución:**
1. **Hard refresh del navegador:**
   - `Ctrl+Shift+R` (Windows/Linux)
   - `Cmd+Shift+R` (Mac)

2. **Limpiar caché del navegador:**
   - DevTools → Application → Clear Storage

3. **Reiniciar servidor:**
   ```bash
   # Detener (Ctrl+C) y reiniciar
   npm run dev
   ```

### Problema 6: Error de conexión con Supabase

**Error:**
```
Failed to fetch
Network error
```

**Solución:**
1. Verificar que las variables de entorno son correctas
2. Verificar conexión a internet
3. Verificar que el proyecto Supabase está activo
4. Revisar la consola del navegador para errores específicos

---

## 📋 Resumen de Comandos Rápidos

### Comandos Esenciales

```bash
# Navegar al frontend
cd frontend

# Instalar dependencias (solo primera vez o después de cambios en package.json)
npm install

# Iniciar servidor de desarrollo
npm run dev

# Compilar para producción (probar build)
npm run build

# Previsualizar build de producción
npm run preview
```

### Comandos de Git (Después de Verificar)

```bash
# Ver qué archivos cambiaron
git status

# Ver diferencias
git diff

# Agregar archivos modificados
git add .

# Hacer commit
git commit -m "Descripción de los cambios"

# Subir a producción
git push
```

---

## 🎯 Buenas Prácticas

### 1. **Siempre Verificar Localmente**

✅ **Antes de hacer push, siempre:**
- Ejecuta `npm run dev` localmente
- Prueba todas las funcionalidades modificadas
- Verifica que no hay errores en la consola

### 2. **Usar Ramas de Git (Opcional pero Recomendado)**

Para cambios grandes, crear una rama:

```bash
# Crear rama nueva
git checkout -b feature/mi-nueva-funcionalidad

# Hacer cambios y commits
# ...

# Cuando esté listo, fusionar a main
git checkout main
git merge feature/mi-nueva-funcionalidad
git push
```

### 3. **Mensajes de Commit Claros**

```bash
# Buen ejemplo
git commit -m "feat: Agregar scanner de cámara en inventario"

# Mal ejemplo
git commit -m "cambios"
```

### 4. **No Subir Credenciales**

✅ **Nunca subas:**
- Archivo `.env` (ya está en `.gitignore`)
- Credenciales de Supabase
- Tokens o claves privadas

---

## ✅ Checklist Pre-Producción

Antes de hacer push a producción, verifica:

- [ ] ✅ La aplicación funciona en `localhost:5173`
- [ ] ✅ No hay errores en la consola del navegador
- [ ] ✅ Todas las funcionalidades modificadas funcionan
- [ ] ✅ No hay errores de sintaxis o linting
- [ ] ✅ Las variables de entorno están configuradas en Vercel
- [ ] ✅ Los cambios están probados y funcionan correctamente
- [ ] ✅ El mensaje de commit es claro y descriptivo

---

## 📞 Soporte

Si tienes problemas con el despliegue local:

1. **Revisa este manual** primero
2. **Revisa la consola** del navegador (F12)
3. **Revisa los logs** del terminal donde corre `npm run dev`
4. **Verifica las variables de entorno** en `.env`
5. **Verifica la conexión** con Supabase

---

## 🎉 ¡Listo!

Una vez que hayas seguido estos pasos, tendrás el sistema corriendo localmente y podrás verificar todos los cambios antes de subirlos a producción.

**URL Local:** http://localhost:5173

**¡Desarrollo exitoso! 🚀**
