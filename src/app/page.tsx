
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This component is now just a redirector.
// It will redirect any traffic from the root URL to the new /login URL.
export default function HomePageRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>Redirecting...</p>
    </div>
  );
}
