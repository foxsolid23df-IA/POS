// Hook para manejar el modo escáner Bluetooth en tablets Android y otros dispositivos
// Cuando está activo, suprime el teclado virtual en los inputs de búsqueda
// ya que el escáner Bluetooth actúa como un teclado hardware.
import { useState, useEffect, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'

const STORAGE_KEY = 'pos_scanner_mode'

export const useScannerMode = () => {
    // Habilitar para todos los dispositivos (Android nativo y navegadores web)
    const isAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
    const isAvailable = true // Disponible en todos los dispositivos

    // Leer estado guardado desde localStorage
    const [scannerMode, setScannerMode] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY)
            return saved === 'true'
        } catch {
            return false
        }
    })

    // Persistir cambios
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, scannerMode ? 'true' : 'false')
    }, [scannerMode])

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
    const scannerInputMode = scannerMode ? 'none' : 'search'

    return {
        isAvailable,         // Siempre true - disponible en todos los dispositivos
        isAndroid,           // true solo en Android nativo
        scannerMode,         // true = modo escáner activo (sin teclado virtual)
        scannerInputMode,    // "none" o "search" - usar directamente en el prop inputMode
        toggleScannerMode,
        enableScannerMode,
        disableScannerMode,
    }
}

export default useScannerMode
