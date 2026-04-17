@echo off
chcp 65001 >nul 2>&1
echo ====================================
echo   NEXUM POS - Build Installer
echo ====================================
echo.

:: Leer version desde package.json
for /f "tokens=2 delims=:, " %%a in ('findstr "\"version\"" package.json') do (
    set VERSION=%%~a
    goto :found_version
)
:found_version
echo Version detectada: %VERSION%
echo.

echo [1/4] Instalando dependencias principales...
call npm install
if errorlevel 1 goto error

echo.
echo [2/4] Instalando dependencias del backend...
cd backend
call npm install --production
if errorlevel 1 goto error
cd ..

echo.
echo [3/4] Instalando dependencias del frontend...
cd frontend
call npm install
if errorlevel 1 goto error
cd ..

echo.
echo [4/5] Preparando Node.js portable...
if not exist "bin" mkdir bin
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js no encontrado en este equipo.
    echo Se requiere Node.js instalado para crear el instalador.
    goto error
)
for /f "tokens=*" %%i in ('where node') do (
    copy /Y "%%i" "bin\node.exe" >nul
    echo    node.exe copiado a bin\
    goto :node_done
)
:node_done

echo.
echo [5/5] Construyendo app y creando instalador...
echo          (este paso puede tardar varios minutos)
call npm run dist
if errorlevel 1 goto error

echo.
echo ====================================
echo   BUILD COMPLETADO EXITOSAMENTE!
echo ====================================
echo.
echo El instalador esta en: release\
echo Archivo: NEXUM POS Setup %VERSION%.exe
echo.
echo Antes de distribuir, verifica que:
echo   1. El .exe se instala correctamente
echo   2. La aplicacion abre sin cerrarse
echo   3. El login funciona
echo.
pause
goto end

:error
echo.
echo ====================================
echo   ERROR EN EL BUILD
echo ====================================
echo.
echo Revisa los mensajes anteriores para
echo identificar el problema.
echo.
pause
exit /b 1

:end
