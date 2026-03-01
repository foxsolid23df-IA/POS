// ===== HOOK PARA MANEJAR LLAMADAS AL BACKEND =====
// Hook simple para manejar carga, errores y peticiones

import { useState, useCallback, useRef, useEffect } from 'react'

export const useApi = () => {
    // 1. ESTADOS SIMPLES
    const [cargando, setCargando] = useState(false)    // Si está cargando
    const [error, setError] = useState('')             // Mensaje de error
    const [datos, setDatos] = useState(null)           // Datos de la respuesta

    // Ref para rastrear si el componente está montado
    const isMountedRef = useRef(true);

    // Marcar como desmontado al limpiar
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // 2. FUNCIÓN PARA EJECUTAR CUALQUIER PETICIÓN
    const ejecutarPeticion = useCallback(async (funcionApi, timeoutMs = 15000) => {
        // Crear un AbortController local para esta petición específica
        const controller = new AbortController();
        const signal = controller.signal;

        if (!isMountedRef.current) return;

        setCargando(true)
        setError('')

        // Timeout ID
        let timeoutId;
        let timedOut = false; // Flag local para controlar timeout explícitamente

        try {
            // Configurar timeout si se especificó
            if (timeoutMs > 0) {
                timeoutId = setTimeout(() => {
                    timedOut = true;
                    controller.abort('TIMEOUT');
                }, timeoutMs);
            }

            const resultado = await funcionApi(signal)

            // Limpiar timeout si termina con éxito
            if (timeoutId) clearTimeout(timeoutId);

            // Solo actualizar estado si el componente sigue montado
            if (isMountedRef.current) {
                setDatos(resultado)
                setCargando(false)
            }
            return resultado
        } catch (err) {
            // Limpiar timeout en caso de error
            if (timeoutId) clearTimeout(timeoutId);

            // Ignorar errores de cancelación (salvo que sea por timeout)
            // Usamos la flag local timedOut que es más segura que signal.reason
            const isTimeout = timedOut || signal.reason === 'TIMEOUT' || err === 'TIMEOUT';

            if ((err.name === 'AbortError' || signal.aborted) && !isTimeout) {
                console.log('Petición cancelada por nueva solicitud o desmontaje');
                // IMPORTANTE: Resetear cargando incluso en cancelaciones
                if (isMountedRef.current) {
                    setCargando(false)
                }
                return null;
            }

            // CRÍTICO: Siempre resetear el estado de cargando ANTES de lanzar el error
            if (isMountedRef.current) {
                const mensajeError = isTimeout ? 'La solicitud tardó demasiado. Por favor intenta de nuevo.' : (err.message || 'Error al conectar con el servidor');
                setError(mensajeError)
                setCargando(false) // SIEMPRE resetear cargando
            }

            // Lanzar el error DESPUÉS de resetear el estado
            throw err
        }
    }, [])

    // 3. FUNCIÓN PARA LIMPIAR ERRORES
    const limpiarError = useCallback(() => {
        if (isMountedRef.current) {
            setError('')
        }
    }, [])

    // 4. DEVOLVER TODO LO QUE NECESITA EL COMPONENTE
    return {
        datos,
        cargando,
        error,
        ejecutarPeticion,
        limpiarError
    }
}
