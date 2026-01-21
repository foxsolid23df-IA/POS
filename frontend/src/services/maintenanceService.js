import { supabase } from '../supabase';

export const maintenanceService = {
  /**
   * Resets project data in the database and cleans up local storage.
   * @param {Object} options - Reset options
   * @param {boolean} options.resetTerminals - Whether to reset devices/terminals
   * @param {boolean} options.resetTransactions - Whether to reset sales, sessions, and cuts
   * @param {boolean} options.resetProfiles - Whether to delete non-admin profiles
   */
  async resetProjectData({ resetTerminals = true, resetTransactions = true, resetProfiles = false, factoryReset = false }) {
    try {
      const { data, error } = await supabase.rpc('reset_project_data', {
        p_reset_terminals: resetTerminals,
        p_reset_transactions: resetTransactions,
        p_reset_profiles: resetProfiles,
        p_factory_reset: factoryReset
      });

      if (error) throw error;

      if (data?.success) {
        // If terminals were reset, we MUST clear local storage to force re-registration
        if (resetTerminals || factoryReset) {
          this.resetLocalTerminal();
        }
        return data;
      } else {
        throw new Error(data?.message || 'Error desconocido durante el reset');
      }
    } catch (error) {
      console.error('Error in maintenanceService.resetProjectData:', error);
      throw error;
    }
  },

  resetLocalTerminal() {
    localStorage.removeItem('pos_terminal_id');
    localStorage.removeItem('pos_terminal_name');
    localStorage.removeItem('pos_is_main_terminal');
  }
};
