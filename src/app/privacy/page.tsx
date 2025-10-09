
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

export default function PrivacyPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-background">
       <div className="fixed top-0 left-0 right-0 z-50 p-2 sm:p-4">
        <header
          className="container mx-auto max-w-5xl flex items-center justify-between h-14 md:h-16 px-4 md:px-6 bg-card/80 backdrop-blur-sm rounded-full shadow-md border">
          <Link href="/" className="flex items-center justify-center" prefetch={false}>
            <Image src="/quickdesk_logowithtext_nobg.png" alt="Quickdesk Logo" width="120" height="60" className="w-[120px] md:w-[150px]" unoptimized />
            <span className="sr-only">Quickdesk</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-1 md:space-x-4">
            <Button asChild variant="link" size="sm" className="text-foreground h-auto p-1 text-xs md:size-auto md:text-sm">
              <Link href="/about" prefetch={false}>
                About
              </Link>
            </Button>
            <Button asChild variant="link" size="sm" className="text-foreground h-auto p-1 text-xs md:size-auto md:text-sm">
              <Link href="/features" prefetch={false}>
                Features
              </Link>
            </Button>
             <Button asChild variant="link" size="sm" className="text-foreground h-auto p-1 text-xs md:size-auto md:text-sm">
              <Link href="/pricing" prefetch={false}>
                Pricing
              </Link>
            </Button>
             <Button asChild variant="link" size="sm" className="text-foreground h-auto p-1 text-xs md:size-auto md:text-sm">
              <Link href="/privacy" prefetch={false}>
                Privacy
              </Link>
            </Button>
            <Button asChild variant="link" size="sm" className="text-foreground h-auto p-1 text-xs md:size-auto md:text-sm">
              <Link href="/terms" prefetch={false}>
                Terms and Policy
              </Link>
            </Button>
          </nav>
          <div className="md:hidden">
            <Button onClick={() => setIsMenuOpen(true)} variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Open menu</span>
            </Button>
          </div>
        </header>
      </div>
       {isMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center">
            <Button onClick={() => setIsMenuOpen(false)} variant="ghost" size="icon" className="absolute top-6 right-6 h-8 w-8">
              <X className="h-6 w-6" />
              <span className="sr-only">Close menu</span>
            </Button>
            <nav className="flex flex-col items-center space-y-8">
                <Link href="/about" className="text-2xl text-foreground hover:underline" onClick={() => setIsMenuOpen(false)}>About</Link>
                <Link href="/features" className="text-2xl text-foreground hover:underline" onClick={() => setIsMenuOpen(false)}>Features</Link>
                <Link href="/pricing" className="text-2xl text-foreground hover:underline" onClick={() => setIsMenuOpen(false)}>Pricing</Link>
                <Link href="/privacy" className="text-2xl text-foreground hover:underline" onClick={() => setIsMenuOpen(false)}>Privacy</Link>
                <Link href="/terms" className="text-2xl text-foreground hover:underline" onClick={() => setIsMenuOpen(false)}>Terms and Policy</Link>
            </nav>
          </div>
        )}
      <main className="flex-1 pt-24">
        <section className="w-full py-12 md:py-24 px-4">
          <div className="container px-4 md:px-6 max-w-3xl mx-auto">
            <div className="flex flex-col items-center space-y-4 text-center">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                  Privacy Policy
                </h1>
                <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
            </div>
            <div className="prose dark:prose-invert max-w-none mt-12 mx-auto">
              <h2>1. Introduction</h2>
              <p>At Quickdesk, a product of Nextcore Technology Inc., we value and respect your privacy. This Privacy Policy explains how we collect, use, and protect your information when you use our platform and services. By registering and using Quickdesk, you agree to the practices described in this policy.</p>
              
              <h2>2. Information We Collect</h2>
              <p>We collect only the information necessary to provide and improve our services. This includes both information you provide directly and information collected automatically during your interaction with our platform.</p>
              
              <h3>2.1. Information You Provide</h3>
              <p>During the registration process, we collect the following information:</p>
              <ul>
                <li>Full Name</li>
                <li>Email Address</li>
                <li>Domain</li>
                <li>Organization Details</li>
              </ul>
              <p>This information is provided voluntarily by you when you create an account on Quickdesk.</p>
              
              <h3>2.2. Information We Collect Automatically</h3>
              <p>In addition to the information you provide, we also automatically collect the following details during your use of the platform:</p>
              <ul>
                <li>The email, name, domain, and organization details associated with your account</li>
                <li>New verified email addresses created during the verification process</li>
              </ul>
              <p>We do not collect IP addresses, exact location data, or browser activity. This ensures that only essential information required for platform functionality is gathered.</p>
              
              <h2>3. How We Use Your Information</h2>
              <p>We use the information we collect solely for the following purposes:</p>
              <ul>
                <li>Metrics and usage computation, to understand how our platform is used and to improve service performance</li>
                <li>Ensuring the security, functionality, and reliability of our platform</li>
              </ul>
              <p>We do not use your information for marketing or advertising purposes. Additionally, we do not read, access, or monitor any emails or tickets created within your account, ensuring that your communication data remains private and secure.</p>
              
              <h2>4. Sharing Your Information</h2>
              <p>We do not share, sell, or rent any personal information, including email addresses, to third parties. The only circumstance under which we may disclose information is if we receive a lawful request from law enforcement authorities supported by a court order. In such cases, we will comply with applicable legal obligations.</p>
              
              <h2>5. Data Security</h2>
              <p>We implement appropriate technical and organizational measures to safeguard the information we collect. Access to data is strictly controlled and limited to authorized personnel who require it to operate and maintain the platform. We continuously review and enhance our security practices to protect your information against unauthorized access, alteration, disclosure, or destruction.</p>
              
              <h2>6. Your Rights</h2>
              <p>You have the right to access, update, or correct the personal information associated with your account. If you wish to request changes or deletion of your information, you may contact us through our official support channels. We will process all legitimate requests in accordance with applicable privacy and data protection laws.</p>
            </div>
          </div>
        </section>
      </main>
      <footer
        className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-6 lg:px-[20%] border-t">
        <p className="text-xs text-muted-foreground">&copy; 2025 Quickdesk. All rights reserved.</p>
      </footer>
    </div>
  );
}
