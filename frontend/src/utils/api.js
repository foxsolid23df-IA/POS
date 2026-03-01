// ===== CLIENTE PARA LLAMADAS AL BACKEND =====
// Funciones simples para comunicarse con el servidor

// 1. URL BASE DEL BACKEND
import { config } from '../config/index.js';
const URL_BASE = config.api.baseUrl.replace(/\/$/, ''); // sin barra final

// 2. FUNCIÓN PRINCIPAL PARA HACER PETICIONES
const hacerPeticion = async (url, opciones = {}, signal = null) => {
    try {
        console.log(`📡 Llamando a: ${url}`)
        
        const fetchOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...opciones.headers
            },
            ...opciones
        };
        
        // Agregar signal si está disponible
        if (signal) {
            fetchOptions.signal = signal;
        }
        
        const respuesta = await fetch(url, fetchOptions)

        if (!respuesta.ok) {
            throw new Error(`Error ${respuesta.status}: ${respuesta.statusText}`)
        }

        const datos = await respuesta.json()
        console.log(`✅ Respuesta recibida:`, datos)
        return datos

    } catch (error) {
        // No loguear errores de cancelación
        if (error.name === 'AbortError') {
            console.log('📡 Petición cancelada');
            throw error;
        }
        console.error(`❌ Error en petición:`, error.message)
        throw error
    }
}

// 3. FUNCIONES PARA PRODUCTOS
export const obtenerProductos = async (limit = 1000, offset = 0, signal = null) => {
    const respuesta = await hacerPeticion(`${URL_BASE}/api/products?limit=${limit}&offset=${offset}`, {}, signal)
    // Si la respuesta tiene estructura paginada, extraer el array de productos
    return respuesta.productos || respuesta
}

export const buscarProductoPorCodigo = async (codigo, signal = null) => {
    return hacerPeticion(`${URL_BASE}/api/products/barcode/${codigo}`, {}, signal)
}

export const crearProducto = async (datosProducto) => {
    return hacerPeticion(`${URL_BASE}/api/products`, {
        method: 'POST',
        body: JSON.stringify(datosProducto)
    })
}

export const actualizarProducto = async (id, datosProducto) => {
    return hacerPeticion(`${URL_BASE}/api/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(datosProducto)
    })
}

export const eliminarProducto = async (id) => {
    return hacerPeticion(`${URL_BASE}/api/products/${id}`, {
        method: 'DELETE'
    })
}

// 4. FUNCIONES PARA VENTAS
export const obtenerVentas = async (limit = 1000, offset = 0) => {
    const respuesta = await hacerPeticion(`${URL_BASE}/api/sales?limit=${limit}&offset=${offset}`)
    // Si la respuesta tiene estructura paginada, extraer el array de ventas
    return respuesta.ventas || respuesta
}

export const crearVenta = async (datosVenta) => {
    return hacerPeticion(`${URL_BASE}/api/sales`, {
        method: 'POST',
        body: JSON.stringify(datosVenta)
    })
}

export const obtenerEstadisticas = async () => {
    return hacerPeticion(`${URL_BASE}/api/sales/stats`)
}

export const obtenerTopProductos = async () => {
    return hacerPeticion(`${URL_BASE}/api/sales/stats/top-products`)
}

export const obtenerEstadisticasPorFecha = async (fechaInicio, fechaFin) => {
    return hacerPeticion(`${URL_BASE}/api/sales/stats/date-range?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`)
}

export const obtenerProductosPocoStock = async () => {
    return hacerPeticion(`${URL_BASE}/api/products/low-stock`)
}

// 5. EXPORTAR TODO JUNTO (por si quieres usar como objeto)
const apiClient = {
    obtenerProductos,
    buscarProductoPorCodigo,
    crearProducto,
    actualizarProducto,
    eliminarProducto,
    obtenerVentas,
    crearVenta,
    obtenerEstadisticas,
    obtenerTopProductos,
    obtenerEstadisticasPorFecha,
    obtenerProductosPocoStock
}

export default apiClient