import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { productService } from '../services/productService';

const ProductContext = createContext();

export const useProducts = () => {
    const context = useContext(ProductContext);
    if (!context) {
        throw new Error('useProducts must be used within a ProductProvider');
    }
    return context;
};

export const ProductProvider = ({ children }) => {
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Referencia para saber si el componente sigue montado (para evitar errores de React)
    const isMounted = useRef(true);

    // Función para cargar productos - CON REINTENTO AUTOMÁTICO
    const loadProducts = useCallback(async (forceRefresh = false, retryCount = 0) => {
        if (!isMounted.current) return;
        
        // Solo mostramos loading visual si es la primera carga o forzada, no en reintentos internos silenciosos
        if ((forceRefresh || productos.length === 0) && retryCount === 0) {
            setLoading(true);
        }
        setError(null);

        try {
            console.log(`[ProductContext] Iniciando carga (Intento ${retryCount + 1})...`, { forceRefresh });
            const data = await productService.getProducts({ forceRefresh });
            
            if (isMounted.current) {
                const safeProds = Array.isArray(data) ? data : [];
                console.log('[ProductContext] Productos cargados exitosamente:', safeProds.length);
                setProductos(safeProds);
                setLoading(false);
            }
        } catch (err) {
            console.error(`[ProductContext] Error cargando productos (Intento ${retryCount + 1}):`, err);
            
            const isAbort = err?.message?.includes('aborted') || err?.name === 'AbortError';
            
            // Si falló (incluso por abort), y es el primer intento, reintentamos automáticamente
            if (isMounted.current && retryCount < 2) {
                console.log(`[ProductContext] Reintentando carga en 1s...`);
                setTimeout(() => {
                    if (isMounted.current) {
                        loadProducts(forceRefresh, retryCount + 1);
                    }
                }, 1000); // Esperar 1 segundo antes de reintentar
                return; // Salimos para no setear error todavía
            }

            if (isMounted.current && !isAbort) {
                setError('No se pudieron cargar los productos. Intenta recargar.');
                setLoading(false); 
            }
        }
    }, [productos.length]);

    // Cargar productos al montar con PEQUEÑO RETRASO para evitar conflictos de inicialización
    useEffect(() => {
        isMounted.current = true;
        
        const timer = setTimeout(() => {
            if (isMounted.current) {
                loadProducts();
            }
        }, 500); // 500ms de gracia al inicio

        return () => {
            isMounted.current = false;
            clearTimeout(timer);
        };
    }, []);

    // Función para actualizar un producto específico (útil para realtime)
    const updateProduct = useCallback((updatedProduct) => {
        setProductos(prev => {
            if (!Array.isArray(prev)) return [updatedProduct];
            return prev.map(p => p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p);
        });
    }, []);

    // Función para agregar un producto
    const addProduct = useCallback((newProduct) => {
        setProductos(prev => {
            if (!Array.isArray(prev)) return [newProduct];
            return [newProduct, ...prev];
        });
    }, []);

    // Función para eliminar un producto
    const removeProduct = useCallback((productId) => {
        setProductos(prev => {
            if (!Array.isArray(prev)) return [];
            return prev.filter(p => p.id !== productId);
        });
    }, []);

    // Cargar productos al montar
    useEffect(() => {
        isMounted.current = true;
        loadProducts();

        return () => {
            isMounted.current = false;
        };
    }, []); // Array vacío para ejecutar solo una vez al montar

    const value = {
        productos,
        loading,
        error,
        loadProducts,
        updateProduct,
        addProduct,
        removeProduct,
    };

    return (
        <ProductContext.Provider value={value}>
            {children}
        </ProductContext.Provider>
    );
};
