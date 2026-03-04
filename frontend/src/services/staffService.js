import { supabase } from '../supabase';

export const staffService = {
    // Verificar si un PIN ya existe para esta tienda
    checkPinDuplicate: async (pin, excludeId = null) => {
        let query = supabase
            .from('staff')
            .select('id')
            .eq('pin', pin);

        if (excludeId) {
            query = query.neq('id', excludeId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data.length > 0;
    },

    // Obtener todos los empleados de la tienda actual
    getStaff: async () => {
        const { data, error } = await supabase
            .from('staff')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    // Crear un nuevo empleado
    createStaff: async (staff) => {
        const { data: userData } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('staff')
            .insert([{
                name: staff.name,
                last_name: staff.last_name || '',
                role: staff.role || 'cajero',
                pin: staff.pin,
                permissions: staff.permissions || { pos: true, inventory: false, reports: false, reset_cash: false, logout: false, cut: true, block: true },
                auth_method: staff.auth_method || 'pin',
                fingerprint_data: staff.fingerprint_data || null,
                active: staff.active !== undefined ? staff.active : true,
                user_id: userData.user.id
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Actualizar un empleado
    updateStaff: async (id, updates) => {
        const { data, error } = await supabase
            .from('staff')
            .update({
                name: updates.name,
                last_name: updates.last_name,
                role: updates.role,
                pin: updates.pin,
                permissions: updates.permissions,
                auth_method: updates.auth_method,
                fingerprint_data: updates.fingerprint_data,
                active: updates.active
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Eliminar un empleado
    deleteStaff: async (id) => {
        const { error } = await supabase
            .from('staff')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // Validar PIN de un empleado (para login rápido)
    validatePin: async (pin) => {
        const { data, error } = await supabase
            .from('staff')
            .select('*')
            .eq('pin', pin)
            .eq('active', true)
            .single();

        if (error || !data) {
            throw new Error('PIN inválido o usuario inactivo');
        }
        return data;
    },

    // Validar huella de un empleado (para login automático)
    loginWithFingerprint: async (fingerprintData) => {
        const { data, error } = await supabase
            .from('staff')
            .select('*')
            .eq('fingerprint_data', fingerprintData)
            .eq('active', true)
            .single();

        if (error || !data) {
            throw new Error('Huella no registrada o empleado inactivo');
        }
        return data;
    }
};
