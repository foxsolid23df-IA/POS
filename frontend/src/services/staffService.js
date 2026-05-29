import { supabase } from '../supabase';

const STAFF_SELECT = 'id, user_id, name, last_name, role, permissions, auth_method, fingerprint_data, active, created_at';

export const staffService = {
    // Verificar si un PIN ya existe para esta tienda sin exponer PINs en texto plano.
    checkPinDuplicate: async (pin, excludeId = null) => {
        const { data, error } = await supabase.rpc('validate_staff_pin', {
            p_pin: String(pin || '').trim()
        });
        if (error) throw error;
        return (data || []).some(staff => String(staff.id) !== String(excludeId || ''));
    },

    // Obtener todos los empleados de la tienda actual.
    getStaff: async () => {
        const { data, error } = await supabase
            .from('staff')
            .select(STAFF_SELECT)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    // Crear un nuevo empleado y guardar su PIN usando hash en la base de datos.
    createStaff: async (staff) => {
        const { data: userData } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('staff')
            .insert([{
                name: staff.name,
                last_name: staff.last_name || '',
                role: staff.role || 'cajero',
                permissions: staff.permissions || { pos: true, inventory: false, reports: false, reset_cash: false, logout: false, cut: true, block: true },
                auth_method: staff.auth_method || 'pin',
                fingerprint_data: staff.fingerprint_data || null,
                active: staff.active !== undefined ? staff.active : true,
                user_id: userData.user.id
            }])
            .select(STAFF_SELECT)
            .single();

        if (error) throw error;

        if (staff.pin) {
            const { error: pinError } = await supabase.rpc('set_staff_pin', {
                p_staff_id: data.id,
                p_pin: String(staff.pin).trim()
            });
            if (pinError) throw pinError;
        }

        return data;
    },

    // Actualizar un empleado sin enviar PIN en texto plano a la tabla.
    updateStaff: async (id, updates) => {
        const updateData = {
            name: updates.name,
            last_name: updates.last_name,
            role: updates.role,
            permissions: updates.permissions,
            auth_method: updates.auth_method,
            fingerprint_data: updates.fingerprint_data,
            active: updates.active
        };

        Object.keys(updateData).forEach(key => {
            if (updateData[key] === undefined) delete updateData[key];
        });

        const { data, error } = await supabase
            .from('staff')
            .update(updateData)
            .eq('id', id)
            .select(STAFF_SELECT)
            .single();

        if (error) throw error;

        if (updates.pin) {
            const { error: pinError } = await supabase.rpc('set_staff_pin', {
                p_staff_id: id,
                p_pin: String(updates.pin).trim()
            });
            if (pinError) throw pinError;
        }

        return data;
    },

    // Eliminar un empleado.
    deleteStaff: async (id) => {
        const { error } = await supabase
            .from('staff')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // Validar PIN de un empleado mediante RPC segura.
    validatePin: async (pin) => {
        const { data, error } = await supabase.rpc('validate_staff_pin', {
            p_pin: String(pin || '').trim()
        });

        if (error || !data || data.length === 0) {
            throw new Error('PIN invalido o usuario inactivo');
        }
        return data[0];
    },

    // Validar huella de un empleado.
    loginWithFingerprint: async (fingerprintData) => {
        const { data, error } = await supabase
            .from('staff')
            .select(STAFF_SELECT)
            .eq('fingerprint_data', fingerprintData)
            .eq('active', true)
            .single();

        if (error || !data) {
            throw new Error('Huella no registrada o empleado inactivo');
        }
        return data;
    }
};
