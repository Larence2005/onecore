
"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { getOrganizationMembers } from '@/app/actions';
import type { OrganizationMember } from '@/app/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, Users, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export function ClientsView() {
    const { userProfile } = useAuth();
    const [members, setMembers] = useState<OrganizationMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchMembers = async () => {
            if (userProfile?.organizationId) {
                setIsLoading(true);
                setError(null);
                try {
                    const orgMembers = await getOrganizationMembers(userProfile.organizationId);
                    setMembers(orgMembers);
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
                    setError(errorMessage);
                } finally {
                    setIsLoading(false);
                }
            } else {
                 setIsLoading(false);
            }
        };

        fetchMembers();
    }, [userProfile]);

    if (isLoading) {
        return (
            <Card className="w-full max-w-4xl">
                <CardHeader>
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64" />
                </CardHeader>
                <CardContent className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                           <div className="space-y-2">
                             <Skeleton className="h-5 w-32" />
                             <Skeleton className="h-4 w-40" />
                           </div>
                           <Skeleton className="h-6 w-6" />
                        </div>
                    ))}
                </CardContent>
            </Card>
        );
    }
    
    if (error) {
        return (
            <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }

    if (!userProfile?.organizationId) {
        return (
             <Alert>
                <Terminal className="h-4 w-4" />
                <AlertTitle>No Organization Found</AlertTitle>
                <AlertDescription>Create or join an organization to see clients.</AlertDescription>
            </Alert>
        )
    }

    return (
        <Card className="w-full max-w-4xl">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users /> Clients</CardTitle>
                <CardDescription>
                    A list of all assignees in your organization. Click on a client to view their profile and assigned tickets.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {members.length > 0 ? (
                    <div className="space-y-2">
                        {members.map(member => (
                            <Link href={`/clients/${encodeURIComponent(member.email)}`} key={member.email} className="block">
                                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted transition-colors">
                                    <div>
                                        <p className="font-medium">{member.name}</p>
                                        <p className="text-sm text-muted-foreground">{member.email}</p>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-10">
                        <p className="text-muted-foreground">No clients found in your organization.</p>
                        <p className="text-sm text-muted-foreground">You can add members in the Organization tab.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
