// Hook para manejar el modo escáner Bluetooth en tablets Android
// Cuando está activo, suprime el teclado virtual en los inputs de búsqueda
// ya que el escáner Bluetooth actúa como un teclado hardware.
import { useState, useEffect, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'

const STORAGE_KEY = 'pos_scanner_mode'

export const useScannerMode = () => {
    // Solo relevante en Android nativo
    const isAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'

    // Leer estado guardado desde localStorage
    const [scannerMode, setScannerMode] = useState(() => {
        if (!isAndroid) return false
        try {
            const saved = localStorage.getItem(STORAGE_KEY)
            return saved === 'true'
        } catch {
            return false
        }
    })

    // Persistir cambios
    useEffect(() => {
        if (isAndroid) {
            localStorage.setItem(STORAGE_KEY, scannerMode ? 'true' : 'false')
        }
    }, [scannerMode, isAndroid])

    // Toggle
    const toggleScannerMode = useCallback(() => {
        setScannerMode(prev => !prev)
    }, [])

    // Activar
    const enableScannerMode = useCallback(() => {
        setScannerMode(true)
    }, [])

    // Desactivar
    const disableScannerMode = useCallback(() => {
        setScannerMode(false)
    }, [])

    // El inputMode que se debe aplicar a los inputs de búsqueda/escaneo
    // "none" = no muestra teclado virtual, pero el campo sigue recibiendo input del escáner BT
    // "search" / "text" = comportamiento normal con teclado virtual
    const scannerInputMode = (isAndroid && scannerMode) ? 'none' : 'search'

    return {
        isAndroid,
        scannerMode,         // true = modo escáner activo (sin teclado virtual)
        scannerInputMode,    // "none" o "search" - usar directamente en el prop inputMode
        toggleScannerMode,
        enableScannerMode,
        disableScannerMode,
    }
}

export default useScannerMode
