
"use client";

import { ReadEmails } from '@/components/read-emails';
import { SendEmailForm } from '@/components/send-email-form';
import { SettingsPage } from '@/components/settings-page';
import type { Email } from '@/app/actions-types';
import type { Company } from '@/app/actions-new';
import { FilterState } from './tickets-filter';
import { ArchiveView } from './archive-view';
import { DashboardView } from './dashboard-view';
import { OrganizationView } from './organization-view';
import { useAuth } from '@/providers/auth-provider-new';
import { ClientsView } from './clients-view';
import { DateRange } from 'react-day-picker';
import { CreateTicketForm } from './create-ticket-form';

type MainViewProps = {
    activeView: 'analytics' | 'tickets' | 'clients' | 'organization' | 'settings' | 'compose' | 'archive' | 'create-ticket';
    emails?: Email[];
    isLoading?: boolean;
    error?: string | null;
    onRefresh?: () => void;
    filters?: Omit<FilterState, 'groups'>;
    dashboardFilters?: {
        companies: Company[];
        selectedCompanyId: string;
        dateRangeOption: string;
        customDateRange?: DateRange;
    }
}

export function MainView({ activeView, emails, isLoading, error, onRefresh, filters, dashboardFilters }: MainViewProps) {
    const { userProfile } = useAuth();
    
    const renderView = () => {
        switch (activeView) {
            case 'analytics':
                 if (!dashboardFilters) return null;
                return <DashboardView {...dashboardFilters} />;
            case 'tickets':
                if (!emails || isLoading === undefined || error === undefined || !onRefresh || !filters) {
                    return null;
                }
                return <ReadEmails emails={emails} isLoading={isLoading} error={error} onRefresh={onRefresh} filters={filters} />;
            case 'clients':
                 return <div className="flex-1 flex justify-center p-4 sm:p-6 lg:p-8"><ClientsView /></div>;
            case 'organization':
                return <div className="flex-1 flex justify-center p-4 sm:p-6 lg:p-8"><OrganizationView /></div>;
            case 'settings':
                return <div className="flex-1 flex items-start justify-center p-4 sm:p-6"><SettingsPage /></div>;
            case 'compose':
                return <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8"><SendEmailForm /></div>;
            case 'create-ticket':
                return <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8"><CreateTicketForm /></div>;
            case 'archive':
                return <ArchiveView />;
            default:
                return <div className="flex flex-1 items-center justify-center text-muted-foreground"><p>Select a view</p></div>;
        }
    };

    if (activeView === 'tickets' || activeView === 'archive' || activeView === 'analytics' || activeView === 'settings') {
        return (
            <div className="flex-1 flex flex-col overflow-y-auto">
                {renderView()}
            </div>
        );
    }
    
    if (activeView === 'clients' || activeView === 'organization' ) {
         return (
            <div className="flex-1 flex flex-col overflow-y-auto pt-6">
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
