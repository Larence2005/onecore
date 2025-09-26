
"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, User, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import type { SignUpFormData, LoginFormData, MemberSignUpFormData, OrganizationMember } from '@/lib/types';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc, arrayUnion, or } from 'firebase/firestore';
import { createOrganization } from '@/app/actions';


export interface UserProfile {
  uid: string;
  email: string;
  name?: string;
  organizationId?: string;
  organizationName?: string;
  organizationOwnerUid?: string;
  isClient?: boolean;
  address?: string;
  mobile?: string;
  landline?: string;
  website?: string;
  status?: 'Uninvited' | 'Invited' | 'Registered';
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
  sendPasswordReset: (email: string) => Promise<void>;
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
    const allOrgsSnapshot = await getDocs(organizationsRef);
    
    for (const orgDoc of allOrgsSnapshot.docs) {
        const orgData = orgDoc.data();
        const members = (orgData.members || []) as OrganizationMember[];
        
        // Check if user is an organization member (agent/admin)
        const memberData = members.find(m => m.uid === user.uid);
        if (memberData) {
            setUserProfile({
                uid: user.uid,
                email: user.email,
                name: (memberData as any)?.name || user.displayName || user.email,
                organizationId: orgDoc.id,
                organizationName: orgData.name,
                organizationOwnerUid: orgData.owner,
                isClient: false,
                address: orgData.address,
                mobile: orgData.mobile,
                landline: orgData.landline,
                website: orgData.website,
                status: memberData.status
            });
            return;
        }

        // Check if user is a client employee
        const companiesRef = collection(orgDoc.ref, 'companies');
        const companiesSnapshot = await getDocs(companiesRef);
        for (const companyDoc of companiesSnapshot.docs) {
            const employeeDocRef = doc(companyDoc.ref, 'employees', user.email);
            const employeeDoc = await getDoc(employeeDocRef);
            if (employeeDoc.exists()) {
                const employeeData = employeeDoc.data();
                setUserProfile({
                    uid: user.uid,
                    email: user.email,
                    name: employeeData.name || user.email,
                    organizationId: orgDoc.id,
                    organizationName: orgData.name,
                    organizationOwnerUid: orgData.owner,
                    isClient: true,
                });
                return;
            }
        }
    }

    // User not found in any org members or client employees list
    setUserProfile(null);

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
    
    await fetchUserProfile(userCredential.user);
    handleLoginSuccess();
  };
  
  const memberSignup = async (data: MemberSignUpFormData) => {
    let orgId: string | null = null;
    let isAgent = false;
    let isClientEmployee = false;
    
    const orgsSnapshot = await getDocs(collection(db, "organizations"));

    for (const orgDoc of orgsSnapshot.docs) {
        const orgData = orgDoc.data();
        // Check if they are an agent invited to the org
        const agentMembers = (orgData.members || []) as OrganizationMember[];
        const agentMatch = agentMembers.find(m => m.email.toLowerCase() === data.email.toLowerCase());

        if (agentMatch) {
            if (agentMatch.uid) throw new Error("This email address has already been registered as an agent.");
            if (agentMatch.status === 'Invited') {
                orgId = orgDoc.id;
                isAgent = true;
                break;
            } else if (agentMatch.status === 'Uninvited') {
                 throw new Error("Your account has not been verified by an administrator. Please contact them to send a verification email.");
            }
        }
        
        // Check if they are an employee of a client company
        const companiesRef = collection(orgDoc.ref, "companies");
        const companiesSnapshot = await getDocs(companiesRef);
        for(const companyDoc of companiesSnapshot.docs) {
            const employeeDocRef = doc(companyDoc.ref, 'employees', data.email);
            const employeeDoc = await getDoc(employeeDocRef);
            if (employeeDoc.exists()) {
                orgId = orgDoc.id;
                isClientEmployee = true;
                break;
            }
        }
        if (isClientEmployee) break;
    }

    if (!orgId || (!isAgent && !isClientEmployee)) {
        throw new Error("You have not been invited to an organization or client company. Please contact an administrator.");
    }
    
    const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    
    if(isAgent) {
        // Add the UID and set status to Registered
        const orgRef = doc(db, 'organizations', orgId);
        const orgDoc = await getDoc(orgRef);
        if(orgDoc.exists()){
            const members = orgDoc.data().members as OrganizationMember[];
            const updatedMembers = members.map(m => 
                m.email.toLowerCase() === data.email.toLowerCase() 
                ? { ...m, uid: userCredential.user.uid, status: 'Registered' as 'Registered' } 
                : m
            );
            await updateDoc(orgRef, { members: updatedMembers });
        }
    }
    // If it's a client employee, we don't need to update any document on signup,
    // as their authorization is based on their email existing in a company's employee list.
    
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
        const user = result.user;
        
        await fetchUserProfile(user);
        handleLoginSuccess();
    } catch (error) {
        console.error("Google Sign-In Error:", error);
        throw error;
    }
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
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
    sendPasswordReset,
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
