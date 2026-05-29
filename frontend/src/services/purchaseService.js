import { supabase } from '../supabase';
import { productService } from './productService';

const normalizePurchaseItem = (item) => {
  const quantity = parseFloat(item.quantity || item.cantidadEntrante || 0);
  const conversionFactor = parseFloat(item.conversion_factor || item.conversionFactor || 1);
  const unitCost = parseFloat(item.unit_cost || item.unitCost || 0);
  const salePrice = item.sale_price ?? item.salePrice ?? null;

  return {
    product_id: parseInt(item.product_id || item.id, 10),
    product_name: item.product_name || item.name || 'Producto',
    quantity,
    unit: (item.unit || item.purchase_unit || 'PZA').toUpperCase(),
    conversion_factor: conversionFactor,
    base_quantity: parseFloat(item.base_quantity || quantity * conversionFactor),
    unit_cost: unitCost,
    sale_price: salePrice !== null && salePrice !== '' ? parseFloat(salePrice) : null,
    margin_percent: parseFloat(item.margin_percent || item.marginPercent || 0),
    line_total: parseFloat(item.line_total || quantity * unitCost),
  };
};

export const purchaseService = {
  registerPurchase: async ({
    supplierName,
    supplierId = null,
    invoiceNumber = null,
    purchasedAt = new Date().toISOString(),
    taxAmount = 0,
    notes = null,
    items = [],
  }) => {
    if (!supplierName?.trim()) throw new Error('Proveedor requerido');
    if (!items.length) throw new Error('Agrega al menos un producto a la entrada');

    const normalizedItems = items.map(normalizePurchaseItem);

    const { data, error } = await supabase.rpc('register_purchase', {
      p_supplier_name: supplierName.trim(),
      p_invoice_number: invoiceNumber || null,
      p_purchased_at: purchasedAt,
      p_items: normalizedItems,
      p_notes: notes || null,
      p_supplier_id: supplierId,
      p_tax_amount: parseFloat(taxAmount || 0),
    });

    if (error) throw error;

    normalizedItems.forEach((item) => {
      productService.invalidateProduct?.(item.product_id);
    });

    return data;
  },
};
