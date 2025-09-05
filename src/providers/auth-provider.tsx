
"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, User, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import type { SignUpFormData, LoginFormData } from '@/lib/types';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { addMemberToOrganization } from '@/app/actions';

export interface UserProfile {
  uid: string;
  email: string;
  organizationId?: string;
  organizationName?: string;
  organizationOwnerUid?: string;
}


interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signup: (data: SignUpFormData) => Promise<any>;
  login: (data: LoginFormData) => Promise<any>;
  logout: () => Promise<void>;
  fetchUserProfile: (user: User) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = useCallback(async (user: User) => {
    if (!user.email) {
      setUserProfile({ uid: user.uid, email: '' });
      return;
    }
    
    const organizationsRef = collection(db, "organizations");
    const allOrgsSnapshot = await getDocs(organizationsRef);

    let foundOrg = false;
    for (const orgDoc of allOrgsSnapshot.docs) {
        const members = orgDoc.data().members as {name: string, email: string}[];
        if (members && members.some(member => member.email === user.email)) {
            setUserProfile({
                uid: user.uid,
                email: user.email,
                organizationId: orgDoc.id,
                organizationName: orgDoc.data().name,
                organizationOwnerUid: orgDoc.data().owner,
            });
            foundOrg = true;
            break; 
        }
    }

    if (!foundOrg) {
        setUserProfile({ uid: user.uid, email: user.email });
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

  const signup = async (data: SignUpFormData) => {
    const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    
    // After user is created, add them to the first organization found.
    // This is a simplification assuming a single-org setup for now.
    const organizationsRef = collection(db, "organizations");
    const orgsSnapshot = await getDocs(organizationsRef);

    if (!orgsSnapshot.empty) {
        const firstOrgDoc = orgsSnapshot.docs[0];
        const userName = data.email.split('@')[0]; // Simple name generation
        await addMemberToOrganization(firstOrgDoc.id, userName, data.email);
    }

    return userCredential;
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
    logout,
    fetchUserProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

    