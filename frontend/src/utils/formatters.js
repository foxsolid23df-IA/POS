// ===== UTILIDADES GENERALES =====
// Funciones útiles que se usan en toda la aplicación

// 1. FORMATEAR DINERO EN PESOS ARGENTINOS
export const formatearDinero = (cantidad) => {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS'
    }).format(cantidad)
}

// 2. VALIDAR CÓDIGOS DE BARRAS
export const validarCodigoBarras = (codigo) => {
    // Verificar que no esté vacío y que sea un string
    if (!codigo || typeof codigo !== 'string') {
        return false
    }
    
    // Limpiar espacios y verificar que tenga al menos 1 caracter
    const codigoLimpio = codigo.trim()
    return codigoLimpio.length > 0
}

// 3. FORMATEAR FECHA Y HORA 
export const formatearFechaHora = (fecha) => {
    const fechaObj = new Date(fecha)
    
    // Fecha en formato español
    const fechaFormateada = fechaObj.toLocaleDateString('es-ES')
    
    // Hora sin segundos
    const horaFormateada = fechaObj.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit' 
    })
    
    return `${fechaFormateada} - ${horaFormateada}`
}

// 4. FORMATEAR FECHA SOLO (sin hora)
export const formatearFecha = (fecha) => {
  if (!fecha) return '---';
  return new Date(fecha).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

// 5. FORMATEAR DINERO (alias en inglés para compatibilidad)
export const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(amount || 0)
}

// 5. CONTAR PRODUCTOS TOTALES EN UNA LISTA
export const contarProductos = (productos) => {
    return productos.reduce((total, producto) => {
        return total + producto.quantity
    }, 0)
}
