
"use client";

import { SidebarTrigger, RightSidebarTrigger } from './ui/sidebar';
import { Filter } from 'lucide-react';

type HeaderProps = {
  children?: React.ReactNode;
}

export function Header({ children }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b bg-background px-4">
        <div className="md:hidden">
            <SidebarTrigger />
        </div>
        {children}
        {/* The right sidebar trigger is removed as the right sidebar is no longer a sheet on mobile */}
        <div className="w-7 h-7 md:hidden" />
    </header>
  );
}
