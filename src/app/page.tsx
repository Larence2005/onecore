
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { useState } from 'react';
import { Menu, X, ArrowDown } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="fixed top-0 left-0 right-0 z-50 p-2 sm:p-4">
        <header
          className="container mx-auto max-w-5xl flex items-center justify-between h-14 md:h-16 px-4 md:px-6 bg-card/80 backdrop-blur-sm rounded-full shadow-md border">
          <Link href="#" className="flex items-center justify-center" prefetch={false}>
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
      <main className="flex-1">
        <section className="w-full h-screen flex flex-col items-center justify-center px-6">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-6">
                <h1
                  className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                  Streamline Your Customer Support
                </h1>
                <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
                  Quickdesk is a powerful and intuitive ticketing system designed to help you manage customer inquiries
                  with ease and efficiency.
                </p>
                <div className="flex flex-row items-center justify-center gap-4">
                  <Button asChild size="sm" variant="outline" className="border-black sm:h-10 sm:px-6">
                    <Link href="/login" prefetch={false}>
                      Login
                    </Link>
                  </Button>
                  <Button asChild size="sm" className="sm:h-10 sm:px-6">
                    <Link href="/signup" prefetch={false}>
                      Sign Up
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute bottom-10 animate-bounce">
            <ArrowDown className="h-8 w-8 text-muted-foreground" />
          </div>
        </section>

        <section id="about" className="w-full py-12 md:py-24 lg:py-32">
          <div className="container grid items-center gap-6 px-4 md:px-6 lg:grid-cols-2 lg:gap-12 mx-auto max-w-5xl">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">All-in-One Support Platform</h2>
              <p className="max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                From intelligent ticket routing to automated responses and a comprehensive analytics dashboard, Quickdesk provides everything your team needs to deliver exceptional customer service.
              </p>
              <ul className="grid gap-4">
                <li className="flex items-start gap-3">
                  <CheckCircleIcon className="mt-1 h-5 w-5 text-primary" />
                  <div>
                    <h3 className="font-semibold">Efficient Ticket Management</h3>
                    <p className="text-muted-foreground">Organize, prioritize, and assign tickets with ease.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircleIcon className="mt-1 h-5 w-5 text-primary" />
                  <div>
                    <h3 className="font-semibold">Seamless Client Communication</h3>
                    <p className="text-muted-foreground">Communicate via email and internal notes, all in one place.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircleIcon className="mt-1 h-5 w-5 text-primary" />
                  <div>
                    <h3 className="font-semibold">Powerful Automation</h3>
                    <p className="text-muted-foreground">Automate notifications, deadline reminders, and more.</p>
                  </div>
                </li>
              </ul>
            </div>
             <div className="w-4/5 mx-auto">
                <Image
                    src="/image1.png"
                    alt="Quickdesk Key Features"
                    width={500}
                    height={333}
                    className="overflow-hidden rounded-xl object-contain object-center sm:w-full"
                    unoptimized
                />
            </div>
          </div>
        </section>

        <section id="pricing" className="w-full py-12 md:py-24 lg:py-32 bg-muted">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-gray-100 px-3 py-1 text-sm dark:bg-gray-800">Pricing</div>
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">Simple, Transparent Pricing</h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  One plan with everything you need to deliver great support. No hidden fees.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl items-start gap-8 sm:max-w-4xl lg:max-w-5xl mt-12">
              <Card className="border-primary shadow-lg w-full max-w-lg mx-auto">
                <div className="p-6 md:p-8 grid md:grid-cols-2 md:items-center gap-6">
                    <div className="space-y-4 text-center md:text-left">
                        <div className="space-y-2">
                            <CardTitle className="text-2xl font-bold">All-in-One Plan</CardTitle>
                            <CardDescription>Perfect for teams of all sizes.</CardDescription>
                        </div>
                        <div className="flex justify-center md:justify-start items-baseline">
                            <span className="text-4xl font-bold">$10</span>
                            <span className="text-muted-foreground">/agent/month</span>
                        </div>
                    </div>
                    <div className="flex justify-center md:justify-end">
                      <Button asChild variant="outline" className="w-full md:w-auto">
                        <Link href="/pricing">Click for more detail</Link>
                      </Button>
                    </div>
                </div>
              </Card>
            </div>
          </div>
        </section>

      </main>
      <footer className="border-t py-6">
        <div className="container mx-auto max-w-5xl px-4 md:px-6 flex flex-col md:flex-row justify-between items-center text-center md:text-left">
            <div className="mb-4 md:mb-0">
                <p className="text-sm text-muted-foreground">&copy; 2025 Quickdesk. All rights reserved.</p>
                <p className="text-xs text-muted-foreground">A Product of Nextcore Technology Inc.</p>
            </div>
            <div>
                <a href="mailto:support@quickdesk-nti.com" className="text-sm text-muted-foreground hover:underline">support@quickdesk-nti.com</a>
            </div>
        </div>
    </footer>
    </div>
  );
}

function CheckCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}
