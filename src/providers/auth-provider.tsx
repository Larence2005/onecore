
"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, User, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import type { SignUpFormData, LoginFormData } from '@/lib/types';
import { doc, getDoc } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string;
  organizationId?: string;
  organizationName?: string;
}


interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signup: (data: SignUpFormData) => Promise<any>;
  login: (data: LoginFormData) => Promise<any>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = useCallback(async (user: User) => {
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);
    if(userDoc.exists()) {
        const profile = userDoc.data() as UserProfile;
        if (profile.organizationId) {
            const orgDocRef = doc(db, "organizations", profile.organizationId);
            const orgDoc = await getDoc(orgDocRef);
            if(orgDoc.exists()){
                setUserProfile({ ...profile, organizationName: orgDoc.data().name });
            } else {
                 setUserProfile(profile);
            }
        } else {
            setUserProfile(profile);
        }
    } else {
      setUserProfile({ uid: user.uid, email: user.email! });
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        await fetchUserProfile(user);
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchUserProfile]);

  const signup = (data: SignUpFormData) => {
    return createUserWithEmailAndPassword(auth, data.email, data.password);
  }

  const login = (data: LoginFormData) => {
    return signInWithEmailAndPassword(auth, data.email, data.password);
  }

  const logout = () => {
    return signOut(auth);
  };

  const value = {
    user,
    userProfile,
    loading,
    signup,
    login,
    logout
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
