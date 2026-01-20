# 🚀 Guía de Despliegue Manual a Vercel

## Pasos para Desplegar Manualmente

### **Paso 1: Instalar Vercel CLI (Primera vez)**
```bash
npm install -g vercel
```

### **Paso 2: Navegar a la carpeta frontend**
```bash
cd frontend
```

### **Paso 3: Iniciar sesión en Vercel (Primera vez)**
```bash
vercel login
```
Esto abrirá tu navegador para autenticarte.

### **Paso 4: Desplegar a Producción**
```bash
vercel --prod
```

---

## ⚙️ Configuración de Variables de Entorno

Si es la primera vez que despliegas, necesitas configurar las variables de entorno:

### **Opción A: Desde la línea de comandos**
```bash
cd frontend

# Agregar URL de Supabase
vercel env add VITE_SUPABASE_URL production

# Agregar Key de Supabase
vercel env add VITE_SUPABASE_ANON_KEY production
```

Cada comando te pedirá ingresar el valor correspondiente.

### **Opción B: Desde el Dashboard de Vercel**
1. Ve a https://vercel.com/dashboard
2. Selecciona tu proyecto
3. Ve a **Settings** → **Environment Variables**
4. Agrega:
   - `VITE_SUPABASE_URL` = Tu URL de Supabase
   - `VITE_SUPABASE_ANON_KEY` = Tu clave anónima de Supabase
5. Asegúrate de que estén marcadas para **Production**

---

## 📋 Comandos Rápidos (Resumen)

```bash
# Si ya tienes Vercel CLI instalado y configurado:
cd frontend
vercel --prod
```

---

## 🔍 Verificar el Despliegue

Después del despliegue, Vercel mostrará:
- ✅ URL de producción: `https://tu-proyecto.vercel.app`
- ✅ Build logs y estadísticas

---

## ⚠️ Notas Importantes

1. **Directorio**: Asegúrate de estar en `frontend/` al ejecutar `vercel --prod`
2. **Variables de Entorno**: Deben estar configuradas antes del primer despliegue
3. **Build**: Vercel detectará automáticamente que es un proyecto Vite gracias a `vercel.json`
4. **Actualizaciones**: Cada vez que hagas `git push`, si tienes integración con GitHub, Vercel desplegará automáticamente. Usa `vercel --prod` solo para despliegues manuales.

---

## 🆘 Solución de Problemas

### Error: "Command not found: vercel"
```bash
npm install -g vercel
```

### Error: "No authentication found"
```bash
vercel login
```

### Error: "Environment variables not found"
- Verifica que hayas agregado `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
- Asegúrate de que estén marcadas para el ambiente **Production**

### Ver logs de build
```bash
vercel logs
```
