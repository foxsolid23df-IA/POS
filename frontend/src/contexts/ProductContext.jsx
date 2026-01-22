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
    const isMountedRef = useRef(true);
    const loadingRef = useRef(false);

    // Función para cargar productos
    const loadProducts = useCallback(async (forceRefresh = false) => {
        // Evitar cargas duplicadas
        if (loadingRef.current && !forceRefresh) {
            console.log('[ProductContext] Carga ya en progreso, omitiendo...');
            return;
        }

        if (!isMountedRef.current) return;

        loadingRef.current = true;
        setLoading(true);
        setError(null);

        try {
            console.log('[ProductContext] Cargando productos...', { forceRefresh });
            const prods = await productService.getProducts({ forceRefresh });
            
            if (!isMountedRef.current) return;

            const safeProds = Array.isArray(prods) ? prods : [];
            console.log('[ProductContext] Productos cargados exitosamente', { count: safeProds.length });
            
            setProductos(safeProds);
            setError(null);
        } catch (err) {
            if (!isMountedRef.current) return;
            
            console.error('[ProductContext] Error cargando productos:', err);
            setError('No se pudieron cargar los productos');
            setProductos([]);
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
                loadingRef.current = false;
            }
        }
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

    // Cargar productos al montar el provider
    useEffect(() => {
        isMountedRef.current = true;
        console.log('[ProductContext] Provider montado - Iniciando carga inicial');
        loadProducts();

        return () => {
            isMountedRef.current = false;
            console.log('[ProductContext] Provider desmontado');
        };
    }, [loadProducts]);

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
