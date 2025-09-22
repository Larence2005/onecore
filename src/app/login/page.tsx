
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This component is now just a redirector.
// It will redirect any traffic from the old /login URL to the new root URL.
export default function LoginPageRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>Redirecting...</p>
    </div>
  );
}
