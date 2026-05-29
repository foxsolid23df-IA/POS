import { supabase } from '../supabase';

export const returnService = {
  cancelSaleWithRestock: async ({
    saleId,
    reason,
    refundAmount = null,
    restock = true,
  }) => {
    if (!saleId) throw new Error('Venta requerida');
    if (!reason?.trim()) throw new Error('Motivo requerido');

    const { data, error } = await supabase.rpc('cancel_sale_with_restock', {
      p_sale_id: saleId,
      p_reason: reason.trim(),
      p_refund_amount: refundAmount === null || refundAmount === '' ? null : parseFloat(refundAmount),
      p_restock: Boolean(restock),
    });

    if (error) throw error;
    return data;
  },
};
