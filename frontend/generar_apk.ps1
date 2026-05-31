$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  COMPILADOR DE APK - NEXUM POS" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

function Test-AndroidSdk {
    if ($env:ANDROID_HOME -and (Test-Path $env:ANDROID_HOME)) {
        return $true
    }

    if ($env:ANDROID_SDK_ROOT -and (Test-Path $env:ANDROID_SDK_ROOT)) {
        return $true
    }

    if (Test-Path "android\local.properties") {
        return $true
    }

    return $false
}

if (-not (Test-AndroidSdk)) {
    Write-Host "`nNo se encontro Android SDK." -ForegroundColor Red
    Write-Host "Instala Android Studio o configura una de estas opciones:" -ForegroundColor Yellow
    Write-Host "  1. ANDROID_HOME apuntando a tu SDK"
    Write-Host "  2. ANDROID_SDK_ROOT apuntando a tu SDK"
    Write-Host "  3. android\local.properties con sdk.dir=C:\\Users\\TU_USUARIO\\AppData\\Local\\Android\\Sdk"
    exit 1
}

Write-Host "`n[1/4] Compilando aplicacion web..." -ForegroundColor Yellow
npm run build

Write-Host "`n[2/4] Sincronizando Capacitor Android..." -ForegroundColor Yellow
npx cap sync android

Write-Host "`n[3/4] Generando iconos Android..." -ForegroundColor Yellow
npx @capacitor/assets generate --android

Write-Host "`n[4/4] Compilando APK debug..." -ForegroundColor Yellow
Push-Location android
try {
    .\gradlew.bat assembleDebug
}
finally {
    Pop-Location
}

$apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
if (Test-Path $apkPath) {
    Write-Host "`nAPK compilado correctamente:" -ForegroundColor Green
    Write-Host (Resolve-Path $apkPath) -ForegroundColor Cyan
}
