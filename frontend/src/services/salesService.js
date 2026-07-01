import { supabase } from '../supabase';
import { terminalService } from './terminalService';

export const salesService = {
    // Crear una nueva venta usando el RPC optimizado
    createSale: async (saleData) => {
        let userId = saleData.user_id;

        // Si no tenemos userId, usar auth de forma síncrona/cacheada en vez de pegarle a la red,
        // o si es la única opción llamar getUser
        if (!userId) {
            console.warn('[salesService] user_id no provisto en saleData, recuperando de Auth (esto causa lentitud)');
            const { data: userData } = await supabase.auth.getUser();
            userId = userData?.user?.id;
        }

        const terminalId = terminalService.getTerminalId();

        if (!terminalId) {
            throw new Error("Terminal no configurada. No se puede realizar la venta.");
        }

        const isReplacement = !!saleData.replacement_sale_id;

        // Formatear items para el RPC de validación y proceso
        const itemsForValidation = saleData.items.map(item => ({
            product_id: isNaN(parseInt(item.product_id ?? item.id)) ? null : parseInt(item.product_id ?? item.id),
            requested_base_qty: parseFloat(item.base_quantity || (item.quantity * (item.conversion_factor || item.stock_multiplier || 1))),
            name: item.name
        }));

        const itemsJson = saleData.items.map(item => ({
            product_id: isNaN(parseInt(item.product_id ?? item.id)) ? null : parseInt(item.product_id ?? item.id),
            product_name: item.name,
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity,
            unit_sold: item.unit_sold || 'PZA',
            conversion_factor: parseInt(item.conversion_factor || item.stock_multiplier || 1),
            base_quantity: parseFloat(item.base_quantity || (item.quantity * (item.conversion_factor || item.stock_multiplier || 1)))
        }));

        // 1. Validar stock atómicamente vía RPC (si affect_inventory es true y allow_negative_stock es false)
        if (saleData.affect_inventory !== false && !saleData.allow_negative_stock && !isReplacement) {
            const { data: validationErrors, error: valError } = await supabase.rpc('validate_sale_stock', {
                p_items: itemsForValidation,
                p_allow_negative_stock: saleData.allow_negative_stock === true
            });

            if (valError) throw valError;
            
            // Si el RPC devuelve registros, significa que hay errores de stock
            if (validationErrors && validationErrors.length > 0) {
                const errorDetails = validationErrors
                    .map(e => `- ${e.product_name}: Disponible ${e.available_stock}, Faltan ${e.missing_qty}`)
                    .join('\n');
                throw new Error(`Stock insuficiente detectado en el servidor:\n${errorDetails}`);
            }
        }

        // Formatear pagos para el RPC
        const paymentsJson = (saleData.payments || []).map(p => ({
            payment_method: p.method,
            amount: p.amount,
            amount_received: p.received || p.amount,
            change_amount: p.change || 0,
            currency: p.currency || 'MXN',
            exchange_rate: p.exchange_rate || null
        }));

        const rpcName = isReplacement ? 'replace_sale_with_new_sale' : 'process_perfect_sale';
        const rpcParams = {
            p_total: saleData.total,
            p_subtotal: saleData.subtotal || 0,
            p_tax_amount: saleData.tax_amount || 0,
            p_currency: saleData.currency || 'MXN',
            p_exchange_rate: saleData.exchange_rate || null,
            p_amount_usd: saleData.amount_usd || null,
            p_payment_method: saleData.payments && saleData.payments.length > 1 ? 'múltiple' : (saleData.metodoPago || 'efectivo'),
            p_terminal_id: terminalId,
            p_billing_issuer_id: saleData.billing_issuer_id || null,
            p_items: itemsJson,
            p_payments: paymentsJson,
            p_affect_inventory: saleData.affect_inventory !== undefined ? saleData.affect_inventory : true,
            p_allow_negative_stock: saleData.allow_negative_stock === true
        };

        if (isReplacement) {
            Object.assign(rpcParams, {
                p_original_sale_id: parseInt(saleData.replacement_sale_id),
                p_replacement_reason: saleData.replacement_reason || 'Reemplazo por nuevo ticket',
                p_refund_amount: saleData.replacement_refund_amount ?? null,
                p_restock: saleData.replacement_restock !== false
            });
        }

        // Llamada única al RPC optimizado (Transacción atómica en DB)
        const { data: sale, error: rpcError } = await supabase.rpc(rpcName, rpcParams);

        if (rpcError) throw rpcError;

        return sale;
    },

    // Crear una venta a crédito usando el RPC especializado
    createCreditSale: async (saleData) => {
        if (saleData.replacement_sale_id) {
            throw new Error("El reemplazo de tickets no esta disponible para ventas a credito en esta version.");
        }

        let userId = saleData.user_id;
        if (!userId) {
            const { data: userData } = await supabase.auth.getUser();
            userId = userData?.user?.id;
        }

        const terminalId = terminalService.getTerminalId();
        if (!terminalId) throw new Error("Terminal no configurada.");

        const itemsJson = saleData.items.map(item => ({
            product_id: isNaN(parseInt(item.product_id ?? item.id)) ? null : parseInt(item.product_id ?? item.id),
            product_name: item.name,
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity,
            unit_sold: item.unit_sold || 'PZA',
            conversion_factor: parseInt(item.conversion_factor || item.stock_multiplier || 1),
            base_quantity: parseFloat(item.base_quantity || (item.quantity * (item.conversion_factor || item.stock_multiplier || 1)))
        }));

        const paymentsJson = (saleData.payments || []).map(p => ({
            payment_method: p.method,
            amount: p.amount,
            amount_received: p.received || p.amount,
            change_amount: p.change || 0,
            currency: p.currency || 'MXN',
            exchange_rate: p.exchange_rate || null
        }));

        const { data: sale, error: rpcError } = await supabase.rpc('process_credit_sale', {
            p_total: saleData.total,
            p_subtotal: saleData.subtotal || 0,
            p_tax_amount: saleData.tax_amount || 0,
            p_currency: saleData.currency || 'MXN',
            p_payment_method: saleData.payments && saleData.payments.length === 1 ? saleData.payments[0].method : 'credito',
            p_terminal_id: terminalId,
            p_items: itemsJson,
            p_payments: paymentsJson,
            p_affect_inventory: saleData.affect_inventory !== undefined ? saleData.affect_inventory : true,
            p_allow_negative_stock: saleData.allow_negative_stock === true,
            p_customer_id: saleData.customer_id || null,
            p_paid_amount: parseFloat(saleData.paid_amount || 0),
            p_balance: parseFloat(saleData.balance || 0),
            p_due_date: saleData.due_date || null
        });

        if (rpcError) throw rpcError;
        return sale;
    },

    // Obtener ventas de hoy
    getTodaySales: async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data, error } = await supabase
            .from('sales')
            .select('*')
            .gte('created_at', today.toISOString())
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    // Obtener ventas desde una fecha (con items), con paginación automática
    // para evitar errores 500 en clientes con miles de ventas.
    getSalesSince: async (startTime, terminalId = null, light = false) => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        const selectFields = light
            ? `*, sale_payments (*), terminals (name)`
            : `*, sale_items (*), sale_payments (*), terminals (name)`;

        const PAGE_SIZE = 1000;
        const MAX_PAGES = 10; // máximo 10 000 ventas por corte
        let allData = [];
        let page = 0;
        let hasMore = true;
        let usedFallback = false;

        const buildQuery = (selectStr, from, to) => {
            let q = supabase
                .from('sales')
                .select(selectStr)
                .gte('created_at', startTime)
                .order('created_at', { ascending: false })
                .range(from, to);

            if (terminalId && uuidRegex.test(terminalId)) {
                q = q.eq('terminal_id', terminalId);
            } else if (terminalId) {
                console.warn('getSalesSince: terminalId no es un UUID válido:', terminalId);
            }
            return q;
        };

        while (hasMore && page < MAX_PAGES) {
            const from = page * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            let { data, error } = await buildQuery(selectFields, from, to);

            // Fallback sin join si hay error de relación (terminals/sale_items no disponibles)
            if (!usedFallback && (
                error?.code === 'PGRST200' ||
                error?.code === '42P01' ||
                error?.message?.includes('relationship')
            )) {
                usedFallback = true;
                const fallbackSelect = light ? `*` : `*, sale_items (*)`;
                const result = await buildQuery(fallbackSelect, from, to);
                data = result.data;
                error = result.error;
            }

            if (error) throw error;

            const rows = data || [];
            allData = allData.concat(rows);

            hasMore = rows.length === PAGE_SIZE;
            page++;
        }

        return allData;
    },



    // Obtener todas las ventas (con paginación y filtros)
    getSales: async (limit = 50, filters = {}) => {
        let query = supabase
            .from('sales')
            .select(`
                *,
                customers (name),
                sale_items (*),
                invoices (*)
            `);

        if (filters.createdAfter) {
            query = query.gte('created_at', filters.createdAfter);
        }
        if (filters.createdBefore) {
            query = query.lte('created_at', filters.createdBefore);
        }

        if (filters.searchTerm) {
            const term = filters.searchTerm.trim();
            if (/^\d+$/.test(term)) {
                query = query.eq('id', parseInt(term, 10));
            } else {
                query = query.ilike('pin_facturacion', `%${term}%`);
            }
        }

        query = query.order('created_at', { ascending: false }).limit(limit);

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    // Obtener detalle de una venta
    getSaleDetails: async (saleId) => {
        const { data, error } = await supabase
            .from('sale_items')
            .select('*')
            .eq('sale_id', saleId);

        if (error) throw error;
        return data || [];
    },

    // Obtener estadísticas generales
    getStatistics: async (signal) => {
        const ahora = new Date();

        // Día actual
        const inicioDelDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
        const finDelDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59, 999);

        // Semana actual (desde el lunes)
        const diaActual = ahora.getDay();
        const diasHastaLunes = diaActual === 0 ? 6 : diaActual - 1;
        const inicioSemana = new Date(ahora);
        inicioSemana.setDate(ahora.getDate() - diasHastaLunes);
        inicioSemana.setHours(0, 0, 0, 0);

        // Mes actual y anterior
        const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
        const inicioMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
        const finMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth(), 0, 23, 59, 59, 999);

        console.log('[salesService] Consultando ventas desde Supabase...')

        // Obtener todas las ventas para cálculos (Limitado a las últimas 2000 para evitar bloqueos)
        let query = supabase
            .from('sales')
            .select('total, created_at')
            .order('created_at', { ascending: false })
            .limit(2000);

        if (signal) {
            query = query.abortSignal(signal);
        }

        const { data: todasVentas, error: ventasError } = await query;

        if (ventasError) {
            throw ventasError;
        }

        // Calcular estadísticas
        const ventasTotales = todasVentas.length;
        const ingresosTotales = todasVentas.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);

        // Ventas de hoy
        const ventasDeHoy = todasVentas.filter(v => {
            const fecha = new Date(v.created_at);
            return fecha >= inicioDelDia && fecha <= finDelDia;
        });
        const ingresosDeHoy = ventasDeHoy.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);

        // Ventas de esta semana
        const ventasSemana = todasVentas.filter(v => new Date(v.created_at) >= inicioSemana);
        const ingresosSemana = ventasSemana.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);

        // Ventas de este mes
        const ventasMes = todasVentas.filter(v => new Date(v.created_at) >= inicioMes);
        const ingresosMes = ventasMes.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);

        // Ventas del mes anterior
        const ventasMesAnterior = todasVentas.filter(v => {
            const fecha = new Date(v.created_at);
            return fecha >= inicioMesAnterior && fecha <= finMesAnterior;
        });
        const ingresosMesAnterior = ventasMesAnterior.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);

        // Calcular crecimiento
        const crecimiento = ingresosMesAnterior > 0
            ? ((ingresosMes - ingresosMesAnterior) / ingresosMesAnterior) * 100
            : (ingresosMes > 0 ? 100 : 0);

        return {
            ventasTotales,
            ingresosTotales,
            ventasDeHoy: ventasDeHoy.length,
            ingresosDeHoy,
            ventasSemana: ventasSemana.length,
            ingresosSemana,
            ingresosMes,
            crecimiento: Math.round(crecimiento * 100) / 100
        };
    },

    // Obtener top productos más vendidos
    getTopProducts: async (limit = 5, signal) => {
        let query = supabase
            .from('sale_items')
            .select('product_name, quantity, price, total');

        if (signal) {
            query = query.abortSignal(signal);
        }

        const { data: saleItems, error } = await query;

        if (error) throw error;

        // Agrupar por producto y sumar
        const productosMap = {};
        saleItems.forEach(item => {
            const nombre = item.product_name;
            if (!productosMap[nombre]) {
                productosMap[nombre] = {
                    name: nombre,
                    cantidadVendida: 0,
                    ingresos: 0
                };
            }
            productosMap[nombre].cantidadVendida += item.quantity || 0;
            productosMap[nombre].ingresos += parseFloat(item.total) || 0;
        });

        // Convertir a array y ordenar por cantidad vendida
        const topProductos = Object.values(productosMap)
            .sort((a, b) => b.cantidadVendida - a.cantidadVendida)
            .slice(0, limit)
            .map((prod, index) => ({
                id: index + 1,
                name: prod.name,
                cantidadVendida: prod.cantidadVendida,
                ingresos: prod.ingresos
            }));

        return topProductos;
    },

    // Obtener ventas por día de la semana actual
    getWeeklySalesData: async (signal) => {
        const ahora = new Date();

        // Calcular inicio de la semana (Lunes)
        const diaActual = ahora.getDay();
        const diasHastaLunes = diaActual === 0 ? 6 : diaActual - 1;
        const inicioSemana = new Date(ahora);
        inicioSemana.setDate(ahora.getDate() - diasHastaLunes);
        inicioSemana.setHours(0, 0, 0, 0);

        // Obtener ventas de la semana
        let query = supabase
            .from('sales')
            .select('total, created_at')
            .gte('created_at', inicioSemana.toISOString());

        if (signal) {
            query = query.abortSignal(signal);
        }

        const { data: ventas, error } = await query;

        if (error) throw error;

        // Agrupar ventas por día de la semana (0 = Lunes, 6 = Domingo)
        const ventasPorDia = [0, 0, 0, 0, 0, 0, 0]; // Lun, Mar, Mie, Jue, Vie, Sab, Dom

        ventas.forEach(venta => {
            const fechaVenta = new Date(venta.created_at);
            const diaSemana = fechaVenta.getDay();
            // Convertir: Domingo(0) -> 6, Lunes(1) -> 0, etc.
            const indice = diaSemana === 0 ? 6 : diaSemana - 1;
            ventasPorDia[indice] += parseFloat(venta.total) || 0;
        });

        return ventasPorDia;
    },

    // Obtener estadísticas por rango de fechas
    getStatisticsByDateRange: async (fechaInicio, fechaFin, signal) => {
        let query = supabase
            .from('sales')
            .select('total, created_at');

        if (fechaInicio) {
            query = query.gte('created_at', fechaInicio);
        }
        if (fechaFin) {
            // Agregar tiempo al final del día
            const fechaFinCompleta = new Date(fechaFin);
            fechaFinCompleta.setHours(23, 59, 59, 999);
            query = query.lte('created_at', fechaFinCompleta.toISOString());
        }

        if (signal) {
            query = query.abortSignal(signal);
        }

        const { data: ventas, error } = await query;

        if (error) throw error;

        const ventasEnRango = ventas.length;
        const ingresosEnRango = ventas.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);

        return {
            ventasEnRango,
            ingresosEnRango,
            fechaInicio: fechaInicio || 'Sin límite inicial',
            fechaFin: fechaFin || 'Sin límite final'
        };
    },

    // Obtener una venta para facturación usando Folio + PIN
    getSaleByFolioAndPin: async (folio, pin) => {
        const { data, error } = await supabase
            .from('sales')
            .select(`
                *,
                sale_items (*)
            `)
            .eq('id', folio)
            .eq('pin_facturacion', pin.trim().toUpperCase())
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                throw new Error("No se encontró ninguna venta con ese Folio y PIN. Verifica tus datos.");
            }
            throw error;
        }
        return data;
    }
};
