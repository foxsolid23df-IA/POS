import { supabase } from '../supabase';

const getCurrentUserId = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const userId = data?.user?.id;
  if (!userId) throw new Error('Usuario no autenticado');
  return userId;
};

const normalizeSupplierInput = (supplier) => ({
  name: supplier.name?.trim(),
  contact_name: supplier.contact_name?.trim() || null,
  email: supplier.email?.trim() || null,
  phone: supplier.phone?.trim() || null,
  tax_id: supplier.tax_id?.trim() || null,
  address: supplier.address?.trim() || null,
  payment_terms: supplier.payment_terms || supplier.conditions || 'Contado',
  balance: parseFloat(supplier.balance || 0),
  status: supplier.status || 'active',
});

export const supplierService = {
  getAll: async () => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('suppliers')
      .select('id, name, contact_name, phone, email, tax_id, address, payment_terms, balance, status, created_at, updated_at')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  create: async (supplier) => {
    const userId = await getCurrentUserId();
    const payload = normalizeSupplierInput(supplier);
    if (!payload.name) throw new Error('El nombre del proveedor es obligatorio');

    const { data, error } = await supabase
      .from('suppliers')
      .insert({ ...payload, user_id: userId })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  update: async (id, supplier) => {
    const userId = await getCurrentUserId();
    const payload = normalizeSupplierInput(supplier);
    if (!payload.name) throw new Error('El nombre del proveedor es obligatorio');

    const { data, error } = await supabase
      .from('suppliers')
      .update({ ...payload, updated_at: new Date().toISOString() })
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
      .from('suppliers')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  },
};
