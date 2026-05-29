import { supabase } from '../supabase';
import { terminalService } from './terminalService';

const normalizeQuotationItem = (item) => {
  const quantity = parseFloat(item.quantity || 0);
  const conversionFactor = parseFloat(item.conversion_factor || item.stock_multiplier || 1);
  const price = parseFloat(item.price || 0);

  return {
    product_id: Number.isNaN(parseInt(item.product_id ?? item.id, 10)) ? null : parseInt(item.product_id ?? item.id, 10),
    product_name: item.product_name || item.name || 'Producto',
    quantity,
    price,
    total: parseFloat(item.total || price * quantity),
    unit_sold: item.unit_sold || 'PZA',
    conversion_factor: conversionFactor,
    base_quantity: parseFloat(item.base_quantity || quantity * conversionFactor),
  };
};

export const quotationService = {
  createQuotation: async ({
    customerId = null,
    customerName = null,
    expiresAt = null,
    items = [],
    notes = null,
    advanceAmount = 0,
    taxAmount = 0,
  }) => {
    if (!items.length) throw new Error('La cotizacion no tiene productos');

    const { data, error } = await supabase.rpc('create_quotation', {
      p_customer_id: customerId,
      p_customer_name: customerName,
      p_expires_at: expiresAt,
      p_items: items.map(normalizeQuotationItem),
      p_notes: notes,
      p_advance_amount: parseFloat(advanceAmount || 0),
      p_tax_amount: parseFloat(taxAmount || 0),
    });

    if (error) throw error;
    return data;
  },

  convertToSale: async ({ quotationId, paymentMethod = 'efectivo', payments = [] }) => {
    const terminalId = terminalService.getTerminalId();
    if (!terminalId) throw new Error('Terminal no configurada');

    const { data, error } = await supabase.rpc('convert_quotation_to_sale', {
      p_quotation_id: quotationId,
      p_terminal_id: terminalId,
      p_payment_method: paymentMethod,
      p_payments: payments,
    });

    if (error) throw error;
    return data;
  },
};
