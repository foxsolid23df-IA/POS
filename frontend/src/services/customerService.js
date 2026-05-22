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

  create: async ({ name, rfc, phone }) => {
    const { data, error } = await supabase
      .from('customers')
      .insert({ name, rfc, phone })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id, { name, rfc, phone }) => {
    const { data, error } = await supabase
      .from('customers')
      .update({ name, rfc, phone })
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
