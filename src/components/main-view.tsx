
"use client";

import { Header } from '@/components/header';
import { ReadEmails } from '@/components/read-emails';
import { SettingsForm } from '@/components/settings-form';

type MainViewProps = {
    activeView: 'analytics' | 'tickets' | 'clients' | 'organization' | 'settings';
}

export function MainView({ activeView }: MainViewProps) {

    const renderActiveView = () => {
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
    };

    return (
        <div className="flex flex-col min-w-0">
            <Header />
            <main className="flex-1 flex flex-col overflow-y-auto">
                <div className="p-4 sm:p-6 lg:p-8 flex-grow">
                    {renderActiveView()}
                </div>
            </main>
        </div>
    );
}
