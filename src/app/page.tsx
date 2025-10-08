
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

export default function LandingPage() {
  return (
    (<div className="flex flex-col min-h-screen bg-background">
      <div className="fixed top-0 left-0 right-0 z-50 p-4">
        <header
          className="container mx-auto max-w-5xl flex items-center justify-between h-16 px-6 bg-card/80 backdrop-blur-sm rounded-full shadow-md border">
          <Link href="#" className="flex items-center justify-center" prefetch={false}>
            <Image src="/quickdesk_logowithtext_nobg.png" alt="Quickdesk Logo" width="150" height="75" unoptimized />
            <span className="sr-only">Quickdesk</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-4">
            <Button asChild variant="link" className="text-foreground">
              <Link href="#" prefetch={false}>
                About
              </Link>
            </Button>
            <Button asChild variant="link" className="text-foreground">
              <Link href="#" prefetch={false}>
                Features
              </Link>
            </Button>
            <Button asChild variant="link" className="text-foreground">
              <Link href="#" prefetch={false}>
                Privacy
              </Link>
            </Button>
            <Button asChild variant="link" className="text-foreground">
              <Link href="#" prefetch={false}>
                Terms and Policy
              </Link>
            </Button>
          </nav>
        </header>
      </div>
      <main className="flex-1 pt-24">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 px-6 lg:px-[20%]">
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
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Button asChild size="lg" variant="outline" className="border-black">
                    <Link href="/login" prefetch={false}>
                      Login
                    </Link>
                  </Button>
                  <Button asChild size="lg">
                    <Link href="/signup" prefetch={false}>
                      Sign Up
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer
        className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-6 lg:px-[20%] border-t">
        <p className="text-xs text-muted-foreground">&copy; 2025 Quickdesk. All rights reserved.</p>
      </footer>
    </div>)
  );
}
