
"use client";

import { ReadEmails } from '@/components/read-emails';
import { SendEmailForm } from '@/components/send-email-form';
import { SettingsForm } from '@/components/settings-form';
import type { Email } from '@/app/actions';
import { FilterState } from './tickets-filter';
import { ArchiveView } from './archive-view';

type MainViewProps = {
    activeView: 'analytics' | 'tickets' | 'clients' | 'organization' | 'settings' | 'compose' | 'archive';
    emails?: Email[];
    isLoading?: boolean;
    error?: string | null;
    onRefresh?: () => void;
    filters?: FilterState;
}

export function MainView({ activeView, emails, isLoading, error, onRefresh, filters }: MainViewProps) {
    const renderView = () => {
        switch (activeView) {
            case 'analytics':
                return <div className="flex flex-1 items-center justify-center text-muted-foreground"><p>Analytics coming soon.</p></div>;
            case 'tickets':
                if (!emails || isLoading === undefined || error === undefined || !onRefresh || !filters) {
                    return null;
                }
                return <ReadEmails emails={emails} isLoading={isLoading} error={error} onRefresh={onRefresh} filters={filters} />;
            case 'clients':
                return <div className="flex flex-1 items-center justify-center text-muted-foreground"><p>Clients coming soon.</p></div>;
            case 'organization':
                return <div className="flex flex-1 items-center justify-center text-muted-foreground"><p>Organization coming soon.</p></div>;
            case 'settings':
                return <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8"><SettingsForm /></div>;
            case 'compose':
                return <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8"><SendEmailForm /></div>;
            case 'archive':
                return <ArchiveView />;
            default:
                return <div className="flex flex-1 items-center justify-center text-muted-foreground"><p>Select a view</p></div>;
        }
    };

    if (activeView === 'tickets' || activeView === 'archive') {
        return (
            <div className="flex-1 flex flex-col overflow-y-auto">
                {renderView()}
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-y-auto">
             <div className="flex flex-1 items-center justify-center">
                {renderView()}
            </div>
        </div>
    );
}

    