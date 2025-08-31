
"use client";

import { SidebarTrigger } from './ui/sidebar';

export function Header() {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 md:hidden">
        <SidebarTrigger />
        <h1 className="text-lg font-bold">Mailflow Manager</h1>
    </header>
  );
}
