import { supabase } from '../supabase';

const getCurrentUserId = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const userId = data?.user?.id;
  if (!userId) throw new Error('Usuario no autenticado');
  return userId;
};

export const creditService = {

  getCustomersWithCredit: async () => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', userId)
      .or('credit_limit.gt.0,credit_balance.gt.0')
      .order('name');
    if (error) throw error;
    return data;
  },

  getCreditSummary: async () => {
    const userId = await getCurrentUserId();
    const { data: customers, error } = await supabase
      .from('customers')
      .select('id, name, credit_limit, credit_balance, credit_hold, rfc, phone')
      .eq('user_id', userId)
      .or('credit_limit.gt.0,credit_balance.gt.0')
      .order('name');
    if (error) throw error;

    const totalOutstanding = customers.reduce((s, c) => s + parseFloat(c.credit_balance || 0), 0);
    const totalLimit = customers.reduce((s, c) => s + parseFloat(c.credit_limit || 0), 0);
    const overdueCustomers = [];

    for (const c of customers) {
      const { data: sales } = await supabase
        .from('sales')
        .select('id, total, balance, due_date, created_at')
        .eq('user_id', userId)
        .eq('customer_id', c.id)
        .in('credit_status', ['pendiente', 'parcial'])
        .order('created_at', { ascending: false });

      const overdue = (sales || []).filter(s =>
        s.due_date && new Date(s.due_date) < new Date() && parseFloat(s.balance || 0) > 0
      );

      if (overdue.length > 0) {
        const overdueTotal = overdue.reduce((s, v) => s + parseFloat(v.balance || 0), 0);
        const oldestOverdue = overdue.reduce((oldest, v) =>
          !oldest || new Date(v.due_date) < new Date(oldest.due_date) ? v : oldest
        , null);
        overdueCustomers.push({
          customer: c,
          overdueSales: overdue,
          overdueTotal,
          daysOverdue: oldestOverdue
            ? Math.floor((new Date() - new Date(oldestOverdue.due_date)) / (1000 * 60 * 60 * 24))
            : 0
        });
      }
    }

    return { customers, totalOutstanding, totalLimit, overdueCustomers, totalOverdue: overdueCustomers.reduce((s, o) => s + o.overdueTotal, 0) };
  },

  getCustomerCreditDetail: async (customerId) => {
    const userId = await getCurrentUserId();
    const { data: customer, error: custError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .eq('user_id', userId)
      .single();
    if (custError) throw custError;

    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select('*')
      .eq('user_id', userId)
      .eq('customer_id', customerId)
      .neq('sale_type', 'contado')
      .order('created_at', { ascending: false });
    if (salesError) throw salesError;

    const { data: payments, error: payError } = await supabase
      .from('credit_payments')
      .select('*')
      .eq('user_id', userId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    if (payError) throw payError;

    return { customer, sales: sales || [], payments: payments || [] };
  },

  registerPayment: async ({ customerId, saleId, amount, paymentMethod, reference, notes }) => {
    const userId = await getCurrentUserId();
    const { data: customer, error: custError } = await supabase
      .from('customers')
      .select('credit_balance')
      .eq('id', customerId)
      .eq('user_id', userId)
      .single();
    if (custError) throw custError;

    const newBalance = Math.max(0, parseFloat(customer.credit_balance || 0) - parseFloat(amount));

    const { error: payError } = await supabase
      .from('credit_payments')
      .insert({
        user_id: userId,
        customer_id: customerId,
        sale_id: saleId || null,
        amount: parseFloat(amount),
        payment_method: paymentMethod || 'efectivo',
        reference: reference || null,
        notes: notes || null
      });
    if (payError) throw payError;

    const { error: updateError } = await supabase
      .from('customers')
      .update({ credit_balance: newBalance })
      .eq('id', customerId)
      .eq('user_id', userId);
    if (updateError) throw updateError;

    if (saleId) {
      const { data: sale } = await supabase
        .from('sales')
        .select('paid_amount, balance, total')
        .eq('id', saleId)
        .eq('user_id', userId)
        .single();
      if (sale) {
        const newPaidAmount = parseFloat(sale.paid_amount || 0) + parseFloat(amount);
        const newBalanceSale = Math.max(0, parseFloat(sale.total || 0) - newPaidAmount);
        const newStatus = newBalanceSale <= 0 ? 'pagado' : 'parcial';
        await supabase
          .from('sales')
          .update({ paid_amount: newPaidAmount, balance: newBalanceSale, credit_status: newStatus })
          .eq('id', saleId)
          .eq('user_id', userId);
      }
    }

    return { success: true, newBalance };
  },

  getPendingCreditSales: async (customerId) => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('user_id', userId)
      .eq('customer_id', customerId)
      .in('credit_status', ['pendiente', 'parcial'])
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  updateCreditLimit: async (customerId, creditLimit) => {
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from('customers')
      .update({ credit_limit: parseFloat(creditLimit) || 0 })
      .eq('id', customerId)
      .eq('user_id', userId);
    if (error) throw error;
    return { success: true };
  },

  toggleCreditHold: async (customerId, hold) => {
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from('customers')
      .update({ credit_hold: hold })
      .eq('id', customerId)
      .eq('user_id', userId);
    if (error) throw error;
    return { success: true };
  },

  getDashboardTotals: async () => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('customers')
      .select('credit_balance, credit_limit')
      .eq('user_id', userId)
      .or('credit_limit.gt.0,credit_balance.gt.0');
    if (error) throw error;

    const totalOutstanding = (data || []).reduce((s, c) => s + parseFloat(c.credit_balance || 0), 0);
    const totalCreditLimit = (data || []).reduce((s, c) => s + parseFloat(c.credit_limit || 0), 0);
    const activeCustomers = (data || []).filter(c => parseFloat(c.credit_balance || 0) > 0).length;

    return { totalOutstanding, totalCreditLimit, activeCustomers, totalCustomers: (data || []).length };
  }
};
