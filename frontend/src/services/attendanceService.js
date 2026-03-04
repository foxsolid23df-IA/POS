import { supabase } from '../supabase';

export const attendanceService = {
    // Check in or out
    logAttendance: async (staffId, action, authMethodUsed = 'pin', notes = null) => {
        const { data: userData } = await supabase.auth.getUser();

        // Validar tipo de acción
        if (!['check_in', 'check_out'].includes(action)) {
            throw new Error('Action must be explicitly check_in or check_out');
        }

        const { data, error } = await supabase
            .from('attendance_logs')
            .insert([{
                user_id: userData.user.id,
                staff_id: staffId,
                action,
                timestamp: new Date().toISOString(),
                auth_method_used: authMethodUsed,
                notes
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Get attendance logs with staff profiles
    getLogs: async (startDate, endDate) => {
        const { data: userData } = await supabase.auth.getUser();

        let query = supabase
            .from('attendance_logs')
            .select(`
        *,
        staff:staff_id (name, last_name, role)
      `)
            .eq('user_id', userData.user.id)
            .order('timestamp', { ascending: false });

        if (startDate) {
            query = query.gte('timestamp', startDate);
        }
        if (endDate) {
            query = query.lte('timestamp', endDate);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    // Get last status of a staff member
    getLastLog: async (staffId) => {
        const { data: userData } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('attendance_logs')
            .select('*')
            .eq('user_id', userData.user.id)
            .eq('staff_id', staffId)
            .order('timestamp', { ascending: false })
            .limit(1);

        if (error) throw error;
        return data && data.length > 0 ? data[0] : null;
    }
};
