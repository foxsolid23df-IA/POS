# NEXUM POS en Android

## Ruta recomendada: PWA desde navegador

1. Publica `frontend` en un hosting HTTPS, preferentemente Vercel.
2. Abre la URL en Chrome para Android.
3. Usa el aviso `Instalar NEXUM POS` o el menu de Chrome `Agregar a pantalla principal`.
4. Abre la app desde el icono instalado.

La PWA funciona online. Puede cachear la interfaz, pero las ventas, inventario y cortes dependen de Supabase/API.

## Verificacion PWA

```powershell
cd frontend
npm run build
npm run preview
```

En produccion, valida:

- Login y permisos.
- Ventas, inventario y corte de caja.
- Escaneo por camara con HTTPS.
- Impresion usando el dialogo del sistema o RawBT en Android.

## Ruta respaldo: APK con Capacitor

El proyecto Android ya esta en `frontend/android`.

Requisitos:

- Android Studio o Android SDK instalado.
- `ANDROID_HOME`, `ANDROID_SDK_ROOT` o `frontend/android/local.properties`.

Ejemplo de `frontend/android/local.properties`:

```properties
sdk.dir=C:\\Users\\TU_USUARIO\\AppData\\Local\\Android\\Sdk
```

Comandos:

```powershell
cd frontend
npm run android:sync
npm run android:debug
```

El APK debug queda en:

```text
frontend/android/app/build/outputs/apk/debug/app-debug.apk
```
