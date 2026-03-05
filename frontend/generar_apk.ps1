Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  COMPILADOR AUTOMÁTICO DE APK - NEXUM POS  " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Compilar aplicación web
Write-Host "`n[1/4] Compilando aplicación web..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Error en la compilación web." -ForegroundColor Red; exit }

# 2. Sincronizar con Capacitor Android
Write-Host "`n[2/4] Sincronizando plataforma Android..." -ForegroundColor Yellow
npx cap sync android
if ($LASTEXITCODE -ne 0) { Write-Host "Error sincronizando Android." -ForegroundColor Red; exit }

# 3. Generar Iconos del APK 
# Nota: La imagen debe estar en 'assets/icon.png'
Write-Host "`n[3/4] Generando iconos desde assets/icon.png..." -ForegroundColor Yellow
npx @capacitor/assets generate --android
if ($LASTEXITCODE -ne 0) { Write-Host "Error generando archivos de icono. Verifica que assets/icon.png exista y sea valido." -ForegroundColor Red; exit }

# 4. Construir APK con Gradle
Write-Host "`n[4/4] Compilando el APK (Modo Debug)..." -ForegroundColor Yellow
cd android
.\gradlew assembleDebug

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n¡APK COMPILADO EXITOSAMENTE!" -ForegroundColor Green
    $apkPath = "app\build\outputs\apk\debug\app-debug.apk"
    if (Test-Path $apkPath) {
        Write-Host "Tu APK está listo en: " -NoNewline; Write-Host "$(Resolve-Path $apkPath)" -ForegroundColor Cyan
        Write-Host "Abriendo la carpeta del APK..." -ForegroundColor Yellow
        explorer.exe "app\build\outputs\apk\debug\"
    }
} else {
    Write-Host "`nError al compilar el código Android usando Gradle." -ForegroundColor Red
}
cd ..
