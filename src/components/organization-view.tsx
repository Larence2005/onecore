
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { createOrganization, addMemberToOrganization, getOrganizationMembers } from '@/app/actions';
import { RefreshCw, UserPlus, Users } from 'lucide-react';

export function OrganizationView() {
    const { user, userProfile, loading } = useAuth();
    const { toast } = useToast();
    const [organizationName, setOrganizationName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [newMemberEmail, setNewMemberEmail] = useState('');
    const [members, setMembers] = useState<string[]>([]);

    useEffect(() => {
        if (userProfile?.organizationId) {
            const fetchMembers = async () => {
                const orgMembers = await getOrganizationMembers(userProfile.organizationId!);
                setMembers(orgMembers);
            };
            fetchMembers();
        }
    }, [userProfile]);

    const handleCreateOrganization = async () => {
        if (!user || !organizationName.trim()) {
            toast({ variant: 'destructive', title: 'Organization name is required.' });
            return;
        }
        setIsCreating(true);
        try {
            await createOrganization(organizationName, user.uid, user.email!);
            toast({ title: 'Organization Created', description: `The organization "${organizationName}" has been created successfully.` });
            // The auth provider will pick up the change and update the profile
            window.location.reload(); // Quick way to refresh state, could be improved.
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ variant: 'destructive', title: 'Creation Failed', description: errorMessage });
        } finally {
            setIsCreating(false);
        }
    };

    const handleAddMember = async () => {
        if (!newMemberEmail.trim()) {
            toast({ variant: 'destructive', title: 'Member email is required.' });
            return;
        }
        setIsAddingMember(true);
        try {
            await addMemberToOrganization(userProfile!.organizationId!, newMemberEmail);
            toast({ title: 'Member Added', description: `${newMemberEmail} has been added to the organization.` });
            setMembers([...members, newMemberEmail]);
            setNewMemberEmail('');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ variant: 'destructive', title: 'Failed to Add Member', description: errorMessage });
        } finally {
            setIsAddingMember(false);
        }
    };
    
    if(loading) {
        return <p>Loading...</p>;
    }

    if (!userProfile?.organizationId) {
        return (
            <Card className="max-w-2xl w-full">
                <CardHeader>
                    <CardTitle className="font-headline">Create Organization</CardTitle>
                    <CardDescription>
                        You don't belong to an organization yet. Create one to get started.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="org-name">Organization Name</Label>
                        <Input 
                            id="org-name" 
                            placeholder="Your Company, Inc." 
                            value={organizationName}
                            onChange={(e) => setOrganizationName(e.target.value)}
                        />
                    </div>
                </CardContent>
                <CardFooter>
                     <Button onClick={handleCreateOrganization} disabled={isCreating}>
                        {isCreating && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                        Create Organization
                    </Button>
                </CardFooter>
            </Card>
        );
    }

    return (
        <div className="space-y-8 max-w-4xl w-full">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users /> {userProfile.organizationName || 'Your Organization'}</CardTitle>
                    <CardDescription>
                        Manage your organization's members. Members can be assigned to tickets.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <h3 className="font-semibold mb-4">Members ({members.length})</h3>
                    <div className="space-y-2">
                        {members.map((member, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md text-sm">
                               <span>{member}</span>
                            </div>
                        ))}
                        {members.length === 0 && <p className="text-sm text-muted-foreground">No members yet. Add one below.</p>}
                    </div>
                </CardContent>
            </Card>
            <Card>
                 <CardHeader>
                    <CardTitle className="flex items-center gap-2"><UserPlus /> Add New Member</CardTitle>
                    <CardDescription>
                        Add a new person to your organization.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="member-email">Member Email</Label>
                        <Input 
                            id="member-email" 
                            type="email"
                            placeholder="member@example.com" 
                            value={newMemberEmail}
                            onChange={(e) => setNewMemberEmail(e.target.value)}
                        />
                    </div>
                </CardContent>
                <CardFooter>
                     <Button onClick={handleAddMember} disabled={isAddingMember}>
                        {isAddingMember && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                        Add Member
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
