// Componente de Scanner de Cámara para códigos de barras y QR
import React, { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import './CameraScanner.css'

const CameraScanner = ({ isOpen, onClose, onScan }) => {
    const [isScanning, setIsScanning] = useState(false)
    const [error, setError] = useState(null)
    const [hasPermission, setHasPermission] = useState(null)
    const [cameras, setCameras] = useState([])
    const [selectedCamera, setSelectedCamera] = useState(null)
    const scannerRef = useRef(null)
    const html5QrcodeRef = useRef(null)

    // Obtener cámaras disponibles
    useEffect(() => {
        if (isOpen) {
            Html5Qrcode.getCameras()
                .then((devices) => {
                    if (devices && devices.length > 0) {
                        setCameras(devices)
                        // Preferir cámara trasera
                        const backCamera = devices.find(
                            (cam) =>
                                cam.label.toLowerCase().includes('back') ||
                                cam.label.toLowerCase().includes('trasera') ||
                                cam.label.toLowerCase().includes('rear') ||
                                cam.label.toLowerCase().includes('environment')
                        )
                        setSelectedCamera(backCamera?.id || devices[0].id)
                        setHasPermission(true)
                    } else {
                        setError('No se encontraron cámaras disponibles')
                        setHasPermission(false)
                    }
                })
                .catch((err) => {
                    console.error('Error obteniendo cámaras:', err)
                    setError('No se pudo acceder a la cámara. Verifica los permisos.')
                    setHasPermission(false)
                })
        }
    }, [isOpen])

    // Iniciar/detener scanner cuando cambia la cámara seleccionada
    useEffect(() => {
        if (isOpen && selectedCamera && hasPermission) {
            startScanner()
        }

        return () => {
            stopScanner()
        }
    }, [isOpen, selectedCamera, hasPermission])

    const startScanner = async () => {
        if (!selectedCamera) return

        try {
            // Si ya hay un scanner corriendo, detenerlo primero
            if (html5QrcodeRef.current) {
                await stopScanner()
            }

            html5QrcodeRef.current = new Html5Qrcode('camera-scanner-region')

            // Detectar si es dispositivo móvil o escritorio
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            const isDesktop = !isMobile

            // Configuración optimizada para webcams de escritorio
            // Las webcams de laptop necesitan área de escaneo más grande y mejor resolución
            const config = {
                fps: isDesktop ? 5 : 10, // Menor FPS en desktop para mejor calidad por frame
                qrbox: isDesktop 
                    ? { width: 400, height: 300 } // Área más grande para webcams de laptop
                    : { width: 250, height: 150 }, // Área normal para móviles
                aspectRatio: isDesktop ? 1.333 : 1.0, // 4:3 para webcams típicas
                disableFlip: false,
                // Formatos soportados
                formatsToSupport: [
                    0,  // QR_CODE
                    1,  // AZTEC
                    2,  // CODABAR
                    3,  // CODE_39
                    4,  // CODE_93
                    5,  // CODE_128
                    6,  // DATA_MATRIX
                    7,  // MAXICODE
                    8,  // ITF
                    9,  // EAN_13
                    10, // EAN_8
                    11, // PDF_417
                    12, // RSS_14
                    13, // RSS_EXPANDED
                    14, // UPC_A
                    15, // UPC_E
                    16, // UPC_EAN_EXTENSION
                ]
            }

            // Iniciar scanner con configuración optimizada
            await html5QrcodeRef.current.start(
                selectedCamera,
                config,
                (decodedText) => {
                    // Código escaneado exitosamente
                    handleSuccessfulScan(decodedText)
                },
                (errorMessage) => {
                    // Ignorar errores de escaneo continuo (son normales)
                }
            )

            setIsScanning(true)
            setError(null)
        } catch (err) {
            console.error('Error iniciando scanner:', err)
            setError('Error al iniciar la cámara. Intenta de nuevo.')
            setIsScanning(false)
        }
    }

    const stopScanner = async () => {
        if (html5QrcodeRef.current) {
            try {
                const state = html5QrcodeRef.current.getState()
                if (state === 2) { // SCANNING
                    await html5QrcodeRef.current.stop()
                }
                html5QrcodeRef.current.clear()
            } catch (err) {
                console.error('Error deteniendo scanner:', err)
            }
            html5QrcodeRef.current = null
        }
        setIsScanning(false)
    }

    const handleSuccessfulScan = async (decodedText) => {
        // Vibrar el dispositivo si está disponible
        if (navigator.vibrate) {
            navigator.vibrate(100)
        }

        // Detener el scanner
        await stopScanner()

        // Llamar callback con el código
        onScan(decodedText)

        // Cerrar el modal
        onClose()
    }

    const handleClose = async () => {
        await stopScanner()
        setError(null)
        setCameras([])
        setSelectedCamera(null)
        setHasPermission(null)
        onClose()
    }

    const handleCameraChange = (e) => {
        setSelectedCamera(e.target.value)
    }

    if (!isOpen) return null

    return (
        <div className="camera-scanner-overlay" onClick={handleClose}>
            <div className="camera-scanner-modal" onClick={(e) => e.stopPropagation()}>
                <div className="camera-scanner-header">
                    <h3>📷 Escanear Código</h3>
                    <button className="close-scanner-btn" onClick={handleClose}>
                        ✕
                    </button>
                </div>

                <div className="camera-scanner-body">
                    {/* Selector de cámara */}
                    {cameras.length > 1 && (
                        <div className="camera-selector">
                            <label>Cámara:</label>
                            <select value={selectedCamera || ''} onChange={handleCameraChange}>
                                {cameras.map((cam) => (
                                    <option key={cam.id} value={cam.id}>
                                        {cam.label || `Cámara ${cam.id}`}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Región del scanner */}
                    <div className="scanner-container">
                        <div id="camera-scanner-region" ref={scannerRef}></div>

                        {/* Overlay con guía de escaneo */}
                        {isScanning && (
                            <div className="scan-overlay">
                                <div className="scan-frame">
                                    <div className="scan-corner top-left"></div>
                                    <div className="scan-corner top-right"></div>
                                    <div className="scan-corner bottom-left"></div>
                                    <div className="scan-corner bottom-right"></div>
                                    <div className="scan-line"></div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Mensajes de estado */}
                    {error && (
                        <div className="scanner-error">
                            <span>⚠️</span>
                            <p>{error}</p>
                            <button onClick={startScanner}>Reintentar</button>
                        </div>
                    )}

                    {hasPermission === false && !error && (
                        <div className="scanner-permission">
                            <span>🔒</span>
                            <p>Se necesita permiso para acceder a la cámara</p>
                            <button onClick={() => window.location.reload()}>
                                Solicitar permiso
                            </button>
                        </div>
                    )}

                    {isScanning && (
                        <p className="scanner-instructions">
                            Apunta la cámara al código de barras o QR
                        </p>
                    )}
                </div>

                <div className="camera-scanner-footer">
                    <div className="supported-formats">
                        <span>Formatos: EAN-13, EAN-8, UPC, Code 128, QR</span>
                    </div>
                    <button className="cancel-scan-btn" onClick={handleClose}>
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    )
}

export default CameraScanner
