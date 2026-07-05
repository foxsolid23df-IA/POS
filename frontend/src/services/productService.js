import { supabase } from '../supabase';
import { isAbortError } from '../utils/supabaseErrorHandler';

// Variables de caché en memoria (Desactivadas temporalmente para asegurar sincronización multicaja)
let productsCache = null;
let lastFetchTime = 0;
const CACHE_DURATION = 0; // 0 para forzar siempre carga desde DB en multicaja

// ============================================================
// Helper: Obtener TODOS los productos con paginación
// PostgREST trunca a 1000 filas por defecto. Esta función
// usa .range() para traer todas las páginas automáticamente.
// ============================================================
const PAGE_SIZE = 1000;

const fetchAllProducts = async (selectColumns = '*', { signal } = {}) => {
    let from = 0;
    let allData = [];
    while (true) {
        let query = supabase
            .from('products')
            .select(selectColumns)
            .order('created_at', { ascending: false })
            .range(from, from + PAGE_SIZE - 1);

        if (signal) {
            query = query.abortSignal(signal);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < PAGE_SIZE) break; // última página
        from += PAGE_SIZE;
    }
    return allData;
};

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
            const data = await fetchAllProducts('*');

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
            special_price_2: parseFloat(product.special_price_2 || 0),
            suggested_price: parseFloat(product.suggested_price || 0),
            wholesale_from_qty: parseFloat(product.wholesale_from_qty || 0) || null,
            special_from_qty: parseFloat(product.special_from_qty || 0) || null,
            stock: parseInt(product.stock),
            min_stock: parseInt(product.min_stock || 0),
            barcode: product.barcode || null,
            box_units: parseInt(product.box_units || 0) || null,
            box_price: parseFloat(product.box_price || 0) || null,
            box_special_price: parseFloat(product.box_special_price || 0) || null,
            box_special_from_qty: parseFloat(product.box_special_from_qty || 0) || null,
            box_barcode: product.box_barcode || null,
            sell_by_box_only: product.sell_by_box_only === true,
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
            special_price_2: parseFloat(updates.special_price_2 || 0),
            suggested_price: parseFloat(updates.suggested_price || 0),
            wholesale_from_qty: parseFloat(updates.wholesale_from_qty || 0) || null,
            special_from_qty: parseFloat(updates.special_from_qty || 0) || null,
            stock: parseInt(updates.stock),
            min_stock: parseInt(updates.min_stock || 0),
            barcode: updates.barcode || null,
            box_units: parseInt(updates.box_units || 0) || null,
            box_price: parseFloat(updates.box_price || 0) || null,
            box_special_price: parseFloat(updates.box_special_price || 0) || null,
            box_special_from_qty: parseFloat(updates.box_special_from_qty || 0) || null,
            box_barcode: updates.box_barcode || null,
            sell_by_box_only: updates.sell_by_box_only === true,
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

        const entrant = parseFloat(cantidadEntrante) || 0;
        const merma = parseFloat(cantidadMerma) || 0;

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

    // Eliminar un producto (borra dependencias en inventory_movements, purchase_items, etc.)
    deleteProduct: async (id) => {
        const { data, error } = await supabase
            .rpc('delete_products_by_ids', { p_ids: [id] });

        if (error) throw error;
        if (!data.success) throw new Error(data.message || 'Error al eliminar producto');

        // Actualizar caché local
        productService.updateCache({ id }, 'DELETE');
    },

    // Eliminar múltiples productos por ID (borra dependencias primero)
    bulkDeleteProducts: async (ids) => {
        if (!ids || ids.length === 0) return;

        const { data, error } = await supabase
            .rpc('delete_products_by_ids', { p_ids: ids });

        if (error) throw error;
        if (!data.success) throw new Error(data.message || 'Error al eliminar productos');

        // Invalidar caché local
        productsCache = null;
        lastFetchTime = 0;
    },

    // Buscar producto por código de barras
    getProductByBarcode: async (barcode) => {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .or(`barcode.eq.${barcode},box_barcode.eq.${barcode}`)
            .maybeSingle(); // Retorna null si no encuentra, en lugar de error

        if (error) throw error;
        return data;
    },

    // Obtener productos con poco stock (menos de N unidades) — con paginación
    getLowStockProducts: async (threshold = 10, signal) => {
        let from = 0;
        let allData = [];
        while (true) {
            let query = supabase
                .from('products')
                .select('*')
                .lte('stock', threshold)
                .order('stock', { ascending: true })
                .range(from, from + PAGE_SIZE - 1);

            if (signal) {
                query = query.abortSignal(signal);
            }

            const { data, error } = await query;
            if (error) throw error;
            if (!data || data.length === 0) break;
            allData = allData.concat(data);
            if (data.length < PAGE_SIZE) break;
            from += PAGE_SIZE;
        }
        return allData;
    },

    // Eliminar todos los productos con datos rotos (de importaciones fallidas)
    bulkDeleteBrokenProducts: async () => {
        // Obtener IDs de productos rotos
        const { data: broken, error: fetchError } = await supabase
            .from('products')
            .select('id')
            .eq('name', 'Producto Sin Nombre');

        if (fetchError) throw fetchError;
        if (!broken || broken.length === 0) return 0;

        const ids = broken.map(p => p.id);
        const { data, error } = await supabase
            .rpc('delete_products_by_ids', { p_ids: ids });

        if (error) throw error;
        if (!data.success) throw new Error(data.message || 'Error al limpiar productos rotos');

        // Invalidar caché
        productsCache = null;

        return data.deletedCount || 0;
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

        // 1. Obtener TODOS los productos actuales para verificar códigos de barras (con paginación)
        const existingProducts = await fetchAllProducts('id, barcode, box_barcode');

        // 2. Crear mapa de barcode a ID
        const existingBarcodeMap = new Map();
        (existingProducts || []).forEach(p => {
            if (p.barcode) {
                existingBarcodeMap.set(String(p.barcode), p.id);
            }
            if (p.box_barcode) {
                existingBarcodeMap.set(String(p.box_barcode), p.id);
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
                special_price_2: parseFloat(product.special_price_2 || 0),
                suggested_price: parseFloat(product.suggested_price || 0),
                wholesale_from_qty: parseFloat(product.wholesale_from_qty || 0) || null,
                special_from_qty: parseFloat(product.special_from_qty || 0) || null,
                stock: parseInt(product.stock),
                min_stock: parseInt(product.min_stock || 0),
                box_units: parseInt(product.box_units || 0) || null,
                box_price: parseFloat(product.box_price || 0) || null,
                box_special_price: parseFloat(product.box_special_price || 0) || null,
                box_special_from_qty: parseFloat(product.box_special_from_qty || 0) || null,
                box_barcode: product.box_barcode || null,
                sell_by_box_only: product.sell_by_box_only === true,
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
            const boxBarcodeStr = product.box_barcode ? String(product.box_barcode) : null;
            baseData.box_barcode = boxBarcodeStr;

            const existingId = (barcodeStr && existingBarcodeMap.get(barcodeStr)) || (boxBarcodeStr && existingBarcodeMap.get(boxBarcodeStr));

            if (existingId) {
                // Producto existe: se actualiza
                productsToUpdate.push({
                    id: existingId,
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
        const failedUpdates = [];
        if (productsToUpdate.length > 0) {
            for (let i = 0; i < productsToUpdate.length; i += BATCH_SIZE_UPDATE) {
                const batch = productsToUpdate.slice(i, i + BATCH_SIZE_UPDATE);
                const batchNum = Math.floor(i / BATCH_SIZE_UPDATE) + 1;
                const totalUpdateBatches = Math.ceil(productsToUpdate.length / BATCH_SIZE_UPDATE);
                try {
                    const updatePromises = batch.map(updateData => {
                        const id = updateData.id;
                        const dataToPatch = { ...updateData };
                        delete dataToPatch.id;
                        return supabase.from('products').update(dataToPatch).eq('id', id);
                    });
                    const results = await Promise.all(updatePromises);
                    const batchErrors = results.filter(r => r.error);
                    if (batchErrors.length > 0) {
                        console.warn(`⚠️ Update batch ${batchNum}/${totalUpdateBatches} had ${batchErrors.length} errors:`, batchErrors[0].error.message);
                        failedUpdates.push(...batch);
                    } else {
                        console.log(`🔄 Updated batch ${batchNum}/${totalUpdateBatches}`);
                    }
                } catch (err) {
                    console.error(`❌ Update batch ${batchNum}/${totalUpdateBatches} failed:`, err.message);
                    failedUpdates.push(...batch);
                }
            }
        }

        // 5. Ejecutar inserciones EN LOTES de 50 — con reintento individual
        const BATCH_SIZE_INSERT = 50;
        let returnedData = [];
        const failedProducts = [];
        const insertBatchesFailed = [];

        if (productsToInsert.length > 0) {
            const totalInsertBatches = Math.ceil(productsToInsert.length / BATCH_SIZE_INSERT);

            // Primer pasaje
            for (let i = 0; i < productsToInsert.length; i += BATCH_SIZE_INSERT) {
                const batch = productsToInsert.slice(i, i + BATCH_SIZE_INSERT);
                const batchNum = Math.floor(i / BATCH_SIZE_INSERT) + 1;
                try {
                    const { data, error: insertError } = await supabase
                        .from('products')
                        .insert(batch)
                        .select();

                    if (insertError) {
                        console.error(`❌ Insert batch ${batchNum}/${totalInsertBatches} error:`, insertError.message);
                        insertBatchesFailed.push({ batchNum, products: batch, error: insertError.message });
                    } else {
                        if (data) returnedData = returnedData.concat(data);
                        console.log(`✅ Inserted batch ${batchNum}/${totalInsertBatches}`);
                    }
                } catch (err) {
                    console.error(`❌ Insert batch ${batchNum}/${totalInsertBatches} exception:`, err.message);
                    insertBatchesFailed.push({ batchNum, products: batch, error: err.message });
                }
            }

            // Reintento: lotes fallidos — intentar de 1 en 1 para maximizar inserción
            if (insertBatchesFailed.length > 0) {
                console.log(`🔄 Retrying ${insertBatchesFailed.length} failed batches individually...`);
                for (const failed of insertBatchesFailed) {
                    for (const product of failed.products) {
                        try {
                            const { data, error: retryError } = await supabase
                                .from('products')
                                .insert([product])
                                .select();

                            if (retryError) {
                                console.warn(`⚠️ Product "${product.name}" (${product.barcode}) failed retry:`, retryError.message);
                                failedProducts.push({ name: product.name, barcode: product.barcode, error: retryError.message });
                            } else {
                                if (data) returnedData = returnedData.concat(data);
                            }
                        } catch (err) {
                            console.warn(`⚠️ Product "${product.name}" (${product.barcode}) retry exception:`, err.message);
                            failedProducts.push({ name: product.name, barcode: product.barcode, error: err.message });
                        }
                    }
                }
            }
        }

        // Invalidar caché
        productsCache = null;

        // Retornar información sobre lo que ocurrió
        return {
            insertedData: returnedData,
            insertedCount: returnedData.length,
            updatedCount: productsToUpdate.length - failedUpdates.length,
            failedCount: failedProducts.length,
            failedProducts: failedProducts,
        };
    },

    // =====================================================
    // BORRADO TOTAL DE INVENTARIO (Clean Wipe)
    // Usa RPC para borrar dependencias (inventory_movements,
    // purchase_items, etc.) antes de borrar productos.
    // =====================================================
    deleteAllProducts: async () => {
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

        const { data, error } = await supabase.rpc('delete_all_user_products');

        if (error) {
            console.error('❌ [deleteAllProducts] Error en borrado:', error);
            throw error;
        }

        if (!data.success) {
            throw new Error(data.message || 'Error al borrar inventario');
        }

        // Invalidar caché completamente
        productsCache = null;
        lastFetchTime = 0;

        console.log(`✅ [deleteAllProducts] ${data.deletedCount} productos eliminados exitosamente.`);
        return { deletedCount: data.deletedCount };
    }
};
