"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './auth-provider';
import { doc, getDoc, setDoc } from "firebase/firestore"; 
import { db } from '@/lib/firebase';

export interface Settings {
  clientId: string;
  tenantId: string;
  clientSecret: string;
  userId: string; // This will now be the user's email from Auth
}

interface StoredSettings {
  clientId: string;
  tenantId: string;
  clientSecret: string;
}

interface SettingsContextType {
  settings: Settings;
  saveSettings: (newSettings: Omit<Settings, 'userId'>) => void;
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
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      if (user) {
        try {
          const settingsDocRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(settingsDocRef);
          if (docSnap.exists()) {
            const storedData = docSnap.data() as StoredSettings;
            setSettings({ ...storedData, userId: user.email || '' });
          } else {
            // No settings exist, use defaults but with user's email
            setSettings({ ...defaultSettings, userId: user.email || '' });
          }
        } catch (error) {
          console.error("Failed to load settings from Firestore", error);
          setSettings({ ...defaultSettings, userId: user.email || '' });
        }
      } else {
        // No user, reset to default settings
        setSettings(defaultSettings);
      }
      setIsLoaded(true);
    }
    loadSettings();
  }, [user]);

  const saveSettings = useCallback(async (newSettings: Omit<Settings, 'userId'>) => {
    if (!user) {
      console.error("Cannot save settings, no user logged in");
      return;
    }
    try {
      const settingsToStore: StoredSettings = {
        clientId: newSettings.clientId,
        tenantId: newSettings.tenantId,
        clientSecret: newSettings.clientSecret,
      };
      await setDoc(doc(db, "users", user.uid), settingsToStore, { merge: true });
      setSettings({ ...newSettings, userId: user.email || '' });
    } catch (error) {
      console.error("Failed to save settings to Firestore", error);
    }
  }, [user]);
  
  const isConfigured = isLoaded && !!(settings.clientId && settings.tenantId && settings.clientSecret && user);

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
