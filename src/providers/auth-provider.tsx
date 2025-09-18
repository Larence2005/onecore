
"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, User, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import type { SignUpFormData, LoginFormData, MemberSignUpFormData } from '@/lib/types';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc, arrayUnion, or } from 'firebase/firestore';
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
  getLockoutEndTime: () => number | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MAX_LOGIN_ATTEMPTS = 3;
const LOCKOUT_DURATION = 60 * 1000; // 1 minute in milliseconds
const LOGIN_ATTEMPTS_KEY = 'loginAttempts';


export class LockoutError extends Error {
    public lockoutUntil: number;
    constructor(message: string, lockoutUntil: number) {
        super(message);
        this.name = 'LockoutError';
        this.lockoutUntil = lockoutUntil;
    }
}


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginAttempts, setLoginAttempts] = useState<number[]>([]);

  useEffect(() => {
    // Load attempts from localStorage on initial load
    try {
        const storedAttempts = localStorage.getItem(LOGIN_ATTEMPTS_KEY);
        if (storedAttempts) {
            const parsedAttempts = JSON.parse(storedAttempts) as number[];
            const now = Date.now();
            // Filter out attempts that are older than the lockout duration
            const recentAttempts = parsedAttempts.filter(attempt => now - attempt < LOCKOUT_DURATION);
            setLoginAttempts(recentAttempts);
        }
    } catch (e) {
        console.error("Failed to parse login attempts from localStorage", e);
    }
  }, []);

  const getLockoutEndTime = useCallback(() => {
    const now = Date.now();
    const recentAttempts = loginAttempts.filter(attempt => now - attempt < LOCKOUT_DURATION);
    if (recentAttempts.length >= MAX_LOGIN_ATTEMPTS) {
        const lastAttempt = recentAttempts[recentAttempts.length - 1];
        return lastAttempt + LOCKOUT_DURATION;
    }
    return null;
  }, [loginAttempts]);

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
      // If not an owner, check if they are a member by uid
      const allOrgsSnapshot = await getDocs(organizationsRef);
      for (const orgDoc of allOrgsSnapshot.docs) {
          const members = (orgDoc.data().members || []) as {email: string, uid: string}[];
          if(members.some(m => m.uid === user.uid)) {
              q = query(organizationsRef, where("__name__", "==", orgDoc.id));
              orgSnapshot = await getDocs(q);
              break;
          }
      }
    }
    
    // Fallback for invited members who just signed up
    if (orgSnapshot.empty) {
        const allOrgsSnapshot = await getDocs(organizationsRef);
        for (const orgDoc of allOrgsSnapshot.docs) {
            const members = (orgDoc.data().members || []) as {email: string, uid?: string, verificationSent?: boolean}[];
            const memberInvite = members.find(m => m.email === user.email && !m.uid);
            if(memberInvite) {
                 q = query(organizationsRef, where("__name__", "==", orgDoc.id));
                 orgSnapshot = await getDocs(q);
                 
                 // Add the UID to the member record
                 if (!orgSnapshot.empty) {
                    const orgToUpdateRef = orgDoc.ref;
                    const updatedMembers = members.map(m => m.email === user.email ? { ...m, uid: user.uid } : m);
                    await updateDoc(orgToUpdateRef, { members: updatedMembers });
                 }

                 break;
            }
        }
    }


    if (!orgSnapshot.empty) {
      const orgDoc = orgSnapshot.docs[0];
      const orgData = orgDoc.data();
      const memberData = (orgData.members || []).find((m: any) => m.uid === user.uid || m.email === user.email);

      setUserProfile({
        uid: user.uid,
        email: user.email,
        name: memberData?.name || user.displayName || user.email,
        organizationId: orgDoc.id,
        organizationName: orgData.name,
        organizationOwnerUid: orgData.owner,
        address: orgData.address,
        mobile: orgData.mobile,
        landline: orgData.landline,
        website: orgData.website,
      });
    } else {
      // User is authenticated but doesn't belong to any organization
      const userSettingsDoc = await getDoc(doc(db, 'users', user.uid));
      if (userSettingsDoc.exists()) {
           setUserProfile({
                uid: user.uid,
                email: user.email!,
                name: user.displayName || user.email!,
           });
      } else {
        setUserProfile(null);
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
  
  const handleLoginSuccess = () => {
    localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
    setLoginAttempts([]);
  };

  const signup = async (data: SignUpFormData) => {
    const organizationsRef = collection(db, "organizations");
    const q = query(organizationsRef, or(
      where("name", "==", data.organizationName),
      where("domain", "==", data.domain)
    ));

    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const existingOrg = querySnapshot.docs[0].data();
      if (existingOrg.name === data.organizationName) {
        throw new Error("An organization with this name already exists.");
      }
      if (existingOrg.domain === data.domain) {
        throw new Error("An organization with this domain already exists.");
      }
    }

    const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    
    // Create the organization in Firestore
    await createOrganization(data.organizationName, data.domain, userCredential.user.uid, data.name, data.email);
    
    // Create the user-specific settings document
    await setDoc(doc(db, "users", userCredential.user.uid), {
        name: data.name,
        email: data.email,
        // Default empty settings
        clientId: "",
        tenantId: "",
        clientSecret: "",
    });
    
    await fetchUserProfile(userCredential.user);
    handleLoginSuccess();
  };
  
  const memberSignup = async (data: MemberSignUpFormData) => {
    let orgId: string | null = null;
    let memberName: string | null = null;
    const orgsSnapshot = await getDocs(collection(db, "organizations"));

    for (const orgDoc of orgsSnapshot.docs) {
        const members = (orgDoc.data().members || []) as { email: string, name: string, verificationSent?: boolean }[];
        const foundMember = members.find(m => m.email.toLowerCase() === data.email.toLowerCase());
        
        if (foundMember) {
            if (foundMember.verificationSent) {
                orgId = orgDoc.id;
                memberName = foundMember.name;
                break;
            } else {
                throw new Error("Your account has not been verified by an administrator. Please contact them to send a verification email.");
            }
        }
    }

    if (!orgId) {
        throw new Error("You have not been invited to any organization, or your invitation has not been verified. Please contact your administrator.");
    }
    
    const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    
    // Add the UID to the member in the organization
    const orgRef = doc(db, 'organizations', orgId);
    const orgDoc = await getDoc(orgRef);
    if(orgDoc.exists()){
        const members = orgDoc.data().members as {name: string, email: string, uid?: string}[];
        const updatedMembers = members.map(m => m.email.toLowerCase() === data.email.toLowerCase() ? { ...m, uid: userCredential.user.uid } : m);
        await updateDoc(orgRef, { members: updatedMembers });
    }

    // Create user settings doc
    await setDoc(doc(db, "users", userCredential.user.uid), {
        name: memberName,
        email: data.email,
    });
    
    await fetchUserProfile(userCredential.user);
    handleLoginSuccess();
}
  
  const recordFailedLogin = () => {
    const now = Date.now();
    const updatedAttempts = [...loginAttempts, now];
    localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(updatedAttempts));
    setLoginAttempts(updatedAttempts);
    return updatedAttempts;
};

  const login = async (data: LoginFormData) => {
    const lockoutEndTime = getLockoutEndTime();
    if (lockoutEndTime && Date.now() < lockoutEndTime) {
        throw new LockoutError('Too many failed login attempts.', lockoutEndTime);
    }
    
    try {
        const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
        await fetchUserProfile(userCredential.user);
        handleLoginSuccess();
    } catch(error) {
        const attempts = recordFailedLogin();
        const now = Date.now();
        const recentAttempts = attempts.filter(a => now - a < LOCKOUT_DURATION);

        if (recentAttempts.length >= MAX_LOGIN_ATTEMPTS) {
            const newLockoutTime = (recentAttempts[recentAttempts.length - 1] || now) + LOCKOUT_DURATION;
            throw new LockoutError('Too many failed login attempts.', newLockoutTime);
        }
        
        throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
  };
  
  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        // This gives you a Google Access Token. You can use it to access the Google API.
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const token = credential?.accessToken;
        
        const user = result.user;

        // Check if user exists in Firestore
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
             // New user, create a document. For now, we assume they are not part of an org.
             await setDoc(userDocRef, {
                name: user.displayName,
                email: user.email,
             });
        }
        
        await fetchUserProfile(user);
        handleLoginSuccess();
    } catch (error) {
        console.error("Google Sign-In Error:", error);
        throw error;
    }
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
    signInWithGoogle,
    getLockoutEndTime,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

