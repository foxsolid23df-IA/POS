import { supabase } from '../supabase';

// Variables de caché en memoria
let productsCache = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos de validez

export const productService = {
    // Helper para actualizar el caché localmente (útil para realtime)
    updateCache: (updatedProduct) => {
        if (productsCache) {
            productsCache = productsCache.map(p =>
                p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p
            );
        }
    },

    // Obtener todos los productos (con caché)
    getProducts: async ({ forceRefresh = false } = {}) => {
        const now = Date.now();

        // Si hay caché válido y no se fuerza refresco, devolver caché
        if (!forceRefresh && productsCache && (now - lastFetchTime < CACHE_DURATION)) {
            // Devolvemos una copia para evitar mutaciones accidentales fuera del servicio
            return [...productsCache];
        }

        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching products:', error);
                // Si hay error pero tenemos caché (aunque sea viejo), devolverlo
                if (productsCache && productsCache.length > 0) {
                    console.warn('Using stale cache due to fetch error');
                    return [...productsCache];
                }
                throw error;
            }

            // Actualizar caché solo si la petición fue exitosa
            productsCache = data || [];
            lastFetchTime = now;

            return data || [];
        } catch (error) {
            console.error('Error in getProducts:', error);
            // Si hay caché disponible (aunque sea viejo), devolverlo como fallback
            if (productsCache && productsCache.length > 0) {
                console.warn('Returning stale cache as fallback');
                return [...productsCache];
            }
            // Si no hay caché, lanzar el error
            throw error;
        }
    },

    // Crear un nuevo producto
    createProduct: async (product) => {
        const { data: userData } = await supabase.auth.getUser();
        const insertData = {
            name: product.name,
            price: parseFloat(product.price),
            cost_price: parseFloat(product.cost_price || 0),
            wholesale_price: parseFloat(product.wholesale_price || 0),
            stock: parseInt(product.stock),
            min_stock: parseInt(product.min_stock || 0),
            barcode: product.barcode || null,
            image_url: product.image || null,
            user_id: userData.user.id
        };

        // Agregar categoría si existe (puede no estar en el esquema de BD, pero lo intentamos)
        if (product.category) {
            insertData.category = product.category;
        }

        const { data, error } = await supabase
            .from('products')
            .insert([insertData])
            .select()
            .single();

        if (error) throw error;

        // Invalidar caché para forzar recarga
        productsCache = null;

        return data;
    },

    // Actualizar un producto existente
    updateProduct: async (id, updates) => {
        // Mapear 'image' del formulario a 'image_url' de la base de datos
        const dbUpdates = {
            name: updates.name,
            price: parseFloat(updates.price),
            cost_price: parseFloat(updates.cost_price || 0),
            wholesale_price: parseFloat(updates.wholesale_price || 0),
            stock: parseInt(updates.stock),
            min_stock: parseInt(updates.min_stock || 0),
            barcode: updates.barcode || null,
            image_url: updates.image || null
        };

        // Agregar categoría si existe
        if (updates.category) {
            dbUpdates.category = updates.category;
        }

        const { data, error } = await supabase
            .from('products')
            .update(dbUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Invalidar caché
        productsCache = null;

        return data;
    },

    // Eliminar un producto
    deleteProduct: async (id) => {
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

        if (error) throw error;

        // Invalidar caché
        productsCache = null;
    },

    // Buscar producto por código de barras
    getProductByBarcode: async (barcode) => {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('barcode', barcode)
            .maybeSingle(); // Retorna null si no encuentra, en lugar de error

        if (error) throw error;
        return data;
    },

    // Obtener productos con poco stock (menos de 10 unidades)
    getLowStockProducts: async (threshold = 10, signal) => {
        let query = supabase
            .from('products')
            .select('*')
            .lte('stock', threshold)
            .order('stock', { ascending: true });

        if (signal) {
            query = query.abortSignal(signal);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data || [];
    },

    // Crear múltiples productos (Carga Masiva)
    bulkCreateProducts: async (products) => {
        const { data: userData } = await supabase.auth.getUser();

        const productsToInsert = products.map(product => ({
            name: product.name,
            price: parseFloat(product.price),
            cost_price: parseFloat(product.cost_price || 0),
            wholesale_price: parseFloat(product.wholesale_price || 0),
            stock: parseInt(product.stock),
            min_stock: parseInt(product.min_stock || 0),
            barcode: product.barcode || null,
            image_url: product.image || null,
            category: product.category || null,
            user_id: userData.user.id
        }));

        const { data, error } = await supabase
            .from('products')
            .insert(productsToInsert)
            .select();

        if (error) throw error;

        // Invalidar caché
        productsCache = null;

        return data;
    }
};
