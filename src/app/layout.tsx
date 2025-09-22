
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Providers } from './providers';
import React from 'react';

export const metadata: Metadata = {
  title: 'Quickdesk',
  description: 'Manage your email workflows with ease.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p>Loading...</p></div>}>
          <Providers>
            {children}
            <Toaster />
          </Providers>
        </React.Suspense>
      </body>
    </html>
  );
}
