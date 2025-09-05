
"use client";

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';


export function ClientsView() {

    return (
        <Alert>
            <Terminal className="h-4 w-4" />
            <AlertTitle>Clients View</AlertTitle>
            <AlertDescription>
                This section is under construction. Member profiles can be accessed from the Organization page.
            </AlertDescription>
        </Alert>
    );
}
