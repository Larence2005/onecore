
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

export default function TermsPage() {
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
                  Terms of Service
                </h1>
                <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
            </div>
            <div className="prose dark:prose-invert max-w-none mt-12 mx-auto">
              <div className="mb-8">
                <h2 className="font-bold">1. Agreement to Terms</h2>
                <p>By accessing or using Quickdesk, a product of Nextcore Technology Inc., you agree to be bound by these Terms and Policy, as well as all applicable laws and regulations. If you do not agree with any of these terms, you must discontinue the use of the platform immediately. Nextcore Technology Inc. reserves the right to update or modify these terms at any time without prior notice. Continued use of Quickdesk following any changes constitutes acceptance of the updated terms.</p>
              </div>
              <div className="mb-8">
                <h2 className="font-bold">2. Your Account</h2>
                <p>To use Quickdesk, you are required to create an account by providing accurate and complete information, including your full name, email address, domain, and organization details. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to promptly notify us of any unauthorized use of your account or any other breach of security. Quickdesk shall not be liable for any loss or damage arising from your failure to safeguard your account information.</p>
              </div>
              <div className="mb-8">
                <h2 className="font-bold">3. User Content</h2>
                <p>As part of using Quickdesk, you may submit or manage information, including emails and support tickets, through your account (“User Content”). You retain ownership of all User Content you create and manage within the platform. Quickdesk does not read, access, or monitor any User Content, ensuring that your data remains private and secure. However, you grant Quickdesk a limited, non-exclusive right to store and process your User Content solely for the purpose of providing and improving the platform’s services. You are solely responsible for ensuring that your User Content complies with applicable laws and does not infringe on the rights of any third party.</p>
              </div>
              <div className="mb-8">
                <h2 className="font-bold">4. Prohibited Activities</h2>
                <p>You agree to use Quickdesk only for lawful and authorized purposes. The following activities are strictly prohibited:</p>
                <ul>
                  <li>Using the platform in any manner that violates applicable local, national, or international laws and regulations</li>
                  <li>Attempting to gain unauthorized access to the platform, other user accounts, or related systems and networks</li>
                  <li>Interfering with or disrupting the integrity or performance of the platform</li>
                  <li>Uploading, transmitting, or sharing content that is unlawful, fraudulent, defamatory, or infringes on the intellectual property rights of others</li>
                  <li>Misusing the platform to send spam, malicious software, or unauthorized communications</li>
                  <li>Engaging in activities that could damage, disable, or impair the operation of Quickdesk or its infrastructure</li>
                </ul>
                <p>Violation of these prohibited activities may result in suspension or termination of your account, in addition to any legal remedies available under applicable law.</p>
              </div>
              <div className="mb-8">
                <h2 className="font-bold">5. Limitation of Liability</h2>
                <p>To the maximum extent permitted by law, Nextcore Technology Inc. and its affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or goodwill, arising out of or in connection with the use or inability to use Quickdesk. Quickdesk is provided on an “as is” and “as available” basis. We do not warrant that the platform will be uninterrupted, error-free, or fully secure at all times.</p>
              </div>
              <div className="mb-8">
                <h2 className="font-bold">6. Termination</h2>
                <p>We reserve the right to suspend or terminate your account or access to Quickdesk at any time, with or without notice, if we believe you have violated these terms, engaged in unlawful activity, or posed a risk to the platform’s security or integrity. Upon termination, your right to use Quickdesk will immediately cease. You remain responsible for any obligations or liabilities incurred prior to termination.</p>
              </div>
              <div className="mb-8">
                <h2 className="font-bold">7. International Use</h2>
                <p>Quickdesk is operated and managed from the Philippines, but may be accessed by users worldwide. If you access or use Quickdesk from outside the Philippines, you are solely responsible for ensuring that your use of the platform complies with all applicable laws and regulations in your country or jurisdiction. We make no representation that Quickdesk is appropriate or available for use in all locations. Accessing the platform from territories where its use is unlawful is strictly prohibited.</p>
              </div>
              <div className="mb-8">
                <h2 className="font-bold">8. Governing Law</h2>
                <p>These Terms and Policy shall be governed by and construed in accordance with the laws of the Republic of the Philippines, without regard to its conflict of law principles. By using the platform, you acknowledge and agree that any disputes, claims, or legal proceedings arising under or in connection with these terms shall be subject to the exclusive jurisdiction of the appropriate courts in the Philippines, regardless of your location.</p>
              </div>
              <div className="mb-8">
                <h2 className="font-bold">9. Compliance with Laws</h2>
                <p>Nextcore Technology Inc. complies with applicable laws and legal processes in the Philippines and may cooperate with law enforcement agencies or regulatory authorities outside the Philippines in accordance with valid international legal requests. If a user engages in activities on Quickdesk that violate the laws of their country or other jurisdictions, we may disclose relevant account information to competent authorities in those jurisdictions, provided that such disclosure is supported by proper legal documentation or international cooperation agreements. Users are solely responsible for ensuring that their use of the platform does not violate any laws or regulations applicable in their location.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t py-6">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center text-center md:text-left">
            <div className="mb-4 md:mb-0">
                <p className="text-sm text-muted-foreground">&copy; 2025 Quickdesk. All rights reserved.</p>
                <p className="text-xs text-muted-foreground">A Product of Nextcore Technology Inc.</p>
            </div>
        </div>
    </footer>
    </div>
  );
}
