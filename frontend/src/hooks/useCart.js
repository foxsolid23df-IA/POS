import { useState } from 'react'

const getBoxUnits = (item) => {
    const units = parseInt(item?.box_units || 0)
    return Number.isFinite(units) && units > 1 ? units : 0
}

const hasBoxConfig = (item) => getBoxUnits(item) > 0 && parseFloat(item?.box_price || 0) > 0

const normalizeCartItem = (producto, requestedUnit = producto?.unit_sold || 'PZA') => {
    const canSellBox = hasBoxConfig(producto)
    const unitSold = canSellBox && requestedUnit === 'CAJA' ? 'CAJA' : 'PZA'
    const productId = producto.product_id || producto.id || null
    const unitPrice = parseFloat(producto.unit_price ?? producto.price ?? 0)
    const boxPrice = parseFloat(producto.box_price || 0)
    const stockMultiplier = unitSold === 'CAJA' ? getBoxUnits(producto) : 1
    const id = producto.cart_id || (productId ? `${productId}::${unitSold}` : producto.id || Date.now() + Math.random())

    return {
        ...producto,
        id,
        cart_id: id,
        product_id: productId,
        unit_price: unitPrice,
        price: unitSold === 'CAJA' ? boxPrice : unitPrice,
        unit_sold: unitSold,
        conversion_factor: stockMultiplier,
        stock_multiplier: stockMultiplier,
        base_quantity: (producto.quantity || 1) * stockMultiplier
    }
}

// 1. HOOK PARA MANEJAR EL CARRITO DE VENTAS
// Este hook maneja todo lo relacionado con el carrito: agregar, quitar, calcular totales
export const useCart = (mostrarError, allowNegativeStock = false) => {
    // 2. ESTADO DEL CARRITO (lista de productos seleccionados)
    const [carrito, setCarrito] = useState([])
    const [activeCartItemId, setActiveCartItemId] = useState(null)

    // 3. FUNCIÓN PARA AGREGAR UN PRODUCTO AL CARRITO
    const agregarProducto = (producto, requestedUnit = producto?.unit_sold || 'PZA') => {
        const productoNormalizado = normalizeCartItem(producto, requestedUnit)
        setCarrito(carritoAnterior => {
            // Buscar si el producto ya está en el carrito
            const productoExistente = carritoAnterior.find(item => item.cart_id === productoNormalizado.cart_id || item.id === productoNormalizado.id)

            if (productoExistente) {
                // Si ya existe, verificar stock antes de incrementar cantidad
                // A menos que permitamos stock negativo
                const nuevaCantidad = productoExistente.quantity + (productoNormalizado.quantity || 1)
                const piezasRequeridas = nuevaCantidad * (productoExistente.stock_multiplier || 1)
                if (allowNegativeStock || piezasRequeridas <= productoExistente.stock) {
                    return carritoAnterior.map(item =>
                        item.id === productoExistente.id
                            ? { ...item, quantity: nuevaCantidad, base_quantity: piezasRequeridas }
                            : item
                    )
                } else {
                    mostrarError?.(`No hay más stock para ${producto.name}`)
                    return carritoAnterior
                }
            } else {
                // Si no existe, verificar que tenga stock disponible
                // A menos que permitamos stock negativo
                const cantidad = productoNormalizado.quantity || 1
                const piezasRequeridas = cantidad * (productoNormalizado.stock_multiplier || 1)
                if (allowNegativeStock || piezasRequeridas <= productoNormalizado.stock) {
                    return [...carritoAnterior, {
                        ...productoNormalizado,
                        quantity: cantidad,
                        base_quantity: piezasRequeridas
                    }]
                } else {
                    mostrarError?.(`${producto.name} no tiene stock suficiente`)
                    return carritoAnterior
                }
            }
        })
        setActiveCartItemId(productoNormalizado.id)
    }

    // 4. FUNCIÓN PARA CAMBIAR LA CANTIDAD DE UN PRODUCTO
    const cambiarCantidad = (idProducto, nuevaCantidad) => {
        // No permitir cantidades negativas
        if (nuevaCantidad < 0) return;

        setCarrito(carritoAnterior =>
            carritoAnterior.map(item => {
                if (item.id === idProducto) {
                    const multiplier = item.stock_multiplier || 1
                    const cantidadMaxima = Math.floor((item.stock || 0) / multiplier)
                    
                    if (!allowNegativeStock && nuevaCantidad * multiplier > (item.stock || 0)) {
                        mostrarError?.(`Máximo disponible: ${cantidadMaxima}`)
                        return { ...item, quantity: cantidadMaxima, base_quantity: cantidadMaxima * multiplier }
                    }

                    return { ...item, quantity: nuevaCantidad, base_quantity: nuevaCantidad * multiplier }
                }
                return item
            })
        )
    }

    const cambiarUnidadVenta = (idProducto, nuevaUnidad) => {
        setCarrito(carritoAnterior => {
            const itemActual = carritoAnterior.find(item => item.id === idProducto)
            if (!itemActual || !hasBoxConfig(itemActual)) return carritoAnterior

            const itemConvertido = normalizeCartItem(itemActual, nuevaUnidad)
            const piezasRequeridas = (itemActual.quantity || 1) * itemConvertido.stock_multiplier
            const cantidadMaxima = Math.floor((itemActual.stock || 0) / itemConvertido.stock_multiplier)

            if (!allowNegativeStock && piezasRequeridas > (itemActual.stock || 0)) {
                mostrarError?.(`Máximo disponible: ${cantidadMaxima} ${nuevaUnidad}`)
                return carritoAnterior
            }

            const existente = carritoAnterior.find(item => item.id !== idProducto && item.cart_id === itemConvertido.cart_id)
            if (existente) {
                const nuevaCantidad = existente.quantity + itemActual.quantity
                const piezasTotales = nuevaCantidad * (existente.stock_multiplier || 1)
                if (!allowNegativeStock && piezasTotales > (existente.stock || 0)) {
                    mostrarError?.(`Máximo disponible: ${Math.floor((existente.stock || 0) / (existente.stock_multiplier || 1))} ${nuevaUnidad}`)
                    return carritoAnterior
                }
                return carritoAnterior
                    .filter(item => item.id !== idProducto)
                    .map(item => item.id === existente.id ? { ...item, quantity: nuevaCantidad, base_quantity: piezasTotales } : item)
            }

            return carritoAnterior.map(item =>
                item.id === idProducto
                    ? { ...itemConvertido, quantity: itemActual.quantity, base_quantity: piezasRequeridas }
                    : item
            )
        })
        const productId = String(idProducto).split('::')[0]
        setActiveCartItemId(`${productId}::${nuevaUnidad}`)
    }

    const alternarUnidadUltimaLinea = () => {
        const item = carrito.find(line => line.id === activeCartItemId) || carrito[carrito.length - 1]
        if (!item || !hasBoxConfig(item)) return
        cambiarUnidadVenta(item.id, item.unit_sold === 'CAJA' ? 'PZA' : 'CAJA')
    }

    // 5. FUNCIÓN PARA QUITAR UN PRODUCTO DEL CARRITO
    const quitarProducto = (idProducto) => {
        setCarrito(carritoAnterior =>
            carritoAnterior.filter(item => item.id !== idProducto)
        )
    }

    // 6. FUNCIÓN PARA VACIAR TODO EL CARRITO
    const vaciarCarrito = () => {
        setCarrito([])
        setActiveCartItemId(null)
    }

    // 7. CALCULAR EL TOTAL A PAGAR
    const total = carrito.reduce((suma, item) => suma + (item.price * item.quantity), 0)

    // 8. CALCULAR TOTAL DE PRODUCTOS EN EL CARRITO
    const totalProductos = carrito.reduce((suma, item) => suma + item.quantity, 0)

    // 9. DEVOLVER TODAS LAS FUNCIONES Y DATOS DEL CARRITO
    return {
        carrito,           // Lista de productos en el carrito
        agregarProducto,   // Función para agregar productos
        cambiarCantidad,   // Función para cambiar cantidades
        cambiarUnidadVenta,
        alternarUnidadUltimaLinea,
        quitarProducto,    // Función para quitar productos
        vaciarCarrito,     // Función para vaciar el carrito
        total,             // Total a pagar
        totalProductos,    // Cantidad total de productos
        activeCartItemId,
        setActiveCartItemId
    }
}
