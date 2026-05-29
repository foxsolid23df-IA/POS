import { supabase } from '../supabase';

export const customerService = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  getById: async (id) => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  search: async (query) => {
    const q = `%${query}%`;
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .or(`name.ilike.${q},rfc.ilike.${q},phone.ilike.${q}`)
      .order('name')
      .limit(20);
    if (error) throw error;
    return data || [];
  },

  create: async ({ name, rfc, phone, credit_limit, payment_terms, credit_notes }) => {
    const { data, error } = await supabase
      .from('customers')
      .insert({
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
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  remove: async (id) => {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};
