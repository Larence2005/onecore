
"use client";

import { SidebarTrigger, RightSidebarTrigger } from './ui/sidebar';
import { Filter } from 'lucide-react';

type HeaderProps = {
  showFilterButton?: boolean;
}

export function Header({ showFilterButton = false }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 md:hidden">
        <SidebarTrigger />
        <h1 className="text-lg font-bold">Mailflow Manager</h1>
        {/* The right sidebar trigger is removed as the right sidebar is no longer a sheet on mobile */}
        <div className="w-7 h-7" />
    </header>
  );
}
