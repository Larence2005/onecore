
"use client";

import { ReadEmails } from '@/components/read-emails';
import { SettingsForm } from '@/components/settings-form';

type MainViewProps = {
    activeView: 'analytics' | 'tickets' | 'clients' | 'organization' | 'settings';
}

export function MainView({ activeView }: MainViewProps) {
    const renderView = () => {
        switch (activeView) {
            case 'analytics':
                return <div className="flex flex-1 items-center justify-center text-muted-foreground w-full h-full p-4 sm:p-6 lg:p-8"><p>Analytics coming soon.</p></div>;
            case 'tickets':
                return <ReadEmails />;
            case 'clients':
                return <div className="flex flex-1 items-center justify-center text-muted-foreground w-full h-full p-4 sm:p-6 lg:p-8"><p>Clients coming soon.</p></div>;
            case 'organization':
                return <div className="flex flex-1 items-center justify-center text-muted-foreground w-full h-full p-4 sm:p-6 lg:p-8"><p>Organization coming soon.</p></div>;
            case 'settings':
                return <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8"><SettingsForm /></div>;
            default:
                return <p className="p-4 sm:p-6 lg:p-8">Select a view</p>;
        }
    };

    return (
        <div className="flex-1 flex flex-col overflow-y-auto">
            {renderView()}
        </div>
    );
}
