// Hook para detectar si el dispositivo es móvil/táctil
import { useState, useEffect } from 'react'

export const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(false)
    const [isTouchDevice, setIsTouchDevice] = useState(false)

    useEffect(() => {
        // Verificar si es un dispositivo táctil
        const checkTouch = () => {
            return (
                'ontouchstart' in window ||
                navigator.maxTouchPoints > 0 ||
                navigator.msMaxTouchPoints > 0
            )
        }

        // Verificar el ancho de pantalla
        const checkMobile = () => {
            return window.innerWidth <= 768
        }

        // Verificar media query de hover (dispositivos sin hover = táctiles)
        const checkHover = () => {
            return window.matchMedia('(hover: none)').matches
        }

        const updateState = () => {
            const touchDevice = checkTouch() || checkHover()
            setIsTouchDevice(touchDevice)
            setIsMobile(checkMobile() || touchDevice)
        }

        // Ejecutar al montar
        updateState()

        // Escuchar cambios de tamaño
        window.addEventListener('resize', updateState)

        return () => {
            window.removeEventListener('resize', updateState)
        }
    }, [])

    return { isMobile, isTouchDevice }
}

export default useIsMobile
