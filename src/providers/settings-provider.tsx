
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
  const { user, userProfile } = useAuth();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      if (userProfile && userProfile.organizationId) {
        try {
          const orgDocRef = doc(db, 'organizations', userProfile.organizationId);
          const docSnap = await getDoc(orgDocRef);
          
          if (docSnap.exists()) {
            const orgData = docSnap.data();
            const ownerUid = orgData.owner;
            const owner = orgData.members.find((m: any) => m.uid === ownerUid);

            const storedSettings: StoredSettings = {
              clientId: orgData.clientId || '',
              tenantId: orgData.tenantId || '',
              clientSecret: orgData.clientSecret || ''
            };
            
            setSettings({
              ...storedSettings,
              userId: owner?.email || ''
            });

          } else {
             setSettings(defaultSettings);
          }
        } catch (error) {
          console.error("Failed to load settings from Firestore", error);
          setSettings(defaultSettings);
        }
      } else {
        setSettings(defaultSettings);
      }
      setIsLoaded(true);
    }
    loadSettings();
  }, [userProfile]);

  const saveSettings = useCallback(async (newSettings: Omit<Settings, 'userId'>) => {
    if (!user || user.uid !== userProfile?.organizationOwnerUid || !userProfile.organizationId) {
      console.error("Cannot save settings, user is not the organization owner or org ID is missing.");
      return;
    }
    try {
      const orgDocRef = doc(db, "organizations", userProfile.organizationId);
      const settingsToStore = {
        clientId: newSettings.clientId,
        tenantId: newSettings.tenantId,
        clientSecret: newSettings.clientSecret,
      };
      await setDoc(orgDocRef, settingsToStore, { merge: true });
      setSettings({ ...newSettings, userId: user.email || '' });
    } catch (error) {
      console.error("Failed to save settings to Firestore", error);
    }
  }, [user, userProfile]);
  
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
