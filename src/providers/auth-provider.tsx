
"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, User, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import type { SignUpFormData, LoginFormData } from '@/lib/types';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc, arrayUnion } from 'firebase/firestore';
import { createOrganization } from '@/app/actions';


export interface UserProfile {
  uid: string;
  email: string;
  name?: string;
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
  signInWithGoogle: () => Promise<any>;
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
        const memberInfo = members?.find(member => member.email === user.email);
        if (memberInfo) {
            setUserProfile({
                uid: user.uid,
                email: user.email,
                name: memberInfo.name,
                organizationId: orgDoc.id,
                organizationName: orgDoc.data().name,
                organizationOwnerUid: orgDoc.data().owner,
            });
            foundOrg = true;
            break; 
        }
    }

    if (!foundOrg) {
        // If user is the owner of an org, they are implicitly a member
        const q = query(organizationsRef, where("owner", "==", user.uid));
        const ownerOrgSnapshot = await getDocs(q);
        if (!ownerOrgSnapshot.empty) {
            const orgDoc = ownerOrgSnapshot.docs[0];
            const ownerMemberInfo = (orgDoc.data().members as {name: string, email: string, uid: string}[])?.find(m => m.email === user.email);
            setUserProfile({
                uid: user.uid,
                email: user.email,
                name: ownerMemberInfo?.name || user.email,
                organizationId: orgDoc.id,
                organizationName: orgDoc.data().name,
                organizationOwnerUid: orgDoc.data().owner,
            });
        } else {
            setUserProfile({ uid: user.uid, email: user.email, name: user.email });
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
    const organizationsRef = collection(db, "organizations");
    const allOrgsSnapshot = await getDocs(organizationsRef);

    // If any organization already exists, block new signups.
    if (!allOrgsSnapshot.empty) {
        throw new Error("An administrator account already exists for this application. No further signups are allowed.");
    }
    
    // If no organizations exist, proceed to create the first user and their organization.
    const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    const user = userCredential.user;
    if (user && user.email) {
        // This user becomes the admin/owner of the new organization.
        await createOrganization(data.organizationName, user.uid, data.name, user.email);
    }
    return userCredential;
  }

  const login = (data: LoginFormData) => {
    return signInWithEmailAndPassword(auth, data.email, data.password);
  }

  const signInWithGoogle = () => {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
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
    fetchUserProfile,
    signInWithGoogle
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

    