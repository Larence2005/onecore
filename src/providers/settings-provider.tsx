
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
  userId: string;
}

interface SettingsContextType {
  settings: Settings;
  saveSettings: (newSettings: Omit<Settings, 'userId'>) => void;
  isConfigured: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const defaultSettings: Settings = {
  clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || '',
  tenantId: process.env.NEXT_PUBLIC_AZURE_TENANT_ID || '',
  clientSecret: process.env.AZURE_CLIENT_SECRET || '',
  userId: '',
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { userProfile } = useAuth();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      // Credentials are now from environment variables, but we still need the userId.
      if (userProfile && userProfile.organizationId) {
        try {
          const orgDocRef = doc(db, 'organizations', userProfile.organizationId);
          const docSnap = await getDoc(orgDocRef);
          
          if (docSnap.exists()) {
            const orgData = docSnap.data();
            const ownerUid = orgData.owner;
            const owner = orgData.members.find((m: any) => m.uid === ownerUid);
            
            let ownerEmail = '';
            if (owner) {
              // Prioritize newEmail if it exists, otherwise use original email
              ownerEmail = owner.newEmail || owner.email;
            }

            setSettings(prev => ({
              ...prev,
              userId: ownerEmail || ''
            }));
          }
        } catch (error) {
          console.error("Failed to load user settings from Firestore", error);
        }
      }
      setIsLoaded(true);
    }
    loadSettings();
  }, [userProfile]);

  const saveSettings = useCallback(async (newSettings: Omit<Settings, 'userId'>) => {
    // This function is now a no-op for client-side credential saving, 
    // as they are managed by environment variables.
    // We could use this for other settings in the future.
    console.warn("Settings are now managed by environment variables. This function call is a no-op.");
  }, []);
  
  const isConfigured = !!(settings.clientId && settings.tenantId && settings.clientSecret && settings.userId);

  const value = {
    settings,
    saveSettings,
    isConfigured,
  };

  if (!isLoaded) {
    return <div className="flex items-center justify-center min-h-screen"><p>Loading settings...</p></div>;
  }
  
  return (
    <SettingsContext.Provider value={value}>
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
