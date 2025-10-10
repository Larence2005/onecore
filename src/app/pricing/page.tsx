
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { useState } from 'react';
import { Menu, X, Check } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const pricingTiers = [
  {
    name: "All-in-One Plan",
    price: "$10",
    period: "/agent/month",
    description: "",
    features: [
      "Per-agent billing",
      "Unlimited Tickets",
      "Multi-Channel Ticket Creation",
      "Client Management",
      "Agent Management",
      "Advanced Ticket Properties",
      "Automated Notifications",
      "Internal Notes",
      "Activity Log",
      "Analytics Dashboard",
      "Dedicated Email Support",
      "24/7 Support",
      "And Many More"
    ],
    buttonText: "Get Started Now",
    variant: "default"
  }
];

export default function PricingPage() {
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
            <Button asChild variant="link" size="sm" className="text-foreground h-auto p-1 text-xs md:size-auto md:text-sm">
              <Link href="/contact" prefetch={false}>
                Contact
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
                <Link href="/contact" className="text-2xl text-foreground hover:underline" onClick={() => setIsMenuOpen(false)}>Contact</Link>
            </nav>
          </div>
        )}
      <main className="flex-1 pt-24">
        <section className="w-full py-12 md:py-24 px-4">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                  Simple, Transparent Pricing
                </h1>
                <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">One plan with everything you need to deliver great support. No hidden fees.</p>
            </div>
            <div className="flex justify-center mt-12">
              {pricingTiers.map((tier) => (
                <Card key={tier.name} className="w-full max-w-4xl border-primary shadow-2xl p-6">
                  <div className="flex flex-col space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center">
                      <div>
                          <CardTitle className="text-3xl">{tier.name}</CardTitle>
                          <CardDescription className="mt-2">{tier.description}</CardDescription>
                          <div className="flex items-baseline mt-6">
                              <span className="text-5xl font-bold">{tier.price}</span>
                              {tier.period && <span className="text-muted-foreground ml-2 text-lg">{tier.period}</span>}
                          </div>
                      </div>
                      {(tier as any).buttonText && (
                        <Button asChild variant={tier.variant as any} size="lg" className="mt-4 sm:mt-0">
                            <Link href="/signup">
                            {(tier as any).buttonText}
                            </Link>
                        </Button>
                      )}
                    </div>
                    <Separator />
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-center">What's included:</h3>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
                            {tier.features.map((feature) => (
                                <li key={feature} className="flex items-center">
                                <Check className="w-4 h-4 mr-2 text-green-500 flex-shrink-0" />
                                <span>{feature}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t py-6">
        <div className="container mx-auto max-w-5xl px-4 md:px-6 flex flex-col md:flex-row justify-between items-center text-center md:text-left">
            <div className="mb-4 md:mb-0">
                <p className="text-xs sm:text-sm text-muted-foreground">&copy; 2025 Quickdesk. All rights reserved.</p>
                <p className="text-xs text-muted-foreground">A Product of Nextcore Technology Inc.</p>
            </div>
            <div>
                <a href="mailto:support@quickdesk-nti.com" className="text-xs sm:text-sm text-muted-foreground hover:underline">support@quickdesk-nti.com</a>
            </div>
        </div>
    </footer>
    </div>
  );
}
