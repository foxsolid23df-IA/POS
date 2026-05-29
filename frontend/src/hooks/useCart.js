import { useState } from 'react'
import { supabase } from '../supabase'

const getBoxUnits = (item) => {
    const units = parseInt(item?.box_units || 0)
    return Number.isFinite(units) && units > 1 ? units : 0
}

const hasBoxConfig = (item) => getBoxUnits(item) > 0 && parseFloat(item?.box_price || 0) > 0

/**
 * Centraliza el cálculo de conversión, precios y factores
 */
const getConversionInfo = (producto, unidad, customPiezas = null, customPrecio = null) => {
    const isCustom = producto.is_custom_pack || customPiezas !== null || customPrecio !== null;
    const configurado = hasBoxConfig(producto);
    const requestedUnit = String(unidad || 'PZA').toUpperCase();
    
    // Determinar la unidad final
    const unitSold = requestedUnit === 'CAJA' && (isCustom || configurado || unidad === 'CAJA')
        ? 'CAJA'
        : requestedUnit;
    
    // Determinar piezas por unidad
    let piezas = 1;
    if (unitSold === 'CAJA') {
        if (customPiezas !== null) {
            piezas = parseFloat(customPiezas);
        } else if (producto.is_custom_pack) {
            piezas = parseFloat(producto.conversion_factor || producto.multiplier || 1);
        } else {
            piezas = getBoxUnits(producto) || 1;
        }
    }

    const unitPrice = parseFloat(producto.unit_price ?? producto.price ?? 0);
    
    // Determinar precio
    let price = unitPrice;
    if (unitSold === 'CAJA') {
        if (customPrecio !== null) {
            price = parseFloat(customPrecio);
        } else if (producto.is_custom_pack) {
            price = parseFloat(producto.price);
        } else if (configurado) {
            price = parseFloat(producto.box_price);
        } else {
            price = unitPrice * piezas;
        }
    }

    const multiplier = unitSold === 'CAJA' ? piezas : 1;

    return { unitSold, piecesPerUnit: piezas, price, multiplier };
};

const normalizeCartItem = (producto, requestedUnit = producto?.unit_sold || 'PZA', customPiezas = null, customPrecio = null) => {
    const { unitSold, multiplier, price } = getConversionInfo(producto, requestedUnit, customPiezas, customPrecio);
    
    const productId = producto.product_id || producto.id || null;
    
    // Generar un ID único para el item en el carrito basado en el producto y la unidad
    // Si es un paquete personalizado (is_custom_pack) o tiene piezas custom, el ID debe ser único para esa instancia
    const id = (productId && !producto.is_custom_pack && customPiezas === null) 
        ? `${productId}::${unitSold}` 
        : (producto.cart_id || producto.id || `custom-${Date.now()}-${Math.random()}`);

    return {
        ...producto,
        id,
        cart_id: id,
        product_id: productId,
        unit_price: parseFloat(producto.unit_price ?? producto.price ?? 0),
        price: price,
        discount: parseFloat(producto.discount || 0),
        unit_sold: unitSold,
        conversion_factor: multiplier,
        stock_multiplier: multiplier,
        base_quantity: (producto.quantity || 1) * multiplier,
        is_custom_pack: producto.is_custom_pack || customPiezas !== null
    }
}

// 1. HOOK PARA MANEJAR EL CARRITO DE VENTAS
// Este hook maneja todo lo relacionado con el carrito: agregar, quitar, calcular totales
export const useCart = (mostrarError, allowNegativeStock = false) => {
    // 2. ESTADO DEL CARRITO (lista de productos seleccionados)
    const [carrito, setCarrito] = useState([])
    const [activeCartItemId, setActiveCartItemId] = useState(null)
    const [globalDiscount, setGlobalDiscount] = useState(0)

    /**
     * Validación centralizada de stock
     */
    const validateStock = (item, quantity, multiplier, force = false) => {
        if (force || allowNegativeStock) {
            return true;
        }

        const requestedPieces = quantity * multiplier;
        const availablePieces = item.stock || 0;
        
        if (requestedPieces <= availablePieces) {
            return true;
        }
        
        const maxUnits = Math.floor(availablePieces / multiplier);
        const unitName = multiplier > 1 ? 'CAJAS' : 'PZAS';
        mostrarError?.(`Stock insuficiente para ${item.name}. Disponible: ${maxUnits} ${unitName}`);
        return false;
    };

    // 3. FUNCIÓN PARA AGREGAR UN PRODUCTO AL CARRITO
    const agregarProducto = (producto, requestedUnit = producto?.unit_sold || 'PZA', force = false) => {
        const productoNormalizado = normalizeCartItem(producto, requestedUnit)
        setCarrito(carritoAnterior => {
            // Buscar si el producto ya está en el carrito
            const productoExistente = carritoAnterior.find(item => item.cart_id === productoNormalizado.cart_id)

            if (productoExistente) {
                const nuevaCantidad = productoExistente.quantity + (productoNormalizado.quantity || 1)
                if (validateStock(productoExistente, nuevaCantidad, productoExistente.stock_multiplier, force)) {
                    return carritoAnterior.map(item =>
                        item.id === productoExistente.id
                            ? { ...item, quantity: nuevaCantidad, base_quantity: nuevaCantidad * item.stock_multiplier }
                            : item
                    )
                }
                return carritoAnterior;
            } else {
                const cantidad = productoNormalizado.quantity || 1
                if (validateStock(productoNormalizado, cantidad, productoNormalizado.stock_multiplier, force)) {
                    return [...carritoAnterior, {
                        ...productoNormalizado,
                        quantity: cantidad,
                        base_quantity: cantidad * productoNormalizado.stock_multiplier
                    }]
                }
                return carritoAnterior;
            }
        })
        setActiveCartItemId(productoNormalizado.id)
    }

    // 4. FUNCIÓN PARA CAMBIAR LA CANTIDAD DE UN PRODUCTO
    const cambiarCantidad = (idProducto, delta, force = false) => {
        if (delta === 0) return;

        setCarrito(carritoAnterior =>
            carritoAnterior.map(item => {
                if (item.id === idProducto) {
                    const nuevaCantidad = Math.max(1, (item.quantity || 1) + delta);
                    if (validateStock(item, nuevaCantidad, item.stock_multiplier, force)) {
                        return { ...item, quantity: nuevaCantidad, base_quantity: nuevaCantidad * item.stock_multiplier }
                    }
                    const maxQty = Math.floor((item.stock || 0) / item.stock_multiplier);
                    return { ...item, quantity: maxQty, base_quantity: maxQty * item.stock_multiplier };
                }
                return item
            })
        )
    }

    const cambiarUnidadVenta = (idProducto, nuevaUnidad, customPiezas = null) => {
        setCarrito(carritoAnterior => {
            const itemActual = carritoAnterior.find(item => item.id === idProducto)
            if (!itemActual) return carritoAnterior

            const itemConvertido = normalizeCartItem(itemActual, nuevaUnidad, customPiezas)
            
            if (!validateStock(itemActual, itemActual.quantity, itemConvertido.stock_multiplier)) {
                return carritoAnterior
            }

            const existente = carritoAnterior.find(item => item.id !== idProducto && item.cart_id === itemConvertido.cart_id)
            if (existente) {
                const nuevaCantidad = existente.quantity + itemActual.quantity
                if (!validateStock(existente, nuevaCantidad, existente.stock_multiplier)) {
                    return carritoAnterior
                }
                return carritoAnterior
                    .filter(item => item.id !== idProducto)
                    .map(item => item.id === existente.id ? { ...item, quantity: nuevaCantidad, base_quantity: nuevaCantidad * item.stock_multiplier } : item)
            }

            return carritoAnterior.map(item =>
                item.id === idProducto
                    ? { ...itemConvertido, quantity: itemActual.quantity, base_quantity: itemActual.quantity * itemConvertido.stock_multiplier }
                    : item
            )
        })
        
        const productId = String(idProducto).split('::')[0]
        setActiveCartItemId(`${productId}::${nuevaUnidad}`)
    }

    const alternarUnidadUltimaLinea = () => {
        const item = carrito.find(line => line.id === activeCartItemId) || carrito[carrito.length - 1]
        if (!item) return
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
        setGlobalDiscount(0)
        setActiveCartItemId(null)
    }

    // 6.3 CAMBIAR PRECIO DE UN ITEM (override)
    const cambiarPrecio = (idProducto, nuevoPrecio) => {
        setCarrito(carritoAnterior =>
            carritoAnterior.map(item =>
                item.id === idProducto
                    ? { ...item, price: Math.max(0, parseFloat(nuevoPrecio) || 0), price_overridden: true }
                    : item
            )
        )
    }

    // 6.5 APLICAR DESCUENTO A UN ITEM
    const applyDiscount = (idProducto, amount) => {
        setCarrito(carritoAnterior =>
            carritoAnterior.map(item =>
                item.id === idProducto
                    ? { ...item, discount: Math.max(0, parseFloat(amount || 0)) }
                    : item
            )
        )
    }

    const applyGlobalDiscount = (amount) => {
        setGlobalDiscount(Math.max(0, parseFloat(amount || 0)))
    }

    // 7. CALCULAR EL TOTAL A PAGAR
    const subtotal = carrito.reduce((suma, item) => suma + (item.price * item.quantity), 0)
    const itemDiscounts = carrito.reduce((suma, item) => suma + (item.discount * item.quantity), 0)
    const total = Math.max(0, subtotal - itemDiscounts - globalDiscount)

    // 8. CALCULAR TOTAL DE PRODUCTOS EN EL CARRITO
    const totalProductos = carrito.reduce((suma, item) => suma + item.quantity, 0)

    const convertirAPaquete = (idProducto, piezasPorCaja, precioTotalCaja) => {
        setCarrito(carritoAnterior =>
            carritoAnterior.map(item => {
                if (item.id === idProducto) {
                    const multiplier = parseInt(piezasPorCaja) || 1;
                    const customPrice = precioTotalCaja !== "" ? parseFloat(precioTotalCaja) : null;
                    
                    // Solo permitir si hay stock suficiente (o stock negativo permitido)
                    const piezasRequeridas = item.quantity * multiplier;
                    if (!allowNegativeStock && piezasRequeridas > (item.stock || 0)) {
                        mostrarError?.(`Stock insuficiente para empaquetar ${multiplier} piezas.`);
                        return item;
                    }

                    const normalized = normalizeCartItem(item, 'CAJA', multiplier, customPrice);
                    
                    return { 
                        ...normalized, 
                        name: normalized.name.startsWith('[CAJA]') ? normalized.name : `[CAJA] ${normalized.name}`,
                        is_custom_pack: true
                    };
                }
                return item;
            })
        );
    };

    const convertirCarritoAPaquete = (nombre, precio) => {
        if (carrito.length === 0) return;

        // Calcular el total real en este momento para evitar inconsistencias
        const subtotalCarrito = carrito.reduce((suma, item) => suma + (item.price * item.quantity), 0)
        const itemDiscounts = carrito.reduce((suma, item) => suma + (item.discount * item.quantity), 0)
        const totalCalculado = Math.max(0, subtotalCarrito - itemDiscounts - globalDiscount)
        
        const precioFinal = (precio !== undefined && precio !== null && precio !== "") ? parseFloat(precio) : totalCalculado;

        const nuevoPaquete = {
            id: `PKG-${Date.now()}`,
            name: nombre.toUpperCase(),
            price: precioFinal,
            quantity: 1,
            unit_sold: "PZA",
            is_package: true,
            items: [...carrito],
            image: null,
            discount: 0,
            stock: 999999, // Paquetes no suelen tener stock limitado directamente aquí
        };

        setCarrito([nuevoPaquete]);
    };

    /**
     * Valida el stock de todo el carrito usando el RPC del servidor
     */
    const validateCartStockWithRPC = async () => {
        if (allowNegativeStock) return { valid: true };
        
        try {
            const cartItems = carrito
                .filter(item => !item.is_package && !item.is_common && item.product_id)
                .map(item => ({
                    product_id: item.product_id,
                    requested_base_qty: item.quantity * (item.stock_multiplier || 1),
                    name: item.name
                }));

            if (cartItems.length === 0) return { valid: true };

            const { data, error } = await supabase.rpc('validate_sale_stock', {
                p_items: cartItems
            });

            if (error) throw error;

            // El RPC ahora devuelve un array de errores. Si está vacío, todo está bien.
            if (data && Array.isArray(data) && data.length > 0) {
                const errors = data.map(err => 
                    `${err.product_name}: Faltan ${err.missing_qty} piezas (Disponible: ${err.available_stock})`
                ).join('\n');
                
                mostrarError?.(`Stock insuficiente en el almacén:\n${errors}`);
                return { valid: false, errors: data };
            }

            return { valid: true };
        } catch (error) {
            console.error('Error validando stock RPC:', error);
            // Si hay error en el RPC por conectividad u otro, mostramos alerta pero permitimos si el usuario insiste? 
            // Por ahora, permitimos para no bloquear la venta si falla el internet pero el stock local parece ok
            return { valid: true }; 
        }
    };

    // 9. DEVOLVER TODAS LAS FUNCIONES Y DATOS DEL CARRITO
    return {
        carrito,           // Lista de productos en el carrito
        agregarProducto,   // Función para agregar productos
        cambiarCantidad,   // Función para cambiar cantidades
        cambiarUnidadVenta,
        alternarUnidadUltimaLinea,
        convertirAPaquete, // Función para empaque al vuelo
        convertirCarritoAPaquete, // Función para convertir todo el carrito a paquete
        quitarProducto,    // Función para quitar productos
        vaciarCarrito,     // Función para vaciar el carrito
        total,             // Total a pagar
        subtotal,
        itemDiscounts,
        globalDiscount,
        cambiarPrecio,
        applyDiscount,
        applyGlobalDiscount,
        totalProductos,    // Cantidad total de productos
        activeCartItemId,
        setActiveCartItemId,
        validateCartStockWithRPC
    }
}
