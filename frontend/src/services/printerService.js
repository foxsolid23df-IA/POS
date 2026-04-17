// Servicio genérico para manejar la impresión de tickets
// Soporta: Electron (nativo), Web (iframe), Capacitor/Android (iframe + RawBT)

/**
 * Imprime un string HTML (en formato de ticket).
 * 
 * - En ELECTRON (.exe): Usa IPC para imprimir directamente por el sistema operativo,
 *   sin abrir diálogo de vista previa (impresión silenciosa a la impresora por defecto).
 * - En WEB/ANDROID: Usa un iframe oculto + window.print() que en Android es
 *   capturado por apps como RawBT para enviar a impresora térmica.
 *
 * @param {string} htmlContent - El contenido HTML completo con hoja de estilos inline
 */
export const printHtmlTicket = (htmlContent) => {
    try {
        // ═══════════════════════════════════════════════════════════
        // RUTA 1: ELECTRON (app de escritorio .exe)
        // ═══════════════════════════════════════════════════════════
        if (window.electronAPI && window.electronAPI.isElectron) {
            console.log("[PrinterService] ✅ Electron detectado — imprimiendo por IPC nativo");
            window.electronAPI.print(htmlContent);
            return; // Salir inmediatamente, no crear iframe
        }

        // ═══════════════════════════════════════════════════════════
        // RUTA 2: WEB / ANDROID (Capacitor + RawBT)
        // ═══════════════════════════════════════════════════════════
        console.log("[PrinterService] Usando método de iframe (Web/Android)");

        const iframe = document.createElement('iframe');
        iframe.style.visibility = 'hidden';
        iframe.style.position = 'absolute';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = 'none';

        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentWindow || iframe.contentDocument.document || iframe.contentDocument;
        iframeDoc.document.open();
        iframeDoc.document.write(htmlContent);
        iframeDoc.document.close();

        // Esperar un breve momento para renderizar estilos/fuentes
        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();

            // Remover el iframe después de un tiempo razonable para no llenar el DOM
            setTimeout(() => {
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
            }, 5000);
        }, 300);

    } catch (error) {
        console.error("Error al intentar imprimir el ticket:", error)
        throw error
    }
}

export const printerService = {
    printHtmlTicket
}
