"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface Settings {
  clientId: string;
  tenantId: string;
  clientSecret: string;
  userId: string;
}

interface SettingsContextType {
  settings: Settings;
  saveSettings: (newSettings: Settings) => void;
  isConfigured: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const defaultSettings: Settings = {
  clientId: '',
  tenantId: '',
  clientSecret: '',
  userId: '',
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const storedSettings = localStorage.getItem('mailflow-settings');
      if (storedSettings) {
        setSettings(JSON.parse(storedSettings));
      }
    } catch (error) {
      console.error("Failed to load settings from localStorage", error);
    }
    setIsLoaded(true);
  }, []);

  const saveSettings = useCallback((newSettings: Settings) => {
    try {
      setSettings(newSettings);
      localStorage.setItem('mailflow-settings', JSON.stringify(newSettings));
    } catch (error) {
      console.error("Failed to save settings to localStorage", error);
    }
  }, []);
  
  const isConfigured = isLoaded && !!(settings.clientId && settings.tenantId && settings.clientSecret && settings.userId);

  if (!isLoaded) {
    return null;
  }

  return (
    <SettingsContext.Provider value={{ settings, saveSettings, isConfigured }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
