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
            special_price: parseFloat(product.special_price || 0),
            suggested_price: parseFloat(product.suggested_price || 0),
            stock: parseInt(product.stock),
            min_stock: parseInt(product.min_stock || 0),
            barcode: product.barcode || null,
            image_url: product.image || null,
            merma: parseInt(product.merma || 0),
            user_id: userData.user.id,
            metadata: product.metadata || {},
            notes: product.notes || null,
            unit: product.unit || 'PZA',
            iva: parseFloat(product.iva || 0),
            wholesale_unit: product.wholesale_unit || null,
            brand: product.brand || null,
            supplier: product.supplier || null
        };

        // Agregar categoría si existe
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
            special_price: parseFloat(updates.special_price || 0),
            suggested_price: parseFloat(updates.suggested_price || 0),
            stock: parseInt(updates.stock),
            min_stock: parseInt(updates.min_stock || 0),
            barcode: updates.barcode || null,
            image_url: updates.image || null,
            merma: parseInt(updates.merma || 0),
            metadata: updates.metadata || {},
            notes: updates.notes || null,
            unit: updates.unit || 'PZA',
            iva: parseFloat(updates.iva || 0),
            wholesale_unit: updates.wholesale_unit || null,
            brand: updates.brand || null,
            supplier: updates.supplier || null
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

    // Registrar entrada (sumar a Existencia y Merma)
    registrarEntrada: async (id, cantidadEntrante, cantidadMerma) => {
        // Obtener el producto actual para saber su stock y merma
        const { data: currentProduct, error: fetchError } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        const entrant = parseInt(cantidadEntrante) || 0;
        const merma = parseInt(cantidadMerma) || 0;

        if (entrant < 0 || merma < 0) {
            throw new Error('Las cantidades no pueden ser negativas');
        }

        const newStock = (currentProduct.stock || 0) + entrant;
        const newMerma = (currentProduct.merma || 0) + merma;

        const { data, error } = await supabase
            .from('products')
            .update({ stock: newStock, merma: newMerma })
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

    // Eliminar múltiples productos por ID
    bulkDeleteProducts: async (ids) => {
        if (!ids || ids.length === 0) return;

        const { error } = await supabase
            .from('products')
            .delete()
            .in('id', ids);

        if (error) throw error;

        // Invalidar caché local
        productsCache = null;
        lastFetchTime = 0;
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

    // Eliminar todos los productos con datos rotos (de importaciones fallidas)
    bulkDeleteBrokenProducts: async () => {
        const { data, error } = await supabase
            .from('products')
            .delete()
            .eq('name', 'Producto Sin Nombre')
            .select('id');

        if (error) throw error;

        // Invalidar caché
        productsCache = null;

        return data ? data.length : 0;
    },

    // Crear múltiples productos (Carga Masiva) - con batching para evitar timeouts
    bulkCreateProducts: async (products) => {
        const { data: userData, error: authError } = await supabase.auth.getUser();

        if (authError) {
            if (authError.message?.includes('aborted') || authError.name === 'AbortError') {
                throw new Error('Operación cancelada');
            }
            throw authError;
        }

        // 1. Obtener todos los productos actuales para verificar códigos de barras
        const { data: existingProducts, error: fetchError } = await supabase
            .from('products')
            .select('id, barcode');

        if (fetchError) throw fetchError;

        // 2. Crear mapa de barcode a ID
        const existingBarcodeMap = new Map();
        (existingProducts || []).forEach(p => {
            if (p.barcode) {
                existingBarcodeMap.set(String(p.barcode), p.id);
            }
        });

        const productsToInsert = [];
        const productsToUpdate = [];

        // 3. Separar productos en inserciones y actualizaciones
        products.forEach(product => {
            const baseData = {
                name: product.name,
                category: product.category || null,
                price: parseFloat(product.price),
                cost_price: parseFloat(product.cost_price || 0),
                wholesale_price: parseFloat(product.wholesale_price || 0),
                special_price: parseFloat(product.special_price || 0),
                suggested_price: parseFloat(product.suggested_price || 0),
                stock: parseInt(product.stock),
                min_stock: parseInt(product.min_stock || 0),
                merma: parseInt(product.merma || 0),
                metadata: product.metadata || {},
                notes: product.notes || null,
                unit: product.unit || 'PZA',
                iva: parseFloat(product.iva || 0),
                wholesale_unit: product.wholesale_unit || null,
                brand: product.brand || null,
                supplier: product.supplier || null
            };

            const barcodeStr = product.barcode ? String(product.barcode) : null;

            if (barcodeStr && existingBarcodeMap.has(barcodeStr)) {
                // Producto existe: se actualiza
                productsToUpdate.push({
                    id: existingBarcodeMap.get(barcodeStr),
                    ...baseData
                });
            } else {
                // Producto nuevo: se inserta
                productsToInsert.push({
                    barcode: barcodeStr,
                    image_url: product.image || null,
                    user_id: userData.user.id,
                    ...baseData
                });
            }
        });

        console.log(`📦 Import: ${productsToInsert.length} to insert, ${productsToUpdate.length} to update`);

        // 4. Ejecutar actualizaciones EN LOTES de 25
        const BATCH_SIZE_UPDATE = 25;
        if (productsToUpdate.length > 0) {
            for (let i = 0; i < productsToUpdate.length; i += BATCH_SIZE_UPDATE) {
                const batch = productsToUpdate.slice(i, i + BATCH_SIZE_UPDATE);
                const updatePromises = batch.map(updateData => {
                    const id = updateData.id;
                    const dataToPatch = { ...updateData };
                    delete dataToPatch.id;
                    return supabase.from('products').update(dataToPatch).eq('id', id);
                });
                await Promise.all(updatePromises);
                console.log(`🔄 Updated batch ${Math.floor(i / BATCH_SIZE_UPDATE) + 1}/${Math.ceil(productsToUpdate.length / BATCH_SIZE_UPDATE)}`);
            }
        }

        // 5. Ejecutar inserciones EN LOTES de 50
        const BATCH_SIZE_INSERT = 50;
        let returnedData = [];
        if (productsToInsert.length > 0) {
            for (let i = 0; i < productsToInsert.length; i += BATCH_SIZE_INSERT) {
                const batch = productsToInsert.slice(i, i + BATCH_SIZE_INSERT);
                const { data, error: insertError } = await supabase
                    .from('products')
                    .insert(batch)
                    .select();

                if (insertError) throw insertError;
                if (data) returnedData = returnedData.concat(data);
                console.log(`✅ Inserted batch ${Math.floor(i / BATCH_SIZE_INSERT) + 1}/${Math.ceil(productsToInsert.length / BATCH_SIZE_INSERT)}`);
            }
        }

        // Invalidar caché
        productsCache = null;

        // Retornar información sobre lo que ocurrió
        return {
            insertedData: returnedData,
            insertedCount: productsToInsert.length,
            updatedCount: productsToUpdate.length
        };
    },

    // =====================================================
    // BORRADO TOTAL DE INVENTARIO (Clean Wipe)
    // Solo elimina productos del usuario autenticado.
    // RLS de Supabase garantiza aislamiento multi-tenant.
    // =====================================================
    deleteAllProducts: async () => {
        // 1. Obtener el usuario autenticado para filtrar explícitamente
        const { data: userData, error: authError } = await supabase.auth.getUser();

        if (authError) {
            if (authError.message?.includes('aborted') || authError.name === 'AbortError') {
                throw new Error('Operación cancelada');
            }
            throw authError;
        }

        const userId = userData.user.id;
        if (!userId) {
            throw new Error('No se pudo identificar al usuario. Inicia sesión nuevamente.');
        }

        console.log(`🗑️ [deleteAllProducts] Iniciando borrado total para user_id: ${userId}`);

        // 2. Contar productos antes del borrado (para reportar al usuario)
        const { count, error: countError } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        if (countError) throw countError;

        if (count === 0) {
            console.log('🗑️ [deleteAllProducts] No hay productos para eliminar.');
            return { deletedCount: 0 };
        }

        // 3. Ejecutar DELETE masivo — filtro explícito por user_id + RLS
        const { error: deleteError } = await supabase
            .from('products')
            .delete()
            .eq('user_id', userId);

        if (deleteError) {
            console.error('❌ [deleteAllProducts] Error en borrado:', deleteError);
            throw deleteError;
        }

        // 4. Invalidar caché completamente
        productsCache = null;
        lastFetchTime = 0;

        console.log(`✅ [deleteAllProducts] ${count} productos eliminados exitosamente.`);
        return { deletedCount: count };
    }
};
