
"use client";

import { AuthProvider } from "@/providers/auth-provider";
import { SettingsProvider } from "@/providers/settings-provider";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <SettingsProvider>
                {children}
            </SettingsProvider>
        </AuthProvider>
    );
}
