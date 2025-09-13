
"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, User, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import type { SignUpFormData, LoginFormData, MemberSignUpFormData } from '@/lib/types';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc, arrayUnion } from 'firebase/firestore';
import { createOrganization } from '@/app/actions';


export interface UserProfile {
  uid: string;
  email: string;
  name?: string;
  organizationId?: string;
  organizationName?: string;
  organizationOwnerUid?: string;
  address?: string;
  mobile?: string;
  landline?: string;
  website?: string;
}


interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signup: (data: SignUpFormData) => Promise<any>;
  memberSignup: (data: MemberSignUpFormData) => Promise<any>;
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
    // Check if user is an owner
    let q = query(organizationsRef, where("owner", "==", user.uid));
    let orgSnapshot = await getDocs(q);

    if (orgSnapshot.empty) {
      // If not an owner, check if they are a member
      q = query(organizationsRef, where("members", "array-contains", { email: user.email, uid: user.uid }));
      orgSnapshot = await getDocs(q);
    }
    
    // Check if they are an invited member without a UID yet
    if (orgSnapshot.empty) {
        q = query(organizationsRef, where("members", "array-contains", { name: user.displayName || user.email, email: user.email, address: '', mobile: '', landline: '' }));
        orgSnapshot = await getDocs(q);
    }


    if (!orgSnapshot.empty) {
        const orgDoc = orgSnapshot.docs[0];
        const orgData = orgDoc.data();
        const memberInfo = (orgData.members as {name: string, email: string, uid?: string}[]).find(m => m.email === user.email);

        setUserProfile({
            uid: user.uid,
            email: user.email,
            name: memberInfo?.name || user.email,
            organizationId: orgDoc.id,
            organizationName: orgData.name,
            organizationOwnerUid: orgData.owner,
            address: orgData.address,
            mobile: orgData.mobile,
            landline: orgData.landline,
            website: orgData.website,
        });
    } else {
        setUserProfile({ uid: user.uid, email: user.email, name: user.email });
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
    const user = userCredential.user;

    if (user && user.email) {
        await createOrganization(data.organizationName, user.uid, data.name, user.email);
        await fetchUserProfile(user);
    }
    return userCredential;
  }
  
  const memberSignup = async (data: MemberSignUpFormData) => {
    const organizationsRef = collection(db, "organizations");
    const q = query(organizationsRef, where("members", "array-contains", { name: data.email, email: data.email, address: '', mobile: '', landline: '' }));
    
    let orgDocToUpdate = null;
    let memberToUpdate = null;
    
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        // Find the specific organization and member object
        for (const doc of querySnapshot.docs) {
            const members = doc.data().members as any[];
            const foundMember = members.find(m => m.email === data.email && !m.uid);
            if (foundMember) {
                orgDocToUpdate = doc.ref;
                memberToUpdate = foundMember;
                break;
            }
        }
    }

    if (!orgDocToUpdate || !memberToUpdate) {
        throw new Error("Your email has not been invited to an organization. Please contact your administrator.");
    }
    
    // Create the user
    const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    const user = userCredential.user;

    if (user) {
        // Update the member record with the new UID
        const updatedMember = { ...memberToUpdate, uid: user.uid };
        const orgData = (await getDoc(orgDocToUpdate)).data();
        const updatedMembers = (orgData?.members || []).map((m: any) => m.email === data.email ? updatedMember : m);

        await updateDoc(orgDocToUpdate, { members: updatedMembers });

        await fetchUserProfile(user);
    }
    
    return userCredential;
  };


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
    memberSignup,
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
