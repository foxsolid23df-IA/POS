import { supabase } from '../supabase';

export const returnService = {
  cancelSaleWithRestock: async ({
    saleId,
    reason = 'Cancelacion de venta',
    refundAmount = null,
    restock = true,
  }) => {
    if (!saleId) throw new Error('Venta requerida');
    const cleanReason = String(reason || 'Cancelacion de venta').trim() || 'Cancelacion de venta';

    const { data, error } = await supabase.rpc('cancel_sale_with_restock', {
      p_sale_id: saleId,
      p_reason: cleanReason,
      p_refund_amount: refundAmount === null || refundAmount === '' ? null : parseFloat(refundAmount),
      p_restock: Boolean(restock),
    });

    if (error) throw error;
    return data;
  },
};
