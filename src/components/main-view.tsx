
"use client";

import { ReadEmails } from '@/components/read-emails';
import { SettingsForm } from '@/components/settings-form';

type MainViewProps = {
    activeView: 'analytics' | 'tickets' | 'clients' | 'organization' | 'settings';
}

export function MainView({ activeView }: MainViewProps) {

    switch (activeView) {
        case 'analytics':
            return <div className="flex flex-1 items-center justify-center text-muted-foreground w-full h-full"><p>Analytics coming soon.</p></div>;
        case 'tickets':
            return <ReadEmails />;
        case 'clients':
            return <div className="flex flex-1 items-center justify-center text-muted-foreground w-full h-full"><p>Clients coming soon.</p></div>;
        case 'organization':
            return <div className="flex flex-1 items-center justify-center text-muted-foreground w-full h-full"><p>Organization coming soon.</p></div>;
        case 'settings':
            return <SettingsForm />;
        default:
            return <p>Select a view</p>;
    }
}
