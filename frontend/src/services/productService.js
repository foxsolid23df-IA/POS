import { supabase } from '../supabase';
import { isAbortError } from '../utils/supabaseErrorHandler';

// Variables de caché en memoria (Desactivadas temporalmente para asegurar sincronización multicaja)
let productsCache = null;
let lastFetchTime = 0;
const CACHE_DURATION = 0; // 0 para forzar siempre carga desde DB en multicaja

export const productService = {
    // Helper para actualizar el caché localmente (útil para realtime)
    updateCache: (updatedProduct, type = 'UPDATE') => {
        if (!productsCache) return;

        if (type === 'INSERT') {
            // Verificar si ya existe para evitar duplicados
            if (!productsCache.some(p => p.id === updatedProduct.id)) {
                productsCache = [updatedProduct, ...productsCache];
            }
        } else if (type === 'DELETE') {
            productsCache = productsCache.filter(p => p.id !== updatedProduct.id);
        } else {
            // UPDATE
            productsCache = productsCache.map(p =>
                p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p
            );
        }
    },

    // Suscribirse a cambios en productos en tiempo real
    subscribeToProducts: (callback) => {
        return supabase
            .channel('public:products')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'products' 
            }, (payload) => {
                console.log('[ProductService] Cambio detectado:', payload.eventType);
                // Actualizar caché local según el tipo de evento
                productService.updateCache(payload.new || payload.old, payload.eventType);
                // Notificar al componente/contexto
                callback(payload);
            })
            .subscribe();
    },

    // Obtener todos los productos (con caché)
    getProducts: async ({ forceRefresh = false } = {}) => {
        const now = Date.now();

        // Si hay caché válido y no se fuerza refresco, devolver caché
        if (!forceRefresh && productsCache && (now - lastFetchTime < CACHE_DURATION)) {
            console.log('[ProductService] Retornando productos desde caché', { count: productsCache.length });
            // Devolvemos una copia para evitar mutaciones accidentales fuera del servicio
            return [...productsCache];
        }
        console.log('[ProductService] Obteniendo productos desde Supabase...', { forceRefresh });

        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                if (!isAbortError(error)) {
                    console.error('[ProductService] Error fetching products:', error);
                }
                
                // Si hay error pero tenemos caché (aunque sea viejo), devolverlo
                if (productsCache && productsCache.length > 0) {
                    console.warn('[ProductService] Using stale cache due to fetch error', { count: productsCache.length });
                    return [...productsCache];
                }
                
                if (isAbortError(error)) throw error; // Relanzar para que catch lo maneje (o ignore)

                // Si no hay caché, retornar array vacío en lugar de lanzar error
                console.error('[ProductService] No cache available, returning empty array');
                return [];
            }

            // ... (procesamiento exitoso)
            const validData = Array.isArray(data) ? data : [];
            productsCache = validData;
            lastFetchTime = now;
            console.log('[ProductService] Productos obtenidos exitosamente', { count: validData.length });
            return validData;

        } catch (error) {
            // Si es un error de abort/cancelación, lo relanzamos para que quien llamó lo maneje (o lo ignore)
            if (isAbortError(error)) {
                throw error;
            }

            console.error('[ProductService] Exception in getProducts:', error);
            // ... (resto del catch)
            if (productsCache && productsCache.length > 0) {
                 return [...productsCache]; 
            }
            return [];
        }
    },

    // Crear un nuevo producto
    createProduct: async (product) => {
        const { data: userData, error: authError } = await supabase.auth.getUser();
        
        if (authError) {
            if (authError.message?.includes('aborted') || authError.name === 'AbortError') {
                throw new Error('Operación cancelada');
            }
            throw authError;
        }
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

        // Actualizar caché local
        productService.updateCache(data, 'INSERT');

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

        // Actualizar caché local
        productService.updateCache(data, 'UPDATE');

        return data;
    },

    // Eliminar un producto
    deleteProduct: async (id) => {
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

        if (error) throw error;

        // Actualizar caché local
        productService.updateCache({ id }, 'DELETE');
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
        const { data: userData, error: authError } = await supabase.auth.getUser();
        
        if (authError) {
            if (authError.message?.includes('aborted') || authError.name === 'AbortError') {
                throw new Error('Operación cancelada');
            }
            throw authError;
        }

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
