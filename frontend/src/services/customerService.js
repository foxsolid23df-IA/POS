import { supabase } from '../supabase';

const getCurrentUserId = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const userId = data?.user?.id;
  if (!userId) throw new Error('Usuario no autenticado');
  return userId;
};

export const customerService = {
  getAll: async () => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  getById: async (id) => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    return data;
  },

  search: async (query) => {
    const userId = await getCurrentUserId();
    const q = `%${query}%`;
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', userId)
      .or(`name.ilike.${q},rfc.ilike.${q},phone.ilike.${q}`)
      .order('name')
      .limit(20);
    if (error) throw error;
    return data || [];
  },

  create: async ({ name, rfc, phone, credit_limit, payment_terms, credit_notes }) => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('customers')
      .insert({
        user_id: userId,
        name,
        rfc: rfc || '',
        phone: phone || '',
        credit_limit: parseFloat(credit_limit) || 0,
        payment_terms: payment_terms || 'contado',
        credit_notes: credit_notes || ''
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id, { name, rfc, phone, credit_limit, payment_terms, credit_notes, credit_hold }) => {
    const userId = await getCurrentUserId();
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (rfc !== undefined) updates.rfc = rfc;
    if (phone !== undefined) updates.phone = phone;
    if (credit_limit !== undefined) updates.credit_limit = parseFloat(credit_limit) || 0;
    if (payment_terms !== undefined) updates.payment_terms = payment_terms;
    if (credit_notes !== undefined) updates.credit_notes = credit_notes;
    if (credit_hold !== undefined) updates.credit_hold = credit_hold;

    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  remove: async (id) => {
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
  }
};
