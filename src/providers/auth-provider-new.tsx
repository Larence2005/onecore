"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import type { SignUpFormData, LoginFormData, MemberSignUpFormData } from '@/lib/types';
import { prisma } from '@/lib/prisma';

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
  status?: 'UNINVITED' | 'INVITED' | 'NOT_VERIFIED' | 'VERIFIED';
  organizationDomain?: string;
  deadlineSettings?: any;
}

interface AuthContextType {
  user: any | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signup: (data: SignUpFormData) => Promise<any>;
  memberSignup: (data: MemberSignUpFormData) => Promise<any>;
  login: (data: LoginFormData) => Promise<any>;
  logout: () => Promise<void>;
  fetchUserProfile: (userId: string) => Promise<void>;
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
  const { data: session, status } = useSession();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loginAttempts, setLoginAttempts] = useState<number[]>([]);
  const loading = status === 'loading';

  useEffect(() => {
    // Load attempts from localStorage on initial load
    try {
      const storedAttempts = localStorage.getItem(LOGIN_ATTEMPTS_KEY);
      if (storedAttempts) {
        const parsedAttempts = JSON.parse(storedAttempts) as number[];
        const now = Date.now();
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

  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      const response = await fetch(`/api/user/profile?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }
      const profile = await response.json();
      setUserProfile(profile);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUserProfile(null);
    }
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      fetchUserProfile(session.user.id);
    } else {
      setUserProfile(null);
    }
  }, [session, fetchUserProfile]);

  const handleLoginSuccess = () => {
    localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
    setLoginAttempts([]);
  };

  const signup = async (data: SignUpFormData) => {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Signup failed');
    }

    const result = await response.json();
    
    // Auto login after signup
    await signIn('credentials', {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    handleLoginSuccess();
    return result;
  };

  const memberSignup = async (data: MemberSignUpFormData) => {
    const response = await fetch('/api/auth/member-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Member signup failed');
    }

    const result = await response.json();

    // Auto login after signup
    await signIn('credentials', {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    handleLoginSuccess();
    return result;
  };

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

    const result = await signIn('credentials', {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      const attempts = recordFailedLogin();
      const now = Date.now();
      const recentAttempts = attempts.filter(a => now - a < LOCKOUT_DURATION);

      if (recentAttempts.length >= MAX_LOGIN_ATTEMPTS) {
        const newLockoutTime = (recentAttempts[recentAttempts.length - 1] || now) + LOCKOUT_DURATION;
        throw new LockoutError('Too many failed login attempts.', newLockoutTime);
      }

      throw new Error(result.error);
    }

    handleLoginSuccess();
    return result;
  };

  const logout = async () => {
    await signOut({ redirect: false });
  };

  const signInWithGoogle = async () => {
    const result = await signIn('google', { redirect: false });
    if (result?.error) {
      throw new Error(result.error);
    }
    handleLoginSuccess();
    return result;
  };

  const sendPasswordReset = async (email: string) => {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Password reset failed');
    }
  };

  const value = {
    user: session?.user || null,
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
