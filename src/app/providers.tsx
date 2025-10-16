
"use client";

import { AuthProvider as FirebaseAuthProvider } from "@/providers/auth-provider";

export function AuthProvider({ children }: { children: React.ReactNode }) {
    return (
        <FirebaseAuthProvider>
            {children}
        </FirebaseAuthProvider>
    );
}
