# 🚀 Instrucciones para Desplegar en Vercel

Esta guía te ayudará a desplegar los cambios del scanner de cámara a Vercel.

---

## 📋 Opción 1: Despliegue Automático (Git) - RECOMENDADO

Si tu proyecto está conectado a GitHub/GitLab/Bitbucket, Vercel se despliega automáticamente:

### Pasos:

1. **Verificar que los cambios estén en Git:**
```bash
git status
```

2. **Agregar los archivos modificados:**
```bash
git add frontend/src/components/sales/Sales.jsx
git add frontend/src/services/productService.js
```

3. **Hacer commit:**
```bash
git commit -m "feat: Integrar scanner de cámara completo"
```

4. **Hacer push:**
```bash
git push
```

5. **Verificar en Vercel:**
   - Vercel detectará automáticamente el push
   - Ir a tu dashboard de Vercel: https://vercel.com/dashboard
   - Verás un nuevo deployment en proceso
   - Espera 2-3 minutos para que complete

---

## 📋 Opción 2: Despliegue Manual con Vercel CLI

### Paso 1: Instalar Vercel CLI (si no lo tienes)

```bash
npm install -g vercel
```

### Paso 2: Autenticarte en Vercel

```bash
vercel login
```

Sigue las instrucciones en el navegador para autenticarte.

### Paso 3: Navegar al directorio frontend

```bash
cd frontend
```

### Paso 4: Desplegar a Producción

```bash
vercel --prod
```

**Respuestas a las preguntas:**
- `Set up and deploy?` → **Y** (Yes)
- `Which scope?` → Selecciona tu cuenta
- `Link to existing project?` → **Y** (si ya tienes un proyecto)
- `What's the name of your project?` → `sistema-ventas` (o el nombre que uses)
- `In which directory is your code located?` → **./** (el directorio actual `frontend`)

### Paso 5: Verificar Variables de Entorno

Asegúrate de que estas variables estén configuradas en Vercel:

1. Ve a: https://vercel.com/dashboard → Tu Proyecto → Settings → Environment Variables
2. Verifica que existan:
   - `VITE_SUPABASE_URL` (tu URL de Supabase)
   - `VITE_SUPABASE_ANON_KEY` (tu clave anónima de Supabase)

---

## 📋 Opción 3: Despliegue desde Vercel Dashboard (Web)

### Paso 1: Ir al Dashboard de Vercel

https://vercel.com/dashboard

### Paso 2: Seleccionar tu Proyecto

Busca y selecciona tu proyecto "sistema-ventas"

### Paso 3: Configurar Root Directory (si es necesario)

1. Ve a **Settings** → **General**
2. En **Root Directory**, asegúrate de que esté configurado como `frontend`
   - Si no está configurado, haz clic en **Edit** y selecciona `frontend`
   - Guarda los cambios

### Paso 4: Forzar Nuevo Deployment

1. Ve a la pestaña **Deployments**
2. Haz clic en el menú **...** del último deployment
3. Selecciona **Redeploy**
4. Confirma el redeploy

O simplemente haz un pequeño cambio y haz push a tu repositorio Git conectado.

---

## ✅ Verificar el Despliegue

### 1. Verificar que el build sea exitoso

En el dashboard de Vercel, verifica que el último deployment tenga estado **Ready** ✅

### 2. Probar la funcionalidad

1. Abre tu aplicación en: https://sistema-ventas-topaz.vercel.app (o tu URL)
2. Ve a la sección de Ventas
3. Verifica que el botón **"Cámara"** aparezca junto al input de búsqueda
4. Haz clic en el botón para verificar que se abre el modal del scanner

### 3. Verificar en la Consola del Navegador

Abre las DevTools (F12) y verifica que no haya errores en la consola relacionados con:
- `CameraScanner`
- `getProductByBarcode`
- `html5-qrcode`

---

## 🔧 Solución de Problemas

### Error: "Cannot find module"

**Problema:** El build falla porque no encuentra módulos.

**Solución:**
1. Verifica que `vercel.json` esté en el directorio `frontend/`
2. Asegúrate de que el Root Directory en Vercel esté configurado como `frontend`
3. Verifica que `package.json` en `frontend/` tenga todas las dependencias

### Error: Variables de entorno no encontradas

**Problema:** La aplicación no puede conectar con Supabase.

**Solución:**
1. Ve a Settings → Environment Variables en Vercel
2. Asegúrate de que `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` estén configuradas
3. Haz un redeploy después de agregar las variables

### El botón de cámara no aparece

**Problema:** Los cambios no se desplegaron correctamente.

**Solución:**
1. Verifica que los archivos se hayan subido a Git
2. Revisa los logs de build en Vercel para ver errores
3. Limpia la caché del navegador (Ctrl+Shift+R)

### La cámara no se activa

**Problema:** Permisos de cámara o HTTPS.

**Solución:**
1. Vercel usa HTTPS por defecto (necesario para acceder a la cámara) ✅
2. Asegúrate de permitir permisos de cámara en el navegador
3. Verifica que tu cámara esté disponible y funcionando

---

## 📝 Resumen de Archivos Modificados

Los siguientes archivos fueron modificados y deben estar en el deployment:

1. ✅ `frontend/src/services/productService.js`
   - Agregado método `getProductByBarcode()`

2. ✅ `frontend/src/components/sales/Sales.jsx`
   - Agregado import de `buscarProductoPorCodigo`
   - Agregado botón "Cámara" en la UI
   - Agregado componente `CameraScanner` renderizado
   - Mejorada validación en `manejarEscaneoCamara`

---

## 🎯 Comandos Rápidos (Resumen)

```bash
# 1. Ir al directorio frontend
cd frontend

# 2. Verificar cambios
git status

# 3. Agregar y commit
git add frontend/src/components/sales/Sales.jsx frontend/src/services/productService.js
git commit -m "feat: Integrar scanner de cámara completo"

# 4. Push (despliegue automático si está conectado)
git push

# O desplegar manualmente con CLI
vercel --prod
```

---

## 📞 Soporte

Si tienes problemas con el despliegue:
1. Revisa los logs de build en Vercel
2. Verifica la consola del navegador para errores
3. Asegúrate de que las variables de entorno estén configuradas

¡Listo! Tu scanner de cámara debería estar funcionando en producción. 🎉
