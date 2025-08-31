"use client";

import { Header } from '@/components/header';
import { Dashboard } from '@/components/dashboard';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export interface Email {
    id: string;
    subject: string;
    sender: string;
}

export interface NewEmail {
    recipient: string;
    subject: string;
    body: string;
}

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
          <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <Dashboard />
      </main>
    </div>
  );
}
