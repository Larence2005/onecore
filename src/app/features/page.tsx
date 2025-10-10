
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { useState } from 'react';
import { Menu, X, Mail, Users, Building, Shield, Bell, Pencil, Activity, LayoutDashboard, AtSign } from 'lucide-react';

const features = [
  {
    icon: <Mail className="w-10 h-10 text-blue-500" />,
    title: "Multi-Channel Ticket Creation",
    description: "Create tickets via email or manually through the user interface, ensuring no customer query is missed. Quickdesk automatically imports and organizes emails into actionable tickets.",
    image: {
      src: "/MultiChannelTicketCreation.png",
      width: 600,
      height: 400
    },
  },
  {
    icon: <AtSign className="w-10 h-10 text-teal-500" />,
    title: "Dedicated Email Account",
    description: "Upon registration, get a dedicated Microsoft 365 email account for your support operations, ensuring a professional and centralized communication channel (e.g., support@your-company.quickdesk-nti.com).",
    image: {
        src: "/DedicatedEmailAccount.png",
        width: 600,
        height: 400
    },
  },
  {
    icon: <Building className="w-10 h-10 text-purple-500" />,
    title: "Client & Company Management",
    description: "Organize clients into companies to get a clear overview of all associated tickets, employees, and communication history. Keep your client relationships organized and accessible.",
    image: {
        src: "/Client&CompanyManagement.png",
        width: 600,
        height: 400
    },
  },
    {
    icon: <Users className="w-8 h-8 text-pink-500" />,
    title: "Agent Management",
    description: "Invite, manage, and assign roles to your support team members. Ensure the right agent is always on the right ticket with clear ownership and permissions.",
    image: {
      src: "/AgentManagement.png",
      width: 600,
      height: 400
    },
  },
  {
    icon: <Shield className="w-10 h-10 text-green-500" />,
    title: "Advanced Ticket Properties",
    description: "Manage tickets with assignees, status, priority, type, deadlines, and tags. Customize your workflow to fit your team's needs and track tickets from creation to resolution.",
    image: {
      src: "/AdvancedTicketProperties.png",
      width: 600,
      height: 400
    },
  },
  {
    icon: <Bell className="w-8 h-8 text-yellow-500" />,
    title: "Automated Notifications",
    description: "Keep everyone in the loop with automatic email alerts for ticket creation, assignments, status changes, and resolutions. Reduce manual work and ensure timely responses.",
    image: {
      src: "/AutomatedNotifications.png",
      width: 600,
      height: 400
    },
  },
    {
    icon: <Pencil className="w-8 h-8 text-orange-500" />,
    title: "Internal Notes",
    description: "Collaborate with your team by adding private, team-only notes to any ticket. Share information, ask questions, and resolve issues faster without the client seeing the internal chatter.",
    image: {
      src: "/InternalNotes.png",
      width: 600,
      height: 400
    },
  },
  {
    icon: <Activity className="w-8 h-8 text-red-500" />,
    title: "Activity Log",
    description: "Maintain a complete audit trail of every ticket. A detailed, chronological activity log tracks every single change, comment, and action from start to finish.",
    image: {
        src: "/ActivityLog.png",
        width: 600,
        height: 400
    },
  },
  {
    icon: <LayoutDashboard className="w-8 h-8 text-indigo-500" />,
    title: "Analytics Dashboard",
    description: "Get a high-level overview of your support operations with insightful charts and stats. Track key metrics like ticket volume, resolution times, and agent performance to make data-driven decisions.",
    image: {
      src: "/AnalyticsDashboard.png",
      width: 600,
      height: 400
    },
  },
];


export default function FeaturesPage() {
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
                  Features
                </h1>
                <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
                  Quickdesk is packed with powerful features to streamline your customer support workflow.
                </p>
            </div>
            <div className="mt-12 space-y-12">
                {features.map((feature, index) => (
                    <section key={index} className="w-full">
                        <div className="container grid items-center gap-6 px-4 md:px-6 lg:grid-cols-2 lg:gap-12 mx-auto max-w-5xl">
                           <div className={`space-y-4 ${index % 2 === 1 ? 'lg:order-last' : ''}`}>
                              <div className="flex items-center gap-4">
                                {feature.icon}
                                <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">{feature.title}</h2>
                              </div>
                              <p className="max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                                {feature.description}
                              </p>
                            </div>
                            <div className="w-full mx-auto">
                                <Image
                                    src={feature.image.src}
                                    alt={feature.title}
                                    width={feature.image.width}
                                    height={feature.image.height}
                                    className="overflow-hidden rounded-xl object-contain object-center border border-black"
                                    data-ai-hint={(feature.image as any)['data-ai-hint']}
                                    unoptimized
                                />
                            </div>
                        </div>
                    </section>
                ))}
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
