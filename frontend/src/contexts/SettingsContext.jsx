import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ticketSettingsService } from "../services/ticketSettingsService";
import { useAuth } from "../hooks/useAuth";

const SettingsContext = createContext();

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};

export const SettingsProvider = ({ children }) => {
  const { user } = useAuth();
  const [ticketSettings, setTicketSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshSettings = useCallback(async () => {
    if (!user) {
      setTicketSettings(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Pasamos user.id directamente para evitar llamada HTTP extra a supabase.auth.getUser()
      const settings = await ticketSettingsService.getSettings(user.id);
      setTicketSettings(settings);
    } catch (error) {
      console.error("[SettingsContext] Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  const value = {
    ticketSettings,
    loading,
    refreshSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};
