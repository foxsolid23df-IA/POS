// Servicio genérico para manejar la impresión de tickets
// Soporta window.print() para Web/Local y Capacitor de forma nativa mediante Iframe

/**
 * Imprime un string HTML (en formato de ticket) usando un iframe oculto.
 * Esto evita usar window.open() que suele ser bloqueado por Android WebViews (Capacitor).
 * En Android, usando apps como "RawBT", window.print() del iframe es capturado
 * y mandado directo a la impresora térmica (Bluetooth, USB o LAN).
 *
 * @param {string} htmlContent - El contenido HTML completo con hoja de estilos inline
 */
export const printHtmlTicket = (htmlContent) => {
    try {
        // Crear un iframe oculto
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

        // Si estamos en Electron, usar la API nativa
        if (window.electronAPI && window.electronAPI.print) {
            console.log("[PrinterService] Usando API nativa de Electron");
            window.electronAPI.print(htmlContent);
            return;
        }

        // Si no estamos en Electron (Web o Capacitor), usar el método del iframe
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
