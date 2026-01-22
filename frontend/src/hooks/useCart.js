import { useState, useEffect } from 'react'

// Clave para guardar en localStorage
const CART_STORAGE_KEY = 'pos_cart_items';

// 1. HOOK PARA MANEJAR EL CARRITO DE VENTAS
// Este hook maneja todo lo relacionado con el carrito: agregar, quitar, calcular totales
export const useCart = (mostrarError) => {
    // 2. ESTADO DEL CARRITO (lista de productos seleccionados)
    // Inicializar leyendo del localStorage si existe
    const [carrito, setCarrito] = useState(() => {
        try {
            const savedCart = localStorage.getItem(CART_STORAGE_KEY);
            return savedCart ? JSON.parse(savedCart) : [];
        } catch (error) {
            console.error('Error al recuperar carrito:', error);
            return [];
        }
    });

    // Efecto para guardar en localStorage cada vez que cambia el carrito
    useEffect(() => {
        try {
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(carrito));
        } catch (error) {
            console.error('Error al guardar carrito:', error);
        }
    }, [carrito]);

    // 3. FUNCIÓN PARA AGREGAR UN PRODUCTO AL CARRITO
    const agregarProducto = (producto) => {
        setCarrito(carritoAnterior => {
            // Buscar si el producto ya está en el carrito
            // Usamos el ID del producto original si existe, para evitar duplicados por ID generado
            const idBusqueda = producto.id; 
            const productoExistente = carritoAnterior.find(item => item.id === idBusqueda || (item.originalId && item.originalId === idBusqueda))
            
            if (productoExistente) {
                // Si ya existe, verificar stock antes de incrementar cantidad
                if (productoExistente.quantity < producto.stock) {
                    return carritoAnterior.map(item =>
                        (item.id === idBusqueda || item.originalId === idBusqueda)
                            ? { ...item, quantity: item.quantity + 1 }
                            : item
                    )
                } else {
                    mostrarError?.(`No hay más stock para ${producto.name}`)
                    return carritoAnterior
                }
            } else {
                // Si no existe, verificar que tenga stock disponible
                if (producto.stock > 0) {
                    // Mantenemos el ID original del producto para búsquedas futuras
                    // Pero si el producto viene de la BD, 'id' ya es único.
                    // La lógica anterior usaba Date.now() + random para ID, lo cual puede duplicar items si se escanea el mismo producto.
                    // Mejor usar el ID del producto como clave principal.
                    return [...carritoAnterior, {
                        ...producto,
                        originalId: producto.id, // Guardamos ID original por si acaso
                        quantity: 1
                    }]
                } else {
                    mostrarError?.(`${producto.name} está sin stock`)
                    return carritoAnterior
                }
            }
        })
    }

    // 4. FUNCIÓN PARA CAMBIAR LA CANTIDAD DE UN PRODUCTO
    const cambiarCantidad = (idProducto, nuevaCantidad) => {
        // Si la cantidad es 0 o menor, eliminar el producto
        if (nuevaCantidad <= 0) {
            quitarProducto(idProducto)
            return
        }

        setCarrito(carritoAnterior =>
            carritoAnterior.map(item => {
                if (item.id === idProducto) {
                    const cantidadMaxima = item.stock
                    const cantidadValida = Math.min(nuevaCantidad, cantidadMaxima)
                    
                    // Mostrar error si intenta agregar más del stock disponible
                    if (nuevaCantidad > cantidadMaxima) {
                        mostrarError?.(`Máximo disponible: ${cantidadMaxima}`)
                    }
                    
                    return { ...item, quantity: cantidadValida }
                }
                return item
            })
        )
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
        // El useEffect se encargará de limpiar el localStorage
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
        quitarProducto,    // Función para quitar productos
        vaciarCarrito,     // Función para vaciar el carrito
        total,             // Total a pagar
        totalProductos     // Cantidad total de productos
    }
}
