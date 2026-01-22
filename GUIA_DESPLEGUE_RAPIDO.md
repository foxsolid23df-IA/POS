# 🚀 Guía de Despliegue Local Rápido

He configurado el entorno local para que puedas ejecutar el proyecto inmediatamente. Aquí tienes los pasos detallados:

## 1. Configuración de Variables de Entorno

He creado un archivo `.env` en la carpeta `frontend/` con las credenciales de tu proyecto de Supabase:

- **VITE_SUPABASE_URL**: `https://qqvjhitxehlqyvawnept.supabase.co`
- **VITE_SUPABASE_ANON_KEY**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

## 2. Instalación de Dependencias

Si necesitas reinstalarlas en el futuro, ejecuta los siguientes comandos desde la carpeta raíz:

```bash
# Instalar dependencias del Frontend
cd frontend
npm install
cd ..

# Instalar dependencias del Backend (SQLite/Electron logic)
cd backend
npm install
cd ..
```

## 3. Ejecución del Proyecto

Para iniciar el sistema en modo desarrollo, abre **tres terminales** y ejecuta:

### Terminal 1: Backend

```bash
cd backend
npm run dev
```

### Terminal 2: Frontend

```bash
cd frontend
npm run dev
```

### Terminal 3 (Opcional): Electron

Si quieres ver la aplicación como un programa de escritorio:

```bash
npm run electron:dev
```

## 4. Acceso al Sistema

Una vez iniciados los servidores:

- Abre tu navegador en: **http://localhost:5173**
- El PIN Maestro configurado en el sistema es: `2026SOP` (según `ACCESO_SOPORTE_CONFIDENCIAL.md`)
- El PIN del administrador por defecto en el backend local es: `1234`

---

## 🛠️ Notas Adicionales

- **Base de Datos Local**: El backend utiliza SQLite para ciertas funciones locales cuando se ejecuta en Electron.
- **Base de Datos Cloud**: El frontend se comunica directamente con Supabase para la gestión de productos, ventas y usuarios.
- **Scanner**: Para que el scanner de cámara funcione localmente, el navegador puede requerir acceso HTTPS o permisos especiales en `localhost`.

¡El sistema ya está listo y corriendo en tu máquina!
