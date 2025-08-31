
"use client";

import { SidebarTrigger } from './ui/sidebar';

type HeaderProps = {
  children?: React.ReactNode;
}

export function Header({ children }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between gap-4 border-b bg-background px-4">
        <div className="flex items-center gap-2">
            <div className="lg:hidden">
                <SidebarTrigger />
            </div>
            {children}
        </div>
        <div className="w-7 h-7 md:hidden" />
    </header>
  );
}
