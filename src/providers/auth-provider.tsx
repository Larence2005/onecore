
"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, User, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import type { SignUpFormData, LoginFormData } from '@/lib/types';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';

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
    // Use 'in' query to check if the user's email is in the members array of any organization
    // Note: 'array-contains' only works for a single value. For multiple potential organizations,
    // this would need a different structure or multiple queries. For now, we assume one.
    const q = query(organizationsRef, where("members", "array-contains", { name: user.displayName || 'Admin', email: user.email }));
    
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      // Assuming a user can only be part of one organization for now
      const orgDoc = querySnapshot.docs[0];
      setUserProfile({
        uid: user.uid,
        email: user.email,
        organizationId: orgDoc.id,
        organizationName: orgDoc.data().name
      });
    } else {
        // More robust check if the first query fails (e.g. name mismatch)
        const allOrgsSnapshot = await getDocs(collection(db, "organizations"));
        let foundOrg = false;
        for (const orgDoc of allOrgsSnapshot.docs) {
            const members = orgDoc.data().members as {name: string, email: string}[];
            if (members.some(member => member.email === user.email)) {
                 setUserProfile({
                    uid: user.uid,
                    email: user.email,
                    organizationId: orgDoc.id,
                    organizationName: orgDoc.data().name
                });
                foundOrg = true;
                break;
            }
        }
        if (!foundOrg) {
             setUserProfile({ uid: user.uid, email: user.email });
        }
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
